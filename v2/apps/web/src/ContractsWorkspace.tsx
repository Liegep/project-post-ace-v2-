import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
      {checking ? <p role="status">{t("Verificando contratos pendentes…")}</p> : contract ? <div className="contract-acceptance-paper" tabIndex={0} aria-label={t("Leitura do contrato")}><ContractDocumentPreview contract={contractRecordDraft(contract)} clientName={accountName}/></div> : null}
      {error ? <p role="alert">{error}</p> : null}
      {!canAccept && contract ? <p>{t("O responsável pela conta deve aceitar este contrato. Você pode sair e entrar novamente depois.")}</p> : null}
      <footer><button className="ghost-button" onClick={onExit} disabled={busy}>{t("Sair da conta")}</button>{error ? <button className="ghost-button" onClick={() => void reload()} disabled={busy || checking}>{t("Verificar novamente")}</button> : null}{contract && canAccept ? <button className="gradient-button" onClick={() => void respond()} disabled={busy || checking || !!error}>{busy ? t("Registrando aceite…") : t("Li e aceito o contrato")}</button> : null}</footer>
    </section>
  </div>, document.body);
}
export type ContractDraft = { title: string; client: string; bodyHtml: string; language: string; type: string; startDate: string; endDate: string; value: string; scope: string; notes: string };
const emptyContractDraft = (): ContractDraft => ({ title: "", client: "", bodyHtml: "", language: "Português", type: "Prestação de serviços", startDate: "", endDate: "", value: "", scope: "", notes: "" });
type ContractRecord = ApiContractRecord;
type ContractTemplate = { id: string; name: string; bodyHtml?: string; language: string; description: string; draft: Partial<ContractDraft>; custom?: boolean };
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

export function ContractDocumentPreview({ contract, clientName }: { contract: ContractDraft; clientName?: string }) {
  const legacyBody = useMemo(() => sanitizedContractHtml(contract.bodyHtml), [contract.bodyHtml]);
  return <article className="contract-document-preview"><header><span>DESIGN HUB · CONTRATO · {contract.language || "Português"}</span><h1>{contract.title || "Novo contrato"}</h1><p>Documento preparado para {clientName || contract.client || "seu cliente"}</p></header>{contract.bodyHtml ? <section className="contract-rich-body" dangerouslySetInnerHTML={{ __html: legacyBody }} /> : <><div className="contract-preview-meta"><div><small>Tipo</small><strong>{contract.type || "—"}</strong></div><div><small>Vigência</small><strong>{contract.startDate || "—"} {contract.endDate ? `até ${contract.endDate}` : ""}</strong></div><div><small>Valor</small><strong>{contract.value || "A definir"}</strong></div></div><section><small>ESCOPO E CONDIÇÕES</small><p>{contract.scope || "O escopo do contrato será apresentado aqui."}</p></section></>}<footer><span>Li e aceito os termos deste contrato.</span><b>Assinatura digital</b></footer></article>;
}

function ContractRichEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const editor = editorRef.current;
    if (editor && document.activeElement !== editor && editor.innerHTML !== value) editor.innerHTML = value;
  }, [value]);
  const format = (command: string, commandValue?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    onChange(editorRef.current?.innerHTML ?? "");
  };
  return <label className="contract-rich-field"><span>Texto do contrato</span><div className="contract-rich-toolbar" role="toolbar" aria-label="Formatação do texto do contrato"><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => format("bold")} title="Negrito"><b>B</b></button><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => format("italic")} title="Itálico"><i>I</i></button><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => format("underline")} title="Sublinhado"><u>U</u></button><i /><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => format("formatBlock", "h2")} title="Título">H2</button><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => format("formatBlock", "h3")} title="Subtítulo">H3</button><i /><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => format("insertUnorderedList")} title="Lista com marcadores">☷</button><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => format("insertOrderedList")} title="Lista numerada">☰</button><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => format("formatBlock", "blockquote")} title="Citação">❞</button><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => format("insertHorizontalRule")} title="Separador">―</button><span className="contract-rich-toolbar-spacer" /><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => format("undo")} title="Desfazer">↶</button><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => format("redo")} title="Refazer">↷</button></div><div ref={editorRef} className="contract-rich-editor" contentEditable suppressContentEditableWarning data-placeholder="Escreva ou selecione um modelo para carregar o texto completo do contrato." onInput={(event) => onChange(event.currentTarget.innerHTML)} /></label>;
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
  useEffect(() => { void Promise.all([listAdminClients(), listAdminContracts(), listAdminContractTemplates()]).then(([clientResult, contractResult, templateResult]) => { setClients(clientResult.items);  setRecords(contractResult.items); setCustomTemplates(templateResult.items.map((template) => ({ id: template.id, name: template.name, bodyHtml: template.bodyHtml, language: template.language, description: template.description, draft: templateDraft(template.draft), custom: true }))); }).catch(() => { setClients([]); setRecords([]); setCustomTemplates([]); }); }, []);
  useEffect(() => {
    if (newContractSignal === lastSignal.current) return;
    lastSignal.current = newContractSignal;
    if (!mayLeave()) return;
    setDraft(emptyContractDraft()); setClientSlug(""); setSelectedModel(""); setSaved(false); setPreviewOpen(false); publication.current = undefined; setPublishedFingerprint("");
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
    if (modelId === selectedModel || !mayLeave()) return;
    setSelectedModel(modelId); setSaved(false); setMessage("");
    const model = allTemplates.find((item) => item.id === modelId);
    setDraft(model ? { ...emptyContractDraft(), ...model.draft, title: model.draft.title || model.name, bodyHtml: sanitizedContractHtml(model.bodyHtml || model.draft.bodyHtml || ""), language: model.language || model.draft.language || "Português" } : emptyContractDraft());
  };
  const saveTemplate = async () => {
    if (!templateName.trim() || busyRef.current) return;
    busyRef.current = true; setBusy(true); setMessage("");
    try {
      const response=await createAdminContractTemplate({name:templateName.trim(),bodyHtml:draft.bodyHtml,language:templateLanguage,description:"Modelo criado por você.",draft:{title:draft.title,bodyHtml:draft.bodyHtml,language:templateLanguage,contractType:draft.type,startDate:draft.startDate||null,endDate:draft.endDate||null,contractValue:draft.value,scope:draft.scope,notes:draft.notes}});
      const template:ContractTemplate={id:response.template.id,name:response.template.name,bodyHtml:response.template.bodyHtml,language:response.template.language,description:response.template.description,draft:templateDraft(response.template.draft),custom:true};
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
    setDraft(contractRecordDraft(record)); setClientSlug(""); setSelectedModel(""); setSaved(false); setPreviewOpen(false); setMessage("Cópia local para uma nova versão. O contrato original e seu aceite serão preservados.");
  };

  return <section className="contracts-workspace">
    <div className="contracts-workspace-grid">
      <aside className="contracts-sent"><header><div><span>ENVIADOS</span><h3>Contratos recentes</h3></div><b>{records.length}</b></header>{records.length ? records.map((record) => <div className="contracts-library-record" key={record.id}><strong>{record.title}</strong><div className="contracts-library-record-meta"><span>{record.clientName}</span><span className={`contract-record-status ${record.status}`}>{record.status === "accepted" ? "Aceito" : record.status === "cancelled" ? "Cancelado" : "Aguardando aceite"}</span></div><button className="ghost-button" type="button" disabled={busy} onClick={() => newVersion(record)}>Criar nova versão</button></div>) : <p className="contracts-sent-empty">Nenhum contrato enviado ainda.</p>}</aside>
      <div className="contracts-form-card">
      <header><div><span>CONTRATO</span><h2>Novo contrato</h2><p>Preencha os dados abaixo para registrar um novo contrato na operação.</p></div><div className="contracts-form-mark">✦</div></header>
      <fieldset disabled={busy} style={{border:0,padding:0,margin:0,minWidth:0}}><div className="contracts-form-grid two"><label>Título do contrato<input autoFocus value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Ex.: Contrato de gestão de conteúdo" /></label><label>Enviar para o cliente<select value={clientSlug} onChange={(event) => setClientSlug(event.target.value)}><option value="">Selecione um cliente</option>{clients.map((client) => <option key={client.id} value={client.slug}>{client.name}</option>)}</select></label></div>
      <label className="contracts-model-picker">Usar um modelo pronto<select value={selectedModel} onChange={(event) => applyModel(event.target.value)}><option value="">Começar em branco</option>{allTemplates.map((model) => <option key={model.id} value={model.id}>{model.name} · {model.language}</option>)}</select></label>
      <div className="contracts-form-grid three"><label>Idioma<select value={draft.language} onChange={(event) => setDraft({ ...draft, language: event.target.value })}><option>Português</option><option>English</option><option>Español</option><option>Français</option><option>Italiano</option><option>Deutsch</option><option>Svenska</option></select></label><label>Tipo<select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}><option>Prestação de serviços</option><option>Mensalidade</option><option>Consultoria</option><option>Parceria</option></select></label><label>Início<input type="date" value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} /></label></div><div className="contracts-form-grid two"><label>Vencimento<input type="date" value={draft.endDate} onChange={(event) => setDraft({ ...draft, endDate: event.target.value })} /></label><label>Valor contratado<input value={draft.value} onChange={(event) => setDraft({ ...draft, value: event.target.value })} placeholder="R$ 0,00" /></label></div>
      <div className="contracts-form-grid two"><label className="wide">Escopo resumido<textarea value={draft.scope} onChange={(event) => setDraft({ ...draft, scope: event.target.value })} placeholder="Descreva os serviços e entregas incluídos." /></label></div>
      <label className="contracts-notes">Observações internas<textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Condições, responsáveis e observações importantes." /></label>
      <ContractRichEditor value={draft.bodyHtml} onChange={(bodyHtml) => setDraft((current) => ({ ...current, bodyHtml }))} />
      </fieldset><footer><small role="status">{draftState === "error" ? "Falha ao salvar localmente" : draftState === "idle" ? "Ainda não publicado" : `Rascunho local neste navegador${draftSavedAt ? ` · ${draftSavedAt.toLocaleTimeString()}` : ""}`}</small><div><button className="ghost-button" disabled={busy} onClick={() => setPreviewOpen(true)}>Visualizar prévia</button><button className="ghost-button" disabled={busy} onClick={() => protectDraft(true)}>Salvar rascunho</button><button className="gradient-button" onClick={save} disabled={busy || !draft.title.trim() || !selectedClient || fingerprint === publishedFingerprint}>{busy ? "Processando…" : "Publicar contrato"}</button></div></footer>
      {saved ? <p className="contracts-saved" role="status">✓ Contrato publicado. Aguardando aceite.</p> : null}
      {message ? <p role="status">{message}</p> : null}
    </div><aside className="contracts-library"><header><div><span>BIBLIOTECA</span><h3>Modelos prontos</h3></div><b>{allTemplates.length}</b></header>{allTemplates.map((model) => <button key={model.id} className={selectedModel === model.id ? "selected" : ""} onClick={() => applyModel(model.id)}><strong>{model.name}</strong><small>{model.language} · {model.description}</small></button>)}<button className="contracts-create-template" disabled={busy} onClick={() => setTemplateModalOpen(true)}>＋ Salvar formulário como modelo</button></aside></div>
    {previewOpen ? <div className="modal-backdrop" onClick={() => setPreviewOpen(false)}><section className="contract-preview-modal" onClick={(event) => event.stopPropagation()}><header><div><span>PRÉVIA PARA O CLIENTE</span><h2>Como o contrato será exibido</h2></div><button className="icon-close" onClick={() => setPreviewOpen(false)}>×</button></header><ContractDocumentPreview contract={draft} clientName={selectedClient?.name || draft.client} /><footer><button className="ghost-button" onClick={() => setPreviewOpen(false)}>Voltar para edição</button></footer></section></div> : null}
    {templateModalOpen ? <div className="modal-backdrop" onClick={() => setTemplateModalOpen(false)}><section className="contract-template-modal" onClick={(event) => event.stopPropagation()}><header><div><span>NOVO MODELO</span><h2>Salvar na biblioteca</h2><p>O formulário atual ficará disponível para reutilização.</p></div><button className="icon-close" onClick={() => setTemplateModalOpen(false)}>×</button></header><label>Nome do modelo<input autoFocus value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Ex.: Contrato mensal em inglês" /></label><label>Idioma<select value={templateLanguage} onChange={(event) => setTemplateLanguage(event.target.value)}><option>Português</option><option>English</option><option>Español</option><option>Français</option><option>Italiano</option><option>Deutsch</option><option>Svenska</option></select></label><footer><button className="ghost-button" onClick={() => setTemplateModalOpen(false)}>Cancelar</button><button className="gradient-button" disabled={busy || !templateName.trim()} onClick={saveTemplate}>Salvar modelo</button></footer></section></div> : null}
  </section>;
}
