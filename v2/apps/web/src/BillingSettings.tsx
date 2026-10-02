import { useEffect, useState } from "react";
import { loadBillingSettings, removeReceiptSignature, uploadReceiptSignature } from "./api";

export function BillingSettings() {
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    loadBillingSettings().then((result) => { if (active) setSignatureUrl(result.signatureUrl); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Não foi possível carregar a assinatura."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const upload = async (file?: File) => {
    if (!file) return;
    setError("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) { setError("Selecione uma imagem PNG, JPG ou WEBP."); return; }
    if (file.size > 12 * 1024 * 1024) { setError("A assinatura pode ter no máximo 12 MB."); return; }
    setSaving(true);
    try { setSignatureUrl((await uploadReceiptSignature(file)).signatureUrl); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível salvar a assinatura."); }
    finally { setSaving(false); }
  };
  const remove = async () => {
    setSaving(true); setError("");
    try { await removeReceiptSignature(); setSignatureUrl(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível remover a assinatura."); }
    finally { setSaving(false); }
  };
  return <section className="billing-company-settings" aria-label="Dados de faturamento">
    <h2>Dados de faturamento</h2>
    <h3>Assinatura para recibos</h3>
    <p>Incluída automaticamente nos novos recibos. Trocar ou remover a assinatura preserva os recibos já emitidos.</p>
    {loading ? <p>Carregando assinatura...</p> : signatureUrl ? <img className="billing-signature-preview" src={signatureUrl} alt="Assinatura atual para recibos" /> : <p>Nenhuma assinatura cadastrada.</p>}
    <label className="billing-signature-upload">{saving ? "Salvando..." : signatureUrl ? "Substituir imagem" : "Enviar imagem"}
      <input aria-label="Assinatura para recibos" type="file" accept="image/png,image/jpeg,image/webp" disabled={loading || saving} onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ""; }} />
    </label>
    {signatureUrl ? <button type="button" disabled={saving || loading} onClick={() => void remove()}>Remover assinatura</button> : null}
    <small>PNG, JPG ou WEBP · até 12 MB. Prefira PNG com fundo transparente.</small>
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}
