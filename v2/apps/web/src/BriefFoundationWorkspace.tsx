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
const emptyForm = (): BriefForm => ({
  title: "",
  introduction: "",
  category: "custom",
  locale: "pt",
  fields: [],
});
const names: Record<BriefField["type"], string> = {
  short: "Texto curto",
  long: "Texto longo",
  choice: "Escolha única",
  checklist: "Checkbox",
  dropdown: "Dropdown",
  number: "Número",
  date: "Data",
  link: "Link",
  scale: "Escala/nota",
  file: "Arquivo/imagem",
};
const statusNames: Record<BriefInstance["status"], string> = {
  draft: "Rascunho",
  sent: "Enviado",
  answered: "Respondido",
  reopened: "Reaberto",
  archived: "Arquivado",
};
const failure = (error: unknown) =>
  error instanceof Error ? error.message : "Não foi possível concluir a ação.";
export function BriefFormEditor({
  form,
  onChange,
}: {
  form: BriefForm;
  onChange: (form: BriefForm) => void;
}) {
  const update = (id: string, patch: Partial<BriefField>) =>
    onChange({
      ...form,
      fields: form.fields.map((field) =>
        field.id === id ? { ...field, ...patch } : field,
      ),
    });
  const move = (index: number, delta: number) => {
    const fields = [...form.fields];
    [fields[index], fields[index + delta]] = [
      fields[index + delta],
      fields[index],
    ];
    onChange({ ...form, fields });
  };
  return (
    <div className="brief-foundation-form">
      <label>
        Título
        <input
          value={form.title}
          onChange={(e) => onChange({ ...form, title: e.target.value })}
          maxLength={500}
        />
      </label>
      <label>
        Categoria
        <input
          value={form.category}
          onChange={(e) => onChange({ ...form, category: e.target.value })}
          maxLength={100}
        />
      </label>
      <label>
        Idioma
        <select
          value={form.locale}
          onChange={(e) =>
            onChange({ ...form, locale: e.target.value as BriefForm["locale"] })
          }
        >
          {["pt", "en", "es", "it", "sv"].map((locale) => (
            <option key={locale}>{locale}</option>
          ))}
        </select>
      </label>
      <label>
        Introdução/instruções
        <textarea
          value={form.introduction}
          onChange={(e) => onChange({ ...form, introduction: e.target.value })}
        />
      </label>
      {form.fields.map((field, index) => (
        <fieldset key={field.id}>
          <legend>Campo {index + 1}</legend>
          <label>
            Pergunta
            <input
              value={field.label}
              onChange={(e) => update(field.id, { label: e.target.value })}
            />
          </label>
          <label>
            Tipo
            <select
              value={field.type}
              onChange={(e) => {
                const type = e.target.value as BriefField["type"];
                update(field.id, {
                  type,
                  options: ["choice", "checklist", "dropdown"].includes(type)
                    ? ["Opção 1", "Opção 2"]
                    : [],
                  validation: {},
                });
              }}
            >
              {Object.entries(names).map(([type, name]) => (
                <option key={type} value={type}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Instruções
            <textarea
              value={field.help}
              onChange={(e) => update(field.id, { help: e.target.value })}
            />
          </label>
          <label className="brief-foundation-check">
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) => update(field.id, { required: e.target.checked })}
            />
            Obrigatório
          </label>
          {["choice", "checklist", "dropdown"].includes(field.type) && (
            <label>
              Opções (uma por linha)
              <textarea
                value={field.options.join("\n")}
                onChange={(e) =>
                  update(field.id, { options: e.target.value.split("\n") })
                }
              />
            </label>
          )}
          {["number", "scale"].includes(field.type) && (
            <div className="brief-foundation-actions">
              {(["min", "max"] as const).map((key) => (
                <label key={key}>
                  {key === "min" ? "Mínimo" : "Máximo"}
                  <input
                    type="number"
                    value={field.validation[key] ?? ""}
                    onChange={(e) =>
                      update(field.id, {
                        validation: {
                          ...field.validation,
                          [key]:
                            e.target.value === ""
                              ? undefined
                              : Number(e.target.value),
                        },
                      })
                    }
                  />
                </label>
              ))}
            </div>
          )}
          {["short", "long", "file"].includes(field.type) && (
            <label>
              {field.type === "file"
                ? "Máximo de arquivos"
                : "Máximo de caracteres"}
              <input
                type="number"
                min={1}
                value={
                  (field.type === "file"
                    ? field.validation.maxFiles
                    : field.validation.maxLength) ?? ""
                }
                onChange={(e) =>
                  update(field.id, {
                    validation: {
                      ...field.validation,
                      [field.type === "file" ? "maxFiles" : "maxLength"]:
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value),
                    },
                  })
                }
              />
            </label>
          )}
          <div className="brief-foundation-actions">
            <button
              className="ghost-button"
              disabled={index === 0}
              onClick={() => move(index, -1)}
            >
              ↑ Subir
            </button>
            <button
              className="ghost-button"
              disabled={index === form.fields.length - 1}
              onClick={() => move(index, 1)}
            >
              ↓ Descer
            </button>
            <button
              className="ghost-button"
              onClick={() =>
                onChange({
                  ...form,
                  fields: form.fields.filter((f) => f.id !== field.id),
                })
              }
            >
              Remover campo
            </button>
          </div>
        </fieldset>
      ))}
      <button
        className="ghost-button"
        onClick={() =>
          onChange({
            ...form,
            fields: [
              ...form.fields,
              {
                id: crypto.randomUUID(),
                type: "short",
                label: "Nova pergunta",
                help: "",
                required: false,
                options: [],
                validation: {},
              },
            ],
          })
        }
      >
        + Adicionar campo
      </button>
    </div>
  );
}
export function BriefResponseForm({
  form,
  answers,
  onChange,
  readOnly,
  onUpload,
  onDownload,
  attachments,
  busy = false,
}: {
  form: BriefForm;
  answers: Record<string, unknown>;
  onChange?: (answers: Record<string, unknown>) => void;
  readOnly: boolean;
  onUpload?: (fieldId: string, file: File) => void;
  onDownload?: (attachment: BriefDetail["attachments"][number]) => void;
  attachments: BriefDetail["attachments"];
  busy?: boolean;
}) {
  const set = (id: string, value: unknown) =>
    onChange?.({ ...answers, [id]: value });
  return (
    <div className="brief-foundation-form">
      <h2>{form.title}</h2>
      <p className="brief-foundation-lines">{form.introduction}</p>
      {form.fields.map((field) => {
        const value = answers[field.id];
        return (
          <fieldset key={field.id}>
            <legend>
              {field.label}
              {field.required ? " *" : ""}
            </legend>
            {field.help && (
              <p className="brief-foundation-lines">{field.help}</p>
            )}
            {field.type === "file" ? (
              <div>
                {((value ?? []) as string[]).map((id) => {
                  const file = attachments.find((a) => a.id === id);
                  return file ? (
                    <div key={id}>
                      <button
                        className="ghost-button"
                        disabled={busy}
                        onClick={() => onDownload?.(file)}
                      >
                        {file.name} · Baixar
                      </button>
                      {!readOnly && (
                        <button
                          className="ghost-button"
                          onClick={() =>
                            set(
                              field.id,
                              (value as string[]).filter((v) => v !== id),
                            )
                          }
                        >
                          Retirar da resposta
                        </button>
                      )}
                    </div>
                  ) : (
                    <p key={id}>Anexo indisponível</p>
                  );
                })}
                {!readOnly && (
                  <label>
                    Adicionar arquivo
                    <input
                      disabled={busy}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) onUpload?.(field.id, file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
            ) : readOnly ? (
              <p className="brief-foundation-lines">
                {Array.isArray(value)
                  ? value.join(", ")
                  : value === undefined || value === null || value === ""
                    ? "Sem resposta"
                    : String(value)}
              </p>
            ) : field.type === "long" ? (
              <textarea
                disabled={busy}
                aria-label={field.label}
                value={String(value ?? "")}
                onChange={(e) => set(field.id, e.target.value)}
              />
            ) : field.type === "choice" || field.type === "dropdown" ? (
              <select
                disabled={busy}
                aria-label={field.label}
                value={String(value ?? "")}
                onChange={(e) => set(field.id, e.target.value)}
              >
                <option value="">Selecione</option>
                {field.options.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            ) : field.type === "checklist" ? (
              <div>
                {field.options.map((option) => (
                  <label className="brief-foundation-check" key={option}>
                    <input
                      disabled={busy}
                      type="checkbox"
                      checked={Array.isArray(value) && value.includes(option)}
                      onChange={(e) =>
                        set(
                          field.id,
                          e.target.checked
                            ? [...(Array.isArray(value) ? value : []), option]
                            : (Array.isArray(value) ? value : []).filter(
                                (v) => v !== option,
                              ),
                        )
                      }
                    />
                    {option}
                  </label>
                ))}
              </div>
            ) : (
              <input
                disabled={busy}
                aria-label={field.label}
                type={
                  field.type === "number" || field.type === "scale"
                    ? "number"
                    : field.type === "date"
                      ? "date"
                      : field.type === "link"
                        ? "url"
                        : "text"
                }
                min={
                  field.validation.min ??
                  (field.type === "scale" ? 1 : undefined)
                }
                max={
                  field.validation.max ??
                  (field.type === "scale" ? 5 : undefined)
                }
                maxLength={field.validation.maxLength}
                step={field.type === "scale" ? 1 : "any"}
                value={String(value ?? "")}
                onChange={(e) =>
                  set(
                    field.id,
                    ["number", "scale"].includes(field.type) &&
                      e.target.value !== ""
                      ? Number(e.target.value)
                      : e.target.value,
                  )
                }
              />
            )}
          </fieldset>
        );
      })}
    </div>
  );
}
function BriefHistory({
  detail,
  base,
  onError,
}: {
  detail: BriefDetail;
  base: string;
  onError: (message: string) => void;
}) {
  const [revision, setRevision] = useState<number | null>(null);
  useEffect(
    () => setRevision(null),
    [detail.brief.id, detail.response?.version],
  );
  const selected = detail.revisions.find((r) => r.revision === revision);
  const answers = selected?.answers ?? detail.response?.answers ?? {};
  return (
    <section>
      <h3>Respostas e revisões</h3>
      {detail.response && (
        <p>
          {detail.response.status === "submitted"
            ? "Resposta enviada"
            : "Rascunho da resposta"}
          {detail.response.submittedAt
            ? ` · Última submissão: ${new Date(detail.response.submittedAt).toLocaleString("pt-BR")}`
            : ""}
        </p>
      )}
      <label>
        Versão consultada
        <select
          value={revision ?? "current"}
          onChange={(e) =>
            setRevision(
              e.target.value === "current" ? null : Number(e.target.value),
            )
          }
        >
          <option value="current">Estado atual</option>
          {detail.revisions.map((r) => (
            <option key={r.id} value={r.revision}>
              Revisão {r.revision} ·{" "}
              {new Date(r.submittedAt).toLocaleString("pt-BR")}
            </option>
          ))}
        </select>
      </label>
      {selected && (
        <p>
          Respondente: {selected.submittedByUserId ?? "Usuário indisponível"}
        </p>
      )}
      <BriefResponseForm
        form={detail.brief.form}
        answers={answers}
        readOnly
        attachments={detail.attachments}
        onDownload={(file) =>
          void downloadBriefAttachment(base, detail.brief.id, file).catch((e) =>
            onError(failure(e)),
          )
        }
      />
      <details>
        <summary>Histórico do brief</summary>
        {detail.events.map((event) => (
          <p key={event.id}>
            {event.action} · {new Date(event.createdAt).toLocaleString("pt-BR")}
            {event.revision ? ` · Revisão ${event.revision}` : ""}
          </p>
        ))}
      </details>
    </section>
  );
}
export function BriefsFoundationWorkspace() {
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
  const creationId = useRef(crypto.randomUUID());
  const busyRef = useRef(false);
  const refresh = async () => {
    const results = await Promise.allSettled([
      listBriefTemplates(),
      listBriefInstances(),
      listAdminClients(),
      listAdminDesignBriefs(),
    ]);
    results.forEach((result, index) => {
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
  };
  useEffect(() => {
    void refresh();
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
    if (!canLeave()) return;
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
  };
  const adopt = (result: BriefDetail) => {
    setDetail(result);
    setForm(result.brief.form);
    setClient(result.brief.clientAccountId ?? "");
    setDirty(false);
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
  const open = (id: string) => {
    if (canLeave())
      void run(async () => {
        adopt(await getBriefDetail(id));
        setMode("brief");
        setTemplateEditing(null);
      });
  };
  const selectedClient = clients.find(
    (c) => c.id === detail?.brief.clientAccountId,
  );
  return (
    <section className="brief-foundation-workspace">
      <header className="design-brief-builder-toolbar">
        <div>
          <h2>Briefs de design</h2>
          <p>Templates, envios e respostas preservadas.</p>
        </div>
        <div className="brief-foundation-actions">
          <button
            className="gradient-button"
            disabled={busy}
            onClick={() => start()}
          >
            Novo brief
          </button>
          <button
            className="ghost-button"
            disabled={busy}
            onClick={() => {
              start(null, true);
            }}
          >
            Novo template
          </button>
        </div>
      </header>
      {message && (
        <p role="status" className="form-feedback">
          {message}
        </p>
      )}
      {mode === "list" ? (
        <>
          <h3>Templates</h3>
          <div className="brief-foundation-list">
            {templates.map((template) => (
              <article className="glass" key={template.id}>
                <strong>{template.name}</strong>
                <p>
                  {template.form.category} · v{template.version} ·{" "}
                  {template.status === "active" ? "Ativo" : "Arquivado"}
                </p>
                <div className="brief-foundation-actions">
                  {template.status === "active" && (
                    <>
                      <button
                        disabled={busy}
                        className="ghost-button"
                        onClick={() => start(template)}
                      >
                        Usar template
                      </button>
                      <button
                        disabled={busy}
                        className="ghost-button"
                        onClick={() => start(template, true)}
                      >
                        Editar
                      </button>
                      <button
                        disabled={busy}
                        className="ghost-button"
                        onClick={() =>
                          void run(async () => {
                            await archiveBriefTemplate(template);
                            await refresh();
                          })
                        }
                      >
                        Arquivar
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
          {!templates.length && <p>Nenhum template salvo.</p>}
          <h3>Briefs e respostas</h3>
          <div className="brief-foundation-list">
            {briefs.map((brief) => (
              <button
                disabled={busy}
                className="ghost-button"
                key={brief.id}
                onClick={() => open(brief.id)}
              >
                {brief.form.title} ·{" "}
                {clients.find((c) => c.id === brief.clientAccountId)?.name ??
                  "Sem cliente"}{" "}
                · {statusNames[brief.status]}
              </button>
            ))}
          </div>
          {!briefs.length && (
            <p>Crie um brief e selecione um cliente para enviar ao portal.</p>
          )}
          <details>
            <summary>
              Registros legados — somente consulta ({legacy.length})
            </summary>
            {legacy.map((brief) => (
              <button
                className="ghost-button"
                key={brief.id}
                onClick={() => setLegacyOpen(brief)}
              >
                {brief.title}
              </button>
            ))}
            {legacyOpen && (
              <article>
                <h3>{legacyOpen.title}</h3>
                <p>{legacyOpen.introduction}</p>
                {legacyOpen.fields.map((field) => (
                  <div key={field.id}>
                    <strong>{field.label}</strong>
                    <p className="brief-foundation-lines">
                      {JSON.stringify(
                        legacyOpen.answers[field.id] ?? "Sem resposta",
                      )}
                    </p>
                  </div>
                ))}
              </article>
            )}
          </details>
        </>
      ) : (
        <>
          <button
            className="ghost-button"
            disabled={busy}
            onClick={() => {
              if (canLeave()) {
                setMode("list");
                setDirty(false);
                void refresh();
              }
            }}
          >
            ← Voltar à lista
          </button>
          {mode === "template" || !detail || detail.brief.status === "draft" ? (
            <>
              <BriefFormEditor
                form={form}
                onChange={(form) => {
                  setForm(form);
                  setDirty(true);
                }}
              />
              {mode === "template" ? (
                <>
                  <label>
                    Descrição
                    <textarea
                      value={description}
                      onChange={(e) => {
                        setDescription(e.target.value);
                        setDirty(true);
                      }}
                    />
                  </label>
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
                    Salvar template
                  </button>
                </>
              ) : (
                <>
                  <label>
                    Cliente
                    <select
                      value={client}
                      onChange={(e) => {
                        setClient(e.target.value);
                        setDirty(true);
                      }}
                    >
                      <option value="">Selecione</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="brief-foundation-actions">
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
                        busy ||
                        !client ||
                        !form.title.trim() ||
                        !form.fields.length
                      }
                      onClick={() =>
                        void run(async () => {
                          const saved =
                            dirty || !detail ? await save() : detail;
                          if (
                            !window.confirm(
                              "Enviar ao cliente? O formulário será congelado.",
                            )
                          )
                            return;
                          adopt(await changeBriefStatus(saved.brief, "send"));
                          await refresh();
                          setMessage("Brief enviado ao portal.");
                        })
                      }
                    >
                      Enviar ao cliente
                    </button>
                    <button
                      className="ghost-button"
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
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <p>
                {statusNames[detail.brief.status]} ·{" "}
                {selectedClient?.name ?? "Cliente"} · Formulário congelado
                {detail.brief.sentAt
                  ? ` · Enviado em ${new Date(detail.brief.sentAt).toLocaleString("pt-BR")}`
                  : ""}
              </p>
              <BriefHistory
                detail={detail}
                base="/api/briefs"
                onError={setMessage}
              />
              {detail.brief.status === "answered" && (
                <button
                  className="ghost-button"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      adopt(await changeBriefStatus(detail.brief, "reopen"));
                      await refresh();
                    })
                  }
                >
                  Reabrir para nova resposta
                </button>
              )}
            </>
          )}
          {detail && detail.brief.status !== "archived" && mode === "brief" && (
            <button
              className="ghost-button"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  if (
                    !window.confirm(
                      "Arquivar o brief? O histórico será preservado.",
                    )
                  )
                    return;
                  adopt(await changeBriefStatus(detail.brief, "archive"));
                  await refresh();
                })
              }
            >
              Arquivar brief
            </button>
          )}
        </>
      )}
    </section>
  );
}
export function PortalBriefsFoundation({
  slug,
  canRespond,
}: {
  slug: string;
  canRespond: boolean;
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
        }
      })
      .catch((e) => {
        if (alive) setMessage(failure(e));
      });
    return () => {
      alive = false;
    };
  }, [slug]);
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
  const adopt = (result: BriefDetail) => {
    setDetail(result);
    setAnswers(result.response?.answers ?? {});
    setDirty(false);
  };
  const writable =
    canRespond && detail && ["sent", "reopened"].includes(detail.brief.status);
  return (
    <section className="brief-foundation-workspace">
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
                setBriefs((await listPortalBriefs(base)).items),
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
              <div className="brief-foundation-actions">
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
                      setBriefs((await listPortalBriefs(base)).items);
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
