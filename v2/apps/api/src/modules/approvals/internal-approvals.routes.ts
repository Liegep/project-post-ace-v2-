import crypto from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import type { RowDataPacket } from "mysql2/promise";
import { z } from "zod";
import { assertClientAccess, assertInternalAccess } from "../auth/auth.access.js";
import { createComment } from "../comments/comments.repository.js";
import { listInternalReviewers } from "./internal-reviewers.repository.js";

const sendSchema = z.object({ recipientIds: z.array(z.uuid()).min(1).max(50), message: z.string().trim().min(1).max(10000) });

export const internalApprovalRoutes: FastifyPluginAsync = async (app) => {
  app.get("/clients/:clientAccountId/internal-approval-reviewers", async (request) => {
    assertInternalAccess(request);
    const { clientAccountId } = request.params as { clientAccountId: string };
    assertClientAccess(request, clientAccountId, ["admin", "colaborador"]);
    return { items: await listInternalReviewers(app.db, clientAccountId, request.auth!.user.id) };
  });

  app.post("/clients/:clientAccountId/cards/:cardId/internal-approvals", async (request) => {
    assertInternalAccess(request);
    const { clientAccountId, cardId } = request.params as { clientAccountId: string; cardId: string };
    assertClientAccess(request, clientAccountId, ["admin", "colaborador"]);
    const parsed = sendSchema.safeParse(request.body);
    if (!parsed.success) throw app.httpErrors.badRequest("Selecione revisores e escreva uma mensagem válida.");
    const { message } = parsed.data;
    const recipientIds = [...new Set(parsed.data.recipientIds)];
    const actor = request.auth!.user;
    const db = await app.db.getConnection();
    try {
      await db.beginTransaction();
      const [cards] = await db.query<RowDataPacket[]>("SELECT id FROM kanban_cards WHERE id = ? AND client_account_id = ? FOR UPDATE", [cardId, clientAccountId]);
      if (!cards.length) throw app.httpErrors.notFound("Card não encontrado nesta conta.");
      // Recheck at send time: stale or forged selections must not reach history.
      const reviewers = await listInternalReviewers(db, clientAccountId, actor.id);
      const recipients = recipientIds.map((id) => reviewers.find((user) => user.id === id));
      if (recipients.some((user) => !user)) throw app.httpErrors.badRequest("Um revisor não está mais disponível. Reabra a lista.");
      const comment = await createComment(db, { cardId, userId: actor.id, authorName: actor.fullName, authorRole: actor.globalRole,
        commentText: `Aprovação interna enviada para ${recipients.map((user) => user!.fullName).join(", ")}.\n\n${message}`, isInternal: true });
      if (!comment) throw new Error("Não foi possível registrar o histórico da aprovação interna.");
      for (const recipientId of recipientIds) {
        await db.query("INSERT INTO internal_approval_requests (id, client_account_id, card_id, requested_by_user_id, assigned_to_user_id, comment_id, message) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [crypto.randomUUID(), clientAccountId, cardId, actor.id, recipientId, comment.id, message]);
      }
      await db.commit();
      return { ok: true, recipientIds, commentId: comment.id };
    } catch (error) { await db.rollback(); throw error; }
    finally { db.release(); }
  });

  app.get("/internal-approvals/inbox", async (request) => {
    assertInternalAccess(request);
    const actor = request.auth!.user;
    const [rows] = await app.db.query<RowDataPacket[]>([
      "SELECT ia.id, ia.card_id AS cardId, ca.slug AS clientSlug, c.title AS cardTitle,",
      "ia.assigned_to_user_id AS recipientId, ia.requested_by_user_id AS requestedByUserId, ia.comment_id AS commentId, ia.message, ia.created_at AS createdAt",
      "FROM internal_approval_requests ia JOIN kanban_cards c ON c.id = ia.card_id",
      "JOIN client_accounts ca ON ca.id = ia.client_account_id",
      "WHERE ia.assigned_to_user_id = ?",
      "AND (? = 'super_admin' OR EXISTS (SELECT 1 FROM client_memberships cm",
      "WHERE cm.user_id = ? AND cm.client_account_id = ia.client_account_id AND cm.membership_role IN ('admin', 'colaborador')))",
      "ORDER BY ia.created_at DESC, ia.id DESC LIMIT 100",
    ].join(" "), [actor.id, actor.globalRole, actor.id]);
    return { items: rows.map(({ recipientId, ...row }) => ({ ...row, recipients: [recipientId] })) };
  });
};
