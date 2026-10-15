import React from "react";
export type EditorialBriefData = {
  concept?: string | null; hook?: string | null; cta?: string | null; description?: string | null;
  rationale?: string | null; objective?: string | null; sourceTitle?: string | null;
  sourceSummary?: string | null; sourceUrl?: string | null; sourceDate?: string | null;
};
/** Produced posts keep their editorial brief after production; only the approval
 * stage flag selects the pauta reader, including pautas with reference media. */
export function usesEditorialPautaLayout(card: { isBriefApproval?: boolean }) {
  return card.isBriefApproval === true;
}
const fields = ["concept", "hook", "cta", "description", "rationale", "objective", "sourceTitle", "sourceSummary", "sourceUrl", "sourceDate"] as const;
/** Copy only client-facing content; never infer missing source text from descriptions/AI. */
export function clientEditorialBrief(input: EditorialBriefData): EditorialBriefData | null {
  const data = Object.fromEntries(fields.filter(key => typeof input[key] === "string" && input[key]!.trim()).map(key => [key, input[key]]));
  return Object.keys(data).length ? data : null;
}
export function safeSourceUrl(value?: string | null) {
  try { const url = new URL(value || ""); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function sourcePublicationDate(value?: string | null, locale = "pt-BR") {
  if (!value) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(dateOnly ? `${value}T00:00:00Z` : value);
  if (!Number.isFinite(date.getTime()) || (dateOnly && date.toISOString().slice(0, 10) !== value)) return null;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(date);
}
export function EditorialBrief({ brief, caption, locale = "pt-BR", t = value => value }: { brief?: EditorialBriefData | null; caption?: string | null; locale?: string; t?: (value: string) => string }) {
  if (!brief) return null;
  const seen = new Set([caption?.trim()].filter(Boolean));
  const rows = ([['concept', 'Ideia central'], ['hook', 'Gancho'], ['description', 'Proposta de conteúdo'], ['objective', 'Objetivo'], ['rationale', 'Por que esta pauta'], ['cta', 'Chamada para ação'], ['sourceSummary', 'Contexto da fonte']] as const).flatMap(([key, label]) => {
    const text = brief[key]?.trim(); if (!text || seen.has(text)) return []; seen.add(text); return [{ key, label, text }];
  });
  const url = safeSourceUrl(brief.sourceUrl), date = sourcePublicationDate(brief.sourceDate, locale);
  if (!rows.length && !brief.sourceTitle?.trim() && !url && !date) return null;
  return <section className="editorial-brief" aria-label={t("Briefing editorial")}>
    <header><span>{t("DIREÇÃO EDITORIAL")}</span><h4>{t("Briefing editorial")}</h4></header>
    <dl>{rows.map(row => <div key={row.key}><dt>{t(row.label)}</dt><dd>{row.text}</dd></div>)}</dl>
    {brief.sourceTitle?.trim() || url || date ? <footer><span>{t("Fonte da notícia")}</span>{url ? <a href={url} target="_blank" rel="noopener noreferrer">{brief.sourceTitle?.trim() || new URL(url).hostname}<span aria-hidden="true"> ↗</span></a> : brief.sourceTitle?.trim() ? <strong>{brief.sourceTitle}</strong> : null}{date ? <small>{t("Publicado em")} <time dateTime={brief.sourceDate!}>{date}</time></small> : null}</footer> : null}
  </section>;
}

export function ApprovalBriefSnapshot({ snapshot }: { snapshot?: {editorialBrief?:EditorialBriefData|null;caption?:string|null} | string }) {
  try {
    const data = typeof snapshot === "string" ? JSON.parse(snapshot) : snapshot;
    if (!data?.editorialBrief) return null;
    return <details className="approval-brief-snapshot"><summary>Briefing desta revisão</summary><EditorialBrief brief={data.editorialBrief} caption={data.caption} /></details>;
  } catch { return null; }
}
