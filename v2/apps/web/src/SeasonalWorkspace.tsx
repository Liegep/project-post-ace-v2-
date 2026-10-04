import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  loadSeasonalCountries, loadSeasonalMonitor, setSeasonalMonitor, loadSeasonalCategories, loadEditorialMarkets,
  confirmEditorialMarkets, loadSeasonalRadar, createSeasonalOpportunity, createAdminCardBySlug, listAdminClients,
  type AdminClientOption, type SeasonalMonitor, type SeasonalOccurrence, type SeasonalRadarResult,
} from "./api";
import type { SessionUser } from "./types";
import { addCalendarDays, countryName, formatSeasonalDate, seasonalDaysLabel } from "./seasonalDates";
import "./SeasonalWorkspace.css";

const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Não foi possível concluir a operação.";
function CountryPicker({ codes, selected, onChange, disabled = false }: { codes: string[]; selected: string[]; onChange: (codes: string[]) => void; disabled?: boolean }) {
  const [query, setQuery] = useState("");
  const [code, setCode] = useState("");
  const options = useMemo(() => codes.map((value) => ({ code: value, name: countryName(value) })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")), [codes]);
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const filtered = options.filter((item) => !selected.includes(item.code) && normalize(`${item.name} ${item.code}`).includes(normalize(query)));
  return <div className="seasonal-country-picker">
    <div className="seasonal-controls"><input aria-label="Pesquisar país" placeholder="Pesquisar país" value={query} disabled={disabled} onChange={(event) => { setQuery(event.target.value); setCode(""); }} />
      <select aria-label="País para adicionar" value={code} disabled={disabled} onChange={(event) => setCode(event.target.value)}><option value="">Selecionar país</option>{filtered.map((item) => <option key={item.code} value={item.code}>{item.name} ({item.code})</option>)}</select>
      <button type="button" disabled={disabled || !code} onClick={() => { onChange([...selected, code]); setCode(""); }}>+ Adicionar país</button></div>
    <div className="seasonal-country-chips">{selected.map((value) => <span key={value}>{countryName(value)} ({value}) <button type="button" disabled={disabled} aria-label={`Remover ${countryName(value)}`} onClick={() => onChange(selected.filter((item) => item !== value))}>×</button></span>)}</div>
  </div>;
}

// Future source-to-pauta linkage can be added here without changing selection or card creation callers.
export async function createPautaFromSeasonalOccurrence(item: SeasonalOccurrence, clientSlug: string) {
  return createAdminCardBySlug(clientSlug, { columnId: null, title: item.title,
    caption: `${item.description || item.title}\nData: ${formatSeasonalDate(item.date)}.`, primaryMediaUrl: null, externalLinkUrl: null,
    artType: "Post", status: ["Entrada"], tags: ["Data comemorativa"], clientLabel: "Pendente", isBriefApproval: true, deadlineAt: item.date });
}
function SeasonalPautaDialog({ item, clients, onClose }: { item: SeasonalOccurrence; clients: AdminClientOption[]; onClose: () => void }) {
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const candidates = new Set(item.relatedClients.map((client) => client.id));
  const sorted = [...clients].sort((a, b) => Number(candidates.has(b.id)) - Number(candidates.has(a.id)) || a.name.localeCompare(b.name));
  async function create() {
    if (!slug || saving) return; setSaving(true); setError("");
    try { await createPautaFromSeasonalOccurrence(item, slug); onClose(); }
    catch (caught) { setError(errorMessage(caught)); }
    finally { setSaving(false); }
  }
  return <div className="modal-backdrop"><section className="commemorative-pauta-modal" role="dialog" aria-modal="true" aria-label="Criar pauta">
    <header><h3>{item.title}</h3><button disabled={saving} onClick={onClose} aria-label="Fechar">×</button></header>
    <p>{formatSeasonalDate(item.date)}</p><label className="field-stack">Cliente<select value={slug} onChange={(event) => setSlug(event.target.value)}><option value="">Selecione um cliente</option>{sorted.map((client) => <option key={client.id} value={client.slug}>{client.name}{candidates.has(client.id) ? " · mercado relacionado" : ""}</option>)}</select></label>
    <small>A pauta será criada como pendente para aprovação. A escolha do cliente é manual.</small>
    {error ? <p role="alert">{error}</p> : null}<footer><button disabled={saving} onClick={onClose}>Cancelar</button><button disabled={!slug || saving} onClick={() => void create()}>{saving ? "Criando..." : "Criar pauta"}</button></footer>
  </section></div>;
}

export function SeasonalWorkspace({ session }: { session: SessionUser }) {
  const manager = session.role === "super_admin" || session.role === "admin";
  const [codes, setCodes] = useState<string[]>([]);
  const [monitored, setMonitored] = useState<SeasonalMonitor[]>([]);
  const [categories, setCategories] = useState<Array<{ code: string; label: string }>>([]);
  const [clients, setClients] = useState<AdminClientOption[]>([]);
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [country, setCountry] = useState(""); const [category, setCategory] = useState(""); const [filterClient, setFilterClient] = useState("");
  const [offset, setOffset] = useState(0); const [version, setVersion] = useState(0);
  const [result, setResult] = useState<SeasonalRadarResult | null>(null);
  const [error, setError] = useState(""); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SeasonalOccurrence | null>(null);
  const [marketClient, setMarketClient] = useState(""); const [marketCodes, setMarketCodes] = useState<string[]>([]); const [marketsReady, setMarketsReady] = useState(false);
  const [title, setTitle] = useState(""); const [description, setDescription] = useState(""); const [ownCategory, setOwnCategory] = useState("cultural");
  const [scope, setScope] = useState<"global" | "countries">("countries"); const [ownCountries, setOwnCountries] = useState<string[]>([]); const [date, setDate] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([loadSeasonalCountries(), loadSeasonalMonitor(), loadSeasonalCategories(), listAdminClients()]).then(([directory, monitor, categoryData, clientData]) => {
      if (!active) return;
      setCodes(directory.countryCodes); setMonitored(monitor.items); setCategories(categoryData.items); setClients(clientData.items);
      setFrom(monitor.today); setTo(addCalendarDays(monitor.today, 90)); setDate(monitor.today);
    }).catch((caught) => { if (active) { setError(errorMessage(caught)); setLoading(false); } });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!from || !to) { setResult(null); setLoading(false); return; } let active = true; setLoading(true); setError(""); setResult(null);
    loadSeasonalRadar({ from, to, countryCode: country, categoryCode: category, clientId: filterClient, offset }).then((data) => { if (active) setResult(data); })
      .catch((caught) => { if (active) setError(errorMessage(caught)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [from, to, country, category, filterClient, offset, version]);
  useEffect(() => {
    setMarketsReady(false); setMarketCodes([]); if (!marketClient) return; let active = true;
    loadEditorialMarkets(marketClient).then((data) => { if (active) { setMarketCodes(data.items.filter((item) => item.active).map((item) => item.countryCode)); setMarketsReady(true); } })
      .catch((caught) => { if (active) setError(errorMessage(caught)); });
    return () => { active = false; };
  }, [marketClient]);
  const activeCountries = monitored.filter((item) => item.active).map((item) => item.countryCode);
  async function changeMonitor(next: string[]) {
    setSaving(true); setError("");
    try {
      for (const code of [...new Set([...activeCountries, ...next])]) if (activeCountries.includes(code) !== next.includes(code)) await setSeasonalMonitor(code, next.includes(code));
    } catch (caught) { setError(errorMessage(caught)); }
    finally {
      try { setMonitored((await loadSeasonalMonitor()).items); setOffset(0); setVersion((value) => value + 1); }
      catch (caught) { setError(errorMessage(caught)); }
      setSaving(false);
    }
  }
  async function saveMarkets() {
    if (!marketClient || !marketsReady) return; setSaving(true); setError("");
    try { await confirmEditorialMarkets(marketClient, marketCodes); setOffset(0); setVersion((value) => value + 1); }
    catch (caught) { setError(errorMessage(caught)); } finally { setSaving(false); }
  }
  async function saveOpportunity() {
    setSaving(true); setError("");
    try { await createSeasonalOpportunity({ title, description, categoryCode: ownCategory, origin: "manual", scope, countryCodes: scope === "global" ? [] : ownCountries, occurrences: [{ date }] });
      setTitle(""); setDescription(""); setOffset(0); setVersion((value) => value + 1);
    } catch (caught) { setError(errorMessage(caught)); } finally { setSaving(false); }
  }
  return <section className="commemorative-workspace glass seasonal-foundation">
    <div className="commemorative-workspace-head"><div><p className="eyebrow">Datas comemorativas</p><h2>Oportunidades sazonais</h2><p>Países monitorados e mercados editoriais compartilhados na operação.</p></div></div>
    {error ? <p role="alert" className="form-feedback error-text">{error}</p> : null}
    <details open><summary>Países monitorados</summary>{manager ? <CountryPicker codes={codes} selected={activeCountries} disabled={saving} onChange={(next) => void changeMonitor(next)} /> : <p>{activeCountries.map((code) => countryName(code)).join(", ") || "Nenhum país monitorado."}</p>}
      <small>Remover desativa somente o monitoramento. Datas e mercados dos clientes são preservados.</small></details>
    {manager ? <details><summary>Mercados editoriais dos clientes</summary><label className="field-stack">Cliente<select value={marketClient} disabled={saving} onChange={(event) => setMarketClient(event.target.value)}><option value="">Selecionar cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
      {marketClient ? <><CountryPicker codes={codes} selected={marketCodes} disabled={saving || !marketsReady} onChange={setMarketCodes} /><p>Confirme os mercados atendidos por este cliente. Idioma e dados fiscais não são usados como associação.</p><button disabled={saving || !marketsReady} onClick={() => void saveMarkets()}>Confirmar mercados editoriais</button></> : null}</details> : null}
    {manager ? <details><summary>Cadastrar oportunidade</summary><div className="seasonal-fields"><label>Título<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={255} /></label><label>Descrição<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={10000} /></label>
      <label>Categoria<select value={ownCategory} onChange={(event) => setOwnCategory(event.target.value)}>{categories.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select></label>
      <label>Abrangência<select value={scope} onChange={(event) => setScope(event.target.value as typeof scope)}><option value="countries">Um ou vários países</option><option value="global">Global / internacional</option></select></label>
      {scope === "countries" ? <CountryPicker codes={codes} selected={ownCountries} onChange={setOwnCountries} disabled={saving} /> : null}
      <label>Data da ocorrência<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><button disabled={saving || !title.trim() || !date || (scope === "countries" && !ownCountries.length)} onClick={() => void saveOpportunity()}>Salvar oportunidade</button></div></details> : null}
    <div className="seasonal-controls"><label>De<input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setOffset(0); }} /></label><label>Até<input type="date" value={to} onChange={(event) => { setTo(event.target.value); setOffset(0); }} /></label>
      <label>País<select value={country} onChange={(event) => { setCountry(event.target.value); setOffset(0); }}><option value="">Todos os monitorados</option>{activeCountries.map((code) => <option key={code} value={code}>{countryName(code)}</option>)}</select></label>
      <label>Categoria<select value={category} onChange={(event) => { setCategory(event.target.value); setOffset(0); }}><option value="">Todas</option>{categories.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select></label>
      <label>Cliente<select value={filterClient} onChange={(event) => { setFilterClient(event.target.value); setOffset(0); }}><option value="">Todos</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label></div>
    {result?.warnings.length ? <p role="status">{result.warnings.map((warning) => `${countryName(warning.countryCode)} (${warning.year})`).join(", ")}: feriados externos indisponíveis. As oportunidades próprias continuam disponíveis.</p> : null}
    <div className="commemorative-list"><header><h3>Datas no período</h3><span>{loading ? "Carregando..." : result ? `${result.total} ocorrências` : ""}</span></header>
      {result?.items.map((item) => <article key={item.id}><time>{formatSeasonalDate(item.date)}</time><div><strong>{item.title}</strong><span>{item.scope === "global" ? "Global / internacional" : item.countryCodes.map((code) => countryName(code)).join(", ")} · {categories.find((entry) => entry.code === item.categoryCode)?.label ?? item.categoryCode}</span>
        {item.regionalScope && !item.regionalScope.nationwide ? <span>Regional: {item.regionalScope.subdivisions.join(", ") || "abrangência regional não detalhada"}</span> : null}
        {item.relatedClients.length ? <span>Clientes com mercados relacionados: {item.relatedClients.map((client) => client.name).join(", ")}</span> : null}</div><em>{seasonalDaysLabel(item.daysUntil)}</em><button disabled={!clients.length} onClick={() => setSelectedItem(item)}>Criar pauta</button></article>)}
      {!loading && result?.total === 0 ? <p className="commemorative-empty">Nenhuma oportunidade encontrada neste período.</p> : null}
      {result ? <div className="seasonal-controls"><button disabled={loading || offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>Anterior</button><span>Página {Math.floor(offset / 50) + 1}</span><button disabled={loading || !result.hasMore} onClick={() => setOffset(offset + 50)}>Próxima</button></div> : null}
    </div>{selectedItem ? <SeasonalPautaDialog item={selectedItem} clients={clients} onClose={() => setSelectedItem(null)} /> : null}
  </section>;
}

export function SeasonalDashboardWidget({ clients }: { clients: AdminClientOption[] }) {
  const [items, setItems] = useState<SeasonalOccurrence[]>([]); const [error, setError] = useState("");
  const [selected, setSelected] = useState<SeasonalOccurrence | null>(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setRefresh((value) => value + 1), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    let active = true;
    loadSeasonalMonitor().then((monitor) => loadSeasonalRadar({ from: monitor.today, to: addCalendarDays(monitor.today, 4), limit: 100 }))
      .then((data) => { if (active) { setItems(data.items); setError(""); } }).catch((caught) => { if (active) setError(errorMessage(caught)); });
    return () => { active = false; };
  }, [refresh]);
  if (!items.length && !error) return null;
  return <><section className="dashboard-tasks-widget commemorative-dashboard-widget"><header><h3>Datas comemorativas</h3><span>{items.length ? seasonalDaysLabel(Math.min(...items.map((item) => item.daysUntil))) : ""}</span></header>
    {error ? <p role="status">Não foi possível carregar as oportunidades.</p> : <div className="dashboard-task-rows">{items.map((item) => <article key={item.id}><span className="dashboard-task-dot commemorative-dot" /><time className="commemorative-date-box" dateTime={item.date}>{formatSeasonalDate(item.date)}</time><div><strong>{item.title}</strong><small>{item.scope === "global" ? "Global" : item.countryCodes.map((code) => countryName(code)).join(", ")}</small></div><button disabled={!clients.length} onClick={() => setSelected(item)}>Criar pauta</button></article>)}</div>}
    <NavLink to="/area/datas-comemorativas" className="dashboard-task-link">Gerenciar monitoramento →</NavLink></section>
    {selected ? <SeasonalPautaDialog item={selected} clients={clients} onClose={() => setSelected(null)} /> : null}</>;
}
