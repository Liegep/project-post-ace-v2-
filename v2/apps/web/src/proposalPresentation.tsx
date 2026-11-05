import { hasProposalPackages } from "./proposalDocument";
import { useProposalReveal } from "./useProposalReveal";
import { premiumCopy, proposalTypeLabel } from "./proposalPremiumCopy";
import "./proposalPremium.css";
import { formatProposalMoney } from "./proposalCurrency";
import React from "react";
import type { ProposalRecord as LocalProposal } from "./api";

export const proposalLocales = {
  Português: {
    code: "pt-BR",
    label: "Português",
    commercial: "Proposta comercial",
    prepared: "Preparada para",
    plan: "Plano",
    validity: "Validade",
    pieces: "Peças",
    deliveries: "entregas",
    scope: "Escopo do projeto",
    investment: "Investimento",
    services: "Serviços inclusos",
    total: "Investimento total",
    until: "Válida até",
    continueTogether: "Vamos seguir juntos?",
    emptyScope: "Descreva o escopo, objetivos e entregas desta proposta.",
    emptyInvestment: "Detalhe aqui as condições comerciais e observações.",
    emptyServices: "Os serviços aparecerão aqui.",
    accept: "Aceitar proposta",
    refuse: "Não aceitar",
    accepted: "Proposta aceita",
    refused: "Proposta recusada",
    answer:
      "Sua resposta foi registrada. Nossa equipe entrará em contato em breve.",
  },
  English: {
    code: "en-US",
    label: "English",
    commercial: "Commercial proposal",
    prepared: "Prepared for",
    plan: "Plan",
    validity: "Validity",
    pieces: "Pieces",
    deliveries: "deliverables",
    scope: "Project scope",
    investment: "Investment",
    services: "Included services",
    total: "Total investment",
    until: "Valid until",
    continueTogether: "Shall we move forward together?",
    emptyScope:
      "Describe the scope, objectives and deliverables for this proposal.",
    emptyInvestment: "Add payment terms, notes and next steps here.",
    emptyServices: "Services will appear here.",
    accept: "Accept proposal",
    refuse: "Decline proposal",
    accepted: "Proposal accepted",
    refused: "Proposal declined",
    answer: "Your answer has been recorded. Our team will be in touch soon.",
  },
  Español: {
    code: "es-ES",
    label: "Español",
    commercial: "Propuesta comercial",
    prepared: "Preparada para",
    plan: "Plan",
    validity: "Validez",
    pieces: "Piezas",
    deliveries: "entregables",
    scope: "Alcance del proyecto",
    investment: "Inversión",
    services: "Servicios incluidos",
    total: "Inversión total",
    until: "Válida hasta",
    continueTogether: "¿Seguimos juntos?",
    emptyScope:
      "Describa el alcance, los objetivos y las entregas de esta propuesta.",
    emptyInvestment:
      "Detalle las condiciones de pago, observaciones y próximos pasos.",
    emptyServices: "Los servicios aparecerán aquí.",
    accept: "Aceptar propuesta",
    refuse: "No aceptar",
    accepted: "Propuesta aceptada",
    refused: "Propuesta rechazada",
    answer:
      "Su respuesta fue registrada. Nuestro equipo se pondrá en contacto pronto.",
  },
  Italiano: {
    code: "it-IT",
    label: "Italiano",
    commercial: "Proposta commerciale",
    prepared: "Preparata per",
    plan: "Piano",
    validity: "Validità",
    pieces: "Pezzi",
    deliveries: "consegne",
    scope: "Ambito del progetto",
    investment: "Investimento",
    services: "Servizi inclusi",
    total: "Investimento totale",
    until: "Valida fino al",
    continueTogether: "Andiamo avanti insieme?",
    emptyScope:
      "Descrivi l'ambito, gli obiettivi e le consegne di questa proposta.",
    emptyInvestment:
      "Inserisci le condizioni di pagamento, le note e i prossimi passi.",
    emptyServices: "I servizi appariranno qui.",
    accept: "Accetta proposta",
    refuse: "Rifiuta",
    accepted: "Proposta accettata",
    refused: "Proposta rifiutata",
    answer:
      "La tua risposta è stata registrata. Il nostro team ti contatterà presto.",
  },
  Svenska: {
    code: "sv-SE",
    label: "Svenska",
    commercial: "Kommersiellt förslag",
    prepared: "Förberett för",
    plan: "Plan",
    validity: "Giltighet",
    pieces: "Delar",
    deliveries: "leveranser",
    scope: "Projektets omfattning",
    investment: "Investering",
    services: "Inkluderade tjänster",
    total: "Total investering",
    until: "Giltigt till",
    continueTogether: "Ska vi gå vidare tillsammans?",
    emptyScope: "Beskriv omfattning, mål och leveranser för detta förslag.",
    emptyInvestment:
      "Lägg till betalningsvillkor, anteckningar och nästa steg här.",
    emptyServices: "Tjänsterna visas här.",
    accept: "Acceptera förslag",
    refuse: "Avböj",
    accepted: "Förslag accepterat",
    refused: "Förslag avböjt",
    answer: "Ditt svar har registrerats. Vårt team kontaktar dig snart.",
  },
} as const;

