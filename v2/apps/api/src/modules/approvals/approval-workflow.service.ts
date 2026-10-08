import type { UpdateCardInput } from "../cards/cards.schemas.js";
import { recordCardActivityEvent } from "../cards/card-activity.service.js";
import type { FastifyInstance } from "fastify";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { findCardById, updateCard } from "../cards/cards.repository.js";
import { createColumn, listColumnsByClientAccountId, updateColumn } from "../columns/columns.repository.js";
import { createComment } from "../comments/comments.repository.js";
import { createApprovalLink, findApprovalLinkByToken, submitApprovalDecision } from "./approvals.repository.js";
import { recordApprovalEvent } from "./approval-history.repository.js";
import { approvalStatuses, inferredApprovalState, resendBlockedReason } from "./approval-state.js";

type Actor = { userId: string | null; name: string; role: "super_admin" | "admin" | "colaborador" | "cliente" | "guest" };
type Card = NonNullable<Awaited<ReturnType<typeof findCardById>>>;
const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

async function lockedCard(app: FastifyInstance, db: PoolConnection, clientAccountId: string, cardId: string) {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT id FROM kanban_cards WHERE id = ? AND client_account_id = ? FOR UPDATE", [cardId, clientAccountId],
  );
  if (!rows.length) throw app.httpErrors.notFound("Card não encontrado nesta conta.");
  return (await findCardById(db, cardId))!;
}

function checkRevision(app: FastifyInstance, card: Card, expected: number | undefined) {
  if (card.approvalRevision !== (expected ?? 0)) {
    throw app.httpErrors.conflict("Este post recebeu uma nova atualização de aprovação. Reabra o card para revisar a versão atual.");
  }
}

async function preserveLegacyState(db: PoolConnection, card: Card) {
  if (card.approvalRevision !== 0) return;
  await recordApprovalEvent(db, {
    cardId: card.id, revision: 0, action: "legacy_snapshot", decision: inferredApprovalState(card), source: "legacy",
    actor: { userId: null, name: "Registro anterior", role: "unknown" }, before: card, after: card,
    commentText: "Estado anterior preservado. A data deste registro é a captura; autor e data da decisão original não estavam registrados.",
  });
}

async function destination(db: PoolConnection, card: Card, approved: boolean) {
  const columns = await listColumnsByClientAccountId(db, card.clientAccountId);
  const current = columns.find((column) => column.id === card.columnId);
  // Preserve the team's column unless it would hide a pending card in Approved.
  if (!approved && (!current || !/aprovados(?: pelo cliente)?/i.test(normalized(current.name)))) return card.columnId;
  const name = approved ? (card.isBriefApproval ? "Pauta aprovada" : "Aprovados") : "Aguardando aprovação";
  let target = columns.find((column) => approved
    ? card.isBriefApproval ? /^pautas? aprovad[ao]s?$/i.test(normalized(column.name)) : /aprovados(?: pelo cliente)?/i.test(normalized(column.name))
    : normalized(column.name).toLowerCase() === "aguardando aprovacao");
  if (!target) target = await createColumn(db, card.clientAccountId, {
    name, color: approved ? (card.isBriefApproval ? "#8b5cf6" : "#28b77d") : "#7568dc",
    visibleToClient: !approved || !card.isBriefApproval, autoCreated: true,
  }) ?? undefined;
  else if ((approved && card.isBriefApproval && target.name !== name) || ((!approved || !card.isBriefApproval) && !target.visibleToClient)) {
    target = await updateColumn(db, target.id, {
      ...(approved && card.isBriefApproval ? { name } : { visibleToClient: true }),
    }) ?? target;
  }
  if (!target) throw new Error("Não foi possível preparar a coluna de aprovação.");
  return target.id;
}

async function moveWithinTransaction(db: PoolConnection, card: Card, columnId: string | null) {
  if (card.columnId === columnId) return;
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT COALESCE(MAX(position), -1) + 1 AS nextPosition FROM kanban_cards WHERE client_account_id = ? AND archived = 0 AND column_id <=> ?",
    [card.clientAccountId, columnId],
  );
  await db.query("UPDATE kanban_cards SET column_id = ?, position = ? WHERE id = ?", [columnId, Number(rows[0].nextPosition), card.id]);
}

export async function resubmitCardApproval(app: FastifyInstance, clientAccountId: string, cardId: string, actor: Actor, expectedApprovalRevision: number) {
  const db = await app.db.getConnection();
  try {
    await db.beginTransaction();
    const card = await lockedCard(app, db, clientAccountId, cardId);
    checkRevision(app, card, expectedApprovalRevision);
    const blocked = resendBlockedReason(card);
    if (blocked) throw app.httpErrors.conflict(blocked);
    if (!inferredApprovalState(card) || inferredApprovalState(card) === "pending") {
      throw app.httpErrors.conflict("Este post ainda não tem uma decisão para reabrir ou já está aguardando aprovação.");
    }
    await preserveLegacyState(db, card);
    await updateCard(db, cardId, { status: approvalStatuses(card.status, "pending"), clientLabel: "Pendente" });
    await db.query("UPDATE kanban_cards SET approval_state = 'pending', approval_revision = approval_revision + 1 WHERE id = ?", [cardId]);
    await moveWithinTransaction(db, card, await destination(db, card, false));
    // Closing a token never removes its previous decision or timestamps.
    await db.query("UPDATE approval_links SET is_active = 0 WHERE card_id = ? AND is_active = 1", [cardId]);
    const link = await createApprovalLink(db, { clientAccountId, cardId, createdByUserId: actor.userId!, expiresAt: new Date(Date.now() + 7 * 86400_000) });
    if (!link) throw new Error("Não foi possível criar o novo link de aprovação.");
    const updated = (await findCardById(db, cardId))!;
    await recordApprovalEvent(db, {
      cardId, revision: updated.approvalRevision, action: "resubmitted", decision: "pending", source: "admin", actor,
      approvalLinkId: link.id, before: card, after: updated,
    });
    await db.commit();
    return { card: updated, approvalLink: link };
  } catch (error) { await db.rollback(); throw error; }
  finally { db.release(); }
}

