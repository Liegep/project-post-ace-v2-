import { createHash, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import type { FastifyInstance } from "fastify";
import type { PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { findCardById } from "../cards/cards.repository.js";
import { editorialBriefSchema, readEditorialBrief } from "../cards/editorial-brief.js";
import { inferredApprovalState, resendBlockedReason } from "../approvals/approval-state.js";
import { recordApprovalEvent } from "../approvals/approval-history.repository.js";

const sourceFields = { concept: "concept", hook: "hook", description: "description", rationale: "rationale", objective: "objective", cta: "cta", sourceTitle: "source_title", sourceSummary: "source_summary", sourceUrl: "source_url", sourceDate: "source_date" } as const;
type Actor = { id: string; fullName: string; globalRole: string };
const parse = (value: unknown) => typeof value === "string" ? JSON.parse(value) : value;
const absent = (value: unknown) => value == null || (typeof value === "string" && !value.trim());
function canonical(value: any): any {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");

/** Missing fields only. Never copy caption/title or replace an existing description. */
export function planBriefRecovery(idea: Record<string, any>, source: Record<string, any>, rawBrief: unknown, protectedCard?: {title:string;caption:string|null}) {
  const brief = parse(rawBrief) ?? {};
  if (typeof brief !== "object" || Array.isArray(brief)) throw Error("Briefing existente incompatível.");
  for (const [key,value] of Object.entries(brief)) {
    if (!(key in editorialBriefSchema.shape) || !editorialBriefSchema.shape[key as keyof typeof sourceFields].safeParse(value).success) throw Error("Briefing existente incompatível.");
  }
  const additions: Record<string, string> = {}, bankAdditions: Record<string, string> = {};
  const divergences: Array<{ field: string; pauta: unknown; current: unknown; original: string }> = [];
  const unavailable: string[] = [];
  for (const [field, column] of Object.entries(sourceFields)) {
    const original = source[column];
    if (absent(original)) { unavailable.push(field); continue; }
    const valid = editorialBriefSchema.shape[field as keyof typeof sourceFields].safeParse(original);
    if (!valid.success || typeof original !== "string") { unavailable.push(field); continue; }
    const bankConflict = !absent(idea[field]) && idea[field] !== original;
    const cardConflict = !absent(brief[field]) && brief[field] !== original;
    if (bankConflict || cardConflict) divergences.push({ field, pauta: idea[field] ?? null, current: brief[field] ?? null, original });
    if (absent(idea[field]) && field !== "description") bankAdditions[field] = original;
    if (absent(brief[field]) && !bankConflict) additions[field] = original;
  }
  if (protectedCard) for (const [field,column] of [["title","title"],["caption","caption_suggestion"]] as const) {
    const original=source[column];
    if (typeof original === "string" && ((!absent(idea[field]) && idea[field] !== original) || (!absent(protectedCard[field]) && protectedCard[field] !== original))) divergences.push({field,pauta:idea[field]??null,current:protectedCard[field],original});
  }
  return { additions, bankAdditions, divergences, unavailable, recoveredBrief: { ...brief, ...additions } };
}

async function inspect(app: FastifyInstance, db: PoolConnection, clientId: string, cardId: string, lock: boolean) {
  const [accounts] = await db.query<RowDataPacket[]>(`SELECT workspace_drawer_json FROM client_accounts WHERE id=?${lock ? " FOR UPDATE" : ""}`, [clientId]);
  if (!accounts[0]) throw app.httpErrors.notFound("Cliente não encontrado.");
  if (lock) await db.query("SELECT id FROM kanban_cards WHERE id=? AND client_account_id=? FOR UPDATE", [cardId, clientId]);
  const card = await findCardById(db, cardId);
  if (!card || card.clientAccountId !== clientId) throw app.httpErrors.notFound("Card não encontrado nesta conta.");
  const drawer = parse(accounts[0].workspace_drawer_json) ?? {};
  const ideas = Array.isArray(drawer.pautaIdeas) ? drawer.pautaIdeas : [];
  const matches = ideas.filter((idea: any) => idea?.cardId === cardId);
  const idea = matches.length === 1 ? matches[0] : null;
  const [sources] = idea?.radarSuggestionId ? await db.query<RowDataPacket[]>(`SELECT * FROM radar_suggestions WHERE client_account_id=? AND id=?${lock ? " FOR UPDATE" : ""}`, [clientId, idea.radarSuggestionId]) : [[]];
  const source = sources[0];
  const [events] = await db.query<RowDataPacket[]>("SELECT id,revision,action,decision,before_json,after_json FROM card_approval_events WHERE card_id=? ORDER BY revision", [cardId]);
  const [links] = await db.query<RowDataPacket[]>(`SELECT id,client_account_id,is_active,approved_at,expires_at FROM approval_links WHERE card_id=? ORDER BY id${lock ? " FOR UPDATE" : ""}`, [cardId]);
  const [columns] = card.columnId ? await db.query<RowDataPacket[]>(`SELECT id,name FROM kanban_columns WHERE id=? AND client_account_id=?${lock ? " FOR UPDATE" : ""}`,[card.columnId,clientId]) : [[]];
  const blockers: string[] = [];
  const normalize = (value:string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase();
  if (links.some(link=>link.client_account_id !== clientId)) blockers.push("Existe link vinculado a outra conta; revise o vínculo antes de recuperar.");
  if (card.columnId && !columns[0]) blockers.push("A coluna do card não pertence a este cliente.");
  if (columns[0] && /^(pautas? aprovad[ao]s?|aprovados(?: pelo cliente)?|publicad[oa]s?|agendad[oa]s?|finalizad[oa]s?|cancelad[oa]s?|arquivad[oa]s?)$/.test(normalize(columns[0].name))) blockers.push("A coluna atual indica um estado incompatível com recuperação.");
  if (card.archivedAt) blockers.push("Existe indicação de arquivamento que precisa de revisão.");
  if ([card.clientLabel,...card.status,...card.tags].some(value=>/^(aprovad[oa]|aprovado pelo cliente|pautas? aprovad[ao]s?)$/.test(normalize(value)))) blockers.push("Existe indicação de aprovação que precisa ser preservada.");
  if (!idea || !source || source.status !== "accepted" || source.accepted_pauta_id !== idea.id) blockers.push("Não há vínculo único com uma sugestão original aceita.");
  if (!card.isBriefApproval || idea?.status !== "sent") blockers.push("A recuperação exige uma pauta enviada para aprovação.");
  const state = inferredApprovalState(card);
  if (inferredApprovalState({...card,approvalState:null}) === "approved") blockers.push("O conteúdo possui indicação de aprovação e está protegido.");
  if (state && state !== "pending") blockers.push("Conteúdo aprovado ou com alterações solicitadas está protegido.");
  if (!state && !card.status.includes("Enviar para Cliente")) blockers.push("O estado atual não permite recuperação.");
  if (events.some(event => event.action === "approved" || event.decision === "approved") || links.some(link => link.approved_at != null)) blockers.push("Existe aprovação anterior; recuperação exige um fluxo separado de revisão.");
  const blocked = resendBlockedReason(card);
  if (blocked) blockers.push(blocked);
  if (card.status.some(status => /^(finalizado|cancelado)$/i.test(status.trim()))) blockers.push("Conteúdo finalizado não permite recuperação.");
  let rawBrief: unknown = null;
  let plan: ReturnType<typeof planBriefRecovery> = { additions: {}, bankAdditions: {}, divergences: [], unavailable: [], recoveredBrief: {} };
  if (idea && source) {
    const [rawCards] = await db.query<RowDataPacket[]>("SELECT editorial_brief_json FROM kanban_cards WHERE id=? AND client_account_id=?", [cardId, clientId]);
    rawBrief = rawCards[0]?.editorial_brief_json ?? null;
    try { plan = planBriefRecovery(idea, source, rawBrief, {title:card.title,caption:card.caption}); }
    catch { blockers.push("O briefing existente precisa de revisão manual."); }
  }
  if (!Object.keys(plan.additions).length && !Object.keys(plan.bankAdditions).length) blockers.push("Não há campos ausentes recuperáveis.");
  return { card, drawer, ideas, idea, source, events, links, plan, blockers, rawBrief,
    digest: hash({ card, idea, source, events, links, columns, plan }) };
}

export async function previewBriefRecovery(app: FastifyInstance, clientId: string, cardId: string, actor: Actor) {
  const db = await app.db.getConnection();
  try {
    // Consistent read only: no history, reservations or link changes in preview.
    await db.beginTransaction();
    const data = await inspect(app, db, clientId, cardId, false);
    await db.commit();
    const previewToken = data.blockers.length ? null : jwt.sign({ purpose: "brief-recovery", clientId, cardId, userId: actor.id, digest: data.digest }, app.appEnv.JWT_SECRET, { algorithm: "HS256", audience: "brief-recovery", expiresIn: "10m", jwtid: randomUUID() });
    return { eligible: !data.blockers.length, blockers: data.blockers, previewToken, revision: data.card.approvalRevision,
      currentTitle: data.card.title, currentCaption: data.card.caption, currentBrief: data.card.editorialBrief, recoverableBrief: readEditorialBrief(data.plan.recoveredBrief),
      additions: data.plan.additions, bankAdditions: data.plan.bankAdditions, divergences: data.plan.divergences, unavailable: data.plan.unavailable,
      effects: { activeLinksToInvalidate: data.links.filter(link => link.is_active).length, newRevision: data.card.approvalRevision + 1, requiresNewApproval: true, preservesDescriptionCaptionMediaStatus: true } };
  } catch (error) { await db.rollback();
    if ((error as {statusCode?:number}).statusCode) throw error;
    throw Object.assign(new Error("Não foi possível consultar a recuperação. Tente uma nova prévia."),{statusCode:503});
  } finally { db.release(); }
}

export async function applyBriefRecovery(app: FastifyInstance, clientId: string, cardId: string, actor: Actor, previewToken: string) {
  let claims: jwt.JwtPayload;
  try {
    const verified = jwt.verify(previewToken, app.appEnv.JWT_SECRET, { algorithms: ["HS256"], audience: "brief-recovery" });
    if (typeof verified === "string" || verified.purpose !== "brief-recovery" || verified.clientId !== clientId || verified.cardId !== cardId || verified.userId !== actor.id || typeof verified.jti !== "string") throw Error("invalid preview");
    claims = verified;
  } catch { throw app.httpErrors.conflict("A prévia expirou ou não pertence a esta operação. Gere uma nova prévia."); }
  const db = await app.db.getConnection();
  try {
    await db.beginTransaction();
    const data = await inspect(app, db, clientId, cardId, true);
    const replay = data.events.find(event => event.id === claims.jti && event.action === "brief_restored");
    if (replay) { await db.commit(); return { applied: false, alreadyApplied: true, card: data.card }; }
    if (data.digest !== claims.digest) throw app.httpErrors.conflict("Os dados mudaram desde a prévia. Confira uma nova prévia.");
    if (data.blockers.length) throw app.httpErrors.conflict(data.blockers[0]);
    const revision = data.card.approvalRevision;
    if (!data.events.some(event => event.revision === revision)) await recordApprovalEvent(db, { cardId, revision, action: "legacy_snapshot", decision: null, source: "legacy", actor: { userId: null, name: "Estado anterior preservado", role: "unknown" }, before: data.card, after: data.card });
    const [written] = await db.query<ResultSetHeader>("UPDATE kanban_cards SET editorial_brief_json=?,approval_revision=approval_revision+1 WHERE id=? AND client_account_id=? AND approval_revision=?", [JSON.stringify(data.plan.recoveredBrief), cardId, clientId, revision]);
    if (written.affectedRows !== 1) throw app.httpErrors.conflict("A revisão mudou. Confira uma nova prévia.");
    const nextIdeas = data.ideas.map((idea: any) => idea.id === data.idea.id ? { ...idea, ...data.plan.bankAdditions } : idea);
    await db.query("UPDATE client_accounts SET workspace_drawer_json=? WHERE id=?", [JSON.stringify({ ...data.drawer, pautaIdeas: nextIdeas }), clientId]);
    await db.query("UPDATE approval_links SET is_active=0 WHERE card_id=? AND is_active=1", [cardId]);
    const after = (await findCardById(db, cardId))!;
    await recordApprovalEvent(db, { eventId: claims.jti, cardId, revision: after.approvalRevision, action: "brief_restored", decision: null, source: "admin", actor: { userId: actor.id, name: actor.fullName, role: actor.globalRole },
      before: data.card, after: { ...after, briefRecoveryOrigin: { suggestionId: data.source.id, fields: Object.keys(data.plan.additions), bankFields: Object.keys(data.plan.bankAdditions), previousStoredBrief: parse(data.rawBrief), previousPautaFields: Object.fromEntries(Object.keys(data.plan.bankAdditions).map(field => [field,{existed:Object.hasOwn(data.idea,field),value:data.idea[field]??null}])) } } });
    await db.commit(); return { applied: true, alreadyApplied: false, card: after };
  } catch (error) {
    await db.rollback();
    if (["ER_LOCK_DEADLOCK", "ER_LOCK_WAIT_TIMEOUT"].includes((error as { code?: string }).code ?? "")) throw app.httpErrors.conflict("Uma operação simultânea alterou o registro. Confira uma nova prévia.");
    if ((error as {statusCode?:number}).statusCode) throw error;
    throw Object.assign(new Error("Não foi possível confirmar a recuperação. Consulte a revisão e o histórico antes de repetir."),{statusCode:503});
  } finally { db.release(); }
}
