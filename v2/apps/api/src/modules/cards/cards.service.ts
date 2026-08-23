import type { FastifyInstance } from "fastify";
import type { RowDataPacket } from "mysql2/promise";
import { ensureClientStarterColumns, findClientAccountById } from "../clients/clients.repository.js";
import { findColumnById, listColumnsByClientAccountId } from "../columns/columns.repository.js";
import { listClientTags } from "../tags/tags.repository.js";
import {
  createCard,
  archiveDueScheduledCards,
  deleteCard,
  findCardById,
  listCardsByClientAccountId,
  moveCard,
  setCardArchived,
  updateCard,
  upsertCalendarEventFromCard,
} from "./cards.repository.js";
import type {
  BoardQueryInput,
  CreateCardInput,
  ListCardsQueryInput,
  MoveCardInput,
  UpdateCardInput,
} from "./cards.schemas.js";

function currentWallClock(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${value("year")}-${value("month")}-${value("day")} ${value("hour")}:${value("minute")}:${value("second")}`;
}

export async function archiveCardsDueForPublication(app: FastifyInstance) {
  const clockByTimeZone = new Map<string, string>();
  const isDue = (scheduledAt: string, storedTimeZone: string | null) => {
    const timeZone = storedTimeZone || app.appEnv.APP_TIMEZONE;
    const dueAt = clockByTimeZone.get(timeZone) ?? currentWallClock(timeZone);
    clockByTimeZone.set(timeZone, dueAt);
    return scheduledAt <= dueAt;
  };
  return archiveDueScheduledCards(app.db, isDue);
}

type KanbanAutomation = {
  id: string;
  name: string;
  enabled: boolean;
  triggerType: "tag_added" | "column_moved";
  triggerValue: string;
  actionType: "add_tag" | "move_column" | "change_color";
  actionValue: string;
};

type KanbanCard = NonNullable<Awaited<ReturnType<typeof findCardById>>>;

function parseAutomations(value: unknown): KanbanAutomation[] {
  if (!value) return [];
  try {
    const items = Array.isArray(value) ? value : JSON.parse(String(value));
    if (!Array.isArray(items)) return [];
    return items.filter((item): item is KanbanAutomation => (
      typeof item === "object" && item !== null &&
      typeof item.id === "string" && typeof item.triggerType === "string" &&
      typeof item.triggerValue === "string" && typeof item.actionType === "string" &&
      typeof item.actionValue === "string" && item.enabled === true
    ));
  } catch {
    return [];
  }
}

async function listActiveAutomations(app: FastifyInstance, clientAccountId: string) {
  const [rows] = await app.db.query<Array<RowDataPacket & { kanban_automations_json: unknown }>>(
    "SELECT kanban_automations_json FROM client_accounts WHERE id = ? LIMIT 1",
    [clientAccountId],
  );
  return parseAutomations(rows[0]?.kanban_automations_json);
}

async function runAutomationActions(
  app: FastifyInstance,
  clientAccountId: string,
  card: KanbanCard,
  rules: KanbanAutomation[],
) {
  let current = card;

  for (const rule of rules) {
    if (rule.actionType === "add_tag") {
      if (!current.tags.includes(rule.actionValue)) {
        const updated = await updateCard(app.db, current.id, { tags: [...current.tags, rule.actionValue] });
        if (updated) current = updated;
      }
      continue;
    }

    if (rule.actionType === "change_color") {
      const updated = await updateCard(app.db, current.id, { eventColor: rule.actionValue });
      if (updated) current = updated;
      continue;
    }

    if (rule.actionType === "move_column" && current.columnId !== rule.actionValue) {
      await assertColumnBelongsToClient(app, clientAccountId, rule.actionValue);
      const moved = await moveCard(app.db, current.id, current, { columnId: rule.actionValue });
      if (moved) current = moved;
    }
  }

  return current;
}

function parseArchivedValue(value: ListCardsQueryInput["archived"]) {
  if (!value) return undefined;
  return value === "1" || value === "true";
}

function groupCardsByColumn(
  columns: Awaited<ReturnType<typeof listColumnsByClientAccountId>>,
  cards: Awaited<ReturnType<typeof listCardsByClientAccountId>>,
) {
  const cardsByColumnId = new Map<string, typeof cards>();
  const withoutColumn: typeof cards = [];

  for (const card of cards) {
    if (!card.columnId) {
      withoutColumn.push(card);
      continue;
    }

    const current = cardsByColumnId.get(card.columnId) ?? [];
    current.push(card);
    cardsByColumnId.set(card.columnId, current);
  }

  return {
    columns: columns.map((column) => ({
      ...column,
      cards: cardsByColumnId.get(column.id) ?? [],
      cardsCount: (cardsByColumnId.get(column.id) ?? []).length,
    })),
    withoutColumn: {
      id: "without-column",
      name: "Sem coluna",
      cards: withoutColumn,
      cardsCount: withoutColumn.length,
    },
  };
}

function buildBoardMeta(cards: Awaited<ReturnType<typeof listCardsByClientAccountId>>) {
  const scheduledCards = cards.filter((card) => Boolean(card.scheduledAt));
  const overdueCards = cards.filter((card) => {
    if (!card.deadlineAt) return false;
    return new Date(card.deadlineAt).getTime() < Date.now();
  });

  return {
    totalCards: cards.length,
    scheduledCards: scheduledCards.length,
    overdueCards: overdueCards.length,
    archivedCards: cards.filter((card) => card.archived).length,
  };
}

async function assertColumnBelongsToClient(
  app: FastifyInstance,
  clientAccountId: string,
  columnId: string | null | undefined,
) {
  if (!columnId) return;

  const column = await findColumnById(app.db, columnId);
  if (!column || column.clientAccountId !== clientAccountId) {
    throw app.httpErrors.badRequest("A coluna informada nao pertence a esta conta.");
  }
}

export async function listKanbanCards(
  app: FastifyInstance,
  clientAccountId: string,
  query: ListCardsQueryInput,
) {
  const client = await findClientAccountById(app.db, clientAccountId);
  if (!client) {
    throw app.httpErrors.notFound("Conta do cliente nao encontrada.");
  }

  if (query.columnId) {
    await assertColumnBelongsToClient(app, clientAccountId, query.columnId);
  }

  return {
    client,
    cards: await listCardsByClientAccountId(app.db, clientAccountId, {
      archived: parseArchivedValue(query.archived) ?? false,
      columnId: query.columnId,
      search: query.search,
    }),
  };
}

export async function getKanbanBoard(
  app: FastifyInstance,
  clientAccountId: string,
  query: BoardQueryInput,
) {
  const client = await findClientAccountById(app.db, clientAccountId);
  if (!client) {
    throw app.httpErrors.notFound("Conta do cliente nao encontrada.");
  }

  const archived = parseArchivedValue(query.archived) ?? false;
  let [columns, cards, tags] = await Promise.all([
    listColumnsByClientAccountId(app.db, clientAccountId),
    listCardsByClientAccountId(app.db, clientAccountId, {
      archived,
      search: query.search,
    }),
    listClientTags(app.db, clientAccountId),
  ]);

  if (columns.length === 0) {
    await ensureClientStarterColumns(app.db, clientAccountId);
    columns = await listColumnsByClientAccountId(app.db, clientAccountId);
  }

  const grouped = groupCardsByColumn(columns, cards);

  return {
    client,
    filters: {
      archived: archived ?? false,
      search: query.search ?? "",
    },
    meta: buildBoardMeta(cards),
    tags,
    board: grouped,
  };
}

export async function createKanbanCard(
  app: FastifyInstance,
  clientAccountId: string,
  createdByUserId: string,
  input: CreateCardInput,
) {
  const client = await findClientAccountById(app.db, clientAccountId);
  if (!client) {
    throw app.httpErrors.notFound("Conta do cliente nao encontrada.");
  }

  await assertColumnBelongsToClient(app, clientAccountId, input.columnId);

  const created = await createCard(app.db, clientAccountId, createdByUserId, input);
  if (!created) {
    throw app.httpErrors.badRequest("Nao foi possivel criar o card.");
  }

  await upsertCalendarEventFromCard(app.db, created);
  return findCardById(app.db, created.id);
}

export async function updateKanbanCard(
  app: FastifyInstance,
  clientAccountId: string,
  cardId: string,
  input: UpdateCardInput,
) {
  const card = await findCardById(app.db, cardId);
  if (!card || card.clientAccountId !== clientAccountId) {
    throw app.httpErrors.notFound("Card nao encontrado nesta conta.");
  }

  const updated = await updateCard(app.db, cardId, input);
  if (!updated) {
    throw app.httpErrors.badRequest("Nao foi possivel atualizar o card.");
  }

  const automations = input.tags
    ? (await listActiveAutomations(app, clientAccountId)).filter((rule) => (
      rule.triggerType === "tag_added" &&
      !card.tags.includes(rule.triggerValue) &&
      updated.tags.includes(rule.triggerValue)
    ))
    : [];
  const result = await runAutomationActions(app, clientAccountId, updated, automations);
  await upsertCalendarEventFromCard(app.db, result);
  return result;
}

export async function moveKanbanCard(
  app: FastifyInstance,
  clientAccountId: string,
  cardId: string,
  input: MoveCardInput,
) {
  const card = await findCardById(app.db, cardId);
  if (!card || card.clientAccountId !== clientAccountId) {
    throw app.httpErrors.notFound("Card nao encontrado nesta conta.");
  }

  await assertColumnBelongsToClient(app, clientAccountId, input.columnId);

  const moved = await moveCard(app.db, cardId, card, input);
  if (!moved) {
    throw app.httpErrors.badRequest("Nao foi possivel mover o card.");
  }

  const automations = card.columnId !== input.columnId
    ? (await listActiveAutomations(app, clientAccountId)).filter((rule) => (
      rule.triggerType === "column_moved" && rule.triggerValue === input.columnId
    ))
    : [];
  const result = await runAutomationActions(app, clientAccountId, moved, automations);
  await upsertCalendarEventFromCard(app.db, result);
  return result;
}

export async function archiveKanbanCard(
  app: FastifyInstance,
  clientAccountId: string,
  cardId: string,
  archived: boolean,
) {
  const card = await findCardById(app.db, cardId);
  if (!card || card.clientAccountId !== clientAccountId) {
    throw app.httpErrors.notFound("Card nao encontrado nesta conta.");
  }

  const updated = await setCardArchived(app.db, cardId, archived);
  if (!updated) {
    throw app.httpErrors.badRequest("Nao foi possivel atualizar o arquivo do card.");
  }

  await upsertCalendarEventFromCard(app.db, updated);
  return updated;
}

export async function deleteKanbanCard(app: FastifyInstance, clientAccountId: string, cardId: string) {
  const card = await findCardById(app.db, cardId);
  if (!card || card.clientAccountId !== clientAccountId) {
    throw app.httpErrors.notFound("Card nao encontrado nesta conta.");
  }

  if (!(await deleteCard(app.db, cardId))) {
    throw app.httpErrors.badRequest("Nao foi possivel excluir o card.");
  }
}
