import { createAdminUploadForm } from "./adminUploadForm";
export type UploadTrace = { id: string; utc: string; headerSent: boolean; status: number | null; outcome: "pending" | "success" | "http_error" | "network_error" | "invalid_response" };
const key = "designhub:upload-traces";
let traces: UploadTrace[] = [];
export function getUploadTraces(): UploadTrace[] {
  try { const saved = JSON.parse(sessionStorage.getItem(key) ?? "[]"); if (Array.isArray(saved)) traces = saved.filter(t => t && /^[0-9a-f-]{36}$/.test(t.id) && typeof t.utc === "string").slice(-20).map(t => ({ id: t.id, utc: t.utc, headerSent: t.headerSent === true, status: Number.isInteger(t.status) ? t.status : null, outcome: ["pending", "success", "http_error", "network_error", "invalid_response"].includes(t.outcome) ? t.outcome : "invalid_response" })); } catch { /* In-memory fallback when storage is unavailable. */ }
  return traces.map(t => ({ ...t }));
}
function save(trace: UploadTrace) {
  traces = [...traces.filter(t => t.id !== trace.id), { ...trace }].slice(-20);
  try { sessionStorage.setItem(key, JSON.stringify(traces)); } catch { /* Uploads do not depend on storage. */ }
}
export async function tracedUpload(file: File, url: string, headers: Headers, transport: (url: string, init: RequestInit) => Promise<Response>): Promise<string> {
  getUploadTraces();
  // Diagnostic opt-out only; never retry a POST automatically. Useful when the
  // host asks for comparison without a custom header. Local time/ID still exist.
  let headerSent = true;
  try { headerSent = sessionStorage.getItem("designhub:upload-trace-header") !== "off"; } catch { /* Default to header. */ }
  const trace: UploadTrace = { id: crypto.randomUUID(), utc: new Date().toISOString(), headerSent, status: null, outcome: "pending" };
  if (headerSent) headers.set("X-Upload-Trace-Id", trace.id);
  save(trace); // Before fetch; does not depend on any response/header.
  let message = "Não foi possível enviar o arquivo.";
  try {
    const body = await createAdminUploadForm(file);
    const response = await transport(url, { method: "POST", headers, body });
    trace.status = response.status;
    if (!response.ok) {
      trace.outcome = "http_error";
      if (response.status === 413) message = "O arquivo excede o limite permitido para este formato.";
      throw new Error(message);
    }
    const result = await response.json().catch(() => null) as { url?: unknown } | null;
    if (!result || typeof result.url !== "string") { trace.outcome = "invalid_response"; throw new Error("Não foi possível confirmar o envio."); }
    trace.outcome = "success"; save(trace); return result.url;
  } catch {
    if (trace.outcome === "pending") trace.outcome = "network_error";
    save(trace);
    throw new Error(message);
  }
}
