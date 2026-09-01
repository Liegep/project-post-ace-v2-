import crypto from "node:crypto";
import { open, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import jwt from "jsonwebtoken";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { loadEnv } from "../config/env.js";

type ManifestObject = { bucket: string; path: string; size: number; mimeType: string | null };
type Manifest = { objects: ManifestObject[] };
type UploadState = { completed: string[]; failed: Array<{ key: string; error: string }> };

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function extensionOf(filePath: string) {
  const extension = path.extname(filePath).slice(1).toLowerCase();
  if (!["webp", "png", "jpg", "jpeg", "mp4", "webm", "mov", "pdf", "svg"].includes(extension)) {
    throw new Error(`Extensão legada não suportada: ${filePath}`);
  }
  return extension;
}

function encodedObjectKey(object: ManifestObject) {
  return Buffer.from(`${object.bucket}/${object.path}`, "utf8").toString("base64url");
}

function destinationUrl(object: ManifestObject) {
  const extension = extensionOf(object.path);
  const digest = crypto.createHash("sha256").update(`${encodedObjectKey(object)}|${extension}`).digest("hex");
  return `/api/uploads/${digest}.${extension}`;
}

function legacyObjectFromUrl(value: string) {
  try {
    const url = new URL(value);
    const marker = "/storage/v1/object/public/";
    const index = url.pathname.indexOf(marker);
    if (index < 0) return null;
    const parts = decodeURIComponent(url.pathname.slice(index + marker.length)).split("/");
    const bucket = parts.shift();
    return bucket && parts.length ? `${bucket}/${parts.join("/")}` : null;
  } catch {
    return null;
  }
}

async function postChunk(input: {
  apiBase: string; token: string; object: ManifestObject; buffer: Buffer; index: number; total: number; offset: number;
}) {
  const extension = extensionOf(input.object.path);
  const form = new FormData();
  form.append("file", new Blob([Uint8Array.from(input.buffer)]), `chunk-${input.index}.bin`);
  let lastError = "Falha desconhecida";
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(`${input.apiBase}/api/uploads/legacy-import`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${input.token}`,
          "x-legacy-object-key": encodedObjectKey(input.object),
          "x-legacy-extension": extension,
          "x-legacy-chunk-index": String(input.index),
          "x-legacy-chunk-total": String(input.total),
          "x-legacy-offset": String(input.offset),
          "x-legacy-total-size": String(input.object.size),
        },
        body: form,
      });
      if (response.ok) return;
      lastError = `HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`;
      if (response.status < 500 && response.status !== 429) break;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 1_500));
  }
  throw new Error(lastError);
}

async function uploadObject(apiBase: string, token: string, backupDir: string, object: ManifestObject) {
  const chunkSize = 8 * 1024 * 1024;
  const total = Math.max(1, Math.ceil(object.size / chunkSize));
  const source = path.join(backupDir, object.bucket, object.path);
  const handle = await open(source, "r");
  try {
    for (let index = 0; index < total; index += 1) {
      const offset = index * chunkSize;
      const length = Math.min(chunkSize, object.size - offset);
      const buffer = Buffer.allocUnsafe(length);
      const { bytesRead } = await handle.read(buffer, 0, length, offset);
      if (bytesRead !== length) throw new Error(`Leitura incompleta (${bytesRead}/${length}).`);
      await postChunk({ apiBase, token, object, buffer, index, total, offset });
    }
  } finally {
    await handle.close();
  }
}

function replaceUrl(value: string | null, mapping: Map<string, string>) {
  if (!value) return value;
  const key = legacyObjectFromUrl(value);
  return key ? mapping.get(key) ?? value : value;
}

function replaceJsonUrls(value: unknown, mapping: Map<string, string>): unknown {
  if (typeof value === "string") return replaceUrl(value, mapping);
  if (Array.isArray(value)) return value.map((item) => replaceJsonUrls(item, mapping));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceJsonUrls(item, mapping)]));
  }
  return value;
}

async function main() {
  const backupDir = path.resolve(argument("--backup-dir") ?? "");
  const apiBase = (argument("--api-base") ?? "").replace(/\/$/, "");
  if (!backupDir || !apiBase) throw new Error("Use --backup-dir e --api-base.");
  const manifest = JSON.parse(await readFile(path.join(backupDir, "manifest.json"), "utf8")) as Manifest;
  const statePath = path.join(backupDir, "legacy-media-upload-state.json");
  let state: UploadState = { completed: [], failed: [] };
  try { state = JSON.parse(await readFile(statePath, "utf8")) as UploadState; } catch { /* First run. */ }
  const completed = new Set(state.completed);

  const env = loadEnv();
  const db = mysql.createPool({ host: env.DB_HOST, port: env.DB_PORT, user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME, connectionLimit: 2 });
  const [admins] = await db.query<Array<RowDataPacket & { id: string }>>("SELECT id FROM users WHERE global_role = 'super_admin' AND is_active = 1 ORDER BY created_at ASC LIMIT 1");
  if (!admins[0]) throw new Error("Nenhum super admin ativo foi encontrado.");
  const token = jwt.sign({ sub: admins[0].id, role: "super_admin", type: "access" }, env.JWT_SECRET, { expiresIn: "12h" });

  let uploadedNow = 0;
  const failures: UploadState["failed"] = [];
  for (const object of manifest.objects) {
    const key = `${object.bucket}/${object.path}`;
    if (completed.has(key)) continue;
    try {
      await uploadObject(apiBase, token, backupDir, object);
      completed.add(key);
      uploadedNow += 1;
      await writeFile(statePath, JSON.stringify({ completed: [...completed], failed: failures }, null, 2));
      if (completed.size % 50 === 0) console.log(`Arquivos transferidos: ${completed.size}/${manifest.objects.length}`);
    } catch (error) {
      failures.push({ key, error: error instanceof Error ? error.message : String(error) });
      console.error(`Falha em ${key}: ${failures.at(-1)?.error}`);
    }
  }
  if (failures.length) {
    await writeFile(statePath, JSON.stringify({ completed: [...completed], failed: failures }, null, 2));
    throw new Error(`${failures.length} arquivos não foram transferidos; execute novamente para tentar apenas os pendentes.`);
  }

  const mapping = new Map(manifest.objects.map((object) => [`${object.bucket}/${object.path}`, destinationUrl(object)]));
  const connection = await db.getConnection();
  let updatedReferences = 0;
  try {
    await connection.beginTransaction();
    const simpleColumns = [["client_accounts", "logo_url"], ["users", "avatar_url"]] as const;
    for (const [table, column] of simpleColumns) {
      const [rows] = await connection.query<Array<RowDataPacket & { id: string; value: string | null }>>(`SELECT id, ${column} AS value FROM ${table}`);
      for (const row of rows) {
        const next = replaceUrl(row.value, mapping);
        if (next !== row.value) { await connection.query(`UPDATE ${table} SET ${column} = ? WHERE id = ?`, [next, row.id]); updatedReferences += 1; }
      }
    }
    const jsonColumns = [["kanban_cards", "media_urls_json"], ["card_calendar_events", "media_urls_json"], ["client_reports", "evidence_urls_json"]] as const;
    for (const [table, column] of jsonColumns) {
      const [rows] = await connection.query<Array<RowDataPacket & { id: string; value: unknown }>>(`SELECT id, ${column} AS value FROM ${table}`);
      for (const row of rows) {
        let parsed: unknown = row.value ?? [];
        if (typeof row.value === "string") {
          try { parsed = JSON.parse(row.value); } catch { parsed = []; }
        }
        const next = replaceJsonUrls(parsed, mapping);
        if (JSON.stringify(next) !== JSON.stringify(parsed)) { await connection.query(`UPDATE ${table} SET ${column} = ? WHERE id = ?`, [JSON.stringify(next), row.id]); updatedReferences += 1; }
      }
    }
    const [cards] = await connection.query<Array<RowDataPacket & { id: string; value: string | null }>>("SELECT id, primary_media_url AS value FROM kanban_cards");
    for (const row of cards) {
      const next = replaceUrl(row.value, mapping);
      if (next !== row.value) { await connection.query("UPDATE kanban_cards SET primary_media_url = ? WHERE id = ?", [next, row.id]); updatedReferences += 1; }
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await db.end();
  }
  console.log(JSON.stringify({ totalFiles: manifest.objects.length, uploadedNow, alreadyUploaded: manifest.objects.length - uploadedNow, updatedReferences }, null, 2));
}

main().catch((error) => { console.error("[migrate-legacy-media]", error instanceof Error ? error.message : error); process.exitCode = 1; });
