import React from "react";
import type { MetaScheduledPublication } from "./api";

type PublicationStatus = Pick<MetaScheduledPublication, "status" | "lastError">;
type PlatformPublication = PublicationStatus & Pick<MetaScheduledPublication, "platform">;
type DetailPublication = PlatformPublication & Pick<MetaScheduledPublication, "publishedPermalink">;

// Presentation only: cancelled jobs remain cancelled and keep their retry semantics.
export function metaPublicationVisualStatus(publication: PublicationStatus) {
  return publication.status === "cancelled" && Boolean(publication.lastError) ? "failed" : publication.status;
}

export function metaPublicationStatusLabel(status: MetaScheduledPublication["status"], lastError?: string | null) {
  if (status === "cancelled" && lastError) return "Falhou · cancelado";
  return status === "scheduled" ? "Agendado" : status === "publishing" ? "Publicando" : status === "published" ? "Publicado" : status === "failed" ? "Falhou" : "Cancelado";
}

export function MetaPublicationPlatformChip({ publication }: { publication: PlatformPublication }) {
  const label = `${publication.platform === "instagram" ? "Instagram" : "Facebook"}: ${metaPublicationStatusLabel(publication.status, publication.lastError)}`;
  return <span className={`${publication.platform} ${metaPublicationVisualStatus(publication)}`} title={label} aria-label={label}>
    {publication.platform === "instagram" ? "IG" : "FB"}<i />
  </span>;
}

export function MetaPublicationPlatformDetail({ publication, actionPending, onCancel }: {
  publication: DetailPublication;
  actionPending: boolean;
  onCancel: () => void;
}) {
  const platform = publication.platform === "instagram" ? "Instagram" : "Facebook";
  return <article className={metaPublicationVisualStatus(publication)}>
    <div><strong>{platform}</strong><span>{metaPublicationStatusLabel(publication.status, publication.lastError)}</span></div>
    {publication.lastError ? <p>{publication.lastError}</p> : null}
    <footer>
      {publication.publishedPermalink ? <a href={publication.publishedPermalink} target="_blank" rel="noreferrer">Abrir publicação</a> : null}
      {publication.status === "scheduled" || publication.status === "failed" ? <button disabled={actionPending} onClick={onCancel}>Cancelar {platform}</button> : null}
    </footer>
  </article>;
}

export function metaCenterPeriodRange(from: string, to: string) {
  const until = new Date(`${to}T00:00:00`);
  until.setDate(until.getDate() + 1);
  return { from: new Date(`${from}T00:00:00`).toISOString(), to: until.toISOString() };
}
