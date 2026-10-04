import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { NavLink } from "react-router-dom";
import {
  loadSeasonalCountries, loadSeasonalMonitor, setSeasonalMonitor, loadSeasonalCategories, loadEditorialMarkets,
  confirmEditorialMarkets, loadSeasonalRadar, createSeasonalOpportunity, createAdminCardBySlug, listAdminClients,
  type AdminClientOption, type SeasonalMonitor, type SeasonalOccurrence, type SeasonalRadarResult,
} from "./api";
import type { SessionUser } from "./types";
import { addCalendarDays, countryName, formatSeasonalDate, seasonalDaysLabel } from "./seasonalDates";
import { monthPeriod, validateSeasonalPeriod, orderSeasonalOccurrences } from "./seasonalPresentation";
import "./SeasonalWorkspace.css";

const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Não foi possível concluir a operação.";
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
type Category = { code: string; label: string };
function Arrow() { return <span aria-hidden="true">↗</span>; }
function ModalShell({ title, drawer = false, busy = false, onClose, children }: { title: string; drawer?: boolean; busy?: boolean; onClose: () => void; children: ReactNode }) {
  const panel = useRef<HTMLElement>(null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = panel.current!;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const background = [...document.body.children].filter((element) => !element.contains(node)).map((element) => ({ element, inert: element.getAttribute("inert"), hidden: element.getAttribute("aria-hidden") }));
    background.forEach(({ element }) => { element.setAttribute("inert", ""); element.setAttribute("aria-hidden", "true"); });
    node.focus();
    return () => {
      document.body.style.overflow = overflow;
      background.forEach(({ element, inert, hidden }) => { if (inert === null) element.removeAttribute("inert"); else element.setAttribute("inert", inert); if (hidden === null) element.removeAttribute("aria-hidden"); else element.setAttribute("aria-hidden", hidden); });
      previous?.focus();
    };
  }, []);
  return createPortal(<div className={`radar-overlay ${drawer ? "radar-drawer-overlay" : ""}`} onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) close.current(); }}>
    <section ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={drawer ? "radar-drawer" : "radar-dialog"} onKeyDown={(event) => {
      if (event.key === "Escape" && !busy) { event.stopPropagation(); close.current(); }
      if (event.key !== "Tab") return;
      const items = [...panel.current!.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')];
      if (!items.length) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === items[0] || document.activeElement === panel.current)) { event.preventDefault(); items[items.length - 1].focus(); }
      else if (!event.shiftKey && (document.activeElement === items[items.length - 1] || document.activeElement === panel.current)) { event.preventDefault(); items[0].focus(); }
    }}><header className="radar-dialog-header"><div><span className="radar-eyebrow">RADAR EDITORIAL</span><h2>{title}</h2></div><button className="radar-icon-button" disabled={busy} onClick={onClose} aria-label={`Fechar ${title}`}>×</button></header>{children}</section>
  </div>, document.body);
}
function CountryPicker({ codes, selected, onChange, disabled = false }: { codes: string[]; selected: string[]; onChange: (codes: string[]) => void; disabled?: boolean }) {
  const [query, setQuery] = useState("");
  const options = useMemo(() => codes.map((code) => ({ code, name: countryName(code) })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")), [codes]);
  const filtered = options.filter((item) => !selected.includes(item.code) && normalize(`${item.name} ${item.code}`).includes(normalize(query)));
  return <div className="radar-country-picker">
    <label className="radar-field">Adicionar país<input placeholder="Buscar nome ou código ISO" aria-label="Pesquisar país" value={query} disabled={disabled} onChange={(event) => setQuery(event.target.value)} /></label>
    <div className="radar-country-results" aria-label="Diretório de países">{filtered.map((item) => <div key={item.code}><span><strong>{item.name}</strong><small>{item.code}</small></span><button className="radar-text-button" type="button" disabled={disabled} onClick={() => onChange([...selected, item.code])} aria-label={`Adicionar ${item.name}`}>+ Adicionar</button></div>)}{!filtered.length ? <p>Nenhum país encontrado.</p> : null}</div>
    {selected.length ? <div className="radar-country-chips">{selected.map((code) => <span key={code}>{countryName(code)}<button type="button" disabled={disabled} aria-label={`Remover ${countryName(code)} da seleção`} onClick={() => onChange(selected.filter((item) => item !== code))}>×</button></span>)}</div> : null}
  </div>;
}

// A future source-to-pauta link belongs here; current creation uses the existing card flow.
export async function createPautaFromSeasonalOccurrence(item: SeasonalOccurrence, clientSlug: string) {
  return createAdminCardBySlug(clientSlug, { columnId: null, title: item.title,
    caption: `${item.description || item.title}\nData: ${formatSeasonalDate(item.date)}.`, primaryMediaUrl: null, externalLinkUrl: null,
    artType: "Post", status: ["Entrada"], tags: ["Data comemorativa"], clientLabel: "Pendente", isBriefApproval: true, deadlineAt: item.date });
}
function SeasonalPautaDialog({ item, clients, onClose }: { item: SeasonalOccurrence; clients: AdminClientOption[]; onClose: () => void }) {
  const [slug, setSlug] = useState(""); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const [created, setCreated] = useState(false); const inFlight = useRef(false);
  const candidates = new Set(item.relatedClients.map((client) => client.id));
  const sorted = [...clients].sort((a, b) => Number(candidates.has(b.id)) - Number(candidates.has(a.id)) || a.name.localeCompare(b.name));
  async function create() {
    if (!slug || inFlight.current || created) return; inFlight.current = true; setSaving(true); setError("");
    try { await createPautaFromSeasonalOccurrence(item, slug); setCreated(true); }
    catch (caught) { setError(errorMessage(caught)); } finally { inFlight.current = false; setSaving(false); }
  }
  return <ModalShell title="Criar pauta" busy={saving} onClose={onClose}><div className="radar-dialog-content">
    <p className="radar-pauta-title">{item.title}</p><p className="radar-muted">{formatSeasonalDate(item.date)}</p>
    {created ? <div className="radar-success" role="status"><strong>Pauta criada</strong><p>Ela está pendente para aprovação no Kanban do cliente.</p></div> : <><label className="radar-field">Cliente<select value={slug} disabled={saving} onChange={(event) => setSlug(event.target.value)}><option value="">Selecione um cliente</option>{sorted.map((client) => <option key={client.id} value={client.slug}>{client.name}{candidates.has(client.id) ? " · mercado relacionado" : ""}</option>)}</select></label><p className="radar-help">A pauta será criada como pendente para aprovação. Você escolhe o cliente.</p></>}
    {error ? <p className="radar-error" role="alert">{error}</p> : null}
    <footer className="radar-dialog-actions">{created ? <button className="radar-primary" onClick={onClose}>Concluir</button> : <><button className="radar-secondary" disabled={saving} onClick={onClose}>Cancelar</button><button className="radar-primary" disabled={!slug || saving} onClick={() => void create()}>{saving ? "Criando…" : "Criar pauta pendente"}</button></>}</footer>
  </div></ModalShell>;
}
function DateStamp({ date, large = false }: { date: string; large?: boolean }) {
  const value = new Date(`${date}T00:00:00Z`);
  return <time className={`radar-date ${large ? "radar-date-large" : ""}`} dateTime={date} aria-label={formatSeasonalDate(date)}><span>{new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" }).format(value).replace(".", "")}</span><strong>{value.getUTCDate().toString().padStart(2, "0")}</strong>{large ? <small>{value.getUTCFullYear()}</small> : null}</time>;
}
function OccurrenceMeta({ item, categories }: { item: SeasonalOccurrence; categories: Category[] }) {
  return <><div className="radar-meta"><span className={`radar-category radar-category-${["feriado", "cultural", "comercial", "sazonal"].includes(item.categoryCode) ? item.categoryCode : "other"}`}>{categories.find((entry) => entry.code === item.categoryCode)?.label ?? item.categoryCode}</span><span>{item.scope === "global" ? "Global" : item.countryCodes.map((code) => countryName(code)).join(" · ")}</span></div>
    {item.regionalScope && !item.regionalScope.nationwide ? <p className="radar-regional">Abrangência regional{item.regionalScope.subdivisions.length ? ` · ${item.regionalScope.subdivisions.join(", ")}` : " · regiões não detalhadas"}</p> : null}</>;
}
function RelatedClients({ item }: { item: SeasonalOccurrence }) {
  return item.relatedClients.length ? <div className="radar-related"><span>Útil para</span><div>{item.relatedClients.map((client) => <span className="radar-client-chip" key={client.id}><i aria-hidden="true">{client.name.slice(0, 1)}</i>{client.name}</span>)}</div></div> : null;
}
function CountryManager({ codes, monitored, clients, initialTab, onClose, onChanged }: { codes: string[]; monitored: SeasonalMonitor[]; clients: AdminClientOption[]; initialTab: "countries" | "markets"; onClose: () => void; onChanged: () => Promise<void> }) {
  const [tab, setTab] = useState(initialTab); const [query, setQuery] = useState(""); const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const [success, setSuccess] = useState("");
  const [clientId, setClientId] = useState(""); const [marketCodes, setMarketCodes] = useState<string[]>([]); const [confirmedCodes, setConfirmedCodes] = useState<string[]>([]); const [ready, setReady] = useState(false);
  const active = monitored.filter((item) => item.active); const inactive = monitored.filter((item) => !item.active);
  const options = useMemo(() => codes.map((code) => ({ code, name: countryName(code) })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")), [codes]);
  const results = options.filter((item) => !active.some((entry) => entry.countryCode === item.code) && normalize(`${item.name} ${item.code}`).includes(normalize(query)));
  useEffect(() => {
    let current = true; setReady(false); setMarketCodes([]); setConfirmedCodes([]); setError(""); setSuccess("");
    if (clientId) loadEditorialMarkets(clientId).then((data) => { if (current) { const selected = data.items.filter((item) => item.active).map((item) => item.countryCode); setMarketCodes(selected); setConfirmedCodes(selected); setReady(true); } }).catch((caught) => { if (current) setError(errorMessage(caught)); });
    return () => { current = false; };
  }, [clientId]);
  async function changeCountry(code: string, enabled: boolean) {
    setSaving(true); setError(""); setSuccess("");
    try { await setSeasonalMonitor(code, enabled); await onChanged(); setSuccess(`${countryName(code)} ${enabled ? "adicionado ao monitoramento" : "desativado"}.`); }
    catch (caught) { setError(errorMessage(caught)); } finally { setSaving(false); }
  }
  async function save() {
    if (!ready || !clientId || saving) return; setSaving(true); setError(""); setSuccess("");
    try { await confirmEditorialMarkets(clientId, marketCodes); setConfirmedCodes([...marketCodes]); await onChanged(); setSuccess("Mercados editoriais confirmados."); }
    catch (caught) { setError(errorMessage(caught)); } finally { setSaving(false); }
  }
  return <ModalShell title="Gerenciar países" drawer busy={saving} onClose={onClose}><div className="radar-drawer-content">
    <div className="radar-tabs" aria-label="Configuração"><button aria-pressed={tab === "countries"} disabled={saving} onClick={() => setTab("countries")}>Países monitorados</button><button aria-pressed={tab === "markets"} disabled={saving} onClick={() => setTab("markets")}>Mercados editoriais</button></div>
    {error ? <p role="alert" className="radar-error">{error}</p> : null}{success ? <p role="status" className="radar-success">{success}</p> : null}
    {tab === "countries" ? <><p className="radar-help">Escolha os países que fazem parte do seu radar. Desativar mantém o histórico e os mercados dos clientes.</p>
      <section className="radar-management-section"><h3>No seu radar</h3>{active.length ? <div className="radar-managed-list">{active.map((item) => <div key={item.countryCode}><span><strong>{countryName(item.countryCode)}</strong><small>{item.countryCode}</small></span><button className="radar-text-button" disabled={saving} onClick={() => void changeCountry(item.countryCode, false)} aria-label={`Desativar ${countryName(item.countryCode)}`}>Desativar</button></div>)}</div> : <p className="radar-muted">Nenhum país monitorado. Adicione seu primeiro país abaixo.</p>}</section>
      <section className="radar-management-section"><h3>+ Adicionar país</h3><label className="radar-field"><span className="radar-visually-hidden">Buscar país no diretório ISO</span><input value={query} disabled={saving} placeholder="Buscar nome ou código ISO" onChange={(event) => setQuery(event.target.value)} /></label><div className="radar-country-results">{results.map((item) => { const paused = inactive.some((entry) => entry.countryCode === item.code); return <div key={item.code}><span><strong>{item.name}</strong><small>{item.code}</small></span><button className="radar-text-button" disabled={saving} onClick={() => void changeCountry(item.code, true)} aria-label={`${paused ? "Reativar" : "Adicionar"} ${item.name}`}>{paused ? "Reativar" : "+ Adicionar"}</button></div>; })}{!results.length ? <p className="radar-muted">Nenhum país encontrado.</p> : null}</div></section>
      {inactive.length ? <section className="radar-management-section"><h3>Monitoramento pausado</h3><div className="radar-managed-list">{inactive.map((item) => <div key={item.countryCode}><span><strong>{countryName(item.countryCode)}</strong><small>{item.countryCode}</small></span><button className="radar-text-button" disabled={saving} onClick={() => void changeCountry(item.countryCode, true)} aria-label={`Reativar monitoramento de ${countryName(item.countryCode)}`}>Reativar</button></div>)}</div></section> : null}
    </> : <><p className="radar-help">Um cliente pode atuar em vários países. Confirme os mercados para ver oportunidades relacionadas a ele.</p><label className="radar-field">Cliente<select value={clientId} disabled={saving} onChange={(event) => setClientId(event.target.value)}><option value="">Selecionar cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
      {clientId ? ready ? <><section className="radar-management-section"><h3>Mercados confirmados</h3><p className="radar-muted">{confirmedCodes.length ? confirmedCodes.map((code) => countryName(code)).join(" · ") : "Este cliente ainda não possui mercados editoriais confirmados."}</p></section><CountryPicker codes={codes} selected={marketCodes} onChange={(next) => { setMarketCodes(next); setSuccess(""); }} disabled={saving} /><p className="radar-help">As alterações só são salvas ao confirmar. Os países selecionados aqui não são adicionados automaticamente ao monitoramento.</p><button className="radar-primary radar-full-button" disabled={saving} onClick={() => void save()}>{saving ? "Confirmando…" : "Confirmar mercados"}</button></> : !error ? <p role="status" className="radar-muted">Carregando mercados…</p> : null : <div className="radar-drawer-empty"><span aria-hidden="true">◎</span><h3>Para quem você cria?</h3><p>Selecione um cliente e configure os países do seu planejamento editorial.</p></div>}
    </>}
  </div></ModalShell>;
}
function OpportunityEditor({ codes, categories, today, onClose, onSaved }: { codes: string[]; categories: Category[]; today: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const [title, setTitle] = useState(""); const [description, setDescription] = useState(""); const [category, setCategory] = useState(categories[0]?.code ?? ""); const [scope, setScope] = useState<"global" | "countries">("countries"); const [countries, setCountries] = useState<string[]>([]); const [date, setDate] = useState(today); const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const [created, setCreated] = useState(false); const inFlight = useRef(false);
  return <ModalShell title="Nova oportunidade" busy={saving} onClose={onClose}><form className="radar-dialog-content" onSubmit={async (event) => { event.preventDefault(); if (inFlight.current || created) return; inFlight.current = true; setSaving(true); setError(""); try { await createSeasonalOpportunity({ title, description, categoryCode: category, origin: "manual", scope, countryCodes: scope === "global" ? [] : countries, occurrences: [{ date }] }); setCreated(true); await onSaved(); onClose(); } catch (caught) { setError(errorMessage(caught)); } finally { inFlight.current = false; setSaving(false); } }}>
    <label className="radar-field">Título<input required value={title} disabled={saving} maxLength={255} onChange={(event) => setTitle(event.target.value)} /></label><label className="radar-field">Descrição<textarea value={description} disabled={saving} maxLength={10000} rows={3} onChange={(event) => setDescription(event.target.value)} /></label><div className="radar-form-pair"><label className="radar-field">Categoria<select value={category} disabled={saving} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select></label><label className="radar-field">Data<input type="date" required value={date} disabled={saving} onChange={(event) => setDate(event.target.value)} /></label></div><label className="radar-field">Abrangência<select value={scope} disabled={saving} onChange={(event) => setScope(event.target.value as typeof scope)}><option value="countries">Um ou vários países</option><option value="global">Global</option></select></label>{scope === "countries" ? <CountryPicker codes={codes} selected={countries} onChange={setCountries} disabled={saving} /> : <p className="radar-help">Uma única oportunidade, com abrangência global.</p>}{created ? <p role="status" className="radar-success">Oportunidade salva. Feche esta janela e atualize o radar.</p> : null}{error ? <p role="alert" className="radar-error">{error}</p> : null}<footer className="radar-dialog-actions"><button className="radar-secondary" type="button" disabled={saving} onClick={onClose}>{created ? "Concluir" : "Cancelar"}</button><button className="radar-primary" disabled={created || saving || !title.trim() || !category || !date || scope === "countries" && !countries.length}>{saving ? "Salvando…" : "Salvar oportunidade"}</button></footer>
  </form></ModalShell>;
}

export function SeasonalWorkspace({ session }: { session: SessionUser }) {
  const manager = session.role === "super_admin" || session.role === "admin";
  const [codes, setCodes] = useState<string[]>([]); const [monitored, setMonitored] = useState<SeasonalMonitor[]>([]); const [categories, setCategories] = useState<Category[]>([]); const [clients, setClients] = useState<AdminClientOption[]>([]);
  const [today, setToday] = useState(""); const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [period, setPeriod] = useState("90"); const [month, setMonth] = useState("");
  const [country, setCountry] = useState(""); const [category, setCategory] = useState(""); const [filterClient, setFilterClient] = useState(""); const [offset, setOffset] = useState(0); const [version, setVersion] = useState(0);
  const [result, setResult] = useState<SeasonalRadarResult | null>(null); const [featured, setFeatured] = useState<SeasonalOccurrence | null>(null);
  const [setupReady, setSetupReady] = useState(false); const [error, setError] = useState(""); const [loading, setLoading] = useState(true); const [selectedItem, setSelectedItem] = useState<SeasonalOccurrence | null>(null);
  const [drawer, setDrawer] = useState<"countries" | "markets" | null>(null); const [editor, setEditor] = useState(false);
  const [filteredMarkets, setFilteredMarkets] = useState<boolean | null>(null);
  const [setupAttempt, setSetupAttempt] = useState(0);
  const invalidPeriod = setupReady ? validateSeasonalPeriod(from, to) : "";
  useEffect(() => {
    let active = true; setError(""); setLoading(true);
    Promise.all([loadSeasonalCountries(), loadSeasonalMonitor(), loadSeasonalCategories(), listAdminClients()]).then(([directory, monitor, categoryData, clientData]) => {
      if (!active) return; setCodes(directory.countryCodes); setMonitored(monitor.items); setCategories(categoryData.items); setClients(clientData.items);
      setToday(monitor.today); setFrom(monitor.today); setTo(addCalendarDays(monitor.today, 89)); setMonth(monitor.today.slice(0, 7)); setSetupReady(true);
    }).catch((caught) => { if (active) { setError(errorMessage(caught)); setLoading(false); } }); return () => { active = false; };
  }, [setupAttempt]);
  useEffect(() => {
    if (!setupReady || !from || !to || invalidPeriod) return;
    let active = true; setLoading(true); setError(""); setResult(null); setFeatured(null);
    const query = { from, to, countryCode: country, categoryCode: category, clientId: filterClient };
    const page = loadSeasonalRadar({ ...query, offset });
    const highlight = from < today && to >= today ? loadSeasonalRadar({ ...query, from: today, offset: 0, limit: 1 }) : offset ? loadSeasonalRadar({ ...query, offset: 0, limit: 1 }) : page;
    Promise.all([page, highlight]).then(([data, first]) => { if (active) { setResult(data); setFeatured(orderSeasonalOccurrences(first.items).find((item) => item.daysUntil >= 0) ?? null); } }).catch((caught) => { if (active) setError(errorMessage(caught)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [setupReady, from, to, invalidPeriod, country, category, filterClient, offset, version, today]);
  useEffect(() => {
    let active = true; setFilteredMarkets(null);
    if (filterClient) loadEditorialMarkets(filterClient).then((data) => { if (active) setFilteredMarkets(data.items.some((item) => item.active)); }).catch(() => { if (active) setFilteredMarkets(null); });
    return () => { active = false; };
  }, [filterClient, version]);
  const activeCountries = monitored.filter((item) => item.active).map((item) => item.countryCode);
  async function refresh() { const monitor = await loadSeasonalMonitor(); setMonitored(monitor.items); if (country && !monitor.items.some((item) => item.active && item.countryCode === country)) setCountry(""); setOffset(0); setVersion((value) => value + 1); }
  function choosePeriod(value: string, selectedMonth = month) { setPeriod(value); setOffset(0); if (value === "month") { const range = monthPeriod(selectedMonth, today); setFrom(range.from); setTo(range.to); } else if (value !== "custom") { setFrom(today); setTo(addCalendarDays(today, Number(value) - 1)); } }
  const timeline = orderSeasonalOccurrences(result?.items ?? []).filter((item) => item.id !== featured?.id);
  const groups = new Map<string, SeasonalOccurrence[]>(); timeline.forEach((item) => { const key = item.date.slice(0, 7); groups.set(key, [...(groups.get(key) ?? []), item]); });
  return <section className="seasonal-radar" aria-label="Radar de oportunidades sazonais">
    <header className="radar-banner"><div><span className="radar-eyebrow">DATAS COMEMORATIVAS</span><h1>Radar de oportunidades sazonais</h1><p>Encontre o próximo assunto. Planeje para os clientes certos.</p></div>{manager ? <button className="radar-secondary" disabled={!setupReady} onClick={() => setDrawer("countries")}><span aria-hidden="true">◎</span> Gerenciar países</button> : null}</header>
    <div className="radar-toolbar" aria-label="Filtros de oportunidades"><label className="radar-field">Período<select value={period} disabled={!setupReady} onChange={(event) => choosePeriod(event.target.value)}><option value="30">Próximos 30 dias</option><option value="90">Próximos 90 dias</option><option value="month">Escolher mês</option><option value="custom">Personalizado</option></select></label>{period === "month" ? <label className="radar-field">Mês<input type="month" value={month} onChange={(event) => { setMonth(event.target.value); if (event.target.value) choosePeriod("month", event.target.value); }} /></label> : null}
      <label className="radar-field">País<select value={country} disabled={!setupReady} onChange={(event) => { setCountry(event.target.value); setOffset(0); }}><option value="">Todos do radar</option>{activeCountries.map((code) => <option key={code} value={code}>{countryName(code)}</option>)}</select></label><label className="radar-field">Categoria<select value={category} disabled={!setupReady} onChange={(event) => { setCategory(event.target.value); setOffset(0); }}><option value="">Todas as categorias</option>{categories.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select></label><label className="radar-field">Cliente<select value={filterClient} disabled={!setupReady} onChange={(event) => { setFilterClient(event.target.value); setOffset(0); }}><option value="">Todos os clientes</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
      {period === "custom" ? <div className="radar-custom-period"><label className="radar-field">De<input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setOffset(0); }} /></label><label className="radar-field">Até<input type="date" value={to} onChange={(event) => { setTo(event.target.value); setOffset(0); }} /></label></div> : null}
    </div>
    {invalidPeriod ? <p className="radar-error" role="alert">{invalidPeriod}</p> : null}{error ? <div className="radar-error" role="alert">{error}<button className="radar-text-button" onClick={() => setupReady ? setVersion((value) => value + 1) : setSetupAttempt((value) => value + 1)}>Tentar novamente</button></div> : null}
    {setupReady && !activeCountries.length ? <div className="radar-onboarding"><span className="radar-onboarding-icon" aria-hidden="true">◎</span><div><h2>Seu radar começa pelos países</h2><p>Adicione os mercados que quer acompanhar. Oportunidades globais aparecem mesmo sem países monitorados.</p></div>{manager ? <button className="radar-primary" onClick={() => setDrawer("countries")}>Adicionar primeiro país <Arrow /></button> : null}</div> : null}
    {filteredMarkets === false ? <div className="radar-market-note"><span>Este cliente ainda não possui mercados editoriais confirmados.</span>{manager ? <button className="radar-text-button" onClick={() => setDrawer("markets")}>Configurar mercados <Arrow /></button> : null}</div> : null}
    {result?.warnings.length ? <p role="status" className="radar-source-note">Feriados externos indisponíveis para {result.warnings.map((warning) => `${countryName(warning.countryCode)} (${warning.year})`).join(", ")}. As outras oportunidades continuam no radar.</p> : null}
    {loading ? <div className="radar-loading" role="status"><span />Buscando as próximas oportunidades…</div> : null}
    {!loading && !invalidPeriod && featured ? <section className="radar-feature" aria-label="Próxima oportunidade"><div className="radar-feature-top"><span className="radar-eyebrow">PRÓXIMA OPORTUNIDADE</span><span className="radar-countdown">{seasonalDaysLabel(featured.daysUntil)}</span></div><div className="radar-feature-main"><DateStamp date={featured.date} large /><div className="radar-feature-copy"><OccurrenceMeta item={featured} categories={categories} /><h2>{featured.title}</h2>{featured.description ? <p className="radar-description">{featured.description}</p> : null}<RelatedClients item={featured} /></div></div><footer className="radar-feature-footer">{!featured.relatedClients.length ? <p className="radar-help">{featured.regionalScope && !featured.regionalScope.nationwide ? "Confira a abrangência regional antes de escolher um cliente." : "Clientes relacionados aparecem com mercados editoriais confirmados."}</p> : <p className="radar-help">Uma oportunidade para entrar no seu planejamento.</p>}<button className="radar-primary" disabled={!clients.length} onClick={() => setSelectedItem(featured)}>Criar pauta <Arrow /></button></footer></section> : null}
    <section className="radar-timeline" aria-label="Próximas datas"><header className="radar-section-header"><div><span className="radar-eyebrow">NO HORIZONTE</span><h2>{featured ? "Próximas datas" : "Oportunidades no período"}</h2></div>{manager ? <button className="radar-text-button" disabled={!setupReady} onClick={() => setEditor(true)}>+ Cadastrar oportunidade</button> : null}</header>
      {!loading && !invalidPeriod && result?.total === 0 ? <div className="radar-empty"><span aria-hidden="true">✧</span><h3>Nenhuma oportunidade neste período</h3><p>Experimente outro período ou ajuste os filtros.</p>{(filterClient || country || category) ? <button className="radar-secondary" onClick={() => { setCountry(""); setCategory(""); setFilterClient(""); setOffset(0); }}>Limpar filtros</button> : null}</div> : null}
      {!loading && !invalidPeriod ? [...groups].map(([key, items]) => <section className="radar-month-group" key={key}><h3>{new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${key}-01T00:00:00Z`))}</h3><ol>{items.map((item) => <li className="radar-timeline-item" key={item.id}><DateStamp date={item.date} /><div className="radar-timeline-copy"><h4>{item.title}</h4><OccurrenceMeta item={item} categories={categories} /><RelatedClients item={item} /></div><div className="radar-timeline-actions"><span className="radar-days">{seasonalDaysLabel(item.daysUntil)}</span><button className="radar-text-button" disabled={!clients.length} onClick={() => setSelectedItem(item)} aria-label={`Criar pauta: ${item.title}`}>Criar pauta <Arrow /></button></div></li>)}</ol></section>) : null}
      {!loading && !invalidPeriod && result && result.total > result.limit ? <nav className="radar-pagination" aria-label="Paginação"><button className="radar-secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - result.limit))}>← Anterior</button><span>Página {Math.floor(offset / result.limit) + 1}</span><button className="radar-secondary" disabled={!result.hasMore} onClick={() => setOffset(offset + result.limit)}>Próxima →</button></nav> : null}
    </section>
    {setupReady ? <aside className="radar-market-note"><div><strong>Conecte oportunidades aos seus clientes</strong><p>Clientes relacionados aparecerão após configurar mercados editoriais. Um cliente pode ter vários países.</p></div>{manager ? <button className="radar-text-button" onClick={() => setDrawer("markets")}>Mercados editoriais <Arrow /></button> : null}</aside> : null}
    {drawer && manager ? <CountryManager codes={codes} monitored={monitored} clients={clients} initialTab={drawer} onClose={() => setDrawer(null)} onChanged={refresh} /> : null}
    {editor && manager ? <OpportunityEditor codes={codes} categories={categories} today={today} onClose={() => setEditor(false)} onSaved={refresh} /> : null}
    {selectedItem ? <SeasonalPautaDialog item={selectedItem} clients={clients} onClose={() => setSelectedItem(null)} /> : null}
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
