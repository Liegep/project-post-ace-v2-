import { createHash } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { isClientDecisionStatus } from "../approvals/approval-state.js";

export const repairTarget = { clientId: "d23f7591-ad3e-45fc-a3a5-f036189153db", cardId: "089dbeed-f15d-4f28-ae5f-ccfaa35e1e9d", ideaId: "e5484a6d-2626-48d8-9100-e75c4ef3c1e7" } as const;
type Row = Record<string, any>;
export function decodeRepairJson(value: unknown): any {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return null; }
}
function canonical(value: any): any {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key,canonical(value[key])]));
  return value;
}
export const repairFingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
export type RepairSnapshot = { card: Row | null; client: Row | null; columns: Row[]; duplicates: Row[]; preserved: Record<string, Row[]> };

/** Pure proposal only: no apply function and no SQL writes. Missing/ambiguous data blocks repair. */
export function buildProducedPostRepairPreview(snapshot: RepairSnapshot) {
  const {card,client,columns,duplicates,preserved} = snapshot, blockers: string[] = [];
  if (!card || card.id !== repairTarget.cardId || card.client_account_id !== repairTarget.clientId || client?.id !== repairTarget.clientId || client.slug !== "kynagogi") blockers.push("Cliente ou card não corresponde ao alvo autorizado.");
  const status = decodeRepairJson(card?.status_json);
  if (!Array.isArray(status) || status.some(item => typeof item !== "string")) blockers.push("Status não pode ser interpretado com segurança.");
  if (card?.is_brief_approval !== 1) blockers.push("O card já não está marcado como pauta ou seu indicador é inválido.");
  if (card?.approval_state !== "pending" || !Number.isInteger(card?.approval_revision) || card.approval_revision < 1) blockers.push("A revisão/decisão atual exige avaliação manual; não reabrir aprovação automaticamente.");
  if (card?.archived || card?.archived_at || card?.scheduled_at || card?.published_at) blockers.push("Card arquivado, agendado ou publicado exige outro procedimento.");
  if (Array.isArray(status) && status.some(item => typeof item === "string" && isClientDecisionStatus(item))) blockers.push("Marcadores de decisão divergem do ciclo pendente.");
  const column = columns.find(item => item.id === card?.column_id);
  if (!column || column.client_account_id !== repairTarget.clientId || !column.visible_to_client) blockers.push("Coluna ausente, de outro cliente ou oculta; não alterar uma coluna compartilhada.");
  if (Array.isArray(status) && status.some(item => typeof item === "string" && /^(agendados?|publicados?|arquivados?)$/i.test(item.trim()))) blockers.push("Marcador de agendamento/publicação/arquivo exige avaliação manual.");
  if (column && /^(aprovados?|pautas? aprovad[ao]s?|agendados?|publicados?|arquivados?)$/i.test(String(column.name).trim())) blockers.push("A coluna não corresponde a uma etapa de aprovação pendente.");
  const media = decodeRepairJson(card?.media_urls_json);
  if (!Array.isArray(media) || (!media.length && !card?.primary_media_url)) blockers.push("Mídia produzida não confirmada no card.");
  const drawer = decodeRepairJson(client?.workspace_drawer_json);
  const ideas = Array.isArray(drawer?.pautaIdeas) ? drawer.pautaIdeas.filter((idea: Row) => idea.cardId === repairTarget.cardId) : [];
  if (ideas.length !== 1 || ideas[0].id !== repairTarget.ideaId || ideas[0].status !== "approved") blockers.push("Vínculo único e aprovação histórica da pauta não confirmados.");
  if (duplicates.length) blockers.push("Outro card tem o mesmo título; conferir possível duplicação antes de reparar.");
  const events = preserved.card_approval_events ?? [];
  const conversions = events.filter(event => event.action === "converted_to_post");
  const conversion = conversions.at(-1);
  const before = decodeRepairJson(conversion?.before_json), after = decodeRepairJson(conversion?.after_json);
  if (!conversion || conversion.card_id !== repairTarget.cardId || before?.id !== repairTarget.cardId || after?.id !== repairTarget.cardId || before.isBriefApproval !== true || after.isBriefApproval !== false || after.approvalState !== "pending" || after.approvalRevision !== conversion.revision || conversion.revision > (card?.approval_revision ?? -1)) blockers.push("Snapshots de conversão válidos não confirmados.");
  if (events.some(event => event.revision > (card?.approval_revision ?? -1))) blockers.push("Histórico está à frente da revisão do card.");
  for (const table of ["card_comments","approval_links","card_caption_versions","card_approval_events","card_calendar_events","internal_approval_requests"]) {
    if (!Array.isArray(preserved[table])) blockers.push(`Conferência ausente: ${table}.`);
    else if (preserved[table].some(row => row.card_id !== repairTarget.cardId)) blockers.push(`Referência de outro card: ${table}.`);
  }
  const latest = events.at(-1);
  if (latest && (latest.revision !== card?.approval_revision || (latest.decision && latest.decision !== card?.approval_state))) blockers.push("A última revisão auditada não confirma a decisão vigente.");
  const snapshotState = (state: Row | null) => state ? {isBriefApproval:state.isBriefApproval,approvalRevision:state.approvalRevision,approvalState:state.approvalState,columnId:state.columnId,status:state.status} : null;
  const proposedStatus = Array.isArray(status) && status.every(item => typeof item === "string") ? [...new Set([...status,"Enviar para Cliente"])] : null;
  return { mode: "preview-only", target: repairTarget, eligibleForReview: blockers.length === 0, blockers,
    snapshotFingerprint: repairFingerprint(snapshot),
    current: card ? {id:card.id,title:card.title,isBriefApproval:!!card.is_brief_approval,approvalRevision:card.approval_revision,approvalState:card.approval_state,status,column:column ? {id:column.id,name:column.name,visibleToClient:!!column.visible_to_client}:null} : null,
    conversion: conversion ? {id:conversion.id,revision:conversion.revision,createdAt:conversion.created_at,before:snapshotState(before),after:snapshotState(after),snapshotsFingerprint:repairFingerprint([before,after])}:null,
    bankLink: ideas.length === 1 ? {id:ideas[0].id,cardId:ideas[0].cardId,status:ideas[0].status} : null,
    contentComparison: after && card ? {captionMatchesConversion:repairFingerprint(after.caption??null)===repairFingerprint(card.caption??null),mediaMatchesConversion:repairFingerprint(after.mediaUrls??[])===repairFingerprint(media??[])} : null,
    proposedPatch: blockers.length ? null : {isBriefApproval:false,status:proposedStatus},
    preserved: Object.fromEntries(Object.entries(preserved).map(([table,rows]) => [table,{count:rows.length,fingerprint:repairFingerprint(rows)}])),
    cardFingerprint: repairFingerprint(card), bankFingerprint:repairFingerprint(client?.workspace_drawer_json ?? null),
    requirements: ["Nenhuma alteração foi executada. Aprovação humana separada é obrigatória.","Repetir esta prévia sob bloqueio e comparar o snapshot integral antes de qualquer reparo.","Preservar ciclo/decisão vigente, mídias, legenda, banco, comentários, links e snapshots; auditar o reparo sem repetir conversão ou reenvio.","Abortar se qualquer estado ou vínculo mudar; não executar um patch comum que abra outro ciclo."] };
}

