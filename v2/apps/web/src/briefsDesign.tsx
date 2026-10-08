import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  downloadBriefAttachment,
  type BriefDetail,
  type BriefField,
  type BriefForm,
  type BriefInstance,
} from "./api";
import { ACCESS_TOKEN_KEY } from "./authApi";
import "./briefsDesign.css";
export const briefFieldNames: Record<BriefField["type"], string> = {
  short: "Texto curto",
  long: "Texto longo",
  choice: "Escolha única",
  checklist: "Caixas de seleção",
  dropdown: "Lista de opções",
  number: "Número",
  date: "Data",
  link: "Link",
  scale: "Escala",
  file: "Upload de arquivo",
};
export const briefCategoryNames: Record<string, string> = {
  custom: "Projeto personalizado",
  branding: "Identidade visual",
  logo: "Logotipo",
  social_media: "Social Media",
  website: "Site",
  editorial: "Material editorial",
};
export const briefStatusNames: Record<BriefInstance["status"], string> = {
  draft: "Rascunho",
  sent: "Aguardando resposta",
  answered: "Respondido",
  reopened: "Reaberto",
  archived: "Arquivado",
};
export function briefDate(value?: string | null, withTime = false) {
  if (!value) return "Data não informada";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Data não informada"
    : new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "medium",
        ...(withTime ? { timeStyle: "short" as const } : {}),
      }).format(date);
}
export function BriefIcon({
  name = "form",
}: {
  name?:
    | "form"
    | "plus"
    | "copy"
    | "send"
    | "check"
    | "close"
    | "arrow"
    | "file"
    | "grip"
    | "clock"
    | "eye"
    | "trash"
    | "edit";
}) {
  const paths: Record<string, ReactNode> = {
    form: (
      <>
        <rect x="5" y="3" width="14" height="18" rx="3" />
        <path d="M9 8h6M9 12h6M9 16h3" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    copy: (
      <>
        <rect x="8" y="8" width="12" height="12" rx="2" />
        <path d="M16 8V4H4v12h4" />
      </>
    ),
    send: (
      <>
        <path d="m3 10 18-7-7 18-3-8-8-3Z" />
        <path d="m11 13 10-10" />
      </>
    ),
    check: <path d="m5 12 4 4 10-10" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    file: (
      <>
        <path d="M14 3H5v18h14V8Z" />
        <path d="M14 3v5h5M8 13h8M8 17h5" />
      </>
    ),
    grip: (
      <>
        <path d="M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16M9 7V3h6v4M6 7l1 14h10l1-14M10 11v6M14 11v6" />
      </>
    ),
    edit: (
      <>
        <path d="m14 4 6 6-10 10-7 1 1-7Z" />
        <path d="m12 6 6 6" />
      </>
    ),
  };
  return (
    <svg
      className="brief-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
export function BriefBadge({ status }: { status: BriefInstance["status"] }) {
  return (
    <span className={`brief-status ${status}`}>
      <BriefIcon
        name={
          status === "answered"
            ? "check"
            : status === "draft"
              ? "edit"
              : "clock"
        }
      />
      {briefStatusNames[status]}
    </span>
  );
}
export function BriefEmpty({
  title,
  description,
  action,
  onAction,
}: {
  title: string;
  description: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="brief-empty">
      <span>
        <BriefIcon />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      <button className="gradient-button" onClick={onAction}>
        <BriefIcon name="plus" />
        {action}
      </button>
    </div>
  );
}
export function BriefDialog({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLElement>(null),
    closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current
      ?.querySelector<HTMLElement>(
        "button,input,select,textarea,[tabindex='0']",
      )
      ?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
      }
      if (e.key === "Tab") {
        const items = [
          ...(ref.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex='0']",
          ) ?? []),
        ];
        if (!items.length) return;
        const first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", key);
      if (trigger?.isConnected) trigger.focus();
    };
  }, []);
  return createPortal(
    <div
      className="brief-ui brief-dialog-shade"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={ref}
        className={`brief-dialog${wide ? " wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          <button
            className="brief-icon-button"
            aria-label="Fechar"
            onClick={onClose}
          >
            <BriefIcon name="close" />
          </button>
        </header>
        {children}
      </section>
    </div>,
    document.body,
  );
}
function PrivateImagePreview({
  file,
  base,
  briefId,
  onClose,
}: {
  file: BriefDetail["attachments"][number];
  base: string;
  briefId: string;
  onClose: () => void;
}) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    let objectUrl = "";
    const apiBase = import.meta.env.VITE_V2_API_URL ?? "";
    void fetch(`${apiBase}${base}/${briefId}/attachments/${file.id}`, {
      signal: abort.signal,
      headers: {
        Authorization: `Bearer ${window.localStorage.getItem(ACCESS_TOKEN_KEY) ?? ""}`,
      },
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("Não foi possível abrir este arquivo.");
        const blob = await response.blob();
        if (abort.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => {
      abort.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.id, base, briefId]);
  return (
    <BriefDialog title={file.name} onClose={onClose} wide>
      <div className="brief-image-preview">
        {error ? (
          <p role="alert">{error}</p>
        ) : url ? (
          <img src={url} alt={file.name} />
        ) : (
          <p role="status">Abrindo imagem…</p>
        )}
      </div>
    </BriefDialog>
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
  definitionOnly = false,
  onPreview,
}: {
  form: BriefForm;
  answers: Record<string, unknown>;
  onChange?: (answers: Record<string, unknown>) => void;
  readOnly: boolean;
  onUpload?: (fieldId: string, file: File) => void;
  onDownload?: (file: BriefDetail["attachments"][number]) => void;
  attachments: BriefDetail["attachments"];
  busy?: boolean;
  definitionOnly?: boolean;
  onPreview?: (file: BriefDetail["attachments"][number]) => void;
}) {
  const set = (id: string, value: unknown) =>
    onChange?.({ ...answers, [id]: value });
  return (
    <article className="brief-client-paper brief-foundation-form">
      <header>
        <span className="brief-paper-mark">
          <BriefIcon />
        </span>
        <small>BRIEF CRIATIVO</small>
        <h2>{form.title || "Seu novo brief"}</h2>
        {form.introduction && (
          <p className="brief-foundation-lines">{form.introduction}</p>
        )}
      </header>
      <div className="brief-response-fields">
        {form.fields.map((field, index) => {
          const value = answers[field.id];
          const options = ["choice", "dropdown", "checklist"].includes(
            field.type,
          );
          const fileIds = Array.isArray(value) ? value : [];
          const min = field.validation.min ?? 1,
            max = field.validation.max ?? 5;
          return (
            <fieldset key={field.id} className="brief-response-field">
              <legend>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>
                  {field.label}
                  {field.required && <em title="Obrigatório"> *</em>}
                </strong>
              </legend>
              {field.help && <p className="brief-field-help">{field.help}</p>}
              {definitionOnly ? (
                <div className="brief-field-definition">
                  <small>
                    {briefFieldNames[field.type]} ·{" "}
                    {field.required ? "Obrigatório" : "Opcional"}
                  </small>
                  {options && (
                    <div>
                      {field.options.map((option, i) => (
                        <span key={i}>{option}</span>
                      ))}
                    </div>
                  )}
                </div>
              ) : field.type === "file" ? (
                <div className="brief-attachments">
                  {fileIds.map((id) => {
                    const file = attachments.find((a) => a.id === id);
                    return file ? (
                      <div className="brief-attachment" key={String(id)}>
                        <span>
                          <BriefIcon name="file" />
                        </span>
                        <div>
                          <strong>{file.name}</strong>
                          <small>
                            {(file.size / 1024).toLocaleString("pt-BR", {
                              maximumFractionDigits: 0,
                            })}{" "}
                            KB
                          </small>
                        </div>
                        <div className="brief-attachment-actions">
                          {onPreview &&
                            file.contentType.startsWith("image/") && (
                              <button
                                className="brief-icon-button"
                                aria-label={`Visualizar ${file.name}`}
                                onClick={() => onPreview(file)}
                              >
                                <BriefIcon name="eye" />
                              </button>
                            )}
                          {onDownload && (
                            <button
                              className="brief-text-button"
                              disabled={busy}
                              onClick={() => onDownload(file)}
                            >
                              Baixar
                            </button>
                          )}
                          {!readOnly && (
                            <button
                              className="brief-icon-button"
                              aria-label={`Retirar ${file.name} da resposta`}
                              disabled={busy}
                              onClick={() =>
                                set(
                                  field.id,
                                  fileIds.filter((v) => v !== id),
                                )
                              }
                            >
                              <BriefIcon name="close" />
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p key={String(id)}>Anexo indisponível</p>
                    );
                  })}
                  {!readOnly ? (
                    <label className="brief-upload-zone">
                      <BriefIcon name="file" />
                      <strong>Selecionar arquivo ou imagem</strong>
                      <small>JPG, PNG, WebP ou PDF · Até 12 MB</small>
                      <input
                        aria-label={field.label}
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
                  ) : !fileIds.length ? (
                    <p className="brief-answer-empty">
                      Nenhum arquivo enviado.
                    </p>
                  ) : null}
                </div>
              ) : readOnly ? (
                <div className="brief-answer-value">
                  {Array.isArray(value) ? (
                    value.length ? (
                      <div className="brief-answer-tags">
                        {value.map((v, i) => (
                          <span key={i}>{String(v)}</span>
                        ))}
                      </div>
                    ) : (
                      <span className="brief-answer-empty">Não informado</span>
                    )
                  ) : value === undefined || value === null || value === "" ? (
                    <span className="brief-answer-empty">Não informado</span>
                  ) : field.type === "link" &&
                    typeof value === "string" &&
                    /^https?:\/\//.test(value) ? (
                    <a href={value} target="_blank" rel="noopener noreferrer">
                      {value} ↗
                    </a>
                  ) : field.type === "date" && typeof value === "string" ? (
                    value.split("-").reverse().join("/")
                  ) : (
                    String(value)
                  )}
                </div>
              ) : field.type === "long" ? (
                <textarea
                  disabled={busy}
                  aria-label={field.label}
                  value={String(value ?? "")}
                  maxLength={field.validation.maxLength}
                  placeholder="Conte um pouco mais…"
                  onChange={(e) => set(field.id, e.target.value)}
                />
              ) : field.type === "choice" ? (
                <div className="brief-answer-options">
                  {field.options.map((option, i) => (
                    <label key={i}>
                      <input
                        type="radio"
                        name={field.id}
                        disabled={busy}
                        checked={value === option}
                        onChange={() => set(field.id, option)}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              ) : field.type === "dropdown" ? (
                <select
                  disabled={busy}
                  aria-label={field.label}
                  value={String(value ?? "")}
                  onChange={(e) => set(field.id, e.target.value)}
                >
                  <option value="">Selecione uma opção</option>
                  {field.options.map((option, i) => (
                    <option key={i}>{option}</option>
                  ))}
                </select>
              ) : field.type === "checklist" ? (
                <div className="brief-answer-options">
                  {field.options.map((option, i) => (
                    <label className="brief-foundation-check" key={i}>
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
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              ) : field.type === "scale" &&
                Number.isInteger(min) &&
                Number.isInteger(max) &&
                max >= min &&
                max - min <= 10 ? (
                <div
                  className="brief-scale"
                  role="group"
                  aria-label={field.label}
                >
                  {Array.from(
                    { length: Math.max(0, max - min + 1) },
                    (_, i) => min + i,
                  ).map((note) => (
                    <button
                      type="button"
                      disabled={busy}
                      aria-pressed={value === note}
                      className={value === note ? "selected" : ""}
                      key={note}
                      onClick={() => set(field.id, note)}
                    >
                      {note}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  disabled={busy}
                  aria-label={field.label}
                  type={
                    ["number", "scale"].includes(field.type)
                      ? "number"
                      : field.type === "date"
                        ? "date"
                        : field.type === "link"
                          ? "url"
                          : "text"
                  }
                  placeholder={
                    field.type === "link" ? "https://" : "Sua resposta"
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
      <footer>
        <BriefIcon name="check" />
        Suas informações ficam organizadas junto ao projeto.
      </footer>
    </article>
  );
}
export function BriefFormEditor({
  form,
  onChange,
  titleMaxLength = 500,
}: {
  form: BriefForm;
  onChange: (form: BriefForm) => void;
  titleMaxLength?: number;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
      form.fields[0]?.id ?? null,
    ),
    [view, setView] = useState<"edit" | "preview">("edit"),
    [adding, setAdding] = useState(false),
    [propertiesOpen, setPropertiesOpen] = useState(false),
    [previewAnswers, setPreviewAnswers] = useState<Record<string, unknown>>({}),
    [previewFiles, setPreviewFiles] = useState<BriefDetail["attachments"]>([]);
  const selected = form.fields.find((f) => f.id === selectedId) ?? null;
  useEffect(() => {
    if (!form.fields.some((f) => f.id === selectedId))
      setSelectedId(form.fields[0]?.id ?? null);
  }, [form.fields, selectedId]);
  const update = (patch: Partial<BriefField>) =>
    onChange({
      ...form,
      fields: form.fields.map((field) =>
        field.id === selectedId ? { ...field, ...patch } : field,
      ),
    });
  const move = (id: string, target: number) => {
    const fields = [...form.fields],
      from = fields.findIndex((f) => f.id === id);
    if (from < 0 || target < 0 || target >= fields.length) return;
    const [field] = fields.splice(from, 1);
    fields.splice(target, 0, field);
    onChange({ ...form, fields });
  };
  const add = (type: BriefField["type"]) => {
    const field: BriefField = {
      id: crypto.randomUUID(),
      type,
      label: "Nova pergunta",
      help: "",
      required: false,
      options: ["choice", "checklist", "dropdown"].includes(type)
        ? ["Opção 1", "Opção 2"]
        : [],
      validation: {},
    };
    onChange({ ...form, fields: [...form.fields, field] });
    setSelectedId(field.id);
    setAdding(false);
    if (window.innerWidth <= 900) setPropertiesOpen(true);
  };
  const select = (id: string) => {
    setSelectedId(id);
    if (window.innerWidth <= 900) setPropertiesOpen(true);
  };
  const inspector = selected ? (
    <div className="brief-property-fields">
      <label>
        Pergunta
        <input
          value={selected.label}
          maxLength={500}
          onChange={(e) => update({ label: e.target.value })}
        />
      </label>
      <label>
        Tipo de resposta
        <select
          value={selected.type}
          onChange={(e) => {
            const type = e.target.value as BriefField["type"];
            update({
              type,
              options: ["choice", "checklist", "dropdown"].includes(type)
                ? ["Opção 1", "Opção 2"]
                : [],
              validation: {},
            });
          }}
        >
          {Object.entries(briefFieldNames).map(([type, name]) => (
            <option key={type} value={type}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Descrição / ajuda
        <textarea
          value={selected.help}
          onChange={(e) => update({ help: e.target.value })}
          placeholder="Ajude o cliente a responder."
        />
      </label>
      <label className="brief-required-toggle">
        <span>
          <strong>Resposta obrigatória</strong>
          <small>O cliente precisa preencher este campo.</small>
        </span>
        <input
          type="checkbox"
          checked={selected.required}
          onChange={(e) => update({ required: e.target.checked })}
        />
      </label>
      {["choice", "checklist", "dropdown"].includes(selected.type) && (
        <label>
          Opções (uma por linha)
          <textarea
            value={selected.options.join("\n")}
            onChange={(e) => update({ options: e.target.value.split("\n") })}
          />
        </label>
      )}
      {["number", "scale"].includes(selected.type) && (
        <div className="brief-property-pair">
          {(["min", "max"] as const).map((key) => (
            <label key={key}>
              {key === "min" ? "Mínimo" : "Máximo"}
              <input
                type="number"
                value={selected.validation[key] ?? ""}
                onChange={(e) =>
                  update({
                    validation: {
                      ...selected.validation,
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
      {["short", "long", "file"].includes(selected.type) && (
        <label>
          {selected.type === "file"
            ? "Máximo de arquivos"
            : "Limite de caracteres"}
          <input
            type="number"
            min={1}
            max={selected.type === "file" ? 10 : 10000}
            value={
              (selected.type === "file"
                ? selected.validation.maxFiles
                : selected.validation.maxLength) ?? ""
            }
            onChange={(e) =>
              update({
                validation: {
                  ...selected.validation,
                  [selected.type === "file" ? "maxFiles" : "maxLength"]:
                    e.target.value === "" ? undefined : Number(e.target.value),
                },
              })
            }
          />
        </label>
      )}
    </div>
  ) : (
    <div className="brief-inspector-empty">
      <BriefIcon name="edit" />
      <p>Selecione uma pergunta para editar seus detalhes.</p>
    </div>
  );
  return (
    <div className="brief-visual-builder">
      <div
        className="brief-builder-view"
        role="tablist"
        aria-label="Visualização do formulário"
      >
        <button
          role="tab"
          aria-selected={view === "edit"}
          className={view === "edit" ? "active" : ""}
          onClick={() => setView("edit")}
        >
          <BriefIcon name="edit" />
          Editar
        </button>
        <button
          role="tab"
          aria-selected={view === "preview"}
          className={view === "preview" ? "active" : ""}
          onClick={() => setView("preview")}
        >
          <BriefIcon name="eye" />
          Prévia do cliente
        </button>
      </div>
      {view === "preview" ? (
        <div className="brief-preview">
          <p className="brief-preview-note">
            Prévia do cliente · As respostas de teste não serão enviadas.
          </p>
          <BriefResponseForm
            form={form}
            answers={previewAnswers}
            onChange={setPreviewAnswers}
            attachments={previewFiles}
            readOnly={false}
            onUpload={(fieldId, file) => {
              const id = crypto.randomUUID();
              setPreviewFiles((files) => [
                ...files,
                {
                  id,
                  fieldId,
                  name: file.name,
                  contentType: file.type,
                  size: file.size,
                },
              ]);
              setPreviewAnswers((answers) => ({
                ...answers,
                [fieldId]: [
                  ...(Array.isArray(answers[fieldId])
                    ? (answers[fieldId] as string[])
                    : []),
                  id,
                ],
              }));
            }}
          />
        </div>
      ) : (
        <div className="brief-editor-layout">
          <div className="brief-editor-main brief-foundation-form">
            <section className="brief-document-settings">
              <small>SEU FORMULÁRIO</small>
              <label>
                Título
                <input
                  value={form.title}
                  onChange={(e) => onChange({ ...form, title: e.target.value })}
                  maxLength={titleMaxLength}
                  placeholder="Ex.: Identidade visual da marca"
                />
              </label>
              <label>
                Introdução / instruções
                <textarea
                  value={form.introduction}
                  onChange={(e) =>
                    onChange({ ...form, introduction: e.target.value })
                  }
                  placeholder="Apresente o projeto e oriente o cliente."
                />
              </label>
              <div className="brief-property-pair">
                <label>
                  Categoria
                  <input
                    value={briefCategoryNames[form.category] ?? form.category}
                    list="brief-category-options"
                    onChange={(e) =>
                      onChange({
                        ...form,
                        category:
                          Object.entries(briefCategoryNames).find(
                            ([, name]) => name === e.target.value,
                          )?.[0] ?? e.target.value,
                      })
                    }
                    maxLength={100}
                  />
                  <datalist id="brief-category-options">
                    {Object.values(briefCategoryNames).map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </label>
                <label>
                  Idioma
                  <select
                    value={form.locale}
                    onChange={(e) =>
                      onChange({
                        ...form,
                        locale: e.target.value as BriefForm["locale"],
                      })
                    }
                  >
                    {Object.entries({
                      pt: "Português",
                      en: "Inglês",
                      es: "Espanhol",
                      it: "Italiano",
                      sv: "Sueco",
                    }).map(([code, label]) => (
                      <option value={code} key={code}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>
            <div className="brief-questions-heading">
              <h3>Perguntas</h3>
              <span>
                {form.fields.length}{" "}
                {form.fields.length === 1 ? "campo" : "campos"}
              </span>
            </div>
            <div className="brief-question-stack">
              {form.fields.map((field, index) => (
                <article
                  className={`brief-question-card${selectedId === field.id ? " selected" : ""}`}
                  key={field.id}
                  draggable
                  onDragStart={(e) =>
                    e.dataTransfer.setData("text/plain", field.id)
                  }
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    move(e.dataTransfer.getData("text/plain"), index);
                  }}
                >
                  <div className="brief-question-top">
                    <span className="brief-question-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="brief-field-type">
                      {briefFieldNames[field.type]}
                    </span>
                    <small>{field.required ? "Obrigatório" : "Opcional"}</small>
                    <span
                      className="brief-drag-handle"
                      title="Arraste para reordenar"
                    >
                      <BriefIcon name="grip" />
                    </span>
                  </div>
                  <button
                    className="brief-field-select"
                    onClick={() => select(field.id)}
                    aria-label={`Editar pergunta ${index + 1}: ${field.label}`}
                  >
                    <strong>{field.label || "Escreva sua pergunta"}</strong>
                    {field.help && <p>{field.help}</p>}
                    {field.options.length > 0 && (
                      <span className="brief-option-preview">
                        {field.options.slice(0, 3).join(" · ")}
                        {field.options.length > 3
                          ? ` · +${field.options.length - 3}`
                          : ""}
                      </span>
                    )}
                    <span className="brief-question-hint">
                      Editar propriedades <BriefIcon name="edit" />
                    </span>
                  </button>
                  <div className="brief-question-actions">
                    <button
                      className="brief-icon-button"
                      disabled={index === 0}
                      aria-label={`Mover pergunta ${index + 1} para cima`}
                      onClick={() => move(field.id, index - 1)}
                    >
                      ↑
                    </button>
                    <button
                      className="brief-icon-button"
                      disabled={index === form.fields.length - 1}
                      aria-label={`Mover pergunta ${index + 1} para baixo`}
                      onClick={() => move(field.id, index + 1)}
                    >
                      ↓
                    </button>
                    <button
                      className="brief-icon-button"
                      aria-label={`Duplicar pergunta ${index + 1}`}
                      onClick={() => {
                        const copy = {
                          ...field,
                          id: crypto.randomUUID(),
                          label: `${field.label.slice(0, 492)} (cópia)`,
                          options: [...field.options],
                          validation: { ...field.validation },
                        };
                        const fields = [...form.fields];
                        fields.splice(index + 1, 0, copy);
                        onChange({ ...form, fields });
                        setSelectedId(copy.id);
                      }}
                    >
                      <BriefIcon name="copy" />
                    </button>
                    <button
                      className="brief-icon-button"
                      aria-label={`Excluir pergunta ${index + 1}`}
                      onClick={() =>
                        onChange({
                          ...form,
                          fields: form.fields.filter((f) => f.id !== field.id),
                        })
                      }
                    >
                      <BriefIcon name="trash" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {!form.fields.length && (
              <div className="brief-builder-empty">
                <BriefIcon />
                <h3>Uma boa pergunta é o começo.</h3>
                <p>Adicione campos para entender o projeto do seu cliente.</p>
              </div>
            )}
            <button
              className="brief-add-field"
              aria-expanded={adding}
              onClick={() => setAdding(!adding)}
            >
              <BriefIcon name="plus" />
              Adicionar campo
            </button>
            {adding && (
              <div className="brief-field-library">
                {Object.entries(briefFieldNames).map(([type, name]) => (
                  <button
                    key={type}
                    onClick={() => add(type as BriefField["type"])}
                  >
                    <BriefIcon name={type === "file" ? "file" : "form"} />
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <aside className="brief-field-inspector">
            <header>
              <small>PROPRIEDADES</small>
              <h3>{selected ? "Personalize a pergunta" : "Seu formulário"}</h3>
            </header>
            {inspector}
          </aside>
          {propertiesOpen && (
            <BriefDialog
              title="Propriedades da pergunta"
              onClose={() => setPropertiesOpen(false)}
            >
              <div className="brief-mobile-properties">
                {inspector}
                <button
                  className="gradient-button"
                  onClick={() => setPropertiesOpen(false)}
                >
                  Concluir
                </button>
              </div>
            </BriefDialog>
          )}
        </div>
      )}
    </div>
  );
}
const eventNames: Record<string, string> = {
  created: "Brief criado",
  draft_updated: "Formulário atualizado",
  send: "Enviado ao cliente",
  response_draft_saved: "Rascunho da resposta salvo",
  attachment_added: "Arquivo anexado",
  submitted: "Resposta recebida",
  reopen: "Reaberto para nova resposta",
  archive: "Brief arquivado",
};
export function BriefHistory({
  detail,
  base,
  onError,
  clientName,
}: {
  detail: BriefDetail;
  base: string;
  onError: (message: string) => void;
  clientName?: string;
}) {
  const latest = detail.revisions[0];
  const [revision, setRevision] = useState<number | null>(
      latest?.revision ?? null,
    ),
    [preview, setPreview] = useState<BriefDetail["attachments"][number] | null>(
      null,
    );
  useEffect(
    () => setRevision(detail.revisions[0]?.revision ?? null),
    [detail.brief.id, detail.response?.version],
  );
  const selected = detail.revisions.find((r) => r.revision === revision);
  const answers = selected?.answers ?? detail.response?.answers ?? {};
  return (
    <section className="brief-response-view">
      <header className="brief-response-heading">
        <div>
          <small>
            {selected ? "RESPOSTA RECEBIDA" : "PREENCHIMENTO EM ANDAMENTO"}
          </small>
          <h2>{detail.brief.form.title}</h2>
          {clientName && <p>{clientName}</p>}
        </div>
        <span className="brief-status answered">
          <BriefIcon name={selected ? "check" : "clock"} />
          {selected
            ? `Revisão ${selected.revision}${selected.revision === latest?.revision ? " · Atual" : ""}`
            : "Rascunho"}
        </span>
      </header>
      <div className="brief-response-context">
        <div>
          <small>Brief enviado</small>
          <strong>{briefDate(detail.brief.sentAt, true)}</strong>
        </div>
        <div>
          <small>{selected ? "Resposta enviada" : "Última alteração"}</small>
          <strong>
            {briefDate(
              selected?.submittedAt ?? detail.response?.updatedAt,
              true,
            )}
          </strong>
        </div>
        <label>
          Revisão
          <select
            value={revision ?? "draft"}
            onChange={(e) =>
              setRevision(
                e.target.value === "draft" ? null : Number(e.target.value),
              )
            }
          >
            {detail.revisions.map((r) => (
              <option key={r.id} value={r.revision}>
                Revisão {r.revision}
                {r.revision === latest?.revision ? " · Atual" : ""} ·{" "}
                {briefDate(r.submittedAt)}
              </option>
            ))}
            {detail.response?.status === "draft" && (
              <option value="draft">Rascunho em andamento</option>
            )}
          </select>
        </label>
      </div>
      <BriefResponseForm
        form={detail.brief.form}
        answers={answers}
        readOnly
        attachments={detail.attachments}
        onDownload={(file) =>
          void downloadBriefAttachment(base, detail.brief.id, file).catch((e) =>
            onError(
              e instanceof Error
                ? e.message
                : "Não foi possível baixar o arquivo.",
            ),
          )
        }
        onPreview={setPreview}
      />
      <details className="brief-event-history">
        <summary>
          Histórico de atividades <span>{detail.events.length}</span>
        </summary>
        <ol>
          {detail.events.map((event) => (
            <li key={event.id}>
              <span>
                <BriefIcon
                  name={event.action === "submitted" ? "check" : "clock"}
                />
              </span>
              <div>
                <strong>
                  {eventNames[event.action] ?? "Atividade registrada"}
                  {event.revision ? ` · Revisão ${event.revision}` : ""}
                </strong>
                <small>{briefDate(event.createdAt, true)}</small>
              </div>
            </li>
          ))}
        </ol>
      </details>
      {preview && (
        <PrivateImagePreview
          file={preview}
          base={base}
          briefId={detail.brief.id}
          onClose={() => setPreview(null)}
        />
      )}
    </section>
  );
}
