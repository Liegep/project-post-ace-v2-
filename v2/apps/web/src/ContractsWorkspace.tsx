import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./contractsWorkspace.css";
import { listAdminClients, listAdminContracts, listAdminContractTemplates, createAdminContract, createAdminContractTemplate, type ContractRecord as ApiContractRecord, type ContractTemplateRecord, type AdminClientOption } from "./api";

function templateDraft(draft: ContractTemplateRecord["draft"]): Partial<ContractDraft> {
  return Object.fromEntries(Object.entries({ title:draft.title,bodyHtml:draft.bodyHtml,language:draft.language,type:draft.contractType,startDate:draft.startDate??"",endDate:draft.endDate??"",value:draft.contractValue,scope:draft.scope,notes:draft.notes }).filter(([, value]) => value !== undefined));
}

type ClientContract = Omit<ContractRecord, "notes">;

// This gate blocks the interface. Unrelated portal APIs still need server-side authorization.
export function ContractAcceptanceGate({ accountName, canAccept = true, onExit, load, accept, t = (text) => text }: {
  accountName: string; canAccept?: boolean; onExit: () => void;
  load: () => Promise<ClientContract | null>; accept: (id: string) => Promise<unknown>; t?: (text: string) => string;
}) {
  const callbacks = useRef({load,accept}); callbacks.current = {load,accept};
  const [contract, setContract] = useState<ClientContract | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const mounted = useRef(false);
  const querySequence = useRef(0);
  const dialogRef = useRef<HTMLElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const blocked = checking || !!contract || !!error;
  const reload = async () => {
    const sequence = ++querySequence.current;
    setChecking(true); setError("");
    try { const next = await callbacks.current.load(); if (mounted.current && sequence === querySequence.current) setContract(next); }
    catch (failure) { if (mounted.current && sequence === querySequence.current) setError(failure instanceof Error ? failure.message : t("Não foi possível verificar o contrato.")); }
    finally { if (mounted.current && sequence === querySequence.current) setChecking(false); }
  };
  useEffect(() => { mounted.current = true; void reload(); return () => { mounted.current = false; querySequence.current++; }; }, []);
  useEffect(() => {
    if (!blocked || !backdropRef.current || !dialogRef.current) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const siblings = Array.from(document.body.children).filter((node) => node !== backdropRef.current);
    const attributes = siblings.map((node) => ({node,inert:node.getAttribute("inert"),hidden:node.getAttribute("aria-hidden")}));
    siblings.forEach((node) => { node.setAttribute("inert", ""); node.setAttribute("aria-hidden", "true"); });
    const overflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    const dialog = dialogRef.current;
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]'));
    dialog.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); }
      if (event.key !== "Tab") return;
      const items = focusable(); const current = document.activeElement;
      if (!items.length) { event.preventDefault(); dialog.focus(); return; }
      if (event.shiftKey && (current === items[0] || current === dialog || !dialog.contains(current))) { event.preventDefault(); items[items.length - 1].focus(); }
      else if (!event.shiftKey && (current === items[items.length - 1] || !dialog.contains(current))) { event.preventDefault(); items[0].focus(); }
    };
    const containFocus = (event: FocusEvent) => { if (!dialog.contains(event.target as Node)) dialog.focus(); };
    document.addEventListener("keydown", trap, true); document.addEventListener("focusin", containFocus);
    return () => {
      document.removeEventListener("keydown", trap, true); document.removeEventListener("focusin", containFocus);
      attributes.forEach(({node,inert,hidden}) => { if (inert === null) node.removeAttribute("inert"); else node.setAttribute("inert",inert); if (hidden === null) node.removeAttribute("aria-hidden"); else node.setAttribute("aria-hidden",hidden); });
      document.body.style.overflow = overflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [blocked]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (blocked && dialog && !dialog.contains(document.activeElement)) dialog.focus();
  }, [contract?.id, checking, error]);
  const respond = async () => {
    if (!contract || !canAccept || busyRef.current || checking) return;
    busyRef.current = true; setBusy(true); setError("");
    try {
      await callbacks.current.accept(contract.id);
      if (!mounted.current) return;
      // Never release navigation between acceptance and checking the next document.
      setChecking(true); setContract(null); await reload();
    } catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : t("Não foi possível registrar o aceite.")); }
    finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  };
  if (!blocked) return null;
  return createPortal(<div ref={backdropRef} className="modal-backdrop contract-acceptance-backdrop">
    <section ref={dialogRef} className="contract-acceptance-modal" role="dialog" aria-modal="true" aria-labelledby="contract-acceptance-title" tabIndex={-1}>
      <header><div><span>{t("CONTRATO")}</span><h2 id="contract-acceptance-title">{t("Contrato pendente de aceite")}</h2><p>{t("Leia o documento para continuar na área do cliente.")}</p></div></header>
      {checking ? <p role="status">{t("Verificando contratos pendentes…")}</p> : contract ? <div className="contract-acceptance-paper" tabIndex={0} aria-label={t("Leitura do contrato")}><ContractDocumentPreview contract={contractRecordDraft(contract)} clientName={accountName} record={contract}/></div> : null}
      {error ? <p role="alert">{error}</p> : null}
      {!canAccept && contract ? <p>{t("O responsável pela conta deve aceitar este contrato. Você pode sair e entrar novamente depois.")}</p> : null}
      <footer><button className="ghost-button" onClick={onExit} disabled={busy}>{t("Sair da conta")}</button>{error ? <button className="ghost-button" onClick={() => void reload()} disabled={busy || checking}>{t("Verificar novamente")}</button> : null}{contract && canAccept ? <button className="gradient-button" onClick={() => void respond()} disabled={busy || checking || !!error}>{busy ? t("Registrando aceite…") : t("Li e aceito o contrato")}</button> : null}</footer>
    </section>
  </div>, document.body);
}
export type ContractDraft = { title: string; client: string; bodyHtml: string; language: string; type: string; startDate: string; endDate: string; value: string; scope: string; notes: string };
const emptyContractDraft = (): ContractDraft => ({ title: "", client: "", bodyHtml: "", language: "Português", type: "Prestação de serviços", startDate: "", endDate: "", value: "", scope: "", notes: "" });
type ContractRecord = ApiContractRecord;
type ContractTemplate = { id: string; name: string; bodyHtml?: string; language: string; description: string; draft: Partial<ContractDraft>; custom?: boolean; updatedAt?: string };
const CONTRACT_MODELS: ContractTemplate[] = [
  { id: "services", name: "Prestação de serviços", language: "Português", description: "Modelo completo para projetos de conteúdo e design.", draft: { title: "Contrato de prestação de serviços", type: "Prestação de serviços", scope: "Objeto, escopo, prazos e entregas do projeto serão definidos entre as partes." } },
  { id: "monthly", name: "Contrato mensal", language: "Português", description: "Ideal para contratos recorrentes e gestão contínua.", draft: { title: "Contrato de serviços mensais", type: "Mensalidade", scope: "A contratada prestará serviços recorrentes conforme o plano e o calendário acordados." } },
  { id: "consulting", name: "Consultoria", language: "Português", description: "Base para projetos estratégicos e consultorias.", draft: { title: "Contrato de consultoria", type: "Consultoria", scope: "A consultoria será conduzida em encontros e entregas definidos no cronograma do projeto." } },
];
export function contractRecordDraft(record: Omit<ContractRecord, "notes"> & { notes?: string }): ContractDraft { return { title: record.title, client: record.clientName, bodyHtml: record.bodyHtml, language: record.language, type: record.contractType, startDate: record.startDate ?? "", endDate: record.endDate ?? "", value: record.contractValue, scope: record.scope, notes: record.notes ?? "" }; }
function sanitizedContractHtml(source: string) {
  const documentValue = new DOMParser().parseFromString(source, "text/html");
  documentValue.querySelectorAll("script,style,iframe,object,embed,form,link,meta").forEach((node) => node.remove());
  documentValue.querySelectorAll("*").forEach((node) => [...node.attributes].forEach((attribute) => {
    if (attribute.name.toLowerCase().startsWith("on") || /^(javascript|data):/i.test(attribute.value.trim())) node.removeAttribute(attribute.name);
  }));
  return documentValue.body.innerHTML;
}

