import React, { useEffect, useState } from "react";
import { getUploadTraces, UPLOAD_TRACE_EVENT, uploadReference } from "./uploadTrace";

export function UploadTraceNotice() {
  const [items, setItems] = useState(getUploadTraces);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const refresh = () => { setItems(getUploadTraces()); setCopied(false); };
    window.addEventListener(UPLOAD_TRACE_EVENT, refresh);
    return () => window.removeEventListener(UPLOAD_TRACE_EVENT, refresh);
  }, []);
  const failures = items.filter(t => t.outcome !== "pending" && t.outcome !== "success");
  const failed = failures[failures.length - 1];
  if (!failed || failed.id === dismissed) return null;
  return <aside className="upload-trace-notice" aria-label="Ajuda com envio de arquivo">
    <strong>Problema ao enviar um arquivo?</strong>
    <p>Copie a referência para pedir ajuda.</p>
    <details><summary>Consultar referência</summary><code>{uploadReference(failed)}</code></details>
    <button type="button" onClick={() => { void navigator.clipboard?.writeText(uploadReference(failed)).then(() => setCopied(true)).catch(() => setCopied(false)); }}>{copied ? "Referência copiada" : "Copiar referência"}</button>
    <button type="button" onClick={() => setDismissed(failed.id)}>Fechar</button>
  </aside>;
}