export async function decideCardApproval(app: FastifyInstance, clientAccountId: string, cardId: string, actor: Actor,
  input: { approved: boolean; commentText?: string; expectedApprovalRevision?: number }, token?: string,
) {
  const db = await app.db.getConnection();
  try {
    await db.beginTransaction();
    const card = await lockedCard(app, db, clientAccountId, cardId);
    const link = token ? await findApprovalLinkByToken(db, token) : null;
    if (token) {
      if (!link || link.cardId !== cardId || !link.isActive || new Date(link.expiresAt).getTime() <= Date.now()) {
        throw app.httpErrors.forbidden("Esse link de aprovação expirou ou foi encerrado. Solicite o link mais recente.");
      }
    } else checkRevision(app, card, input.expectedApprovalRevision);
    await preserveLegacyState(db, card);
    const comment = input.commentText?.trim() ? await createComment(db, {
      cardId, userId: actor.userId, authorName: actor.name, authorRole: actor.role,
      commentText: input.commentText.trim(), isInternal: false,
    }) : null;
    const state = input.approved ? "approved" : "changes_requested";
    await updateCard(db, cardId, {
      clientLabel: input.approved ? "Aprovado pelo cliente" : "Alteração solicitada",
      status: approvalStatuses(card.status, state),
    });
    await db.query("UPDATE kanban_cards SET approval_state = ?, approval_revision = approval_revision + 1 WHERE id = ?", [state, cardId]);
    // Approval keeps the existing separate destination for pautas.
    if (input.approved) await moveWithinTransaction(db, card, await destination(db, card, true));
    if (token) await submitApprovalDecision(db, token, { approved: input.approved });
    await db.query("UPDATE approval_links SET is_active = 0 WHERE card_id = ? AND is_active = 1", [cardId]);
    const updated = (await findCardById(db, cardId))!;
    await recordApprovalEvent(db, {
      cardId, revision: updated.approvalRevision, action: state, decision: state,
      source: token ? "public_link" : "portal", actor, commentId: comment?.id, commentText: input.commentText?.trim(),
      approvalLinkId: link?.id, before: card, after: updated,
    });
    if (!token && actor.role === "cliente") {
      await recordCardActivityEvent(db, {
        clientAccountId, cardId, actorUserId: actor.userId, actorName: actor.name, actorRole: actor.role,
        activityType: input.approved ? "client_approved" : "client_changes_requested",
        detail: input.approved ? "Aprovou o conteúdo" : "Solicitou alterações",
      });
    }
    const decidedLink = token ? await findApprovalLinkByToken(db, token) : null;
    await db.commit();
    return { card: updated, approvalLink: decidedLink, approved: input.approved };
  } catch (error) { await db.rollback(); throw error; }
  finally { db.release(); }
}

// Preserve the existing pauta-to-post trigger, including sending an approved
// pauta via the visibility status, while auditing the new independent cycle.
export function isBriefApprovalConversion(card: Card, input: UpdateCardInput) {
  const hasApproval = inferredApprovalState(card) === "approved";
  return card.isBriefApproval && (input.isBriefApproval === false ||
    (hasApproval && (input.status ?? []).some((status) => normalized(status).toLowerCase() === "enviar para cliente")));
}

export async function convertBriefApprovalToPost(app: FastifyInstance, clientAccountId: string, cardId: string,
  actor: { id: string; fullName: string; globalRole: string }, input: UpdateCardInput,
) {
  const db = await app.db.getConnection();
  try {
    await db.beginTransaction();
    const card = await lockedCard(app, db, clientAccountId, cardId);
    checkRevision(app, card, input.expectedApprovalRevision);
    if (!isBriefApprovalConversion(card, input)) throw app.httpErrors.conflict("A pauta já foi convertida. Atualize o card.");
    await preserveLegacyState(db, card);
    // Keep intentional visibility and internal production badges.
    const status = approvalStatuses(input.status ?? card.status, "pending");
    const visible = (input.status ?? card.status).includes("Enviar para Cliente");
    await updateCard(db, cardId, { ...input, isBriefApproval: false, clientLabel: "Pendente",
      status: visible ? status : status.filter((item) => item !== "Enviar para Cliente") });
    await db.query("UPDATE kanban_cards SET approval_reset_at = CURRENT_TIMESTAMP, approval_state = 'pending', approval_revision = approval_revision + 1 WHERE id = ?", [cardId]);
    await db.query("UPDATE approval_links SET is_active = 0 WHERE card_id = ? AND is_active = 1", [cardId]);
    const updated = (await findCardById(db, cardId))!;
    await recordApprovalEvent(db, { cardId, revision: updated.approvalRevision, action: "converted_to_post",
      decision: "pending", source: "admin", actor: { userId: actor.id, name: actor.fullName, role: actor.globalRole },
      before: card, after: updated });
    await db.commit();
    return updated;
  } catch (error) { await db.rollback(); throw error; }
  finally { db.release(); }
}