const CONTRACT_LANGUAGES = ["Português", "English", "Español", "Français", "Italiano", "Deutsch", "Svenska"];
const contractStatus = (record: Pick<ContractRecord, "status" | "acceptedAt">) => record.acceptedAt || record.status === "accepted" ? "accepted" : record.status;
const statusLabel = (status: string) => status === "accepted" ? "Aceito" : status === "cancelled" ? "Cancelado" : "Aguardando aceite";
const documentDate = (value?: string | null, time = false) => {
  if (!value) return "";
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", ...(time ? { hour: "2-digit", minute: "2-digit" } as const : {}) }).format(date);
};

export function ContractDocumentPreview({ contract, clientName, record }: { contract: ContractDraft; clientName?: string; record?: Omit<ContractRecord, "notes"> }) {
  const legacyBody = useMemo(() => sanitizedContractHtml(contract.bodyHtml), [contract.bodyHtml]);
  return <article className="contract-document-preview contract-paper" lang={({English:"en",Español:"es",Français:"fr",Italiano:"it",Deutsch:"de",Svenska:"sv"} as Record<string,string>)[contract.language] || "pt-BR"}>
    <header className="contract-paper-heading"><div><span>DESIGN HUB</span><span>{contract.language || "Português"} · {contract.type}</span></div><small>INSTRUMENTO CONTRATUAL</small><h1>{contract.title || "Novo contrato"}</h1><p>Documento preparado para {clientName || contract.client || "cliente ainda não selecionado"}</p></header>
    {(clientName || contract.client || record?.createdAt) ? <dl className="contract-paper-parties"><div><dt>Destinatário</dt><dd>{clientName || contract.client || "—"}</dd></div>{record?.createdAt ? <div><dt>Publicado em</dt><dd>{documentDate(record.createdAt)}</dd></div> : null}</dl> : null}
    {contract.scope ? <section className="contract-paper-section"><small>OBJETO / ESCOPO</small><p>{contract.scope}</p></section> : null}
    {legacyBody ? <section className="contract-paper-section"><small>CLÁUSULAS E CONDIÇÕES</small><div className="contract-rich-body" dangerouslySetInnerHTML={{ __html: legacyBody }}/></section> : null}
    {(contract.value || contract.startDate || contract.endDate) ? <section className="contract-paper-section"><small>VALORES E VIGÊNCIA</small><dl className="contract-paper-terms">{contract.value ? <div><dt>Valor / condições</dt><dd>{contract.value}</dd></div> : null}{contract.startDate || contract.endDate ? <div><dt>Vigência</dt><dd>{contract.startDate ? documentDate(contract.startDate) : "Início não informado"}{contract.endDate ? ` até ${documentDate(contract.endDate)}` : ""}</dd></div> : null}</dl></section> : null}
    {!contract.scope && !legacyBody && !contract.value ? <p className="contract-paper-empty">O conteúdo do documento aparecerá aqui conforme o preenchimento.</p> : null}
    {record ? <section className={`contract-paper-acceptance ${contractStatus(record)}`}><span className={`contract-record-status ${contractStatus(record)}`}>{statusLabel(contractStatus(record))}</span>{record.acceptedAt ? <p>Aceite registrado em <strong>{documentDate(record.acceptedAt, true)}</strong>{record.acceptedByUserId ? <><br/>Usuário: <span className="contract-user-id">{record.acceptedByUserId}</span></> : null}</p> : null}</section> : null}
    <footer><span>{record && contractStatus(record) === "accepted" ? "Documento com aceite registrado" : "Li e aceito os termos deste contrato."}</span><b>Assinatura digital</b></footer>
  </article>;
}

