import { useEffect, useRef, useState } from "react";
import {
  archiveBriefTemplate,
  briefPortalBase,
  changeBriefStatus,
  downloadBriefAttachment,
  getBriefDetail,
  getPortalBrief,
  listAdminClients,
  listAdminDesignBriefs,
  listBriefInstances,
  listBriefTemplates,
  listPortalBriefs,
  saveBriefInstance,
  saveBriefTemplate,
  savePortalBriefResponse,
  uploadBriefAttachment,
  type AdminClientOption,
  type BriefDetail,
  type BriefField,
  type BriefForm,
  type BriefInstance,
  type BriefTemplate,
  type DesignBriefRecord,
} from "./api";
import {
  BriefFormEditor,
  BriefResponseForm,
  BriefHistory,
  BriefIcon,
  BriefBadge,
  BriefEmpty,
  BriefDialog,
  briefStatusNames as statusNames,
  briefDate,
} from "./briefsDesign";
export { BriefFormEditor, BriefResponseForm } from "./briefsDesign";
const emptyForm = (): BriefForm => ({
  title: "",
  introduction: "",
  category: "custom",
  locale: "pt",
  fields: [],
});
const failure = (error: unknown) =>
  error instanceof Error ? error.message : "Não foi possível concluir a ação.";
export function BriefsFoundationWorkspace({
  viewerId,
}: { viewerId?: string } = {}) {
  const [templates, setTemplates] = useState<BriefTemplate[]>([]),
    [briefs, setBriefs] = useState<BriefInstance[]>([]),
    [clients, setClients] = useState<AdminClientOption[]>([]),
    [legacy, setLegacy] = useState<DesignBriefRecord[]>([]);
  const [detail, setDetail] = useState<BriefDetail | null>(null),
    [form, setForm] = useState<BriefForm>(emptyForm),
    [client, setClient] = useState(""),
    [templateSource, setTemplateSource] = useState<BriefTemplate | null>(null),
    [templateEditing, setTemplateEditing] = useState<BriefTemplate | null>(
      null,
    ),
    [description, setDescription] = useState("");
  const [mode, setMode] = useState<"list" | "brief" | "template">("list"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [dirty, setDirty] = useState(false),
    [legacyOpen, setLegacyOpen] = useState<DesignBriefRecord | null>(null);
  const [tab, setTab] = useState<"templates" | "briefs" | "responses">(
      "templates",
    ),
    [query, setQuery] = useState(""),
    [clientFilter, setClientFilter] = useState(""),
    [statusFilter, setStatusFilter] = useState(""),
    [chooser, setChooser] = useState(false),
    [review, setReview] = useState(false),
    [detailView, setDetailView] = useState<"form" | "response">("form"),
    [loading, setLoading] = useState(true),
    [responsesLoading, setResponsesLoading] = useState(false),
    [responses, setResponses] = useState<Record<string, BriefDetail>>({});
  const seenKey = viewerId ? `designhub:briefs:seen:${viewerId}` : null;
  const [seen, setSeen] = useState<Record<string, string>>(() => {
    try {
      return seenKey ? JSON.parse(localStorage.getItem(seenKey) ?? "{}") : {};
    } catch {
      return {};
    }
  });
  const creationId = useRef(crypto.randomUUID()),
    busyRef = useRef(false),
    refreshSequence = useRef(0);
  const refresh = async () => {
    const sequence = ++refreshSequence.current;
    const results = await Promise.allSettled([
      listBriefTemplates(),
      listBriefInstances(),
      listAdminClients(),
      listAdminDesignBriefs(),
    ]);
    results.forEach((result, index) => {
      if (sequence !== refreshSequence.current) return;
      if (result.status === "rejected") {
        setMessage(failure(result.reason));
        return;
      }
      switch (index) {
        case 0:
          setTemplates((result.value as { items: BriefTemplate[] }).items);
          break;
        case 1:
          setBriefs((result.value as { items: BriefInstance[] }).items);
          break;
        case 2:
          setClients((result.value as { items: AdminClientOption[] }).items);
          break;
        case 3:
          setLegacy((result.value as { items: DesignBriefRecord[] }).items);
      }
    });
    if (sequence !== refreshSequence.current) return;
    setLoading(false);
    const list = results[1];
    if (list.status !== "fulfilled") return;
    const eligible = (list.value as { items: BriefInstance[] }).items.filter(
      (b) =>
        b.status === "answered" ||
        b.status === "sent" ||
        b.status === "reopened" ||
        (b.status === "archived" && b.sentAt),
    );
    setResponsesLoading(true);
    let cursor = 0;
    const loaded: Record<string, BriefDetail> = {};
    let failed = false;
    await Promise.all(
      Array.from({ length: Math.min(3, eligible.length) }, async () => {
        while (cursor < eligible.length) {
          const brief = eligible[cursor++];
          try {
            const result = await getBriefDetail(brief.id);
            loaded[brief.id] = result;
          } catch {
            failed = true;
          }
        }
      }),
    );
    if (sequence === refreshSequence.current) {
      setResponses((previous) =>
        failed ? { ...previous, ...loaded } : loaded,
      );
      setResponsesLoading(false);
      if (failed)
        setMessage(
          "Algumas respostas não puderam ser carregadas. Atualize para tentar novamente.",
        );
    }
  };
  useEffect(() => {
    void refresh();
    return () => {
      refreshSequence.current++;
    };
  }, []);
  useEffect(() => {
    const before = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [dirty]);
  const run = async (task: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage("");
    try {
      await task();
    } catch (e) {
      setMessage(failure(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const canLeave = () =>
    !dirty || window.confirm("Descartar alterações ainda não salvas?");
  const start = (template: BriefTemplate | null = null, edit = false) => {
    if (!canLeave()) return false;
    creationId.current = crypto.randomUUID();
    setDetail(null);
    setForm(template ? structuredClone(template.form) : emptyForm());
    setClient("");
    setTemplateSource(edit ? null : template);
    setTemplateEditing(edit ? template : null);
    setDescription(edit ? (template?.description ?? "") : "");
    setMode(edit ? "template" : "brief");
    setDirty(false);
    setMessage("");
    setChooser(false);
    setReview(false);
    return true;
  };
  const adopt = (result: BriefDetail) => {
    setDetail(result);
    setForm(result.brief.form);
    setClient(result.brief.clientAccountId ?? "");
    setDirty(false);
  };
  const markSeen = (result: BriefDetail) => {
    const latest = result.revisions[0];
    if (!latest) return;
    setSeen((current) => {
      const next = { ...current, [result.brief.id]: latest.id };
      try {
        if (seenKey) localStorage.setItem(seenKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  };
  const save = async () => {
    const result = await saveBriefInstance(
      detail
        ? {
            clientAccountId: client || null,
            form,
            expectedVersion: detail.brief.version,
          }
        : {
            id: creationId.current,
            clientAccountId: client || null,
            templateId: templateSource?.id ?? null,
            templateVersion: templateSource?.version ?? null,
            form,
          },
      detail?.brief.id,
    );
    adopt(result);
    await refresh();
    setMessage("Rascunho salvo no servidor.");
    return result;
  };
  const open = (id: string, view?: "form" | "response") => {
    if (canLeave())
      void run(async () => {
        const result = await getBriefDetail(id);
        adopt(result);
        setMode("brief");
        setTemplateEditing(null);
        const next = view ?? (result.revisions.length ? "response" : "form");
        setDetailView(next);
        if (next === "response") markSeen(result);
      });
  };
  const back = () => {
    if (canLeave()) {
      setMode("list");
      setDirty(false);
      setReview(false);
      void refresh();
    }
  };
  const selectedClient = clients.find(
      (c) => c.id === detail?.brief.clientAccountId,
    ),
    clientName = (id: string | null) =>
      clients.find((c) => c.id === id)?.name ?? "Cliente não informado";
  const lastActivity = (brief: BriefInstance) => {
    const loaded = responses[brief.id];
    const timestamps = [
      brief.updatedAt,
      loaded?.response?.updatedAt,
      ...(loaded?.events.map((event) => event.createdAt) ?? []),
    ].filter(
      (value): value is string =>
        Boolean(value) && Number.isFinite(Date.parse(value!)),
    );
    return timestamps.sort((a, b) => Date.parse(b) - Date.parse(a))[0];
  };
  const editable =
    mode === "template" || !detail || detail.brief.status === "draft";
  const matches = (value: string) =>
    value.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"));
  const visibleTemplates = templates.filter(
    (t) =>
      matches(`${t.name} ${t.description} ${t.form.category}`) &&
      (!statusFilter || t.status === statusFilter),
  );
  const visibleBriefs = briefs.filter(
    (b) =>
      matches(`${b.form.title} ${clientName(b.clientAccountId)}`) &&
      (!clientFilter || b.clientAccountId === clientFilter) &&
      (!statusFilter || b.status === statusFilter),
  );
  const received = Object.values(responses)
    .filter((d) => d.revisions.length)
    .sort(
      (a, b) =>
        new Date(b.revisions[0].submittedAt).valueOf() -
        new Date(a.revisions[0].submittedAt).valueOf(),
    );
  const visibleResponses = received.filter(
    (d) =>
      matches(`${d.brief.form.title} ${clientName(d.brief.clientAccountId)}`) &&
      (!clientFilter || d.brief.clientAccountId === clientFilter),
  );
  const chooseTab = (value: typeof tab) => {
    setTab(value);
    setQuery("");
    setStatusFilter("");
    setClientFilter("");
  };
  const category = (value: string) =>
    ({
      custom: "Projeto personalizado",
      branding: "Identidade visual",
      logo: "Logotipo",
      social_media: "Social Media",
      website: "Site",
      editorial: "Material editorial",
    })[value] ?? value;
  return (
    <section className="brief-ui brief-workspace">
      <header className="brief-workspace-banner">
        <div>
          <span className="brief-banner-eyebrow">
            <BriefIcon />
            ESPAÇO CRIATIVO
          </span>
          <h1>Briefs de design</h1>
          <p>Boas perguntas. Projetos mais claros.</p>
        </div>
        <div className="brief-banner-actions">
          <button
            className="gradient-button"
            disabled={busy}
            onClick={() => {
              if (canLeave()) setChooser(true);
            }}
          >
            <BriefIcon name="plus" />
            Novo brief
          </button>
          <button
            className="brief-text-button"
            disabled={busy}
            onClick={() => start(null, true)}
          >
            Criar template <BriefIcon name="arrow" />
          </button>
        </div>
      </header>
      {message && (
        <p role="status" className="brief-feedback">
          {message}
        </p>
      )}
      {mode === "list" ? (
        <>
          <div
            className="brief-library-navigation"
            role="tablist"
            aria-label="Área de briefs"
          >
            {(
              [
                {
                  key: "templates",
                  label: "Templates",
                  count: templates.length,
                },
                {
                  key: "briefs",
                  label: "Briefs enviados",
                  count: briefs.length,
                },
                {
                  key: "responses",
                  label: "Respostas recebidas",
                  count: received.length,
                },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                role="tab"
                aria-selected={tab === item.key}
                className={tab === item.key ? "active" : ""}
                onClick={() => chooseTab(item.key)}
              >
                {item.label}
                {!loading &&
                  !(item.key === "responses" && responsesLoading) && (
                    <span>{item.count}</span>
                  )}
              </button>
            ))}
          </div>
          <section className="brief-library-panel">
            <div className="brief-library-heading">
              <div>
                <h2>
                  {tab === "templates"
                    ? "Sua biblioteca criativa"
                    : tab === "briefs"
                      ? "Do planejamento à resposta"
                      : "O que seus clientes compartilharam"}
                </h2>
                <p>
                  {tab === "templates"
                    ? "Formulários que você prepara uma vez e reutiliza em novos projetos."
                    : tab === "briefs"
                      ? "Continue os rascunhos e acompanhe os formulários enviados."
                      : "Consulte respostas completas e cada nova revisão, no mesmo lugar."}
                </p>
              </div>
              {tab === "templates" && (
                <button
                  className="ghost-button"
                  disabled={busy}
                  onClick={() => start(null, true)}
                >
                  <BriefIcon name="plus" />
                  Novo template
                </button>
              )}
            </div>
            <div className="brief-library-toolbar">
              <label className="brief-search">
                <BriefIcon name="eye" />
                <input
                  type="search"
                  aria-label="Buscar briefs e templates"
                  placeholder={
                    tab === "templates"
                      ? "Buscar template…"
                      : "Buscar por brief ou cliente…"
                  }
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              {tab !== "templates" && (
                <select
                  aria-label="Filtrar por cliente"
                  value={clientFilter}
                  onChange={(e) => setClientFilter(e.target.value)}
                >
                  <option value="">Todos os clientes</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
              {tab !== "responses" && (
                <select
                  aria-label="Filtrar por status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">Todos os status</option>
                  {tab === "templates" ? (
                    <>
                      <option value="active">Ativos</option>
                      <option value="archived">Arquivados</option>
                    </>
                  ) : (
                    Object.entries(statusNames).map(([value, label]) => (
                      <option value={value} key={value}>
                        {label}
                      </option>
                    ))
                  )}
                </select>
              )}
              <button
                className="brief-icon-button"
                disabled={busy || responsesLoading}
                aria-label="Atualizar biblioteca"
                onClick={() => void refresh()}
              >
                <BriefIcon name="clock" />
              </button>
            </div>
            {loading ||
            (tab === "responses" && responsesLoading && !received.length) ? (
              <p className="brief-loading" role="status">
                Carregando {tab === "responses" ? "respostas" : "biblioteca"}…
              </p>
            ) : tab === "templates" ? (
              visibleTemplates.length ? (
                <div className="brief-template-grid">
                  {visibleTemplates.map((template) => (
                    <article
                      key={template.id}
                      className={`brief-template-card${template.status === "archived" ? " archived" : ""}`}
                    >
                      <div className="brief-template-top">
                        <span className="brief-template-symbol">
                          <BriefIcon />
                        </span>
                        <span className={`brief-status ${template.status}`}>
                          {template.status === "active" ? "Ativo" : "Arquivado"}
                        </span>
                      </div>
                      <span className="brief-template-category">
                        {category(template.form.category)}
                      </span>
                      <h3>{template.name}</h3>
                      <p>
                        {template.description ||
                          "Um formulário preparado para conhecer melhor o projeto."}
                      </p>
                      <div className="brief-template-meta">
                        <span>
                          {template.form.fields.length}{" "}
                          {template.form.fields.length === 1
                            ? "campo"
                            : "campos"}
                        </span>
                        <span>
                          Atualizado em{" "}
                          {briefDate(
                            (template as BriefTemplate & { updatedAt?: string })
                              .updatedAt,
                          )}
                        </span>
                      </div>
                      <div className="brief-template-actions">
                        {template.status === "active" && (
                          <>
                            <button
                              className="brief-use-button"
                              disabled={busy}
                              onClick={() => start(template)}
                            >
                              Usar <BriefIcon name="arrow" />
                            </button>
                            <button
                              className="brief-icon-button"
                              disabled={busy}
                              aria-label={`Editar template ${template.name}`}
                              onClick={() => start(template, true)}
                            >
                              <BriefIcon name="edit" />
                            </button>
                          </>
                        )}
                        <button
                          className="brief-icon-button"
                          disabled={busy}
                          aria-label={`Duplicar template ${template.name}`}
                          onClick={() => {
                            if (start(template, true)) {
                              setTemplateEditing(null);
                              setForm({
                                ...structuredClone(template.form),
                                title: `${template.name.slice(0, 247)} (cópia)`,
                              });
                              setDirty(true);
                            }
                          }}
                        >
                          <BriefIcon name="copy" />
                        </button>
                        {template.status === "active" && (
                          <button
                            className="brief-icon-button"
                            disabled={busy}
                            aria-label={`Arquivar template ${template.name}`}
                            onClick={() =>
                              void run(async () => {
                                if (
                                  !window.confirm(
                                    "Arquivar este template? Os briefs enviados serão preservados.",
                                  )
                                )
                                  return;
                                await archiveBriefTemplate(template);
                                await refresh();
                              })
                            }
                          >
                            <BriefIcon name="file" />
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <BriefEmpty
                  title={
                    query || statusFilter
                      ? "Nenhum template encontrado"
                      : "Sua próxima boa ideia começa aqui."
                  }
                  description={
                    query || statusFilter
                      ? "Tente outra busca ou limpe os filtros."
                      : "Crie um modelo com as perguntas certas para cada tipo de projeto."
                  }
                  action={
                    query || statusFilter
                      ? "Limpar filtros"
                      : "Criar primeiro template"
                  }
                  onAction={() =>
                    query || statusFilter
                      ? (setQuery(""), setStatusFilter(""))
                      : start(null, true)
                  }
                />
              )
            ) : tab === "briefs" ? (
              visibleBriefs.length ? (
                <div className="brief-sent-list">
                  {visibleBriefs.map((brief) => (
                    <article className="brief-sent-card" key={brief.id}>
                      <span className="brief-client-avatar">
                        {clientName(brief.clientAccountId).slice(0, 1)}
                      </span>
                      <div className="brief-sent-copy">
                        <small>{clientName(brief.clientAccountId)}</small>
                        <h3>{brief.form.title}</h3>
                        {brief.templateId && (
                          <p>
                            Modelo:{" "}
                            {templates.find((t) => t.id === brief.templateId)
                              ?.name ?? "Template de origem"}{" "}
                            · versão {brief.templateVersion}
                          </p>
                        )}
                      </div>
                      <div className="brief-sent-dates">
                        <small>
                          {brief.sentAt
                            ? `Enviado em ${briefDate(brief.sentAt)}`
                            : "Ainda não enviado"}
                        </small>
                        <span>
                          Última atividade · {briefDate(lastActivity(brief))}
                        </span>
                      </div>
                      <BriefBadge status={brief.status} />
                      <button
                        className="brief-text-button"
                        disabled={busy}
                        onClick={() => open(brief.id, "form")}
                      >
                        {brief.status === "draft"
                          ? "Continuar rascunho"
                          : "Ver formulário"}
                        <BriefIcon name="arrow" />
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <BriefEmpty
                  title={
                    query || clientFilter || statusFilter
                      ? "Nenhum brief encontrado"
                      : "Tudo começa com um bom brief."
                  }
                  description={
                    query || clientFilter || statusFilter
                      ? "Altere os filtros para encontrar outros projetos."
                      : "Escolha um modelo ou comece do zero, prepare as perguntas e envie ao cliente."
                  }
                  action={
                    query || clientFilter || statusFilter
                      ? "Limpar filtros"
                      : "Criar primeiro brief"
                  }
                  onAction={() =>
                    query || clientFilter || statusFilter
                      ? (setQuery(""), setClientFilter(""), setStatusFilter(""))
                      : setChooser(true)
                  }
                />
              )
            ) : visibleResponses.length ? (
              <div className="brief-received-list">
                {visibleResponses.map((result) => {
                  const latest = result.revisions[0],
                    fresh = seen[result.brief.id] !== latest.id;
                  return (
                    <article
                      className="brief-received-card"
                      key={result.brief.id}
                    >
                      <span className="brief-response-symbol">
                        <BriefIcon name="check" />
                      </span>
                      <div className="brief-received-copy">
                        <small>
                          {clientName(result.brief.clientAccountId)}
                        </small>
                        <h3>{result.brief.form.title}</h3>
                        <p>
                          Resposta enviada em{" "}
                          {briefDate(latest.submittedAt, true)}
                        </p>
                        <small>
                          Brief enviado em {briefDate(result.brief.sentAt)}
                        </small>
                      </div>
                      <div className="brief-received-labels">
                        <span className="brief-revision-badge">
                          Revisão {latest.revision}
                        </span>
                        {fresh && (
                          <span
                            className="brief-new-badge"
                            title="Ainda não consultada neste dispositivo"
                          >
                            Nova resposta
                          </span>
                        )}
                      </div>
                      <button
                        disabled={busy}
                        className="brief-text-button"
                        onClick={() => open(result.brief.id, "response")}
                      >
                        Ler resposta
                        <BriefIcon name="arrow" />
                      </button>
                    </article>
                  );
                })}
              </div>
            ) : (
              <BriefEmpty
                title={
                  query || clientFilter
                    ? "Nenhuma resposta encontrada"
                    : "As respostas vão chegar por aqui."
                }
                description={
                  query || clientFilter
                    ? "Tente outra busca ou escolha outro cliente."
                    : "Envie um brief pelo portal. Quando o cliente responder, você poderá consultar cada detalhe e revisão."
                }
                action={
                  query || clientFilter
                    ? "Limpar filtros"
                    : "Ver briefs enviados"
                }
                onAction={() =>
                  query || clientFilter
                    ? (setQuery(""), setClientFilter(""))
                    : chooseTab("briefs")
                }
              />
            )}
          </section>
          {tab === "briefs" && legacy.length > 0 && (
            <details className="brief-legacy">
              <summary>
                Briefs anteriores · Somente consulta{" "}
                <span>{legacy.length}</span>
              </summary>
              {legacy.map((brief) => (
                <button
                  className="brief-text-button"
                  key={brief.id}
                  onClick={() => setLegacyOpen(brief)}
                >
                  {brief.title}
                  <BriefIcon name="arrow" />
                </button>
              ))}
              {legacyOpen && (
                <article>
                  <h3>{legacyOpen.title}</h3>
                  <p>{legacyOpen.introduction}</p>
                  {legacyOpen.fields.map((field) => (
                    <div key={field.id}>
                      <strong>{field.label}</strong>
                      <p>
                        {typeof legacyOpen.answers[field.id] === "string"
                          ? String(legacyOpen.answers[field.id])
                          : JSON.stringify(
                              legacyOpen.answers[field.id] ?? "Não informado",
                            )}
                      </p>
                    </div>
                  ))}
                </article>
              )}
            </details>
          )}
        </>
      ) : (
        <div className="brief-detail-workspace">
          <div className="brief-editor-heading">
            <button
              className="brief-text-button brief-back-button"
              disabled={busy}
              onClick={back}
            >
              ← Voltar à biblioteca
            </button>
            <div>
              <span className="brief-editor-state">
                {mode === "template"
                  ? templateEditing
                    ? `Editando template · v${templateEditing.version}`
                    : "Novo template"
                  : detail
                    ? statusNames[detail.brief.status]
                    : "Novo brief"}
              </span>
              {editable && (
                <span className={`brief-save-state${dirty ? " pending" : ""}`}>
                  <BriefIcon name={dirty ? "clock" : "check"} />
                  {dirty
                    ? "Alterações não salvas"
                    : detail || templateEditing
                      ? "Salvo"
                      : "Comece pelas perguntas"}
                </span>
              )}
            </div>
          </div>
          {editable ? (
            <>
              <div className="brief-editor-title">
                <h2>
                  {mode === "template"
                    ? "Prepare um modelo reutilizável"
                    : "Vamos entender o próximo projeto."}
                </h2>
                <p>
                  {mode === "template"
                    ? "Ajuste as perguntas. Seus briefs já enviados continuam iguais."
                    : "Monte o formulário, escolha o cliente e revise antes de enviar."}
                </p>
              </div>
              {mode === "template" && (
                <label className="brief-template-description">
                  Descrição do template
                  <textarea
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      setDirty(true);
                    }}
                    placeholder="Explique quando usar este modelo."
                  />
                </label>
              )}
              <BriefFormEditor
                titleMaxLength={mode === "template" ? 255 : 500}
                key={
                  detail?.brief.id ?? templateEditing?.id ?? creationId.current
                }
                form={form}
                onChange={(value) => {
                  setForm(value);
                  setDirty(true);
                }}
              />
              {mode === "brief" && (
                <label className="brief-client-picker">
                  Cliente
                  <select
                    value={client}
                    onChange={(e) => {
                      setClient(e.target.value);
                      setDirty(true);
                    }}
                  >
                    <option value="">Selecione o cliente</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <footer className="brief-editor-footer">
                <div>
                  <small>
                    {mode === "template"
                      ? "Modelo reutilizável"
                      : client
                        ? clientName(client)
                        : "Escolha o cliente antes de enviar"}
                  </small>
                  <span>
                    {form.fields.length}{" "}
                    {form.fields.length === 1 ? "pergunta" : "perguntas"} ·{" "}
                    {form.fields.filter((f) => f.required).length} obrigatórias
                  </span>
                </div>
                <div className="brief-footer-actions">
                  {mode === "template" ? (
                    <button
                      className="gradient-button"
                      disabled={busy || !form.title.trim()}
                      onClick={() =>
                        void run(async () => {
                          const result = await saveBriefTemplate(
                            {
                              ...(templateEditing
                                ? { expectedVersion: templateEditing.version }
                                : { id: creationId.current }),
                              name: form.title,
                              description,
                              form,
                            },
                            templateEditing?.id,
                          );
                          setTemplateEditing(result.template);
                          setForm(result.template.form);
                          setDirty(false);
                          await refresh();
                          setMessage(
                            "Template salvo. Envios anteriores permanecem iguais.",
                          );
                        })
                      }
                    >
                      <BriefIcon name="check" />
                      Salvar template
                    </button>
                  ) : (
                    <>
                      <button
                        className="brief-text-button brief-save-model"
                        disabled={busy || !form.fields.length}
                        onClick={() => {
                          if (canLeave()) {
                            setMode("template");
                            setTemplateEditing(null);
                            creationId.current = crypto.randomUUID();
                            setDescription("");
                            setDirty(true);
                          }
                        }}
                      >
                        Salvar como template
                      </button>
                      <button
                        className="ghost-button"
                        disabled={busy || !form.title.trim()}
                        onClick={() =>
                          void run(async () => {
                            await save();
                          })
                        }
                      >
                        Salvar rascunho
                      </button>
                      <button
                        className="gradient-button"
                        disabled={
                          busy || !form.title.trim() || !form.fields.length
                        }
                        onClick={() => setReview(true)}
                      >
                        <BriefIcon name="send" />
                        Revisar e enviar
                      </button>
                    </>
                  )}
                </div>
              </footer>
            </>
          ) : (
            detail && (
              <>
                <div className="brief-frozen-heading">
                  <div>
                    <small>{selectedClient?.name ?? "Cliente"}</small>
                    <h2>{detail.brief.form.title}</h2>
                    <p>
                      Enviado em {briefDate(detail.brief.sentAt, true)} · Este
                      formulário não pode ser alterado.
                    </p>
                  </div>
                  <BriefBadge status={detail.brief.status} />
                </div>
                <div
                  className="brief-builder-view"
                  role="tablist"
                  aria-label="Consultar brief"
                >
                  <button
                    role="tab"
                    aria-selected={detailView === "form"}
                    className={detailView === "form" ? "active" : ""}
                    onClick={() => setDetailView("form")}
                  >
                    <BriefIcon />
                    Formulário enviado
                  </button>
                  <button
                    role="tab"
                    aria-selected={detailView === "response"}
                    className={detailView === "response" ? "active" : ""}
                    onClick={() => {
                      setDetailView("response");
                      markSeen(detail);
                    }}
                  >
                    <BriefIcon name="check" />
                    Resposta e histórico
                  </button>
                </div>
                {detailView === "response" ? (
                  <BriefHistory
                    detail={detail}
                    base="/api/briefs"
                    clientName={selectedClient?.name}
                    onError={setMessage}
                  />
                ) : (
                  <BriefResponseForm
                    form={detail.brief.form}
                    answers={{}}
                    readOnly
                    definitionOnly
                    attachments={[]}
                  />
                )}
                <div className="brief-frozen-actions">
                  {detail.brief.status === "answered" && (
                    <button
                      className="ghost-button"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          adopt(
                            await changeBriefStatus(detail.brief, "reopen"),
                          );
                          await refresh();
                        })
                      }
                    >
                      <BriefIcon name="clock" />
                      Reabrir para nova resposta
                    </button>
                  )}
                  {detail.brief.status !== "archived" && (
                    <button
                      className="brief-text-button"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          if (
                            !window.confirm(
                              "Arquivar o brief? O histórico será preservado.",
                            )
                          )
                            return;
                          adopt(
                            await changeBriefStatus(detail.brief, "archive"),
                          );
                          await refresh();
                        })
                      }
                    >
                      Arquivar brief
                    </button>
                  )}
                </div>
              </>
            )
          )}
        </div>
      )}
      {chooser && (
        <BriefDialog
          title="Como você quer começar?"
          onClose={() => setChooser(false)}
          wide
        >
          <p className="brief-dialog-intro">
            Escolha um modelo pronto ou crie as perguntas do seu projeto.
          </p>
          <button className="brief-blank-choice" onClick={() => start()}>
            <span>
              <BriefIcon name="plus" />
            </span>
            <div>
              <strong>Começar do zero</strong>
              <small>Um formulário com a sua abordagem.</small>
            </div>
            <BriefIcon name="arrow" />
          </button>
          <h3 className="brief-dialog-section-title">Usar um template</h3>
          <div className="brief-chooser-grid">
            {templates
              .filter((t) => t.status === "active")
              .map((template) => (
                <button key={template.id} onClick={() => start(template)}>
                  <BriefIcon />
                  <strong>{template.name}</strong>
                  <small>
                    {category(template.form.category)} ·{" "}
                    {template.form.fields.length} campos
                  </small>
                </button>
              ))}
          </div>
          {!templates.some((t) => t.status === "active") && (
            <p className="brief-dialog-intro">
              Você ainda não tem modelos ativos. Comece do zero e salve seu
              primeiro template.
            </p>
          )}
        </BriefDialog>
      )}
      {review && (
        <BriefDialog
          title="Tudo pronto para enviar?"
          onClose={() => {
            if (!busy) setReview(false);
          }}
          wide
        >
          <div className="brief-send-review">
            <label>
              Enviar para
              <select
                value={client}
                disabled={busy}
                onChange={(e) => {
                  setClient(e.target.value);
                  setDirty(true);
                }}
              >
                <option value="">Selecione o cliente</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="brief-review-document">
              <BriefIcon />
              <div>
                <strong>{form.title}</strong>
                <small>
                  {form.fields.length} campos ·{" "}
                  {form.fields.filter((f) => f.required).length} obrigatórios
                </small>
              </div>
            </div>
            <div className="brief-freeze-notice">
              <BriefIcon name="check" />
              <p>
                Depois de enviado, este formulário não poderá ser alterado.
                Alterações no template serão aplicadas somente a novos briefs.
              </p>
            </div>
            <details>
              <summary>Revisar perguntas</summary>
              <BriefResponseForm
                form={form}
                answers={{}}
                readOnly
                definitionOnly
                attachments={[]}
              />
            </details>
            {message && (
              <p className="brief-feedback" role="status">
                {message}
              </p>
            )}
            <footer>
              <button
                className="ghost-button"
                disabled={busy}
                onClick={() => setReview(false)}
              >
                Continuar editando
              </button>
              <button
                className="gradient-button"
                disabled={busy || !client}
                onClick={() =>
                  void run(async () => {
                    const saved = dirty || !detail ? await save() : detail;
                    const sent = await changeBriefStatus(saved.brief, "send");
                    adopt(sent);
                    setDetailView("form");
                    setReview(false);
                    await refresh();
                    setMessage("Brief enviado ao portal.");
                  })
                }
              >
                <BriefIcon name="send" />
                {busy ? "Enviando…" : "Confirmar envio"}
              </button>
            </footer>
          </div>
        </BriefDialog>
      )}
    </section>
  );
}
export function PortalBriefsFoundation({
  slug,
  canRespond,
  onBriefsChange,
}: {
  slug: string;
  canRespond: boolean;
  onBriefsChange?: (items: BriefInstance[]) => void;
}) {
  const [base, setBase] = useState(""),
    [briefs, setBriefs] = useState<BriefInstance[]>([]),
    [detail, setDetail] = useState<BriefDetail | null>(null),
    [answers, setAnswers] = useState<Record<string, unknown>>({}),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const busyRef = useRef(false),
    submitKey = useRef<string | null>(null);
  useEffect(() => {
    let alive = true;
    setDetail(null);
    setDirty(false);
    void briefPortalBase(slug)
      .then(async (url) => {
        const result = await listPortalBriefs(url);
        if (alive) {
          setBase(url);
          setBriefs(result.items);
          onBriefsChange?.(result.items);
        }
      })
      .catch((e) => {
        if (alive) setMessage(failure(e));
      });
    return () => {
      alive = false;
    };
  }, [slug, onBriefsChange]);
  useEffect(() => {
    const before = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [dirty]);
  const refreshBriefs = async () => {
    const { items } = await listPortalBriefs(base);
    setBriefs(items);
    onBriefsChange?.(items);
  };
  const run = async (task: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage("");
    try {
      await task();
    } catch (e) {
      setMessage(failure(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const adopt = (result: BriefDetail) => {
    setDetail(result);
    setAnswers(result.response?.answers ?? {});
    setDirty(false);
  };
  const writable =
    canRespond && detail && ["sent", "reopened"].includes(detail.brief.status);
  return (
    <section className="brief-foundation-workspace brief-ui brief-portal-workspace">
      <h1>Briefs de design</h1>
      {message && (
        <p role="status" className="form-feedback">
          {message}
        </p>
      )}
      {!detail ? (
        <>
          <p>
            Preencha os briefs pendentes ou consulte suas respostas enviadas.
          </p>
          <div className="brief-foundation-list">
            {briefs.map((brief) => (
              <button
                disabled={busy}
                className="ghost-button"
                key={brief.id}
                onClick={() =>
                  void run(async () => {
                    adopt(await getPortalBrief(base, brief.id));
                    submitKey.current = null;
                  })
                }
              >
                {brief.form.title} · {statusNames[brief.status]}
              </button>
            ))}
          </div>
          {!briefs.length && <p>Nenhum brief enviado para sua conta.</p>}
        </>
      ) : (
        <>
          <button
            className="ghost-button"
            disabled={busy}
            onClick={() => {
              if (dirty && !window.confirm("Descartar alterações não salvas?"))
                return;
              setDetail(null);
              setDirty(false);
              void run(async () =>
                refreshBriefs(),
              );
            }}
          >
            ← Voltar aos briefs
          </button>
          <p>{statusNames[detail.brief.status]}</p>
          {writable ? (
            <>
              <BriefResponseForm
                form={detail.brief.form}
                answers={answers}
                onChange={(value) => {
                  setAnswers(value);
                  setDirty(true);
                  submitKey.current = null;
                }}
                readOnly={false}
                busy={busy}
                attachments={detail.attachments}
                onDownload={(file) =>
                  void run(async () =>
                    downloadBriefAttachment(base, detail.brief.id, file),
                  )
                }
                onUpload={(field, file) =>
                  void run(async () => {
                    if (dirty) {
                      const saved = await savePortalBriefResponse(
                        base,
                        detail,
                        answers,
                      );
                      adopt(saved);
                      adopt(
                        await uploadBriefAttachment(base, saved, field, file),
                      );
                    } else
                      adopt(
                        await uploadBriefAttachment(base, detail, field, file),
                      );
                    submitKey.current = null;
                    setMessage("Anexo salvo na resposta.");
                  })
                }
              />
              <div className="brief-foundation-actions brief-portal-actions">
                <button
                  className="ghost-button"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      adopt(
                        await savePortalBriefResponse(base, detail, answers),
                      );
                      setMessage("Rascunho salvo.");
                    })
                  }
                >
                  Salvar rascunho
                </button>
                <button
                  className="gradient-button"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      submitKey.current ??= crypto.randomUUID();
                      adopt(
                        await savePortalBriefResponse(
                          base,
                          detail,
                          answers,
                          submitKey.current,
                        ),
                      );
                      await refreshBriefs();
                      setMessage(
                        "Resposta enviada. Uma cópia foi preservada no histórico.",
                      );
                    })
                  }
                >
                  Enviar resposta
                </button>
              </div>
              {detail.revisions.length > 0 && (
                <details>
                  <summary>Consultar respostas anteriores</summary>
                  <BriefHistory
                    detail={detail}
                    base={base}
                    onError={setMessage}
                  />
                </details>
              )}
            </>
          ) : (
            <BriefHistory detail={detail} base={base} onError={setMessage} />
          )}
        </>
      )}
    </section>
  );
}
