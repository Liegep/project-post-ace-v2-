import assert from "node:assert/strict";
import test from "node:test";
import Fastify, { type FastifyInstance } from "fastify";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { uploadTracePluginRegistered } from "./upload-trace.js";
import { httpErrorsPluginRegistered } from "./http-errors.js";
import { uploadRoutes } from "../modules/uploads/uploads.routes.js";
const id = "12345678-1234-4234-8234-123456789abc";

test("upload arrival precedes auth; success/rejection metadata is bounded and contains no secrets", async () => {
  const logs: string[] = [];
  const dir = await mkdtemp(path.join(os.tmpdir(), "upload-trace-test-"));
  const app = Fastify({ logger: { stream: { write: (line: string) => { logs.push(line); } } } });
  app.decorate("appEnv", { UPLOAD_DIR: dir } as FastifyInstance["appEnv"]);
  await app.register(uploadTracePluginRegistered);
  await app.register(httpErrorsPluginRegistered);
  app.addHook("onRequest", async (request) => {
    if (request.headers.authorization === "Bearer reject-secret") throw app.httpErrors.forbidden("private-person-filename.png");
    request.auth = { user: { globalRole: "super_admin" } } as typeof request.auth;
  });
  await app.register(uploadRoutes, { prefix: "/api" });
  const multipart = (mime: string, data: Buffer) => ({ headers: { "x-upload-trace-id": id, authorization: "Bearer token-secret", cookie: "session=cookie-secret", "content-type": "multipart/form-data; boundary=test-boundary" }, payload: Buffer.concat([Buffer.from(`--test-boundary\r\nContent-Disposition: form-data; name="file"; filename="private-person-filename.png"\r\nContent-Type: ${mime}\r\n\r\n`), data, Buffer.from("\r\n--test-boundary--\r\n")]) });
  try {
    const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: "red" } }).png().toBuffer();
    const valid = await app.inject({ method: "POST", url: "/api/uploads?private-query=secret", ...multipart("image/png", png) });
    assert.equal(valid.statusCode, 200); assert.equal(valid.headers["x-upload-trace-id"], id);
    let events = logs.map(line => JSON.parse(line)).filter(line => line.event === "upload_trace");
    assert.equal(events.length, 2); assert.equal(events[0].stage, "received"); assert.equal(events[1].lastStage, "stored"); assert.equal(events[1].mime, "image/png"); assert.equal(events[1].bytes, png.length); assert.equal(events[1].status, 200);
    assert.ok(events[1].durationMs >= 0); assert.ok(events[0].utc.endsWith("Z"));
    const invalid = await app.inject({ method: "POST", url: "/api/uploads", ...multipart("text/private-person", Buffer.from("binary-secret")) });
    assert.equal(invalid.statusCode, 400);
    const denied = await app.inject({ method: "POST", url: "/api/uploads", headers: { authorization: "Bearer reject-secret", "x-upload-trace-id": id } });
    assert.equal(denied.statusCode, 403); assert.equal(denied.headers["x-upload-trace-id"], id);
    events = logs.map(line => JSON.parse(line)).filter(line => line.event === "upload_trace");
    assert.equal(events.at(-1).errorCode, "UPLOAD_FORBIDDEN"); assert.equal(events.at(-1).lastStage, "received");
    const corrupt = await app.inject({ method: "POST", url: "/api/uploads", ...multipart("image/png", Buffer.from("binary-secret")) });
    assert.equal(corrupt.statusCode, 400);
    const malicious = await app.inject({ method: "POST", url: "/api/uploads", headers: { "x-upload-trace-id": "person@example.test" } });
    assert.match(String(malicious.headers["x-upload-trace-id"]), /^[a-f0-9-]{36}$/);
    for (let n = 0; n < 65; n++) await app.inject({ method: "POST", url: "/api/uploads", headers: { authorization: "Bearer reject-secret", "x-upload-trace-id": id } });
    assert.equal(logs.map(line => JSON.parse(line)).filter(line => line.event === "upload_trace").length, 120);
    const serialized = logs.join("");
    for (const sensitive of ["token-secret", "cookie-secret", "reject-secret", "private-person", "binary-secret", "person@example.test", "private-query"]) assert.ok(!serialized.includes(sensitive), sensitive);
    const before = logs.map(line => JSON.parse(line)).filter(line => line.event === "upload_trace").length;
    await app.inject({ method: "GET", url: "/unrelated" });
    assert.equal(logs.map(line => JSON.parse(line)).filter(line => line.event === "upload_trace").length, before);
  } finally { await app.close(); await rm(dir, { recursive: true, force: true }); }
});