function ContractRichEditor({ value, onChange, readOnly = false }: { value: string; onChange: (html: string) => void; readOnly?: boolean }) {
  const editorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const editor = editorRef.current;
    if (editor && document.activeElement !== editor && editor.innerHTML !== value) editor.innerHTML = value;
  }, [value]);
  const format = (command: string, commandValue?: string) => {
    if (readOnly) return;
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    onChange(editorRef.current?.innerHTML ?? "");
  };
  return <label className="contract-rich-field"><span>Texto do contrato</span><div className="contract-rich-toolbar" role="toolbar" aria-label="Formatação do texto do contrato"><button type="button" disabled={readOnly} onMouseDown={(event) => event.preventDefault()} onClick={() => format("bold")} title="Negrito"><b>B</b></button><button type="button" disabled={readOnly} onMouseDown={(event) => event.preventDefault()} onClick={() => format("italic")} title="Itálico"><i>I</i></button><button type="button" disabled={readOnly} onMouseDown={(event) => event.preventDefault()} onClick={() => format("underline")} title="Sublinhado"><u>U</u></button><i /><button type="button" disabled={readOnly} onMouseDown={(event) => event.preventDefault()} onClick={() => format("formatBlock", "h2")} title="Título">H2</button><button type="button" disabled={readOnly} onMouseDown={(event) => event.preventDefault()} onClick={() => format("formatBlock", "h3")} title="Subtítulo">H3</button><i /><button type="button" disabled={readOnly} onMouseDown={(event) => event.preventDefault()} onClick={() => format("insertUnorderedList")} title="Lista com marcadores">☷</button><button type="button" disabled={readOnly} onMouseDown={(event) => event.preventDefault()} onClick={() => format("insertOrderedList")} title="Lista numerada">☰</button><button type="button" disabled={readOnly} onMouseDown={(event) => event.preventDefault()} onClick={() => format("formatBlock", "blockquote")} title="Citação">❞</button><button type="button" disabled={readOnly} onMouseDown={(event) => event.preventDefault()} onClick={() => format("insertHorizontalRule")} title="Separador">―</button><span className="contract-rich-toolbar-spacer" /><button type="button" disabled={readOnly} onMouseDown={(event) => event.preventDefault()} onClick={() => format("undo")} title="Desfazer">↶</button><button type="button" disabled={readOnly} onMouseDown={(event) => event.preventDefault()} onClick={() => format("redo")} title="Refazer">↷</button></div><div ref={editorRef} className="contract-rich-editor" contentEditable={!readOnly} role="textbox" aria-label="Texto do contrato" aria-multiline="true" aria-readonly={readOnly} suppressContentEditableWarning data-placeholder="Escreva ou selecione um modelo para carregar o texto completo do contrato." onInput={(event) => { if (!readOnly) onChange(event.currentTarget.innerHTML); }} /></label>;
}

