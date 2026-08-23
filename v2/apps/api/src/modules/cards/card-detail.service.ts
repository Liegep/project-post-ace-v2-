import type { FastifyInstance } from "fastify";
import { listApprovalLinksByCardId } from "../approvals/approvals.repository.js";
import { listCommentsByCardId } from "../comments/comments.repository.js";
import { findCardById } from "./cards.repository.js";

export async function getInternalCardDetail(
  app: FastifyInstance,
  clientAccountId: string,
  cardId: string,
) {
  const card = await findCardById(app.db, cardId);
  if (!card || card.clientAccountId !== clientAccountId) {
    throw app.httpErrors.notFound("Card nao encontrado nesta conta.");
  }

  const [comments, approvalLinks] = await Promise.all([
    listCommentsByCardId(app.db, cardId, { includeInternal: true }),
    listApprovalLinksByCardId(app.db, cardId),
  ]);

  return {
    card,
    comments,
    approvalLinks,
    history: [
      ...comments.map((comment) => ({
        type: "comment" as const,
        createdAt: comment.createdAt,
        payload: comment,
      })),
      ...approvalLinks.map((link) => ({
        type: "approval_link" as const,
        createdAt: link.createdAt,
        payload: link,
      })),
    ].sort((a, b) => {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }),
  };
}

export async function getPortalCardDetail(
  app: FastifyInstance,
  clientAccountId: string,
  cardId: string,
) {
  const card = await findCardById(app.db, cardId);
  if (!card || card.clientAccountId !== clientAccountId) {
    throw app.httpErrors.notFound("Card nao encontrado nesta conta.");
  }

  const comments = await listCommentsByCardId(app.db, cardId, { includeInternal: false });

  return {
    card,
    comments,
  };
}
