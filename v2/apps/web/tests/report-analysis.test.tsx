import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportAnalysisPanel } from '../src/ReportAnalysisPanel';
import { ReportsWorkspace } from '../src/ReportsWorkspace';
import { appendReportAnalysis, type ReportAnalysis } from '../src/reportAnalysis';
import { analyzeAdminReport, listAdminReports, loadClientMetaDestinations, loadClientMetaInsights, loadClientMetaAdsInsights, updateAdminReport, type ClientReport } from '../src/api';
const metrics = { instagram: { reach: 120, impressions: 200, engagement: 20, followers: 5, visits: 3, clicks: 2 }, facebook: { reach: 70, impressions: 100, engagement: 10, followers: 2, visits: 2, clicks: 1 } };
const report: ClientReport = { id: 'report-a', clientAccountId: 'client-a', metaDestinationId: null, metaDestinationName: null, title: 'Relatório A', periodStart: '2026-09-01', periodEnd: '2026-09-30', status: 'draft', metrics, highlights: [], evidenceUrls: [], notes: 'Texto manual preservado', createdAt: '', updatedAt: '', publishedAt: null };
const analysis: ReportAnalysis = { executiveSummary: 'Resumo com 120 de alcance.', keyFindings: ['fact', 'interpretation', 'hypothesis'].map(type => ({ title: type, finding: 'Achado', evidence: 'Alcance 120', evidenceRefs: ['current.instagram.reach'], type: type as 'fact' | 'interpretation' | 'hypothesis' })), whatWorked: [], attentionPoints: [], platformComparison: null, contentInsights: [], nextSteps: [], experiments: [], confidenceNotes: ['Dados comparativos insuficientes.'] };
vi.mock('../src/api', () => ({
  ApiRequestTimeoutError: class extends Error {}, loadClientMetaAdsInsights: vi.fn(), analyzeAdminReport: vi.fn(), listAdminClients: vi.fn(async () => ({ items: [{ id: 'client-a', name: 'Cliente A', slug: 'a' }, { id: 'client-b', name: 'Cliente B', slug: 'b' }] })),
  listAdminReports: vi.fn(async (clientId: string) => ({ items: clientId === 'client-a' ? [report] : [] })),
  createAdminReport: vi.fn(async () => ({ report })), updateAdminReport: vi.fn(async () => ({ report })), publishAdminReport: vi.fn(), deleteAdminReport: vi.fn(),
  extractAdminReportMetrics: vi.fn(async () => ({ metrics, highlights: [] })), uploadAdminMedia: vi.fn(async () => '/api/uploads/abc-123.webp'), listPortalReportsBySlug: vi.fn(async () => ({ items: [] })),
  loadMetaStatus: vi.fn(async () => ({ connected: true })), loadClientMetaAssets: vi.fn(async () => ({ assets: { instagramAccountId: 'ig-test', facebookPageId: 'fb-test', instagramUsername: 'test', facebookPageName: 'Test' } })), loadClientMetaDestinations: vi.fn(async () => ({ destinations: [] })), loadClientMetaInsights: vi.fn(async () => ({ status: 'success', sources: { instagram: 'available', facebook: 'available' }, instagram: { metrics: { reach: 120, views: 200, interactions: 20, followers: 5, profileViews: 3, linkClicks: 2 }, topContent: [] }, facebook: null, warnings: [] })),
}));
const mockAnalyze = vi.mocked(analyzeAdminReport);
beforeEach(() => { mockAnalyze.mockResolvedValue({ analysis, contextHash: 'hash' }); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const clickAnalyze = () => fireEvent.click(screen.getByRole('button', { name: '✦ Analisar relatório com IA' }));
const waitPreview = () => screen.findByText(analysis.executiveSummary);
describe('manual report analysis', () => {
  it('mounting/opening/saving/importing the workspace never calls analysis', async () => {
    render(<ReportsWorkspace />);
    fireEvent.click(await screen.findByRole('button', { name: /Relatório A/ }));
    expect(mockAnalyze).toHaveBeenCalledTimes(0);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(screen.getByText('Relatório salvo como rascunho.')).toBeTruthy());
    const file = new File(['image'], 'capture.webp', { type: 'image/webp' });
    fireEvent.change(document.querySelector('input[type=file]')!, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Analisar com IA' }));
    await waitFor(() => expect(screen.getByText(/Leitura concluída|Análise concluída/)).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Importar dados da Meta' }));
    await screen.findByText('Dados orgânicos e de anúncios importados da Meta com sucesso.');
    expect(mockAnalyze).toHaveBeenCalledTimes(0);
  });
  it('click invokes once with matching client/report/current editor, duplicate pending click prevented', async () => {
    let resolve!: (value: { analysis: ReportAnalysis; contextHash: string }) => void;
    mockAnalyze.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    render(<ReportAnalysisPanel report={report} available onInsert={vi.fn()} />);
    clickAnalyze(); clickAnalyze(); expect(mockAnalyze).toHaveBeenCalledTimes(1);
    expect(mockAnalyze.mock.calls[0][0]).toBe('client-a'); expect(mockAnalyze.mock.calls[0][1]).toBe('report-a'); expect(mockAnalyze.mock.calls[0][2].notes).toBe(report.notes);
    await act(async () => resolve({ analysis, contextHash: 'hash' })); await waitPreview(); expect(mockAnalyze).toHaveBeenCalledTimes(1);
  });
  it('inserting appends existing notes with title and does not call again', async () => {
    const insert = vi.fn(); render(<ReportAnalysisPanel report={report} available onInsert={insert} />); clickAnalyze(); await waitPreview();
    fireEvent.click(screen.getByRole('button', { name: 'Inserir nas observações' }));
    expect(insert).toHaveBeenCalledTimes(1); expect(insert.mock.calls[0][0]).toMatch(/^Texto manual preservado\n\n---\n\nAnálise estratégica da IA/); expect(mockAnalyze).toHaveBeenCalledTimes(1); expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('insertion into empty notes works; no truncation or overwrite if over limit', () => {
    expect(appendReportAnalysis(null, analysis)).toMatch(/^Análise estratégica da IA/);
    expect(() => appendReportAnalysis('x'.repeat(9999), analysis)).toThrow(/10.000/);
  });
  it('regenerate explicitly makes a second call', async () => { render(<ReportAnalysisPanel report={report} available onInsert={vi.fn()} />); clickAnalyze(); await waitPreview(); fireEvent.click(screen.getByRole('button', { name: 'Regenerar análise' })); await waitPreview(); expect(mockAnalyze).toHaveBeenCalledTimes(2); });
  it('discard does not call again or insert', async () => { const insert = vi.fn(); render(<ReportAnalysisPanel report={report} available onInsert={insert} />); clickAnalyze(); await waitPreview(); fireEvent.click(screen.getByRole('button', { name: 'Descartar' })); expect(mockAnalyze).toHaveBeenCalledTimes(1); expect(insert).not.toHaveBeenCalled(); expect(screen.queryByRole('dialog')).toBeNull(); });
  it('fact/interpretation/hypothesis and insufficient-data warning visible', async () => { render(<ReportAnalysisPanel report={report} available onInsert={vi.fn()} />); clickAnalyze(); await waitPreview(); for (const text of ['FATO', 'INTERPRETAÇÃO', 'HIPÓTESE', 'Dados comparativos insuficientes.']) expect(screen.getByText(text)).toBeTruthy(); });
  it('switching report/client clears preview and ignores old in-flight responses', async () => {
    let resolve!: (value: { analysis: ReportAnalysis; contextHash: string }) => void; mockAnalyze.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    const insert = vi.fn(); const { rerender } = render(<ReportAnalysisPanel report={report} available onInsert={insert} />); clickAnalyze();
    rerender(<ReportAnalysisPanel report={{ ...report, id: 'report-b', clientAccountId: 'client-b' }} available onInsert={insert} />);
    await act(async () => resolve({ analysis, contextHash: 'hash' })); expect(screen.queryByRole('dialog')).toBeNull(); expect(insert).not.toHaveBeenCalled(); expect(mockAnalyze).toHaveBeenCalledTimes(1);
  });
  it('editing after analysis invalidates insertion without automatically regenerating', async () => {
    const insert = vi.fn(); const { rerender } = render(<ReportAnalysisPanel report={report} available onInsert={insert} />); clickAnalyze(); await waitPreview();
    rerender(<ReportAnalysisPanel report={{ ...report, notes: 'New manual text' }} available onInsert={insert} />);
    expect((screen.getByRole('button', { name: 'Inserir nas observações' }) as HTMLButtonElement).disabled).toBe(true); expect(screen.getByText(/Os dados foram alterados/)).toBeTruthy(); expect(mockAnalyze).toHaveBeenCalledTimes(1);
  });
  it('discard pending response never reopens or inserts preview', async () => {
    let resolve!: (value: { analysis: ReportAnalysis; contextHash: string }) => void; mockAnalyze.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    render(<ReportAnalysisPanel report={report} available onInsert={vi.fn()} />); clickAnalyze(); fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    await act(async () => resolve({ analysis, contextHash: 'hash' })); expect(screen.queryByRole('dialog')).toBeNull(); expect(mockAnalyze).toHaveBeenCalledTimes(1);
  });
  it('provider errors appear in preview and no notes are changed', async () => { mockAnalyze.mockRejectedValueOnce(new Error('IA desabilitada')); const insert = vi.fn(); render(<ReportAnalysisPanel report={report} available onInsert={insert} />); clickAnalyze(); expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'IA desabilitada'); expect(insert).not.toHaveBeenCalled(); expect(mockAnalyze).toHaveBeenCalledTimes(1); });
  it('unsaved/local reports cannot request analysis', () => { const { rerender } = render(<ReportAnalysisPanel report={report} available={false} onInsert={vi.fn()} />); clickAnalyze(); rerender(<ReportAnalysisPanel report={{ ...report, id: '' }} available onInsert={vi.fn()} />); clickAnalyze(); expect(mockAnalyze).not.toHaveBeenCalled(); });
  it('escaping imported/output HTML uses plain React text', async () => { mockAnalyze.mockResolvedValueOnce({ analysis: { ...analysis, executiveSummary: '<script>alert(1)</script>' }, contextHash: 'h' }); render(<ReportAnalysisPanel report={report} available onInsert={vi.fn()} />); clickAnalyze(); expect(await screen.findByText('<script>alert(1)</script>')).toBeTruthy(); expect(document.querySelector('script')).toBeNull(); });
});

it('formatted manual notes remain an exact prefix; generated HTML is escaped', () => {
  const notes = '<h2>Manual</h2><p>Texto <b>original</b> &amp; completo.</p>';
  const added = appendReportAnalysis(notes, { ...analysis, executiveSummary: '<script>malicious</script>' });
  expect(added.startsWith(notes)).toBe(true); expect(added).toContain('&lt;script&gt;'); expect(added.slice(notes.length)).not.toContain('<script>');
});


describe('Meta report import period guard', () => {
  async function openLongReport() {
    vi.mocked(listAdminReports).mockResolvedValueOnce({ items: [{ ...report, periodEnd: '2026-10-07' }] });
    render(<ReportsWorkspace />);
    fireEvent.click(await screen.findByRole('button', { name: /Relatório A/ }));
    await waitFor(() => expect((screen.getByRole('button', { name: 'Importar dados da Meta' }) as HTMLButtonElement).disabled).toBe(false));
  }
  it('warns before importing Instagram and preserves the full existing form, including manual edits', async () => {
    await openLongReport();
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Título manual' } });
    fireEvent.change(screen.getAllByLabelText('Seguidores')[0], { target: { value: '830' } });
    const before = Array.from(document.querySelectorAll('.report-editor input')).map(input => (input as HTMLInputElement).value);
    const notesBefore = document.querySelector('.report-editor [contenteditable]')?.innerHTML;
    fireEvent.click(screen.getByRole('button', { name: 'Importar dados da Meta' }));
    expect(await screen.findByText('O Instagram permite importar Insights em períodos de até 30 dias. Ajuste as datas e tente novamente.')).toBeTruthy();
    expect(loadClientMetaInsights).not.toHaveBeenCalled();
    expect(loadClientMetaAdsInsights).not.toHaveBeenCalled();
    expect(Array.from(document.querySelectorAll('.report-editor input')).map(input => (input as HTMLInputElement).value)).toEqual(before);
    expect(document.querySelector('.report-editor [contenteditable]')?.innerHTML).toEqual(notesBefore);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await screen.findByText('Relatório salvo como rascunho.');
    expect(vi.mocked(updateAdminReport).mock.calls[0][2]).toMatchObject({ title: 'Título manual', periodEnd: '2026-10-07', notes: report.notes, metrics: { instagram: { followers: 830 } } });
  });
  it('imports normally after correcting dates to exactly 30 days', async () => {
    await openLongReport();
    fireEvent.click(screen.getByRole('button', { name: 'Importar dados da Meta' }));
    expect(loadClientMetaInsights).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-10-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Importar dados da Meta' }));
    await screen.findByText('Dados orgânicos e de anúncios importados da Meta com sucesso.');
    expect(loadClientMetaInsights).toHaveBeenCalledTimes(1);
    expect(loadClientMetaInsights).toHaveBeenCalledWith('client-a', '2026-09-01', '2026-10-01', undefined);
  });
  it('preserves data and shows the specific warning if the server rejects the period', async () => {
    vi.mocked(loadClientMetaInsights).mockRejectedValueOnce(new Error('O Instagram permite importar Insights em períodos de até 30 dias. Ajuste as datas e tente novamente.'));
    render(<ReportsWorkspace />);
    fireEvent.click(await screen.findByRole('button', { name: /Relatório A/ }));
    await waitFor(() => expect((screen.getByRole('button', { name: 'Importar dados da Meta' }) as HTMLButtonElement).disabled).toBe(false));
    const before = Array.from(document.querySelectorAll('.report-editor input')).map(input => (input as HTMLInputElement).value);
    fireEvent.click(screen.getByRole('button', { name: 'Importar dados da Meta' }));
    await screen.findByText('O Instagram permite importar Insights em períodos de até 30 dias. Ajuste as datas e tente novamente.');
    expect(Array.from(document.querySelectorAll('.report-editor input')).map(input => (input as HTMLInputElement).value)).toEqual(before);
  });
  it('honors a Facebook-only selected destination even if legacy client assets include Instagram', async () => {
    vi.mocked(loadClientMetaDestinations).mockResolvedValueOnce({ destinations: [{ id: 'facebook-only', clientAccountId: 'client-a', name: 'Facebook', facebookPageId: 'fb', facebookPageName: 'Page', instagramAccountId: null, instagramUsername: null, isDefault: true, createdAt: '', updatedAt: '' }] });
    await openLongReport();
    fireEvent.click(screen.getByRole('button', { name: 'Importar dados da Meta' }));
    await screen.findByText('Dados orgânicos e de anúncios importados da Meta com sucesso.');
    expect(loadClientMetaInsights).toHaveBeenCalledWith('client-a', '2026-09-01', '2026-10-07', 'facebook-only');
  });
});
