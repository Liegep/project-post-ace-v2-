export type ApprovalState = "pending" | "approved" | "changes_requested";

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

// Internal approvals (for example “Aprovado pela boss ❤️”) are unrelated.
export function isClientDecisionStatus(value: string) {
  return /^(aprovad[oa]|aprovado pelo cliente|pautas? aprovad[ao]s?|revisao solicitada|alteracao solicitada|alterad[oa]|reprovado|nao aprovado)$/.test(normalize(value));
}

export function approvalStatuses(status: string[], state: ApprovalState) {
  const retained = status.filter((item) => !isClientDecisionStatus(item));
  return Array.from(new Set([
    ...(state === "pending" ? ["Enviar para Cliente"] : []),
    ...retained,
    ...(state === "pending" ? [] : [state === "approved" ? "Aprovado" : "Revisão solicitada"]),
  ]));
}

export function inferredApprovalState(card: { approvalState?: ApprovalState | null; clientLabel: string; status: string[]; tags?: string[] }): ApprovalState | null {
  if (card.approvalState) return card.approvalState;
  const values = [card.clientLabel, ...card.status, ...(card.tags ?? [])].map(normalize);
  if (values.some((value) => /^(alterad[oa]|alteracao solicitada|revisao solicitada|reprovado|nao aprovado)$/.test(value))) return "changes_requested";
  if (values.some((value) => /^(aprovad[oa]|aprovado pelo cliente|pautas? aprovad[ao]s?)$/.test(value))) return "approved";
  return null;
}

export function resendBlockedReason(card: { archived: boolean; publishedAt: unknown; scheduledAt: unknown; status: string[] }) {
  if (card.archived) return "Restaure o post antes de enviar novamente para aprovação.";
  if (card.publishedAt || card.status.some((value) => /^publicado$/.test(normalize(value)))) return "Este post já foi publicado. Crie uma nova versão para aprovação.";
  if (card.scheduledAt || card.status.some((value) => /^agendados?$/.test(normalize(value)))) return "Remova o agendamento e o status Agendado antes de enviar novamente para aprovação.";
  return null;
}
