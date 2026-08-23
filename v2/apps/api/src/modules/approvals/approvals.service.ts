import type { FastifyInstance } from "fastify";
import { addCardComment } from "../comments/comments.service.js";
import { findClientAccountById } from "../clients/clients.repository.js";
import { createColumn, findColumnByClientAndName } from "../columns/columns.repository.js";
import { findCardById, moveCard, updateCard } from "../cards/cards.repository.js";
import {
  createApprovalLink,
  findApprovalLinkByToken,
  listApprovalLinksByCardId,
  markApprovalLinkViewed,
  submitApprovalDecision,
} from "./approvals.repository.js";
import type {
  CreateApprovalLinkInput,
  SubmitApprovalDecisionInput,
} from "./approvals.schemas.js";

function isExpired(dateValue: Date | string) {
  return new Date(dateValue).getTime() < Date.now();
}

async function ensureApprovedColumn(app: FastifyInstance, clientAccountId: string) {
  const existing = await findColumnByClientAndName(
    app.db,
    clientAccountId,
    "Aprovados pelo cliente",
  );
  if (existing) return existing;

  return createColumn(app.db, clientAccountId, {
    name: "Aprovados pelo cliente",
    color: "#9adf2f",
    visibleToClient: false,
    autoCreated: true,
  });
}

async function ensureEntradaColumn(app: FastifyInstance, clientAccountId: string) {
  const existing = await findColumnByClientAndName(app.db, clientAccountId, "Entrada");
  if (existing) return existing;
  return createColumn(app.db, clientAccountId, { name: "Entrada", color: "#5b7cfa", visibleToClient: false, autoCreated: true });
}

export async function createCardApprovalLink(
  app: FastifyInstance,
  clientAccountId: string,
  cardId: string,
  createdByUserId: string,
  input: CreateApprovalLinkInput,
) {
  const client = await findClientAccountById(app.db, clientAccountId);
  if (!client) {
    throw app.httpErrors.notFound("Conta do cliente nao encontrada.");
  }

  const card = await findCardById(app.db, cardId);
  if (!card || card.clientAccountId !== clientAccountId) {
    throw app.httpErrors.notFound("Card nao encontrado nesta conta.");
  }

  const days = input.expiresInDays ?? 7;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  const created = await createApprovalLink(app.db, {
    clientAccountId,
    cardId,
    expiresAt,
    createdByUserId,
  });

  if (!created) {
    throw app.httpErrors.badRequest("Nao foi possivel criar o link de aprovacao.");
  }

  return created;
}

export async function getCardApprovalHistory(
  app: FastifyInstance,
  clientAccountId: string,
  cardId: string,
) {
  const card = await findCardById(app.db, cardId);
  if (!card || card.clientAccountId !== clientAccountId) {
    throw app.httpErrors.notFound("Card nao encontrado nesta conta.");
  }

  return {
    card,
    links: await listApprovalLinksByCardId(app.db, cardId),
  };
}

export async function getPublicApprovalView(
  app: FastifyInstance,
  token: string,
) {
  const link = await findApprovalLinkByToken(app.db, token);
  if (!link) {
    throw app.httpErrors.notFound("Link de aprovacao nao encontrado.");
  }
  if (!link.isActive || isExpired(link.expiresAt)) {
    throw app.httpErrors.forbidden("Esse link de aprovacao expirou ou foi encerrado.");
  }

  await markApprovalLinkViewed(app.db, token);

  const card = await findCardById(app.db, link.cardId);
  if (!card) {
    throw app.httpErrors.notFound("Card nao encontrado.");
  }

  const client = await findClientAccountById(app.db, link.clientAccountId);
  if (!client) {
    throw app.httpErrors.notFound("Conta do cliente nao encontrada.");
  }

  const refreshedLink = await findApprovalLinkByToken(app.db, token);

  return {
    account: {
      id: client.id,
      name: client.name,
      slug: client.slug,
      locale: client.locale,
      portalTitle: client.portal_title,
    },
    card,
    approvalLink: refreshedLink,
  };
}

export async function submitPublicApprovalDecision(
  app: FastifyInstance,
  token: string,
  input: SubmitApprovalDecisionInput,
) {
  const link = await findApprovalLinkByToken(app.db, token);
  if (!link) {
    throw app.httpErrors.notFound("Link de aprovacao nao encontrado.");
  }
  if (!link.isActive || isExpired(link.expiresAt)) {
    throw app.httpErrors.forbidden("Esse link de aprovacao expirou ou foi encerrado.");
  }

  const card = await findCardById(app.db, link.cardId);
  if (!card) {
    throw app.httpErrors.notFound("Card nao encontrado.");
  }

  if (input.commentText) {
    await addCardComment(app, link.clientAccountId, link.cardId, {
      commentText: input.commentText,
      isInternal: false,
    }, {
      userId: null,
      authorName: input.requesterName ?? "Cliente",
      authorRole: "guest",
      canCreateInternal: false,
    });
  }

  const decision = await submitApprovalDecision(app.db, token, {
    approved: input.approved,
  });

  if (input.approved) {
    const approvedColumn = card.isBriefApproval
      ? await ensureEntradaColumn(app, link.clientAccountId)
      : await ensureApprovedColumn(app, link.clientAccountId);
    await moveCard(app.db, link.cardId, card, {
      columnId: approvedColumn?.id ?? null,
    });
    if (card.isBriefApproval) await updateCard(app.db, link.cardId, { isBriefApproval: false, clientLabel: "Aprovado" });
  }

  return {
    approvalLink: decision,
    approved: input.approved,
  };
}
