import { premiumCopy } from "./proposalPremiumCopy";
import React from "react";
import type { ProposalRecord } from "./api";
import {
  emptyProposalDocument,
  type ProposalDocument,
} from "./proposalDocument";
import {
  proposalCurrencies,
  proposalCurrency,
  formatProposalMoney,
} from "./proposalCurrency";
import { proposalLocales } from "./proposalPresentation";
export function ProposalPremiumEditor({
  draft,
  update,
}: {
  draft: ProposalRecord;
  update: (patch: Partial<ProposalRecord>) => void;
}) {
  const doc = draft.document ?? emptyProposalDocument();
  const change = (patch: Partial<ProposalDocument>) =>
    update({ document: { ...doc, ...patch }, revision: draft.revision ?? 0 });
  const field = (
    label: string,
    key: keyof ProposalDocument,
    multiline = true,
  ) => (
    <label>
      {label}
      {multiline ? (
        <textarea
          value={String(doc[key] ?? "")}
          onChange={(e) => change({ [key]: e.target.value })}
        />
      ) : (
        <input
          value={String(doc[key] ?? "")}
          onChange={(e) => change({ [key]: e.target.value })}
        />
      )}
    </label>
  );
  const section = (
    number: string,
    title: string,
    children: React.ReactNode,
    open = false,
  ) => (
    <details
      className="proposal-premium-editor-section"
      open={open || undefined}
    >
      <summary>
        <span>{number}</span>
        {title}
      </summary>
      <div className="proposal-premium-editor-fields">{children}</div>
    </details>
  );
  const lines = (value: string) => value.split("\n");
  return (
    <>
      {section(
        "01",
        "Informações gerais",
        <>
          <div className="proposal-fields two">
            <label>
              Nome do cliente *
              <input
                value={draft.clientName}
                onChange={(e) => update({ clientName: e.target.value })}
              />
            </label>
            <label>
              E-mail
              <input
                type="email"
                value={draft.email}
                onChange={(e) => update({ email: e.target.value })}
              />
            </label>
          </div>
          {field("Título da proposta", "title", false)}
          <div className="proposal-fields two">
            <label>
              Tipo de proposta
              <input
                value={draft.proposalType}
                onChange={(e) => update({ proposalType: e.target.value })}
              />
            </label>
            <label>
              Plano
              <input
                value={draft.plan}
                onChange={(e) => update({ plan: e.target.value })}
              />
            </label>
            <label>
              Idioma
              <select
                value={draft.locale}
                onChange={(e) => update({ locale: e.target.value })}
              >
                {Object.values(proposalLocales).map((l) => (
                  <option key={l.label}>{l.label}</option>
                ))}
              </select>
            </label>
            <label>
              Moeda
              <select
                value={proposalCurrency(draft.currency)}
                onChange={(e) => update({ currency: e.target.value })}
              >
                {!Object.prototype.hasOwnProperty.call(
                  proposalCurrencies,
                  proposalCurrency(draft.currency),
                ) && <option value={draft.currency}>{draft.currency}</option>}
                {Object.entries(proposalCurrencies).map(([key, label]) => (
                  <option value={key} key={key}>
                    {key} — {label}
                  </option>
                ))}
              </select>
              <small>Alterar a moeda não converte os valores digitados.</small>
            </label>
            <label>
              Data de validade
              <input
                type="date"
                value={new Date(draft.expiresAt).toLocaleDateString("sv-SE")}
                onChange={(e) => {
                  if (e.target.value)
                    update({
                      expiresAt: new Date(
                        `${e.target.value}T23:59:59`,
                      ).toISOString(),
                    });
                }}
              />
            </label>
          </div>
        </>,
        true,
      )}
      {section("02", "Resumo do projeto", field("Resumo executivo", "summary"))}
      {section(
        "03",
        "Escopo do projeto",
        <>
          {field("Título da seção", "scopeTitle", false)}
          <label>
            Escopo do projeto
            <textarea
              value={draft.scope}
              onChange={(e) => update({ scope: e.target.value })}
            />
          </label>
          {field("Objetivos (um por linha)", "objectives")}
          {field("Itens incluídos (um por linha)", "included")}
          {field("Limitações / não incluídos (um por linha)", "excluded")}
          <label>
            Qtd. de peças
            <input
              type="number"
              min="0"
              value={draft.pieces}
              onChange={(e) => update({ pieces: Number(e.target.value) })}
            />
          </label>
        </>,
      )}
      {section(
        "04",
        "Opções e pacotes",
        <>
          <label>
            Modo de proposta
            <select
              value={doc.mode}
              onChange={(e) =>
                change({
                  mode: e.target.value as ProposalDocument["mode"],
                  options:
                    e.target.value !== "single" &&
                    doc.options.length < (e.target.value === "packages" ? 1 : 2)
                      ? [
                          ...doc.options,
                          ...Array.from(
                            {
                              length:
                                (e.target.value === "packages" ? 1 : 2) -
                                doc.options.length,
                            },
                            (_, i) => ({
                              id: crypto.randomUUID(),
                              name: String.fromCharCode(
                                65 + doc.options.length + i,
                              ),
                              description: "",
                              items: [],
                              value: 0,
                              recommended: false,
                            }),
                          ),
                        ]
                      : doc.options,
                })
              }
            >
              <option value="single">Proposta única</option>
              <option value="packages">Pacotes — seleção de uma opção</option>
              {doc.mode === "alternatives" && (
                <option value="alternatives">Alternativas independentes</option>
              )}
            </select>
          </label>
          <p>
            A moeda de cada pacote é a moeda geral da proposta:{" "}
            {proposalCurrency(draft.currency)}. Alterar a moeda não converte os
            valores.
          </p>
          {doc.mode === "single" &&
            draft.services.some(
              (service) => service.name.trim() || service.value > 0,
            ) && (
              <div>
                <button
                  type="button"
                  onClick={() =>
                    change({
                      mode: "packages",
                      options: draft.services
                        .filter(
                          (service) => service.name.trim() || service.value > 0,
                        )
                        .map((service) => ({
                          id: crypto.randomUUID(),
                          name:
                            service.name || premiumCopy(draft.locale).option,
                          description: service.description,
                          items: [],
                          value: service.value,
                          recommended: false,
                        })),
                    })
                  }
                >
                  Usar cada serviço atual como um pacote
                </button>
                <p>
                  Use somente quando os serviços forem alternativas comerciais.
                  Os preços e a lista original serão preservados.
                </p>
              </div>
            )}
          {doc.mode === "single" ? (
            <>
              {draft.services.map((service, index) => (
                <div className="proposal-premium-item" key={index}>
                  <label>
                    Serviço
                    <input
                      value={service.name}
                      onChange={(e) =>
                        update({
                          services: draft.services.map((v, i) =>
                            i === index ? { ...v, name: e.target.value } : v,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    Valor ({proposalCurrency(draft.currency)})
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={service.value}
                      onChange={(e) =>
                        update({
                          services: draft.services.map((v, i) =>
                            i === index
                              ? { ...v, value: Number(e.target.value) }
                              : v,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    Descrição
                    <input
                      value={service.description}
                      onChange={(e) =>
                        update({
                          services: draft.services.map((v, i) =>
                            i === index
                              ? { ...v, description: e.target.value }
                              : v,
                          ),
                        })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      update({
                        services: draft.services.filter((_, i) => i !== index),
                      })
                    }
                  >
                    Remover serviço
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  update({
                    services: [
                      ...draft.services,
                      { name: "", value: 0, description: "" },
                    ],
                  })
                }
              >
                + Adicionar serviço
              </button>
              <div className="proposal-editor-total">
                <span>Investimento total</span>
                <strong>
                  {formatProposalMoney(
                    draft.services.reduce((n, i) => n + i.value, 0),
                    draft.currency,
                  )}
                </strong>
              </div>
            </>
          ) : (
            <>
              <p>
                As alternativas são mutuamente exclusivas. Os valores não serão
                somados.
              </p>
              {doc.options.map((option, index) => {
                const edit = (patch: Partial<typeof option>) =>
                  change({
                    options: doc.options.map((v, i) =>
                      i === index ? { ...v, ...patch } : v,
                    ),
                  });
                return (
                  <div className="proposal-premium-item" key={option.id}>
                    <h4>Opção {String.fromCharCode(65 + index)}</h4>
                    <label>
                      Título do pacote
                      <input
                        value={option.name}
                        onChange={(e) => edit({ name: e.target.value })}
                      />
                    </label>
                    <label>
                      Subtítulo (opcional)
                      <input
                        value={option.subtitle ?? ""}
                        onChange={(e) => edit({ subtitle: e.target.value })}
                      />
                    </label>
                    <label>
                      Badge (opcional)
                      <input
                        value={option.badge ?? ""}
                        onChange={(e) => edit({ badge: e.target.value })}
                        placeholder="Ex.: Most popular"
                        aria-description="Se ficar vazio, nenhum selo será exibido."
                      />
                    </label>
                    <label>
                      Itens não incluídos (um por linha, opcional)
                      <textarea
                        value={(option.excludedItems ?? []).join("\n")}
                        onChange={(e) =>
                          edit({ excludedItems: e.target.value.split("\n") })
                        }
                      />
                    </label>
                    <label>
                      Descrição curta
                      <textarea
                        value={option.description}
                        onChange={(e) => edit({ description: e.target.value })}
                      />
                    </label>
                    <label>
                      Itens incluídos (um por linha)
                      <textarea
                        value={option.items.join("\n")}
                        onChange={(e) => edit({ items: lines(e.target.value) })}
                      />
                    </label>
                    <label>
                      Valor total ({proposalCurrency(draft.currency)})
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={option.value}
                        onChange={(e) =>
                          edit({ value: Number(e.target.value) })
                        }
                      />
                    </label>
                    <div className="proposal-item-actions">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => {
                          const options = [...doc.options];
                          [options[index - 1], options[index]] = [
                            options[index],
                            options[index - 1],
                          ];
                          change({ options });
                        }}
                      >
                        Mover para cima
                      </button>
                      <button
                        type="button"
                        disabled={index === doc.options.length - 1}
                        onClick={() => {
                          const options = [...doc.options];
                          [options[index + 1], options[index]] = [
                            options[index],
                            options[index + 1],
                          ];
                          change({ options });
                        }}
                      >
                        Mover para baixo
                      </button>
                      <button
                        type="button"
                        disabled={
                          doc.options.length <=
                          (doc.mode === "packages" ? 1 : 2)
                        }
                        onClick={() =>
                          change({
                            options: doc.options.filter((_, i) => i !== index),
                          })
                        }
                      >
                        Remover opção
                      </button>
                    </div>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() =>
                  change({
                    options: [
                      ...doc.options,
                      {
                        id: crypto.randomUUID(),
                        name: String.fromCharCode(65 + doc.options.length),
                        description: "",
                        items: [],
                        value: 0,
                        recommended: false,
                      },
                    ],
                  })
                }
              >
                + Adicionar opção
              </button>
            </>
          )}
        </>,
      )}
      {section(
        "05",
        "Entregáveis",
        <>
          {field("Título da seção", "deliverablesTitle", false)}
          {doc.deliverables.map((item, index) => (
            <div className="proposal-premium-item" key={index}>
              <label>
                Entregável
                <input
                  value={item.name}
                  onChange={(e) =>
                    change({
                      deliverables: doc.deliverables.map((v, i) =>
                        i === index ? { ...v, name: e.target.value } : v,
                      ),
                    })
                  }
                />
              </label>
              <label>
                Descrição
                <textarea
                  value={item.description}
                  onChange={(e) =>
                    change({
                      deliverables: doc.deliverables.map((v, i) =>
                        i === index ? { ...v, description: e.target.value } : v,
                      ),
                    })
                  }
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  change({
                    deliverables: doc.deliverables.filter(
                      (_, i) => i !== index,
                    ),
                  })
                }
              >
                Remover entregável
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              change({
                deliverables: [
                  ...doc.deliverables,
                  { name: "", description: "" },
                ],
              })
            }
          >
            + Adicionar entregável
          </button>
        </>,
      )}
      {section(
        "06",
        "Cronograma",
        <>
          {field("Título da seção", "timelineTitle", false)}
          <div className="proposal-fields two">
            <label>
              Prazo estimado
              <input
                type={doc.timelineUnit === "date" ? "date" : "number"}
                min="0"
                value={doc.timelineValue}
                onChange={(e) => change({ timelineValue: e.target.value })}
              />
            </label>
            <label>
              Unidade
              <select
                value={doc.timelineUnit}
                onChange={(e) =>
                  change({
                    timelineUnit: e.target
                      .value as ProposalDocument["timelineUnit"],
                    timelineValue: "",
                  })
                }
              >
                <option value="business">Dias úteis</option>
                <option value="calendar">Dias corridos</option>
                <option value="date">Data específica</option>
              </select>
            </label>
          </div>
          {field("Condições de início do prazo", "timelineStart")}
          {field("Observações adicionais", "timelineNotes")}
        </>,
      )}
      {section(
        "07",
        "Serviços adicionais",
        <>
          <p>
            Opcionais para contratação posterior. Não entram no total nem na
            aprovação.
          </p>
          {doc.addons.map((item, index) => {
            const edit = (patch: Partial<typeof item>) =>
              change({
                addons: doc.addons.map((v, i) =>
                  i === index ? { ...v, ...patch } : v,
                ),
              });
            return (
              <div className="proposal-premium-item" key={index}>
                <label>
                  Nome
                  <input
                    value={item.name}
                    onChange={(e) => edit({ name: e.target.value })}
                  />
                </label>
                <label>
                  Descrição
                  <textarea
                    value={item.description}
                    onChange={(e) => edit({ description: e.target.value })}
                  />
                </label>
                <label>
                  Preço ({proposalCurrency(draft.currency)})
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.value}
                    onChange={(e) => edit({ value: Number(e.target.value) })}
                  />
                </label>
                <button
                  type="button"
                  onClick={() =>
                    change({ addons: doc.addons.filter((_, i) => i !== index) })
                  }
                >
                  Remover adicional
                </button>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() =>
              change({
                addons: [
                  ...doc.addons,
                  { name: "", description: "", value: 0 },
                ],
              })
            }
          >
            + Adicionar serviço adicional
          </button>
        </>,
      )}
      {section(
        "08",
        "Investimento e pagamento",
        <>
          <label>
            Descrição do investimento
            <textarea
              value={draft.investment}
              onChange={(e) => update({ investment: e.target.value })}
            />
          </label>
          {field("Condições de pagamento", "paymentTerms")}
          <label>
            Entrada (%)
            <input
              type="number"
              min="0"
              max="100"
              value={doc.deposit ?? ""}
              onChange={(e) =>
                change({
                  deposit:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </label>
          {field("Condições do saldo", "balance")}
          {field("Meios de pagamento aceitos", "paymentMethods")}
          {field("Observações financeiras", "financialNotes")}
        </>,
      )}
      {section(
        "09",
        "Termos e aprovação",
        <>
          <p>
            Validade: {new Date(draft.expiresAt).toLocaleDateString("pt-BR")}.
            Edite a data em Informações gerais.
          </p>
          <label>
            Rodadas de revisão
            <input
              type="number"
              min="0"
              value={doc.revisions ?? ""}
              onChange={(e) =>
                change({
                  revisions:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </label>
          {field("Termos e condições", "terms")}
          {field("Materiais fornecidos pelo cliente (um por linha)", "clientMaterials")}
          {field("Texto de aprovação", "approvalText")}
        </>,
      )}
    </>
  );
}
