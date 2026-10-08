import { useEffect, useRef, useState } from 'react';
import { analyzeAdminReport, type ClientReport } from './api';
import { analysisEditorKey, analysisSnapshot, appendReportAnalysis, findingLabels, priorityLabels, type ReportAnalysis } from './reportAnalysis';
import './reportAnalysis.css';

export function ReportAnalysisPanel({ report, available, onInsert }: { report: ClientReport; available: boolean; onInsert: (notes: string) => void }) {
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [preview, setPreview] = useState<{ key: string; analysis: ReportAnalysis } | null>(null);
  const key = analysisEditorKey(report); const currentKey = useRef(key); currentKey.current = key;
  const generation = useRef(0); const pending = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null); const panel = useRef<HTMLDivElement>(null);
  useEffect(() => { generation.current++; pending.current = false; setBusy(false); setPreview(null); setOpen(false); setError(''); }, [report.id, report.clientAccountId]);
  useEffect(() => () => { generation.current++; }, []);
  useEffect(() => { if (!open) return; const previous = document.activeElement as HTMLElement | null; panel.current?.focus(); return () => { previous?.focus(); }; }, [open]);
  const discard = () => { generation.current++; pending.current = false; setOpen(false); setBusy(false); setPreview(null); setError(''); trigger.current?.focus(); };
  const analyze = async () => {
    if (pending.current || !available || !report.id) return;
    pending.current = true; const run = ++generation.current; const requestKey = key;
    setOpen(true); setBusy(true); setPreview(null); setError('');
    try {
      const result = await analyzeAdminReport(report.clientAccountId, report.id, analysisSnapshot(report));
      if (run !== generation.current) return;
      if (currentKey.current !== requestKey) { setError('O relatório mudou durante a análise. Regere para usar os dados atuais.'); return; }
      setPreview({ key: requestKey, analysis: result.analysis });
    } catch (failure) { if (run === generation.current) setError(failure instanceof Error ? failure.message : 'Não foi possível analisar o relatório.'); }
    finally { if (run === generation.current) { pending.current = false; setBusy(false); } }
  };
  const insert = () => {
    if (!preview || preview.key !== key || busy) return;
    try { onInsert(appendReportAnalysis(report.notes, preview.analysis)); discard(); } catch (failure) { setError((failure as Error).message); }
  };
  const a = preview?.analysis;
  const points = (title: string, items: Array<{ title: string; explanation: string; evidence: string }>) => <section><h3>{title}</h3>{items.length ? items.map((item, i) => <article key={i}><h4>{item.title}</h4><p>{item.explanation}</p><small>{item.evidence}</small></article>) : <p>Não há dados suficientes para concluir este ponto.</p>}</section>;
  return <div className="report-ai-control">
    <button ref={trigger} type="button" className="ghost-button" disabled={!available || !report.id || busy} onClick={() => void analyze()}>✦ Analisar relatório com IA</button>
    {!available || !report.id ? <small>Salve o relatório no servidor para habilitar a análise.</small> : null}
    {open ? <div className="report-ai-overlay"><div className="report-ai-panel" role="dialog" aria-modal="true" aria-labelledby="report-ai-title" tabIndex={-1} ref={panel} onKeyDown={event => {
      if (event.key === 'Escape') discard();
      if (event.key === 'Tab') {
        const buttons = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
        const first = buttons[0]; const last = buttons[buttons.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first?.focus(); }
      }
    }}>
      <header><div><h2 id="report-ai-title">Análise estratégica da IA</h2><p>{report.title} · Revise antes de inserir nas observações.</p></div><button type="button" className="ghost-button" aria-label="Fechar análise" onClick={discard}>×</button></header>
      {busy ? <p role="status">Analisando os dados do relatório…</p> : null}{error ? <p role="alert">{error}</p> : null}
      {preview && preview.key !== key ? <p role="alert">Os dados foram alterados. Regere a análise antes de inserir.</p> : null}
      {a ? <div className="report-ai-content">
        <section><h3>Resumo executivo</h3><p>{a.executiveSummary}</p></section>
        <section><h3>Principais achados</h3>{a.keyFindings.map((item, i) => <article key={i}><span className={`report-ai-kind ${item.type}`}>{findingLabels[item.type]}</span><h4>{item.title}</h4><p>{item.finding}</p><small>{item.evidence}</small></article>)}</section>
        {points('O que funcionou', a.whatWorked)}{points('Pontos de atenção', a.attentionPoints)}
        {a.platformComparison ? <section><h3>Comparação entre plataformas</h3>{a.platformComparison.instagram ? <p><b>Instagram:</b> {a.platformComparison.instagram}</p> : null}{a.platformComparison.facebook ? <p><b>Facebook:</b> {a.platformComparison.facebook}</p> : null}</section> : null}
        <section><h3>Insights de conteúdo</h3>{a.contentInsights.map((item, i) => <article key={i}><h4>{item.contentTitle ?? 'Conteúdo'}</h4><p>{item.insight}</p><small>{item.evidence}</small></article>)}</section>
        <section><h3>Próximos passos</h3>{a.nextSteps.map((item, i) => <article key={i}><h4>{item.action} · Prioridade {priorityLabels[item.priority]}</h4><p>{item.reason}</p><small>{item.evidence}</small></article>)}</section>
        <section><h3>Experimentos sugeridos</h3>{a.experiments.map((item, i) => <article key={i}><h4>{item.test}</h4><p>{item.expectedLearning}</p><small>{item.evidence}</small></article>)}</section>
        <section><h3>Limites e confiança</h3>{a.confidenceNotes.map((note, i) => <p key={i}>{note}</p>)}</section>
      </div> : null}
      <footer><button type="button" className="gradient-button" disabled={!preview || preview.key !== key || busy} onClick={insert}>Inserir nas observações</button><button type="button" className="ghost-button" disabled={busy} onClick={() => void analyze()}>Regenerar análise</button><button type="button" className="ghost-button" onClick={discard}>Descartar</button></footer>
    </div></div> : null}
  </div>;
}
