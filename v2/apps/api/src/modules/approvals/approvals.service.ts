import type { FastifyInstance } from "fastify";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { decideCardApproval } from "./approval-workflow.service.js";
import { findClientAccountById } from "../clients/clients.repository.js";
import { createColumn, findColumnByClientAndName, listColumnsByClientAccountId, updateColumn } from "../columns/columns.repository.js";
import { findCardById } from "../cards/cards.repository.js";
import {
  createApprovalLink,
  findApprovalLinkByToken,
  listApprovalLinksByCardId,
  markApprovalLinkViewed,
} from "./approvals.repository.js";
import type {
  CreateApprovalLinkInput,
  SubmitApprovalDecisionInput,
} from "./approvals.schemas.js";

function isExpired(dateValue: Date | string) {
  return new Date(dateValue).getTime() < Date.now();
}

async function ensureApprovedColumn(app: FastifyInstance, clientAccountId: string) {
  const columns = await listColumnsByClientAccountId(app.db, clientAccountId);
  let existing = columns.find((column) => /aprovados(?: pelo cliente)?/i.test(column.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
  if (existing) {
    if (!existing.visibleToClient) existing = await updateColumn(app.db, existing.id, { visibleToClient: true }) ?? existing;
    return existing;
  }

  return createColumn(app.db, clientAccountId, {
    name: "Aprovados",
    color: "#28b77d",
    visibleToClient: true,
    autoCreated: true,
  });
}

async function ensureApprovedBriefsColumn(app: FastifyInstance, clientAccountId: string) {
  const existing = await findColumnByClientAndName(app.db, clientAccountId, "Pauta aprovada");
  if (existing) return existing;
  const previousPlural = await findColumnByClientAndName(app.db, clientAccountId, "Pautas aprovadas");
  if (previousPlural) return updateColumn(app.db, previousPlural.id, { name: "Pauta aprovada" });
  return createColumn(app.db, clientAccountId, { name: "Pauta aprovada", color: "#8b5cf6", visibleToClient: false, autoCreated: true });
}

export async function reconcileApprovedCardColumns(app: FastifyInstance) {
  // Earlier versions cleared this flag after approval. Recover it from the
  // pauta bank so existing approved pautas can also be organized correctly.
  await app.db.query(
    [
      "UPDATE kanban_cards c INNER JOIN client_accounts ca ON ca.id = c.client_account_id",
      "SET c.is_brief_approval = 1",
      "WHERE c.archived = 0 AND c.scheduled_at IS NULL AND c.published_at IS NULL AND c.is_brief_approval = 0 AND c.approval_revision = 0 AND c.approval_reset_at IS NULL",
      "AND LOWER(c.client_label) LIKE '%aprovad%'",
      "AND CAST(ca.workspace_drawer_json AS CHAR) LIKE CONCAT('%', c.id, '%')",
    ].join(" "),
  );

  const [rows] = await app.db.query<Array<RowDataPacket & { clientAccountId: string }>>(
    [
      "SELECT DISTINCT c.client_account_id AS clientAccountId",
      "FROM kanban_cards c",
      "WHERE c.archived = 0 AND c.scheduled_at IS NULL AND c.published_at IS NULL AND c.is_brief_approval = 0 AND (c.approval_state = 'approved' OR (c.approval_revision = 0 AND LOWER(c.client_label) LIKE '%aprovad%') OR EXISTS (",
      "SELECT 1 FROM approval_links al WHERE al.card_id = c.id AND al.approved_at IS NOT NULL AND c.approval_revision = 0 AND LOWER(c.client_label) NOT LIKE '%altera%' AND LOWER(COALESCE(c.status_json, '')) NOT LIKE '%solicitad%'",
      "AND (c.approval_reset_at IS NULL OR al.created_at >= c.approval_reset_at)",
      "))",
    ].join(" "),
  );

  let moved = 0;
  for (const row of rows) {
    const approvedColumn = await ensureApprovedColumn(app, row.clientAccountId);
    if (!approvedColumn) continue;
    const [result] = await app.db.query<ResultSetHeader>(
      [
        "UPDATE kanban_cards c SET c.column_id = ?, c.client_label = 'Aprovado pelo cliente'",
        "WHERE c.client_account_id = ? AND c.archived = 0 AND c.scheduled_at IS NULL AND c.published_at IS NULL AND (c.approval_state = 'approved' OR (c.approval_revision = 0 AND LOWER(c.client_label) LIKE '%aprovad%') OR EXISTS (",
        "SELECT 1 FROM approval_links al WHERE al.card_id = c.id AND al.approved_at IS NOT NULL AND c.approval_revision = 0 AND LOWER(c.client_label) NOT LIKE '%altera%' AND LOWER(COALESCE(c.status_json, '')) NOT LIKE '%solicitad%'",
        "AND (c.approval_reset_at IS NULL OR al.created_at >= c.approval_reset_at)",
        ")) AND c.is_brief_approval = 0 AND (c.column_id IS NULL OR c.column_id <> ?)",
      ].join(" "),
      [approvedColumn.id, row.clientAccountId, approvedColumn.id],
    );
    moved += Number(result.affectedRows ?? 0);
  }

  const [briefRows] = await app.db.query<Array<RowDataPacket & { clientAccountId: string }>>(
    [
      "SELECT DISTINCT c.client_account_id AS clientAccountId FROM kanban_cards c",
      "WHERE c.archived = 0 AND c.scheduled_at IS NULL AND c.published_at IS NULL AND c.is_brief_approval = 1",
      "AND (c.approval_state = 'approved' OR (c.approval_revision = 0 AND LOWER(c.client_label) LIKE '%aprovad%') OR EXISTS (",
      "SELECT 1 FROM approval_links al WHERE al.card_id = c.id AND al.approved_at IS NOT NULL AND c.approval_revision = 0 AND LOWER(c.client_label) NOT LIKE '%altera%' AND LOWER(COALESCE(c.status_json, '')) NOT LIKE '%solicitad%'",
      "AND (c.approval_reset_at IS NULL OR al.created_at >= c.approval_reset_at)",
      "))",
    ].join(" "),
  );
  for (const row of briefRows) {
    const approvedBriefsColumn = await ensureApprovedBriefsColumn(app, row.clientAccountId);
    if (!approvedBriefsColumn) continue;
    const [result] = await app.db.query<ResultSetHeader>(
      [
        "UPDATE kanban_cards c SET c.column_id = ?, c.client_label = 'Aprovado pelo cliente'",
        "WHERE c.client_account_id = ? AND c.archived = 0 AND c.scheduled_at IS NULL AND c.published_at IS NULL AND c.is_brief_approval = 1",
        "AND (c.approval_state = 'approved' OR (c.approval_revision = 0 AND LOWER(c.client_label) LIKE '%aprovad%') OR EXISTS (",
        "SELECT 1 FROM approval_links al WHERE al.card_id = c.id AND al.approved_at IS NOT NULL AND c.approval_revision = 0 AND LOWER(c.client_label) NOT LIKE '%altera%' AND LOWER(COALESCE(c.status_json, '')) NOT LIKE '%solicitad%'",
        "AND (c.approval_reset_at IS NULL OR al.created_at >= c.approval_reset_at)",
        ")) AND (c.column_id IS NULL OR c.column_id <> ?)",
      ].join(" "),
      [approvedBriefsColumn.id, row.clientAccountId, approvedBriefsColumn.id],
    );
    moved += Number(result.affectedRows ?? 0);
  }
  return moved;
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
    throw app.httpErrors.notFound("Conta do cliente não encontrada.");
  }

  const card = await findCardById(app.db, cardId);
  if (!card || card.clientAccountId !== clientAccountId) {
    throw app.httpErrors.notFound("Card não encontrado nesta conta.");
  }

  const db = await app.db.getConnection();
  try {
    await db.beginTransaction();
    // Serialize link creation with resubmissions and decisions.
    await db.query("SELECT id FROM kanban_cards WHERE id = ? FOR UPDATE", [cardId]);
    const current = await findCardById(db, cardId);
    if (!current || current.approvalRevision !== (input.expectedApprovalRevision ?? 0)) {
      throw app.httpErrors.conflict("A aprovação mudou. Reabra o card antes de criar um link.");
    }
    const created = await createApprovalLink(db, {
      clientAccountId, cardId, createdByUserId,
      expiresAt: new Date(Date.now() + (input.expiresInDays ?? 7) * 86400_000),
    });
    if (!created) throw app.httpErrors.badRequest("Não foi possível criar o link de aprovação.");
    await db.commit();
    return created;
  } catch (error) { await db.rollback(); throw error; }
  finally { db.release(); }
}

export async function getCardApprovalHistory(
  app: FastifyInstance,
  clientAccountId: string,
  cardId: string,
) {
  const card = await findCardById(app.db, cardId);
  if (!card || card.clientAccountId !== clientAccountId) {
    throw app.httpErrors.notFound("Card não encontrado nesta conta.");
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
    throw app.httpErrors.notFound("Link de aprovação não encontrado.");
  }
  if (!link.isActive || isExpired(link.expiresAt)) {
    throw app.httpErrors.forbidden("Esse link de aprovação expirou ou foi encerrado.");
  }

  await markApprovalLinkViewed(app.db, token);

  const card = await findCardById(app.db, link.cardId);
  if (!card) {
    throw app.httpErrors.notFound("Card não encontrado.");
  }

  const client = await findClientAccountById(app.db, link.clientAccountId);
  if (!client) {
    throw app.httpErrors.notFound("Conta do cliente não encontrada.");
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
    throw app.httpErrors.notFound("Link de aprovação não encontrado.");
  }
  if (!link.isActive || isExpired(link.expiresAt)) {
    throw app.httpErrors.forbidden("Esse link de aprovação expirou ou foi encerrado.");
  }

  return decideCardApproval(app, link.clientAccountId, link.cardId, {
    userId: null, name: input.requesterName ?? "Cliente", role: "guest",
  }, input, token);
}
