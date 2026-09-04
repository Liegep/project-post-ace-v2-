import crypto from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type LegacyAttachment = {
  file_name?: string | null;
  file_url?: string | null;
};

type ManifestObject = {
  bucket: string;
  path: string;
  size: number;
  mimeType: string | null;
  sha256: string;
};

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function objectFromPublicUrl(value: string) {
  const url = new URL(value);
  const marker = "/storage/v1/object/public/";
  const index = url.pathname.indexOf(marker);
  if (index < 0) throw new Error(`URL de anexo não pertence ao storage público: ${value}`);
  const parts = decodeURIComponent(url.pathname.slice(index + marker.length)).split("/");
  const bucket = parts.shift();
  if (!bucket || !parts.length) throw new Error(`Caminho de anexo inválido: ${value}`);
  const objectPath = parts.join("/");
  if (parts.some((part) => part === "..")) throw new Error(`Caminho inseguro no anexo: ${value}`);
  return { bucket, path: objectPath };
}

function downloadCandidates(value: string) {
  const candidates = [value];
  // Some legacy rows contain an already encoded filename that was encoded again.
  // Supabase expects the single-encoded variant when serving the public object.
  if (/%25[0-9a-f]{2}/i.test(value)) candidates.push(value.replace(/%25([0-9a-f]{2})/gi, "%$1"));
  return candidates;
}

async function download(value: string) {
  let lastError = "falha desconhecida";
  for (const candidate of downloadCandidates(value)) {
    try {
      const response = await fetch(candidate);
      if (!response.ok) {
        lastError = `HTTP ${response.status}`;
        continue;
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get("content-type");
      if (!buffer.length) throw new Error("arquivo vazio");
      if (contentType?.includes("application/json")) throw new Error("o storage devolveu JSON em vez do arquivo");
      return { buffer, contentType };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(lastError);
}

async function main() {
  const input = path.resolve(argument("--input") ?? "");
  const output = path.resolve(argument("--output") ?? "");
  if (!input || !output) throw new Error("Use --input e --output.");

  const rows = JSON.parse(await readFile(input, "utf8")) as LegacyAttachment[];
  const unique = new Map<string, { url: string; bucket: string; path: string }>();
  for (const row of rows) {
    if (!row.file_url) continue;
    const object = objectFromPublicUrl(row.file_url);
    unique.set(`${object.bucket}/${object.path}`, { url: row.file_url, ...object });
  }

  const objects: ManifestObject[] = [];
  for (const [index, object] of [...unique.values()].entries()) {
    const { buffer, contentType } = await download(object.url);
    const destination = path.join(output, object.bucket, object.path);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, buffer);
    objects.push({
      bucket: object.bucket,
      path: object.path,
      size: buffer.length,
      mimeType: contentType,
      sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
    });
    console.log(`Anexo copiado: ${index + 1}/${unique.size}`);
  }

  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, "manifest.json"), JSON.stringify({ objects }, null, 2));
  console.log(JSON.stringify({ attachments: objects.length, bytes: objects.reduce((sum, item) => sum + item.size, 0) }, null, 2));
}

main().catch((error) => {
  console.error("[backup-legacy-invoice-attachments]", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