export function getProposalLocale(locale: string) {
  return (
    proposalLocales[locale as keyof typeof proposalLocales] ??
    proposalLocales["Português"]
  );
}

export function ProposalClientPreview({
  proposal,
  brandLogo,
  selectedOptionId,
  onSelectOption,
  showApproval = true,
}: {
  proposal: LocalProposal;
  brandLogo?: string;
  showApproval?: boolean;
  selectedOptionId?: string;
  onSelectOption?: (id: string) => void;
}) {
  const doc = proposal.document;
  const copy = getProposalLocale(proposal.locale),
    extra = premiumCopy(proposal.locale);
  const money = (value: number) =>
    formatProposalMoney(value, proposal.currency);
  const alternatives = hasProposalPackages(doc);
  const revealRef = useProposalReveal(`${proposal.id}:${proposal.revision}`);
  const selected = proposal.acceptance?.optionId ?? selectedOptionId;
  const chosen = alternatives
    ? doc!.options.find((option) => option.id === selected)
    : null;
  const total =
    proposal.acceptance?.value ??
    (alternatives
      ? chosen?.value
      : proposal.services.reduce(
          (sum, item) => sum + Number(item.value || 0),
          0,
        ));
  let number = 0;
  const section = (title: string, content: React.ReactNode, className = "") => (
    <section className={className} data-proposal-reveal>
      <header className="proposal-document-section-heading">
        <span>{String(++number).padStart(2, "0")}</span>
        <h2>{title}</h2>
      </header>
      {content}
    </section>
  );
  const text = (value?: string) =>
    value?.trim() ? (
      <div className="proposal-document-text">{value}</div>
    ) : null;
  const list = (value: string) => (
    <ul>
      {value
        .split("\n")
        .filter((line) => line.trim())
        .map((line, i) => (
          <li key={i}>{line}</li>
        ))}
    </ul>
  );
  return (
    <article
      ref={revealRef}
      className="proposal-client-preview proposal-document proposal-document-premium proposal-document-mockup"
      lang={copy.code}
    >
      <header className="proposal-document-brand">
        {brandLogo && <img src={brandLogo} alt="Liege Paschoalini Studio" />}
        <span>
          LIEGE PASCHOALINI
          <br />
          <b>STUDIO</b>
        </span>
        <small>DESIGN HUB V2</small>
      </header>
      <section className="proposal-document-cover">
        <div className="proposal-cover-intro">
          <p className="proposal-document-eyebrow">
            {copy.commercial} ·{" "}
            {proposalTypeLabel(proposal.proposalType, proposal.locale)}
          </p>
          <h1>
            {doc?.title ||
              proposal.plan ||
              proposalTypeLabel(proposal.proposalType, proposal.locale)}
          </h1>
          <div className="proposal-document-recipient">
            <span>{copy.prepared}</span>
            <strong>{proposal.clientName || "…"}</strong>
          </div>
          <div className="proposal-document-cover-bottom">
            {proposal.plan && (
              <span>
                {copy.plan}
                <b>{proposal.plan}</b>
              </span>
            )}
            {proposal.pieces > 0 && (
              <span>
                {copy.pieces}
                <b>
                  {proposal.pieces} {copy.deliveries}
                </b>
              </span>
            )}
          </div>
        </div>
        {doc?.summary.trim() && (
          <div className="proposal-cover-summary">
            <h2>{extra.summary}</h2>
            {text(doc.summary)}
          </div>
        )}
      </section>
      <div className="proposal-document-body">
        {(proposal.scope?.trim() ||
          doc?.objectives.trim() ||
          doc?.included.trim() ||
          doc?.excluded.trim()) &&
          section(
            doc?.scopeTitle || (doc ? extra.scope : copy.scope),
            <>
              {text(proposal.scope)}
              {doc?.objectives && (
                <>
                  <h3>{extra.objectives}</h3>
                  {text(doc.objectives)}
                </>
              )}
              {doc?.included && (
                <>
                  <h3>{extra.included}</h3>
                  {list(doc.included)}
                </>
              )}
              {doc?.excluded && (
                <>
                  <h3>{extra.excluded}</h3>
                  {text(doc.excluded)}
                </>
              )}
            </>,
            "proposal-document-scope",
          )}
        {alternatives
          ? section(
              extra.options,
              <div className="proposal-option-grid">
                {doc!.options.map((option, index) => (
                  <label
                    data-proposal-reveal
                    key={option.id}
                    className={`proposal-option-card ${selected === option.id ? "selected" : ""}`}
                  >
                    <div className="proposal-package-identity">
                      <div className="proposal-option-overline">
                        <span>
                          {extra.option} {String(index + 1).padStart(2, "0")}
                        </span>
                        {(option.badge?.trim() || option.recommended) && (
                          <b>{option.badge?.trim() || extra.recommended}</b>
                        )}
                      </div>
                      <h3>{option.name}</h3>
                      {text(option.subtitle)}
                      {text(option.description)}
                    </div>
                    <div className="proposal-package-inclusions">
                      {option.items.some((item) => item.trim()) && (
                        <>
                          <h4>{extra.included}</h4>
                          {list(option.items.join("\n"))}
                        </>
                      )}
                      {option.excludedItems?.some((item) => item.trim()) && (
                        <>
                          <h4>{extra.excluded}</h4>
                          {list(option.excludedItems.join("\n"))}
                        </>
                      )}
                    </div>
                    <div className="proposal-package-investment">
                      <span className="proposal-package-price-label">
                        {copy.investment}
                      </span>
                      <strong className="proposal-option-price">
                        {money(option.value)}
                      </strong>
                      {onSelectOption && !proposal.acceptance ? (
                        <span className="proposal-option-select">
                          <input
                            type="radio"
                            name="proposal-option"
                            aria-label={`${extra.option} ${index + 1}: ${option.name}`}
                            value={option.id}
                            checked={selected === option.id}
                            onChange={() => onSelectOption(option.id)}
                          />
                          {selected === option.id
                            ? extra.selected
                            : extra.selectPackage}
                        </span>
                      ) : selected === option.id ? (
                        <p>{extra.selected}</p>
                      ) : null}
                    </div>
                  </label>
                ))}
              </div>,
            )
          : proposal.services.some((service) => service.name) &&
            section(
              copy.services,
              <div className="proposal-document-service-list">
                {proposal.services
                  .filter((service) => service.name)
                  .map((service, index) => (
                    <div key={index}>
                      <span className="proposal-document-service-number">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <h3>{service.name}</h3>
                        {text(service.description)}
                      </div>
                      <strong>{money(Number(service.value || 0))}</strong>
                    </div>
                  ))}
              </div>,
              "proposal-document-services",
            )}
        {doc?.deliverables.some((item) => item.name.trim()) &&
          section(
            doc.deliverablesTitle || extra.deliverables,
            <ul className="proposal-deliverable-list">
              {doc.deliverables
                .filter((item) => item.name.trim())
                .map((item, i) => (
                  <li key={i}>
                    <h3>{item.name}</h3>
                    {text(item.description)}
                  </li>
                ))}
            </ul>,
            doc?.timelineValue ? "proposal-paired-section" : "",
          )}
        {doc?.timelineValue &&
          section(
            doc.timelineTitle || extra.timeline,
            <>
              <p className="proposal-timeline-value">
                {doc.timelineUnit === "date"
                  ? new Date(
                      doc.timelineValue + "T12:00:00",
                    ).toLocaleDateString(copy.code)
                  : `${doc.timelineValue} ${doc.timelineUnit === "business" ? extra.business : extra.calendar}`}
              </p>
              {text(doc.timelineStart)}
              {text(doc.timelineNotes)}
            </>,
            doc.deliverables.some((item) => item.name.trim())
              ? "proposal-paired-section"
              : "",
          )}
        {doc?.addons.some((item) => item.name.trim()) &&
          section(
            extra.addons,
            <>
              <p>{extra.addonNote}</p>
              {doc.addons
                .filter((item) => item.name.trim())
                .map((item, i) => (
                  <div className="proposal-addon" key={i}>
                    <div>
                      <h3>{item.name}</h3>
                      {text(item.description)}
                    </div>
                    <strong>{money(item.value)}</strong>
                  </div>
                ))}
            </>,
          )}
        {section(
          doc ? extra.payment : copy.investment,
          <div className="proposal-investment-band">
            {chosen && (
              <div className="proposal-chosen-package">
                <span>{extra.selected}</span>
                <strong>{chosen.name}</strong>
              </div>
            )}
            <div className="proposal-investment-price">
              {total !== undefined && (
                <div
                  className="proposal-document-investment-amount"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <span>{copy.total}</span>
                  <strong>{money(total)}</strong>
                </div>
              )}
              {alternatives && !chosen && !proposal.acceptance && (
                <p role="status" aria-live="polite">
                  {extra.neutralInvestment}
                </p>
              )}
            </div>
            <div className="proposal-payment-details">
              {doc &&
                (doc.paymentTerms ||
                  doc.deposit !== null ||
                  doc.balance ||
                  doc.paymentMethods ||
                  doc.financialNotes ||
                  proposal.investment) && <h3>{extra.payment}</h3>}
              {text(proposal.investment)}
              {doc && (
                <>
                  {text(doc.paymentTerms)}
                  {doc.deposit !== null && (
                    <p>
                      {extra.deposit}: {doc.deposit}%
                    </p>
                  )}
                  {doc.balance && (
                    <>
                      <h3>{extra.balance}</h3>
                      {text(doc.balance)}
                    </>
                  )}
                  {doc.paymentMethods && (
                    <>
                      <h3>{extra.methods}</h3>
                      {text(doc.paymentMethods)}
                    </>
                  )}
                  {text(doc.financialNotes)}
                </>
              )}
            </div>
          </div>,
          "proposal-document-investment",
        )}
        {doc &&
          (doc.terms || doc.revisions !== null || doc.clientMaterials) &&
          section(
            extra.terms,
            <>
              {doc.revisions !== null && (
                <p>
                  {extra.revisions}: {doc.revisions}
                </p>
              )}
              {text(doc.terms)}
              {doc.clientMaterials && (
                <>
                  <h3>{extra.materials}</h3>
                  {text(doc.clientMaterials)}
                </>
              )}
            </>,
          )}
        <footer className="proposal-document-validity">
          <span>
            {copy.validity}
            <strong>
              {copy.until}{" "}
              {new Date(proposal.expiresAt).toLocaleDateString(copy.code)}
            </strong>
          </span>
          <b>LIEGE PASCHOALINI STUDIO</b>
        </footer>
        {showApproval &&
          doc?.approvalText &&
          section(
            extra.approval,
            text(doc.approvalText),
            "proposal-approval-copy",
          )}
      </div>
    </article>
  );
}
