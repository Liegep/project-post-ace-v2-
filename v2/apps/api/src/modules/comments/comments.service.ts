import type { FastifyInstance } from "fastify";
import { findCardById } from "../cards/cards.repository.js";
import { createComment, listCommentsByCardId } from "./comments.repository.js";
import type { CreateCommentInput } from "./comments.schemas.js";

export async function getCardComments(
  app: FastifyInstance,
  clientAccountId: string,
  cardId: string,
  options: { includeInternal: boolean },
) {
  const card = await findCardById(app.db, cardId);
  if (!card || card.clientAccountId !== clientAccountId) {
    throw app.httpErrors.notFound("Card nao encontrado nesta conta.");
  }

  return {
    card,
    comments: await listCommentsByCardId(app.db, cardId, options),
  };
}

export async function addCardComment(
  app: FastifyInstance,
  clientAccountId: string,
  cardId: string,
  input: CreateCommentInput,
  actor: {
    userId: string | null;
    authorName: string;
    authorRole: "super_admin" | "admin" | "colaborador" | "cliente" | "guest";
    canCreateInternal: boolean;
  },
) {
  const card = await findCardById(app.db, cardId);
  if (!card || card.clientAccountId !== clientAccountId) {
    throw app.httpErrors.notFound("Card nao encontrado nesta conta.");
  }

  if (input.isInternal && !actor.canCreateInternal) {
    throw app.httpErrors.forbidden(
      "Esse perfil nao pode criar comentario interno.",
    );
  }

  const created = await createComment(app.db, {
    cardId,
    userId: actor.userId,
    authorName: actor.authorName,
    authorRole: actor.authorRole,
    commentText: input.commentText,
    isInternal: input.isInternal,
  });

  if (!created) {
    throw app.httpErrors.badRequest("Nao foi possivel salvar o comentario.");
  }

  return created;
}
