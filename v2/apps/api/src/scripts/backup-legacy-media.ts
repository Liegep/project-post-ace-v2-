import crypto from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

type LegacyMediaRow = { url?: string | null };
type SourceObject = { url: string; bucket: string; path: string };
type ManifestObject = SourceObject & { size: number; mimeType: string | null; sha256: string };
type BackupState = { objects: ManifestObject[]; failed: Array<{ key: string; error: string }> };

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function objectFromPublicUrl(value: string): SourceObject | null {
  const url = new URL(value);
  const marker = "/storage/v1/object/public/";
  const index = url.pathname.indexOf(marker);
  if (index < 0) return null;
  const parts = decodeURIComponent(url.pathname.slice(index + marker.length)).split("/");
  const bucket = parts.shift();
  if (!bucket || !parts.length || parts.some((part) => !part || part === "." || part === "..")) return null;
  return { url: value, bucket, path: parts.join("/") };
}

function downloadCandidates(value: string) {
  const candidates = [value];
  if (/%25[0-9a-f]{2}/i.test(value)) candidates.push(value.replace(/%25([0-9a-f]{2})/gi, "%$1"));
  return candidates;
}

async function checksum(filePath: string) {
  const hash = crypto.createHash("sha256");
  await pipeline(createReadStream(filePath), hash);
  return hash.digest("hex");
}

async function download(object: SourceObject, output: string): Promise<ManifestObject> {
  const destination = path.join(output, object.bucket, object.path);
  const temporary = `${destination}.partial`;
  await mkdir(path.dirname(destination), { recursive: true });
  let lastError = "falha desconhecida";

  for (const candidate of downloadCandidates(object.url)) {
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      try {
        const response = await fetch(candidate);
        if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("application/json")) throw new Error("o storage devolveu JSON em vez do arquivo");
        await pipeline(Readable.fromWeb(response.body as never), createWriteStream(temporary));
        const file = await stat(temporary);
        if (!file.size) throw new Error("arquivo vazio");
        await rename(temporary, destination);
        return { ...object, size: file.size, mimeType: contentType, sha256: await checksum(destination) };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        await unlink(temporary).catch(() => undefined);
        if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
      }
    }
  }
  throw new Error(lastError);
}

async function main() {
  const input = path.resolve(argument("--input") ?? "");
  const output = path.resolve(argument("--output") ?? "");
  const concurrency = Math.max(1, Math.min(8, Number(argument("--concurrency") ?? 4)));
  if (!input || !output) throw new Error("Use --input e --output.");

  const rows = JSON.parse(await readFile(input, "utf8")) as LegacyMediaRow[];
  const unique = new Map<string, SourceObject>();
  let externalUrls = 0;
  for (const row of rows) {
    if (!row.url) continue;
    const object = objectFromPublicUrl(row.url);
    if (!object) { externalUrls += 1; continue; }
    unique.set(`${object.bucket}/${object.path}`, object);
  }

  await mkdir(output, { recursive: true });
  const manifestPath = path.join(output, "manifest.json");
  let previous: BackupState = { objects: [], failed: [] };
  try { previous = JSON.parse(await readFile(manifestPath, "utf8")) as BackupState; } catch { /* First run. */ }
  const completed = new Map(previous.objects.map((object) => [`${object.bucket}/${object.path}`, object]));
  const pending = [...unique.entries()].filter(([key]) => !completed.has(key));
  const failed: BackupState["failed"] = [];
  let cursor = 0;

  async function persist() {
    await writeFile(manifestPath, JSON.stringify({ objects: [...completed.values()], failed }, null, 2));
  }

  async function worker() {
    while (cursor < pending.length) {
      const current = cursor;
      cursor += 1;
      const [key, object] = pending[current];
      try {
        const result = await download(object, output);
        completed.set(key, result);
        if (completed.size % 25 === 0 || completed.size === unique.size) {
          await persist();
          console.log(`Arquivos preservados: ${completed.size}/${unique.size}`);
        }
      } catch (error) {
        failed.push({ key, error: error instanceof Error ? error.message : String(error) });
        console.error(`Falha em ${key}: ${failed.at(-1)?.error}`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  await persist();
  const objects = [...completed.values()];
  console.log(JSON.stringify({
    storageObjects: unique.size,
    backedUp: objects.length,
    failed: failed.length,
    externalUrlsPreservedAsLinks: externalUrls,
    bytes: objects.reduce((sum, item) => sum + item.size, 0),
  }, null, 2));
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error("[backup-legacy-media]", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
