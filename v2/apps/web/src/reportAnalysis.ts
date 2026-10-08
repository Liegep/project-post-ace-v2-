import type { ClientReport } from './api';
type Supported = { evidence: string; evidenceRefs: string[] };
type Point = Supported & { title: string; explanation: string };
export type ReportAnalysis = {
  executiveSummary: string;
  keyFindings: Array<Supported & { title: string; finding: string; type: 'fact' | 'interpretation' | 'hypothesis' }>;
  whatWorked: Point[]; attentionPoints: Point[];
  platformComparison: { instagram: string | null; facebook: string | null; evidenceRefs: string[] } | null;
  contentInsights: Array<Supported & { contentTitle: string | null; insight: string }>;
  nextSteps: Array<Supported & { action: string; reason: string; priority: 'high' | 'medium' | 'low' }>;
  experiments: Array<Supported & { test: string; expectedLearning: string }>;
  confidenceNotes: string[];
};
export type ReportAnalysisResult = { analysis: ReportAnalysis; contextHash: string };
export const findingLabels = { fact: 'FATO', interpretation: 'INTERPRETAÇÃO', hypothesis: 'HIPÓTESE' };
export const priorityLabels = { high: 'Alta', medium: 'Média', low: 'Baixa' };
export function analysisSnapshot(report: ClientReport) {
  return { title: report.title, periodStart: report.periodStart.slice(0, 10), periodEnd: report.periodEnd.slice(0, 10), metrics: report.metrics, highlights: report.highlights, evidenceUrls: report.evidenceUrls, notes: report.notes };
}
export const analysisEditorKey = (report: ClientReport) => JSON.stringify([report.clientAccountId, report.id, analysisSnapshot(report)]);
export function analysisToEditorial(a: ReportAnalysis) {
  const evidence = (item: Supported) => `Evidência: ${item.evidence}`;
  const sections: Array<[string, string[]]> = [
    ['Resumo executivo', [a.executiveSummary]],
    ['Principais achados', a.keyFindings.map(i => `${findingLabels[i.type]} — ${i.title}\n${i.finding}\n${evidence(i)}`)],
    ['O que funcionou', a.whatWorked.map(i => `${i.title}\n${i.explanation}\n${evidence(i)}`)],
    ['Pontos de atenção', a.attentionPoints.map(i => `${i.title}\n${i.explanation}\n${evidence(i)}`)],
    ['Comparação entre plataformas', a.platformComparison ? [a.platformComparison.instagram ? `Instagram: ${a.platformComparison.instagram}` : '', a.platformComparison.facebook ? `Facebook: ${a.platformComparison.facebook}` : ''].filter(Boolean) : []],
    ['Insights de conteúdo', a.contentInsights.map(i => `${i.contentTitle ?? 'Conteúdo'}\n${i.insight}\n${evidence(i)}`)],
    ['Próximos passos', a.nextSteps.map(i => `[Prioridade ${priorityLabels[i.priority]}] ${i.action}\n${i.reason}\n${evidence(i)}`)],
    ['Experimentos sugeridos', a.experiments.map(i => `${i.test}\nAprendizado esperado: ${i.expectedLearning}\n${evidence(i)}`)],
    ['Limites e confiança', a.confidenceNotes],
  ];
  return 'Análise estratégica da IA\n\n' + sections.filter(([, values]) => values.length).map(([title, values]) => `${title}\n${values.join('\n\n')}`).join('\n\n');
}
export function appendReportAnalysis(notes: string | null, a: ReportAnalysis) {
  const appended = `${notes ?? ''}${notes ? '\n\n---\n\n' : ''}${analysisToEditorial(a)}`;
  if (appended.length > 10000) throw new Error('As observações excederiam 10.000 caracteres. Reduza o texto antes de inserir.');
  return appended;
}
