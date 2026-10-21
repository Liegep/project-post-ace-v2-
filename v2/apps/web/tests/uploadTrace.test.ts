import assert from "node:assert/strict";
import test from "node:test";
import { getUploadTraces, tracedUpload } from "../src/uploadTrace.js";
const storage = new Map<string, string>();
Object.assign(globalThis, { sessionStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) }, window: new EventTarget() });
const file = new File(["secret-binary"], "private-person.png", { type: "image/png" });

test("success, rejection, network failure and replaced HTML preserve local attempt references", async () => {
  const ids: string[] = [];
  for (const kind of ["success", "rejected", "network", "html"] as const) {
    const transport = async (_url: string, init: RequestInit) => {
      const id = new Headers(init.headers).get("X-Upload-Trace-Id")!;
      ids.push(id); assert.equal(getUploadTraces().at(-1)?.id, id); assert.equal(getUploadTraces().at(-1)?.outcome, "pending");
      if (kind === "network") throw new TypeError("private-network-detail");
      if (kind === "html") return new Response("<html>" + "x".repeat(774) + "</html>", { status: 403, headers: { "content-type": "text/html" } });
      return new Response(JSON.stringify(kind === "success" ? { url: "/api/uploads/result.webp" } : { message: "private-server-detail" }), { status: kind === "success" ? 200 : 400 });
    };
    if (kind === "success") assert.equal(await tracedUpload(file, "/api/uploads", new Headers(), transport), "/api/uploads/result.webp");
    else await assert.rejects(tracedUpload(file, "/api/uploads", new Headers(), transport), error => error instanceof Error && error.message === "Não foi possível enviar o arquivo." && !error.message.includes(ids.at(-1)!));
    assert.equal(getUploadTraces().at(-1)?.id, ids.at(-1));
  }
  assert.equal(new Set(ids).size, 4);
  assert.equal(getUploadTraces().at(-1)?.status, 403);
  assert.ok(getUploadTraces().at(-1)!.utc.endsWith("Z"));
  assert.ok(!JSON.stringify([...storage.values()]).includes("private-person"));
  storage.set("designhub:upload-trace-header", "off");
  await assert.rejects(tracedUpload(file, "/api/uploads", new Headers(), async (_url, init) => { assert.equal(new Headers(init.headers).has("X-Upload-Trace-Id"), false); throw Error("network"); }));
  assert.equal(getUploadTraces().at(-1)?.headerSent, false);
  for (let n = 0; n < 25; n++) await assert.rejects(tracedUpload(file, "/api/uploads", new Headers(), async () => { throw Error("network"); }));
  assert.equal(getUploadTraces().length, 20);
});

test("old diagnostics remain technical only; normal error messages never expose ID or UTC", async () => {
  const old = { id: crypto.randomUUID(), utc: "2026-10-21T12:32:00.481Z", headerSent: true, status: 403, outcome: "http_error" };
  storage.set("designhub:upload-traces", JSON.stringify([old]));
  assert.equal(getUploadTraces()[0].id, old.id);
  storage.delete("designhub:upload-trace-header");
  for (const [status, message] of [[413, "O arquivo excede o limite permitido para este formato."], [403, "Não foi possível enviar o arquivo."]] as const) {
    await assert.rejects(tracedUpload(file, "/api/uploads", new Headers(), async (_url, init) => {
      assert.match(new Headers(init.headers).get("X-Upload-Trace-Id")!, /^[a-f0-9-]{36}$/);
      const sent = (init.body as FormData).get("file") as File;
      assert.match(sent.name, /^upload-[a-f0-9-]{36}\.png$/);
      return new Response("<html>failure</html>", { status });
    }), { message });
    const trace = getUploadTraces().at(-1)!;
    assert.equal(trace.status, status); assert.equal(trace.outcome, "http_error");
    assert.ok(trace.utc.endsWith("Z")); assert.ok(trace.headerSent);
  }
  assert.equal(getUploadTraces()[0].id, old.id);
});
