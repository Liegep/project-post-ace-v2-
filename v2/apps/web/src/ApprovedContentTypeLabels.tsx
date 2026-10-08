import { useEffect } from "react";
import { loadClientPortalBySlug } from "./api";
import type { BoardCard, ClientPortalPreview } from "./types";

const APPROVED_LABELS = {
  pt: { brief: "Pauta aprovada", post: "Post final aprovado" },
  en: { brief: "Approved content idea", post: "Final post approved" },
  es: { brief: "Propuesta aprobada", post: "Publicación final aprobada" },
  it: { brief: "Proposta approvata", post: "Post finale approvato" },
  sv: { brief: "Godkänd innehållsidé", post: "Slutligt inlägg godkänt" },
} as const;

type SupportedLocale = keyof typeof APPROVED_LABELS;

function normalizeLocale(value: string): SupportedLocale {
  const locale = value.trim().toLowerCase();
  if (locale.startsWith("en") || locale.includes("ingl")) return "en";
  if (locale.startsWith("es") || locale.includes("esp")) return "es";
  if (locale.startsWith("it") || locale.includes("ital")) return "it";
  if (locale.startsWith("sv") || locale.includes("suec") || locale.includes("swed")) return "sv";
  return "pt";
}

function isPortalApproved(card: BoardCard) {
  const statusText = [card.clientLabel, ...card.statusBadges].join(" ").toLocaleLowerCase("pt-BR");
  return /(aprovad|finalizad|publicad)/.test(statusText);
}

function portalSlugFromHash() {
  const match = window.location.hash.match(/^#\/portal\/([^/?]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function approvedCards(data: ClientPortalPreview) {
  return [...data.boardColumns.flatMap((column) => column.cards), ...data.withoutColumn].filter(isPortalApproved);
}

function applyApprovedLabels(data: ClientPortalPreview) {
  const cards = approvedCards(data);
  const locale = normalizeLocale(data.locale);
  const labels = APPROVED_LABELS[locale];
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>(".portal-approved-card:not(.portal-approved-text-card) .portal-text-status.approved"),
  );

  nodes.forEach((node, index) => {
    const card = cards[index];
    if (!card) return;
    const nextLabel = card.isBriefApproval ? labels.brief : labels.post;
    if (node.textContent !== nextLabel) node.textContent = nextLabel;
  });
}

export function ApprovedContentTypeLabels() {
  useEffect(() => {
    let disposed = false;
    let timer: number | null = null;
    let cachedSlug = "";
    let cachedData: ClientPortalPreview | null = null;
    let cachedAt = 0;

    const run = async () => {
      if (disposed || !document.querySelector(".portal-approved-view")) return;
      const slug = portalSlugFromHash();
      if (!slug) return;

      try {
        const now = Date.now();
        if (!cachedData || cachedSlug !== slug || now - cachedAt > 1000) {
          cachedData = await loadClientPortalBySlug(slug);
          cachedSlug = slug;
          cachedAt = now;
        }
        if (!disposed && cachedData) applyApprovedLabels(cachedData);
      } catch {
        // The portal already has its own loading/error handling. This helper only
        // improves labels and must never interfere with normal portal rendering.
      }
    };

    const schedule = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => void run(), 120);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener("hashchange", schedule);
    schedule();

    return () => {
      disposed = true;
      observer.disconnect();
      window.removeEventListener("hashchange", schedule);
      if (timer !== null) window.clearTimeout(timer);
    };
  }, []);

  return null;
}
