import { useState } from "react";
import { confirmInvoiceRecurringSource, loadRecurringAudit, type RecurringAudit } from "./api";

export function RecurringSourceReview({ onConfigured }: { onConfigured: () => Promise<void> }) {
  const [audit, setAudit] = useState<RecurringAudit | null>(null);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = async () => {
    setBusy(true); setError("");
    try { setAudit(await loadRecurringAudit()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível analisar as recorrências."); }
    finally { setBusy(false); }
  };
  const confirm = async (sourceId: string) => {
    setBusy(true); setError("");
    try { await confirmInvoiceRecurringSource(sourceId); setAudit(await loadRecurringAudit()); await onConfigured(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível definir a fonte."); }
    finally { setBusy(false); }
  };
  return <details className="billing-settings-panel"><summary>Revisar fontes de recorrência</summary><section className="billing-company-settings">
    <p>Faturas históricas não são fontes automáticas. Escolha a fatura-base de cada recorrência antes de gerar novos meses.</p>
    <button disabled={busy} onClick={() => void load()}>{busy ? "Verificando..." : "Analisar recorrências"}</button>
    {error ? <p role="alert">{error}</p> : null}
    {audit?.sources.map((group) => {
      const key = group.clientAccountId ?? group.suggestedSourceId;
      const selected = chosen[key] ?? group.suggestedSourceId;
      return <section className="recurring-source-group" key={key}>
        <strong>{group.clientName}</strong>
        <label>Fatura-base<select aria-label={`Fatura-base de ${group.clientName}`} disabled={busy} value={selected} onChange={(event) => setChosen((current) => ({ ...current, [key]: event.target.value }))}>
          {group.candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>#{candidate.number} · {candidate.title} · emissão {candidate.issueDate}</option>)}
        </select></label>
        {group.confirmedSourceIds.length ? <small>Fonte definida: {group.confirmedSourceIds.map((id) => `#${group.candidates.find((candidate) => candidate.id === id)?.number}`).join(", ")}</small>
          : <button disabled={busy} onClick={() => void confirm(selected)}>Definir esta fatura como fonte</button>}
      </section>;
    })}
    {audit ? <p>{audit.instances.length} instância(s) encontrada(s) para {audit.period}. Registros anteriores não serão corrigidos ou excluídos automaticamente.</p> : null}
    {audit?.instances.filter((instance) => instance.problems.length).map((instance) => <p key={instance.id}>Revisar #{instance.number} · {instance.clientName}: {instance.title} → {instance.expectedTitle ?? "origem inválida"}. Emissão {instance.issueDate}, vencimento {instance.dueDate}.</p>)}
  </section></details>;
}
