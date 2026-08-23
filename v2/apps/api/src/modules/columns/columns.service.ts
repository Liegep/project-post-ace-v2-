import type { FastifyInstance } from "fastify";
import { findClientAccountById } from "../clients/clients.repository.js";
import {
  createColumn,
  deleteColumn,
  findColumnById,
  listColumnsByClientAccountId,
  reorderColumns,
  updateColumn,
} from "./columns.repository.js";
import type {
  CreateColumnInput,
  ReorderColumnsInput,
  UpdateColumnInput,
} from "./columns.schemas.js";

export async function listKanbanColumns(
  app: FastifyInstance,
  clientAccountId: string,
) {
  const client = await findClientAccountById(app.db, clientAccountId);
  if (!client) {
    throw app.httpErrors.notFound("Conta do cliente nao encontrada.");
  }

  return {
    client,
    columns: await listColumnsByClientAccountId(app.db, clientAccountId),
  };
}

export async function createKanbanColumn(
  app: FastifyInstance,
  clientAccountId: string,
  input: CreateColumnInput,
) {
  const client = await findClientAccountById(app.db, clientAccountId);
  if (!client) {
    throw app.httpErrors.notFound("Conta do cliente nao encontrada.");
  }

  const created = await createColumn(app.db, clientAccountId, input);
  if (!created) {
    throw app.httpErrors.badRequest("Nao foi possivel criar a coluna.");
  }

  return created;
}

export async function updateKanbanColumn(
  app: FastifyInstance,
  clientAccountId: string,
  columnId: string,
  input: UpdateColumnInput,
) {
  const column = await findColumnById(app.db, columnId);
  if (!column || column.clientAccountId !== clientAccountId) {
    throw app.httpErrors.notFound("Coluna nao encontrada nesta conta.");
  }

  const updated = await updateColumn(app.db, columnId, input);
  if (!updated) {
    throw app.httpErrors.badRequest("Nao foi possivel atualizar a coluna.");
  }

  return updated;
}

export async function deleteKanbanColumn(
  app: FastifyInstance,
  clientAccountId: string,
  columnId: string,
) {
  const column = await findColumnById(app.db, columnId);
  if (!column || column.clientAccountId !== clientAccountId) {
    throw app.httpErrors.notFound("Coluna nao encontrada nesta conta.");
  }

  await deleteColumn(app.db, columnId);
}

export async function reorderKanbanColumns(
  app: FastifyInstance,
  clientAccountId: string,
  input: ReorderColumnsInput,
) {
  const currentColumns = await listColumnsByClientAccountId(app.db, clientAccountId);
  const currentIds = new Set(currentColumns.map((column) => column.id));

  if (currentColumns.length !== input.orderedColumnIds.length) {
    throw app.httpErrors.badRequest(
      "A reordenacao precisa incluir todas as colunas da conta.",
    );
  }

  for (const columnId of input.orderedColumnIds) {
    if (!currentIds.has(columnId)) {
      throw app.httpErrors.badRequest(
        "A lista enviada tem coluna que nao pertence a esta conta.",
      );
    }
  }

  return reorderColumns(app.db, clientAccountId, input.orderedColumnIds);
}
