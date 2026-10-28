import { resubmitCardApproval } from "../approvals/approval-workflow.service.js";
import type { FastifyInstance } from "fastify";
import { findCardById } from "./cards.repository.js";
import { createComment } from "../comments/comments.repository.js";

export function isWithdrawnBrief(card: { briefWithdrawnAt?: unknown }) {
  return Boolean(card.briefWithdrawnAt);
}

// All client mutations and delivery transitions lock the same row, then re-read.
// A normal card PATCH never writes brief_withdrawn_at.
export async function withLockedCard<T>(app: FastifyInstance, clientId: string, cardId: string,
  visibleOnly: boolean, run: (scoped: FastifyInstance) => Promise<T>): Promise<T> {
  const db = await app.db.getConnection();
  try {
    await db.beginTransaction();
    await db.query("SELECT id FROM kanban_cards WHERE id = ? AND client_account_id = ? FOR UPDATE", [cardId, clientId]);
    const scoped = Object.create(app) as FastifyInstance;
    Object.defineProperty(scoped, "db", { value: db });
    const card = await findCardById(scoped.db, cardId);
    if (!card || card.clientAccountId !== clientId || (visibleOnly && isWithdrawnBrief(card))) {
      throw app.httpErrors.notFound("Pauta indisponível para o cliente.");
    }
    const result = await run(scoped);
    await db.commit();
    return result;
  } catch (error) { await db.rollback(); throw error; }
  finally { db.release(); }
}

export async function changeBriefDelivery(app: FastifyInstance, clientId: string, cardId: string,
  action: "withdraw" | "resend", actor: { id: string; fullName: string; globalRole: "super_admin" | "admin" | "colaborador" | "cliente" }, expectedApprovalRevision: number) {
  if (action === "resend") {
    const current = await findCardById(app.db, cardId);
    if (!current || current.clientAccountId !== clientId || !current.briefWithdrawnAt) throw app.httpErrors.conflict("Esta pauta não está retirada do cliente.");
    return resubmitCardApproval(app, clientId, cardId, { userId: actor.id, name: actor.fullName, role: actor.globalRole }, expectedApprovalRevision);
  }
  return withLockedCard(app, clientId, cardId, false, async (scoped) => {
    const card = (await findCardById(scoped.db, cardId))!;
    if (!card.isBriefApproval || card.scheduledAt || card.publishedAt) {
      throw app.httpErrors.badRequest("Esta ação está disponível apenas para pautas de aprovação.");
    }
    if (card.approvalRevision !== expectedApprovalRevision) throw app.httpErrors.conflict("A aprovação mudou. Atualize a pauta antes de continuar.");
    const withdrawn = isWithdrawnBrief(card);
    if (withdrawn) return { card };
    await scoped.db.query("UPDATE approval_links SET is_active = 0 WHERE card_id = ?", [cardId]);
    await scoped.db.query("UPDATE kanban_cards SET brief_withdrawn_at = CURRENT_TIMESTAMP(3), approval_revision = approval_revision + 1 WHERE id = ?", [cardId]);
    await createComment(scoped.db, { cardId, userId: actor.id, authorName: actor.fullName,
      authorRole: actor.globalRole, commentText: `Retirada do cliente. Situação anterior: ${card.clientLabel}. Status: ${card.status.join(", ")}.`, isInternal: true });
    return { card: await findCardById(scoped.db, cardId) };
  });
}