/** Reads only scoped rows. The CLI additionally requires a read-only transaction. */
export async function readProducedPostRepairSnapshot(db: {query: Function}): Promise<RepairSnapshot> {
  const rows = async (sql: string, args: unknown[]) => (await db.query(sql,args))[0] as RowDataPacket[];
  const card = (await rows("SELECT * FROM kanban_cards WHERE id = ? AND client_account_id = ?",[repairTarget.cardId,repairTarget.clientId]))[0] ?? null;
  const client = (await rows("SELECT id, slug, workspace_drawer_json FROM client_accounts WHERE id = ?",[repairTarget.clientId]))[0] ?? null;
  if (!card || client?.slug !== "kynagogi") return {card,client,columns:[],duplicates:[],preserved:{}};
  const columns = await rows("SELECT * FROM kanban_columns WHERE client_account_id = ? ORDER BY id",[repairTarget.clientId]);
  const duplicates = card ? await rows("SELECT id, title, archived FROM kanban_cards WHERE client_account_id = ? AND id <> ? AND TRIM(title) = TRIM(?) ORDER BY id",[repairTarget.clientId,repairTarget.cardId,card.title]) : [];
  const preserved: Record<string,Row[]> = {};
  // Identifiers are a fixed allowlist, never supplied by the caller.
  for (const table of ["card_comments","approval_links","card_caption_versions","card_approval_events","card_calendar_events","internal_approval_requests"]) {
    preserved[table] = await rows(`SELECT * FROM ${table} WHERE card_id = ? ORDER BY id`,[repairTarget.cardId]);
  }
  preserved.card_approval_events.sort((a,b) => a.revision-b.revision);
  return {card,client,columns,duplicates,preserved};
}