export function ContractsWorkspace({ newContractSignal = 0 }: { newContractSignal?: number }) {
  const recoveryKey = "designhub-v2-contract-current-draft";
  const recoveredDraft = useMemo(() => { try { return JSON.parse(window.localStorage.getItem(recoveryKey) || "null") as { draft: ContractDraft; clientSlug: string; selectedModel: string; clientChosen?: boolean; publication?: { id: string; fingerprint: string }; publishedFingerprint?: string } | null; } catch { return null; } }, []);
  const [clients, setClients] = useState<AdminClientOption[]>([]);
  const [clientSlug, setClientSlug] = useState(recoveredDraft?.clientChosen ? recoveredDraft.clientSlug : "");
  const [draft, setDraft] = useState<ContractDraft>(recoveredDraft?.draft ?? emptyContractDraft);
  const [records, setRecords] = useState<ContractRecord[]>([]);
  const [customTemplates, setCustomTemplates] = useState<ContractTemplate[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [viewedRecord, setViewedRecord] = useState<ContractRecord | null>(null);
  const [languageFilter, setLanguageFilter] = useState("");
  const [libraryExpanded, setLibraryExpanded] = useState(false);
  const [librarySection, setLibrarySection] = useState<"models" | "clients">("models");
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateLanguage, setTemplateLanguage] = useState("Português");
  const [selectedModel, setSelectedModel] = useState(recoveredDraft?.selectedModel ?? "");
  const [saved, setSaved] = useState(false);
  const [draftState, setDraftState] = useState<string>(recoveredDraft ? "recovered" : "idle");
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const initialFingerprint = JSON.stringify({ draft: recoveredDraft?.draft ?? emptyContractDraft(), clientSlug: recoveredDraft?.clientChosen ? recoveredDraft.clientSlug : "", selectedModel: recoveredDraft?.selectedModel ?? "" });
  const committedDraftRef = useRef(initialFingerprint);
  const lastSignal = useRef(newContractSignal);
  const publication = useRef(recoveredDraft?.publication);
  const [publishedFingerprint, setPublishedFingerprint] = useState(recoveredDraft?.publishedFingerprint ?? "");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [message, setMessage] = useState("");
  const fingerprint = JSON.stringify({draft,clientSlug,selectedModel});
  const mayLeave = () => !busyRef.current && (fingerprint === committedDraftRef.current || window.confirm("Há alterações locais. Deseja descartá-las e trocar de contrato/modelo?"));
  const protectDraft = (explicit = false) => {
    try { window.localStorage.setItem(recoveryKey, JSON.stringify({draft,clientSlug,clientChosen:!!clientSlug,selectedModel,publication:publication.current,publishedFingerprint})); if (explicit) committedDraftRef.current = fingerprint; setDraftSavedAt(new Date()); setDraftState("saved"); if (explicit) setMessage("Rascunho salvo neste navegador. Não foi publicado para o cliente."); return true; }
    catch { setDraftState("error"); setMessage("Não foi possível proteger o rascunho neste navegador. O conteúdo continua no editor."); return false; }
  };
  useEffect(() => { void Promise.all([listAdminClients(), listAdminContracts(), listAdminContractTemplates()]).then(([clientResult, contractResult, templateResult]) => { setClients(clientResult.items);  setRecords(contractResult.items); setCustomTemplates(templateResult.items.map((template) => ({ id: template.id, name: template.name, bodyHtml: template.bodyHtml, language: template.language, description: template.description, draft: templateDraft(template.draft), updatedAt: template.updatedAt, custom: true }))); }).catch(() => { setClients([]); setRecords([]); setCustomTemplates([]); }); }, []);
  useEffect(() => {
    if (newContractSignal === lastSignal.current) return;
    lastSignal.current = newContractSignal;
    if (!mayLeave()) return;
    setViewedRecord(null); setDraft(emptyContractDraft()); setClientSlug(""); setSelectedModel(""); setSaved(false); setPreviewOpen(false); publication.current = undefined; setPublishedFingerprint("");
    committedDraftRef.current = JSON.stringify({ draft: emptyContractDraft(), clientSlug: "", selectedModel: "" });
    try { window.localStorage.removeItem(recoveryKey); } catch { /* Local protection reports errors on save. */ }
    setMessage(""); setDraftState("idle");
  }, [newContractSignal]);
  useEffect(() => {
    if (fingerprint === committedDraftRef.current || (!draft.title && !draft.bodyHtml && !draft.scope && !draft.notes && !draft.value && !draft.startDate && !draft.endDate)) return;
    setSaved(false); setDraftState("pending");
    const timeout = window.setTimeout(() => protectDraft(), 600);
    return () => window.clearTimeout(timeout);
  }, [fingerprint, publishedFingerprint]);
  useEffect(() => {
    if (fingerprint === committedDraftRef.current) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [fingerprint]);

  const selectedClient = clients.find((client) => client.slug === clientSlug);
  const allTemplates = [...CONTRACT_MODELS, ...customTemplates];
  const applyModel = (modelId: string) => {
    if ((!viewedRecord && modelId === selectedModel) || !mayLeave()) return;
    setViewedRecord(null); setPreviewOpen(false); setLibraryExpanded(false);
    setSelectedModel(modelId); setSaved(false); setMessage("");
    const model = allTemplates.find((item) => item.id === modelId);
    setDraft(model ? { ...emptyContractDraft(), ...model.draft, title: model.draft.title || model.name, bodyHtml: sanitizedContractHtml(model.bodyHtml || model.draft.bodyHtml || ""), language: model.language || model.draft.language || "Português" } : emptyContractDraft());
  };
  const saveTemplate = async () => {
    if (!templateName.trim() || busyRef.current) return;
    busyRef.current = true; setBusy(true); setMessage("");
    try {
      const response=await createAdminContractTemplate({name:templateName.trim(),bodyHtml:draft.bodyHtml,language:templateLanguage,description:"Modelo criado por você.",draft:{title:draft.title,bodyHtml:draft.bodyHtml,language:templateLanguage,contractType:draft.type,startDate:draft.startDate||null,endDate:draft.endDate||null,contractValue:draft.value,scope:draft.scope,notes:draft.notes}});
      const template:ContractTemplate={id:response.template.id,name:response.template.name,bodyHtml:response.template.bodyHtml,language:response.template.language,description:response.template.description,draft:templateDraft(response.template.draft),updatedAt:response.template.updatedAt,custom:true};
      setCustomTemplates((current)=>[template,...current]); setSelectedModel(template.id); setTemplateName(""); setTemplateModalOpen(false); setMessage("Novo modelo salvo. Os modelos anteriores foram preservados.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível salvar o modelo."); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const save = async () => {
    if (busyRef.current || !draft.title.trim() || !selectedClient || fingerprint === publishedFingerprint) return;
    busyRef.current = true; setBusy(true); setMessage("");
    try {
      if (!publication.current || publication.current.fingerprint !== fingerprint) publication.current = { id: crypto.randomUUID(), fingerprint };
      if (!protectDraft()) return;
      const response=await createAdminContract({publicationId:publication.current.id,clientAccountId:selectedClient.id,title:draft.title.trim(),bodyHtml:draft.bodyHtml,language:draft.language,contractType:draft.type,startDate:draft.startDate||null,endDate:draft.endDate||null,contractValue:draft.value,scope:draft.scope,notes:draft.notes,status:"pending"});
      setRecords((current)=>[response.contract,...current.filter((item)=>item.id!==response.contract.id)]);
      committedDraftRef.current=fingerprint; setPublishedFingerprint(fingerprint); setSaved(true); setDraftState("saved");
      try { window.localStorage.setItem(recoveryKey, JSON.stringify({draft,clientSlug,clientChosen:!!clientSlug,selectedModel,publication:publication.current,publishedFingerprint:fingerprint})); } catch { /* The request ID was saved before publication. */ }
      setMessage("Contrato publicado para o cliente. Aguardando aceite.");
    } catch (error) { setDraftState("saved"); setMessage(error instanceof Error ? error.message : "Não foi possível publicar. O rascunho foi preservado."); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const newVersion = (record: ContractRecord) => {
    if (!mayLeave()) return;
    setViewedRecord(null); setLibraryExpanded(false); setDraft(contractRecordDraft(record)); setClientSlug(""); setSelectedModel(""); setSaved(false); setPreviewOpen(false); setMessage("Cópia local para uma nova versão. O contrato original e seu aceite serão preservados.");
  };

  const readOnly = !!viewedRecord;
  const editorDraft = viewedRecord ? contractRecordDraft(viewedRecord) : draft;
  const editorClient = viewedRecord?.clientName || selectedClient?.name;
  const filteredModels = allTemplates.filter((model) => !languageFilter || model.language === languageFilter);
  const filteredRecords = records.filter((record) => !languageFilter || record.language === languageFilter);
  const openRecord = (record: ContractRecord) => { if (busyRef.current) return; setViewedRecord(record); setPreviewOpen(false); setLibraryExpanded(false); };
  const tabKeyboard = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault(); const preview = event.key === "End" || (event.key !== "Home" && !previewOpen);
    setPreviewOpen(preview); document.getElementById(preview ? "contract-preview-tab" : "contract-edit-tab")?.focus();
  };

  return <section className="contracts-workspace contract-workbench">
    <aside className={`contract-browser ${libraryExpanded ? "is-expanded" : ""}`} aria-label="Biblioteca e histórico de contratos">
      <header><div><span className="contract-eyebrow">DOCUMENTOS</span><h2>Biblioteca</h2></div><button className="contract-browser-toggle ghost-button" aria-expanded={libraryExpanded} aria-controls="contract-browser-content" onClick={() => setLibraryExpanded(!libraryExpanded)}>{libraryExpanded ? "Recolher" : "Abrir biblioteca"}</button></header>
      <div id="contract-browser-content" className="contract-browser-content">
        <label className="contract-language-filter">Filtrar por idioma<select value={languageFilter} onChange={(event) => setLanguageFilter(event.target.value)}><option value="">Todos os idiomas</option>{CONTRACT_LANGUAGES.map((language) => <option key={language}>{language}</option>)}</select></label>
        <button className={`contract-library-item contract-local-item ${!viewedRecord ? "is-active" : ""}`} aria-pressed={!viewedRecord} onClick={() => {setViewedRecord(null);setLibraryExpanded(false);}}><span className="contract-item-type">RASCUNHO LOCAL</span><strong>{draft.title || "Novo contrato"}</strong><small>{draft.language} · Somente neste navegador</small>{draftSavedAt ? <time>{draftSavedAt.toLocaleTimeString()}</time> : null}</button>
        <nav className="contract-browser-sections" aria-label="Seções da biblioteca"><button aria-pressed={librarySection === "models"} onClick={() => setLibrarySection("models")}>Modelos</button><button aria-pressed={librarySection === "clients"} onClick={() => setLibrarySection("clients")}>Clientes</button></nav>
        <section className="contract-models" hidden={librarySection !== "models"}><h3>Modelos <span>{filteredModels.length}</span></h3>{filteredModels.length ? filteredModels.map((model) => <button key={model.id} className={`contract-library-item ${!viewedRecord && selectedModel === model.id ? "is-selected" : ""}`} aria-pressed={!viewedRecord && selectedModel === model.id} disabled={busy} onClick={() => applyModel(model.id)}><span className="contract-item-type">MODELO · {model.language}</span><strong>{model.name}</strong><small>{model.description}</small>{model.updatedAt ? <time>Atualizado em {documentDate(model.updatedAt)}</time> : null}</button>) : <p className="contract-browser-empty">Nenhum modelo neste idioma.</p>}</section>
        <section className="contract-history" hidden={librarySection !== "clients"}><h3>Contratos de clientes <span>{filteredRecords.length}</span></h3>{filteredRecords.length ? filteredRecords.map((record) => <button key={record.id} className={`contract-library-item contracts-library-record ${viewedRecord?.id === record.id ? "is-active" : ""}`} aria-pressed={viewedRecord?.id === record.id} disabled={busy} onClick={() => openRecord(record)}><span className="contract-item-type">CONTRATO · {record.language}</span><strong>{record.title}</strong><small>{record.clientName}</small><span className={`contract-record-status ${contractStatus(record)}`}>{statusLabel(contractStatus(record))}</span><time>{documentDate(record.updatedAt || record.createdAt)}</time></button>) : <p className="contract-browser-empty">Nenhum contrato {languageFilter ? "neste idioma" : "publicado ainda"}.</p>}</section>
      </div>
    </aside>

    <div className="contract-desk">
      <header className="contract-desk-heading"><div><span className="contract-eyebrow">{readOnly ? "CONTRATO DO CLIENTE" : "EDIÇÃO / PERSONALIZAÇÃO"}</span><h2>{viewedRecord?.title || "Preparar contrato"}</h2><p>{viewedRecord ? viewedRecord.clientName : "Uma cópia de trabalho. Os modelos originais permanecem preservados."}</p></div><span className={viewedRecord ? `contract-record-status ${contractStatus(viewedRecord)}` : "contract-local-status"}>{viewedRecord ? statusLabel(contractStatus(viewedRecord)) : "Rascunho local"}</span></header>
      <div className="contract-mode-tabs" role="tablist" aria-label="Modo do contrato">{[{preview:false,label:"Editar",id:"contract-edit-tab"},{preview:true,label:"Prévia do cliente",id:"contract-preview-tab"}].map((tab) => <button key={tab.id} role="tab" id={tab.id} aria-selected={previewOpen === tab.preview} aria-controls="contract-mode-panel" tabIndex={previewOpen === tab.preview ? 0 : -1} onKeyDown={tabKeyboard} onClick={() => setPreviewOpen(tab.preview)}>{tab.label}</button>)}</div>
      {viewedRecord ? <div className={`contract-readonly-note ${contractStatus(viewedRecord)}`}><div><strong>{contractStatus(viewedRecord) === "accepted" ? "Documento aceito · somente leitura" : "Documento publicado · somente leitura"}</strong><p>{viewedRecord.acceptedAt ? `Aceite em ${documentDate(viewedRecord.acceptedAt, true)}. ` : "O documento original permanece preservado. "}Para alterar os termos, crie uma nova versão.</p>{viewedRecord.acceptedByUserId ? <small>Usuário do aceite: <span className="contract-user-id">{viewedRecord.acceptedByUserId}</span></small> : null}</div><button className="ghost-button" disabled={busy} onClick={() => newVersion(viewedRecord)}>Criar nova versão</button></div> : null}
      <div id="contract-mode-panel" role="tabpanel" aria-labelledby={previewOpen ? "contract-preview-tab" : "contract-edit-tab"} className={previewOpen ? "contract-preview-stage" : "contract-editor-stage"}>
        {previewOpen ? <><div className="contract-preview-caption"><span>PRÉVIA DO CLIENTE</span><p>Somente conteúdo do documento. Observações internas não são exibidas.</p></div><ContractDocumentPreview contract={editorDraft} clientName={editorClient} record={viewedRecord || undefined}/></> : <>
          <fieldset disabled={busy || readOnly} className="contract-editor-fields">
            <section className="contract-editor-section"><header><span>01</span><div><h3>Partes</h3><p>Identifique o documento e escolha o destinatário.</p></div></header><div className="contract-fields two"><label>Título do contrato<input value={editorDraft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Ex.: Contrato de serviços mensais" /></label><label>Enviar para o cliente{viewedRecord ? <input value={viewedRecord.clientName} readOnly/> : <select value={clientSlug} onChange={(event) => setClientSlug(event.target.value)}><option value="">Selecione um cliente</option>{clients.map((client) => <option key={client.id} value={client.slug}>{client.name}</option>)}</select>}</label></div><div className="contract-fields two"><label>Idioma<select value={editorDraft.language} onChange={(event) => setDraft({ ...draft, language: event.target.value })}>{CONTRACT_LANGUAGES.map((language) => <option key={language}>{language}</option>)}</select></label><label>Tipo<select value={editorDraft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}>{["Prestação de serviços","Mensalidade","Consultoria","Parceria"].map((type) => <option key={type}>{type}</option>)}</select></label></div>{!readOnly ? <label className="contract-source-picker">Usar um modelo pronto<select value={selectedModel} onChange={(event) => applyModel(event.target.value)}><option value="">Começar em branco</option>{allTemplates.map((model) => <option key={model.id} value={model.id}>{model.name} · {model.language}</option>)}</select><small>A personalização cria uma cópia local, sem modificar o modelo da biblioteca.</small></label> : null}</section>
            <section className="contract-editor-section"><header><span>02</span><div><h3>Objeto / escopo</h3><p>Defina os serviços e as entregas contratadas.</p></div></header><label>Escopo resumido<textarea value={editorDraft.scope} onChange={(event) => setDraft({ ...draft, scope: event.target.value })} placeholder="Descreva os serviços e entregas incluídos." /></label></section>
            <section className="contract-editor-section"><header><span>03</span><div><h3>Valores e pagamento</h3><p>Registre o investimento e as condições nos campos e cláusulas existentes.</p></div></header><label>Valor contratado<input value={editorDraft.value} onChange={(event) => setDraft({ ...draft, value: event.target.value })} placeholder="Ex.: € 500 / mês" /></label></section>
            <section className="contract-editor-section"><header><span>04</span><div><h3>Vigência</h3><p>Defina o período de validade do documento.</p></div></header><div className="contract-fields two"><label>Início<input type="date" value={editorDraft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} /></label><label>Vencimento<input type="date" value={editorDraft.endDate} onChange={(event) => setDraft({ ...draft, endDate: event.target.value })} /></label></div></section>
            <section className="contract-editor-section"><header><span>05</span><div><h3>Cláusulas</h3><p>Adapte o texto, mantendo a formatação do modelo.</p></div></header><ContractRichEditor value={editorDraft.bodyHtml} readOnly={readOnly || busy} onChange={(bodyHtml) => setDraft((current) => ({ ...current, bodyHtml }))}/></section>
            <section className="contract-internal-section"><header><span>USO ADMINISTRATIVO</span><h3>Observações internas</h3><p>Visíveis somente na operação. Não fazem parte da prévia do cliente.</p></header><label>Observações internas<textarea value={editorDraft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Responsáveis e orientações internas."/></label></section>
          </fieldset>
        </>}
      </div>
      {!readOnly ? <>
        <section className="contract-publish-review" aria-label="Revisão antes de publicar"><header><span className="contract-eyebrow">REVISÃO DE PUBLICAÇÃO</span><h3>Confira o destinatário e os termos</h3></header><dl><div><dt>Cliente</dt><dd className={!selectedClient ? "needs-client" : ""}>{selectedClient?.name || "Selecione um cliente para publicar"}</dd></div><div><dt>Idioma</dt><dd>{draft.language}</dd></div><div><dt>Contrato</dt><dd>{draft.title || "Título ainda não preenchido"}</dd></div><div><dt>Vigência</dt><dd>{draft.startDate ? documentDate(draft.startDate) : "Início não informado"}{draft.endDate ? ` até ${documentDate(draft.endDate)}` : ""}</dd></div></dl><footer><small role="status">{draftState === "error" ? "Falha ao salvar localmente" : `Rascunho local neste navegador${draftSavedAt ? ` · ${draftSavedAt.toLocaleTimeString()}` : ""}`}</small><div><button className="ghost-button" disabled={busy} onClick={() => protectDraft(true)}>Salvar rascunho</button><button className="gradient-button" onClick={save} disabled={busy || !draft.title.trim() || !selectedClient || fingerprint === publishedFingerprint}>{busy ? "Processando…" : "Publicar contrato"}</button></div></footer><p>Salvar mantém o rascunho local. Publicar disponibiliza o documento para a conta escolhida.</p></section>
        <div className="contract-template-action"><p>Quer reutilizar esta estrutura em outros contratos?</p><button className="ghost-button contracts-create-template" disabled={busy} onClick={() => setTemplateModalOpen(true)}>＋ Salvar formulário como modelo</button></div>
        {saved ? <p className="contracts-saved" role="status">✓ Contrato publicado. Aguardando aceite.</p> : null}{message ? <p className="contract-workspace-feedback" role="status">{message}</p> : null}
      </> : null}
    </div>
    {templateModalOpen ? <div className="modal-backdrop" onClick={() => setTemplateModalOpen(false)}><section className="contract-template-modal" onClick={(event) => event.stopPropagation()}><header><div><span>NOVO MODELO</span><h2>Salvar na biblioteca</h2><p>O formulário atual ficará disponível para reutilização.</p></div><button className="icon-close" onClick={() => setTemplateModalOpen(false)}>×</button></header><label>Nome do modelo<input autoFocus value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Ex.: Contrato mensal em inglês" /></label><label>Idioma<select value={templateLanguage} onChange={(event) => setTemplateLanguage(event.target.value)}>{CONTRACT_LANGUAGES.map((language) => <option key={language}>{language}</option>)}</select></label><footer><button className="ghost-button" onClick={() => setTemplateModalOpen(false)}>Cancelar</button><button className="gradient-button" disabled={busy || !templateName.trim()} onClick={saveTemplate}>Salvar modelo</button></footer></section></div> : null}
  </section>;
}
