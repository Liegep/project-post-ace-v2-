import assert from "node:assert/strict";
import test from "node:test";
import Fastify, { type FastifyInstance } from "fastify";
import type { Pool } from "mysql2/promise";
import sharp from "sharp";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { uploadRoutes } from "../uploads/uploads.routes.js";
import { httpErrorsPluginRegistered } from "../../plugins/http-errors.js";

function payload(type: string, bytes: Buffer) {
  const boundary = "receipt-signature-boundary";
  return { headers: { "content-type": `multipart/form-data; boundary=${boundary}` }, payload: Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="signature"\r\nContent-Type: ${type}\r\n\r\n`), bytes, Buffer.from(`\r\n--${boundary}--\r\n`),
  ]) };
}

test("signature uploads validate images, retain alpha, use immutable storage, and require super admin", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "receipt-signature-"));
  let role = "super_admin";
  let signatureUrl: string | null = null;
  const app = Fastify();
  app.decorate("appEnv", { UPLOAD_DIR: directory } as FastifyInstance["appEnv"]);
  app.decorate("db", { query: async (_sql: string, values: unknown[]) => { signatureUrl = values[0] as string; return [{ affectedRows: 1 }, []]; } } as unknown as Pool);
  await app.register(httpErrorsPluginRegistered);
  app.addHook("onRequest", async (request) => { request.auth = { user: { globalRole: role } } as typeof request.auth; });
  await app.register(uploadRoutes, { prefix: "/api" });
  try {
    const transparent = await sharp({ create: { width: 200, height: 50, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.5 } } }).png().toBuffer();
    const first = await app.inject({ method: "POST", url: "/api/uploads/receipt-signature", ...payload("image/png", transparent) });
    assert.equal(first.statusCode, 200);
    const originalUrl = first.json().signatureUrl;
    assert.equal(signatureUrl, originalUrl);
    const firstBytes = await readFile(path.join(directory, path.basename(originalUrl)));
    const metadata = await sharp(firstBytes).metadata();
    assert.equal(metadata.hasAlpha, true);
    assert.equal(metadata.width, 200); assert.equal(metadata.height, 50);
    for (const [type, format] of [["image/jpeg", "jpeg"], ["image/webp", "webp"]] as const) {
      const bytes = await sharp(transparent).toFormat(format).toBuffer();
      const next = await app.inject({ method: "POST", url: "/api/uploads/receipt-signature", ...payload(type, bytes) });
      assert.equal(next.statusCode, 200); assert.notEqual(next.json().signatureUrl, originalUrl);
    }
    assert.deepEqual(await readFile(path.join(directory, path.basename(originalUrl))), firstBytes);
    for (const [type, bytes] of [["application/pdf", Buffer.from("pdf")], ["image/png", Buffer.from("corrupted")], ["image/png", await sharp(transparent).gif().toBuffer()]] as const) {
      const bad = await app.inject({ method: "POST", url: "/api/uploads/receipt-signature", ...payload(type, bytes) });
      assert.equal(bad.statusCode, 400);
    }
    role = "admin";
    const denied = await app.inject({ method: "POST", url: "/api/uploads/receipt-signature", ...payload("image/png", transparent) });
    assert.equal(denied.statusCode, 403);
    assert.equal((await readdir(directory)).length, 3);
    const publicRead = await app.inject({ method: "GET", url: originalUrl });
    assert.equal(publicRead.statusCode, 200);
  } finally { await app.close(); await rm(directory, { recursive: true, force: true }); }
});
