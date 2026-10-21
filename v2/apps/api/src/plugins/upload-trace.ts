import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import fp from "fastify-plugin";
import type { FastifyInstance, FastifyRequest } from "fastify";

const states = new WeakMap<FastifyRequest, { id: string; start: number; sampled: boolean; stage: string; mime: string | null; bytes: number | null; error: string | null; finished: boolean }>();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const knownMime = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm", "video/quicktime", "application/pdf"]);
export function uploadTraceStage(request: FastifyRequest, stage: "multipart" | "file_received" | "converting" | "storing" | "stored", mime?: string, bytes?: number) {
  const state = states.get(request);
  if (!state) return;
  state.stage = stage;
  if (mime !== undefined) {
    const normalized = mime.split(";", 1)[0].trim().toLowerCase();
    state.mime = knownMime.has(normalized) ? normalized : "other";
  }
  if (bytes !== undefined && Number.isSafeInteger(bytes) && bytes >= 0) state.bytes = bytes;
}
function errorCode(status: number) {
  return status === 401 ? "UPLOAD_UNAUTHORIZED" : status === 403 ? "UPLOAD_FORBIDDEN" : status === 413 ? "UPLOAD_TOO_LARGE" : status >= 500 ? "UPLOAD_INTERNAL" : status >= 400 ? "UPLOAD_REJECTED" : null;
}
async function uploadTracePlugin(app: FastifyInstance) {
  // Two records per sampled attempt, at most 60 sampled attempts per minute per
  // instance. Counters only: no intervals, background jobs, or growing ID map.
  let windowStart = Date.now();
  let attempts = 0;
  app.addHook("onRoute", options => {
    if (options.url === "/api/uploads" && (options.method === "POST" || Array.isArray(options.method) && options.method.includes("POST"))) {
      // Dedicated allowlisted records replace automatic request/error logs here,
      // which could otherwise include a query string or an error with a filename.
      options.logLevel = "silent";
    }
  });
  app.addHook("onRequest", async (request, reply) => {
    if (request.method !== "POST" || request.url.split("?", 1)[0] !== "/api/uploads") return;
    if (Date.now() - windowStart >= 60_000) { windowStart = Date.now(); attempts = 0; }
    const incoming = request.headers["x-upload-trace-id"];
    const id = typeof incoming === "string" && uuid.test(incoming) ? incoming.toLowerCase() : randomUUID();
    const state = { id, start: performance.now(), sampled: attempts++ < 60, stage: "received", mime: null, bytes: null, error: null, finished: false };
    states.set(request, state);
    reply.header("X-Upload-Trace-Id", id);
    if (state.sampled) app.log.info({ event: "upload_trace", uploadTraceId: id, utc: new Date().toISOString(), method: "POST", route: "/api/uploads", stage: "received" }, "Upload diagnostic");
  });
  app.addHook("onError", async (request, _reply, error) => {
    const state = states.get(request);
    if (state) state.error = errorCode(error.statusCode ?? 500);
  });
  const finish = (request: FastifyRequest, status: number | null) => {
    const state = states.get(request);
    if (!state || state.finished) return;
    state.finished = true;
    if (state.sampled) app.log.info({ event: "upload_trace", uploadTraceId: state.id, utc: new Date().toISOString(), method: "POST", route: "/api/uploads", stage: status === null ? "aborted" : "completed", lastStage: state.stage, status, durationMs: Math.round(performance.now() - state.start), mime: state.mime, bytes: state.bytes, errorCode: status === null ? "UPLOAD_ABORTED" : state.error ?? errorCode(status) }, "Upload diagnostic");
  };
  app.addHook("onResponse", async (request, reply) => { finish(request, reply.statusCode); });
  app.addHook("onRequestAbort", async request => { finish(request, null); });
}
export const uploadTracePluginRegistered = fp(uploadTracePlugin, { name: "upload-trace-plugin" });
