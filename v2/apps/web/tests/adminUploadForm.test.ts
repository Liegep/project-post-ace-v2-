import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { createAdminUploadForm } from "../src/adminUploadForm.js";

const originalNames = ["Imagem " + "nome longo; ".repeat(50) + ".png", "nome com espaços.png", "ação à noite.png", "qual imagem?.png", "arte; versão.final.png", "圖像 🌸 é Ж صورة.png"];

test("problematic names become short UUID filenames without changing PNG bytes, MIME or original File", async () => {
  const bytes = await sharp({ create: { width: 2, height: 2, channels: 4, background: "red" } }).png().toBuffer();
  const names = new Set<string>();
  for (const name of originalNames) {
    const file = new File([bytes], name, { type: "image/png", lastModified: 12345 });
    const body = await createAdminUploadForm(file);
    const sent = body.get("file") as File;
    assert.match(sent.name, /^upload-[a-f0-9-]{36}\.png$/);
    assert.ok(sent.name.length < 50); names.add(sent.name);
    assert.equal(file.name, name); assert.equal(file.lastModified, 12345);
    assert.equal(sent.type, file.type); assert.equal(sent.size, file.size);
    assert.deepEqual(Buffer.from(await sent.arrayBuffer()), bytes);
    // Verify the actual multipart serialization rather than only FormData getters.
    const wire = Buffer.from(await new Response(body).arrayBuffer());
    assert.ok(wire.includes(Buffer.from(`filename="${sent.name}"`)));
    assert.ok(wire.includes(bytes)); assert.ok(!wire.includes(Buffer.from(name)));
    assert.ok(wire.includes(Buffer.from("Content-Type: image/png")));
  }
  assert.equal(names.size, originalNames.length);
});

test("supported image, video and PDF formats retain content and MIME with matching technical extensions", async () => {
  const seed = sharp({ create: { width: 1, height: 1, channels: 3, background: "blue" } });
  const cases: Array<[string, string, Buffer]> = [
    ["image/png", "png", await seed.clone().png().toBuffer()],
    ["image/jpeg", "jpg", await seed.clone().jpeg().toBuffer()],
    ["image/webp", "webp", await seed.clone().webp().toBuffer()],
    ["image/gif", "gif", await seed.clone().gif().toBuffer()],
    ["video/mp4", "mp4", Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(20)])],
    ["video/quicktime", "mov", Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypqt  "), Buffer.alloc(20)])],
    ["video/webm", "webm", Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d])],
    ["application/pdf", "pdf", Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF")],
  ];
  for (const [mime, extension, bytes] of cases) {
    const file = new File([bytes], "wrong;長い?.txt", { type: mime });
    const sent = (await createAdminUploadForm(file)).get("file") as File;
    assert.ok(sent.name.endsWith(`.${extension}`)); assert.equal(sent.type, mime);
    assert.deepEqual(Buffer.from(await sent.arrayBuffer()), bytes);
  }
});

test("signature takes precedence over misleading names/MIME; unknown files are not converted or accepted by the helper", async () => {
  const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: "red" } }).png().toBuffer();
  const sent = (await createAdminUploadForm(new File([png], "fake.jpg", { type: "image/jpeg" }))).get("file") as File;
  assert.ok(sent.name.endsWith(".png")); assert.equal(sent.type, "image/jpeg");
  const unknown = (await createAdminUploadForm(new File(["unknown"], "pretend.png", { type: "application/octet-stream" }))).get("file") as File;
  assert.ok(unknown.name.endsWith(".bin")); assert.equal(await unknown.text(), "unknown");
  const empty = (await createAdminUploadForm(new File([], "empty.png", { type: "image/png" }))).get("file") as File;
  assert.equal(empty.size, 0); assert.ok(empty.name.endsWith(".png"));
});

test("administrative flows use shared normalization; portal and shared brief attachments keep their original paths", () => {
  const api = readFileSync(new URL("../src/api.ts", import.meta.url), "utf8");
  const trace = readFileSync(new URL("../src/uploadTrace.ts", import.meta.url), "utf8");
  assert.match(api.slice(api.indexOf("export async function uploadAdminMedia"), api.indexOf("export async function uploadPortalMediaBySlug")), /return tracedUpload/);
  assert.match(trace, /await createAdminUploadForm\(file\)/);
  assert.match(api.slice(api.indexOf("export async function uploadReceiptSignature"), api.indexOf("export async function generateCurrentRecurringInvoices")), /await createAdminUploadForm\(file\)/);
  assert.match(api.slice(api.indexOf("export async function uploadPortalMediaBySlug"), api.indexOf("export async function createPortalPostBySlug")), /body.set\("file", file\)/);
  assert.match(api, /data.append\("file",file\)/);
});

test("normalized multipart preserves API image conversion and video/PDF passthrough", async () => {
  const { default: Fastify } = await import("fastify");
  const { mkdtemp, readFile, rm } = await import("node:fs/promises");
  const { default: os } = await import("node:os");
  const { default: path } = await import("node:path");
  const { uploadRoutes } = await import("../../api/src/modules/uploads/uploads.routes.js");
  const { httpErrorsPluginRegistered } = await import("../../api/src/plugins/http-errors.js");
  const dir = await mkdtemp(path.join(os.tmpdir(), "admin-upload-name-"));
  const app = Fastify();
  app.decorate("appEnv", { UPLOAD_DIR: dir } as typeof app.appEnv);
  await app.register(httpErrorsPluginRegistered);
  app.addHook("onRequest", async request => { request.auth = { user: { globalRole: "super_admin" } } as typeof request.auth; });
  await app.register(uploadRoutes, { prefix: "/api" });
  const seed = sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } });
  const cases: Array<[string, Buffer, boolean]> = [
    ["image/png", await seed.clone().png().toBuffer(), true],
    ["image/jpeg", await seed.clone().jpeg().toBuffer(), true],
    ["image/webp", await seed.clone().webp().toBuffer(), true],
    ["image/gif", await seed.clone().gif().toBuffer(), true],
    ["video/mp4", Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(20)]), false],
    ["video/quicktime", Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypqt  "), Buffer.alloc(20)]), false],
    ["video/webm", Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d]), false],
    ["application/pdf", Buffer.from("%PDF-1.4\n%%EOF"), false],
  ];
  async function send(mime: string, bytes: Buffer) {
    const body = await createAdminUploadForm(new File([bytes], originalNames[0], { type: mime }));
    const wire = new Response(body);
    return app.inject({ method: "POST", url: "/api/uploads", headers: { "content-type": wire.headers.get("content-type")! }, payload: Buffer.from(await wire.arrayBuffer()) });
  }
  try {
    for (const [mime, bytes, image] of cases) {
      const response = await send(mime, bytes);
      assert.equal(response.statusCode, 200, mime);
      const stored = await readFile(path.join(dir, path.basename(response.json().url)));
      if (image) assert.equal((await sharp(stored).metadata()).format, "webp");
      else assert.deepEqual(stored, bytes);
    }
    assert.equal((await send("image/png", Buffer.from("invalid"))).statusCode, 400);
  } finally { await app.close(); await rm(dir, { recursive: true, force: true }); }
});
