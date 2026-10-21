import assert from "node:assert/strict";
import test from "node:test";
import { getUploadTraces, tracedUpload, uploadReference } from "../src/uploadTrace.js";
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
    else await assert.rejects(tracedUpload(file, "/api/uploads", new Headers(), transport), error => error instanceof Error && error.message.includes(ids.at(-1)!) && !error.message.includes("private-"));
    assert.equal(getUploadTraces().at(-1)?.id, ids.at(-1));
  }
  assert.equal(new Set(ids).size, 4);
  assert.equal(getUploadTraces().at(-1)?.status, 403);
  assert.ok(uploadReference(getUploadTraces().at(-1)!).includes("Z"));
  assert.ok(!JSON.stringify([...storage.values()]).includes("private-person"));
  storage.set("designhub:upload-trace-header", "off");
  await assert.rejects(tracedUpload(file, "/api/uploads", new Headers(), async (_url, init) => { assert.equal(new Headers(init.headers).has("X-Upload-Trace-Id"), false); throw Error("network"); }));
  assert.equal(getUploadTraces().at(-1)?.headerSent, false);
  for (let n = 0; n < 25; n++) await assert.rejects(tracedUpload(file, "/api/uploads", new Headers(), async () => { throw Error("network"); }));
  assert.equal(getUploadTraces().length, 20);
});

test("failure notice restores the saved reference and copies ID plus UTC time", async () => {
  const { JSDOM } = await import("jsdom");
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { UploadTraceNotice } = await import("../src/UploadTraceNotice.js");
  const dom = new JSDOM("<div id='test-root'></div>", { url: "https://local.invalid" });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  let copied = "";
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { clipboard: { writeText: async (value: string) => { copied = value; } } } });
  const root = createRoot(document.getElementById("test-root")!);
  try {
    await React.act(async () => root.render(React.createElement(UploadTraceNotice)));
    assert.ok(document.body.textContent?.includes("Consultar referência"));
    const button = [...document.querySelectorAll("button")].find(node => node.textContent === "Copiar referência")!;
    await React.act(async () => button.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })));
    assert.equal(copied, uploadReference(getUploadTraces().at(-1)!));
    assert.ok(document.body.textContent?.includes("Referência copiada"));
  } finally { await React.act(async () => root.unmount()); dom.window.close(); }
});
