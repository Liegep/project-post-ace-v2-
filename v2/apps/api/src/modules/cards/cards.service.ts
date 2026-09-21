import { convertBriefApprovalToPost, isBriefApprovalConversion } from "../approvals/approval-workflow.service.js";
import { approvalStatuses } from "../approvals/approval-state.js";
import type { FastifyInstance } from "fastify";
import type { RowDataPacket } from "mysql2/promise";
import { findClientAccountById } from "../clients/clients.repository.js";
import { createColumn, findColumnById, listColumnsByClientAccountId } from "../columns/columns.repository.js";
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
import { findCaptionVersion, listCaptionVersions, recordCaptionVersion } from "./caption-history.repository.js";
import { instantToWallClock } from "../../lib/zoned-date-time.js";

function normalizeScheduleInput<T extends CreateCardInput | UpdateCardInput>(input: T, fallbackTimeZone: string): T {
  if (typeof input.scheduledAt !== "string" || !input.scheduledAt.trim()) return input;
  const timeZone = input.scheduledTimeZone || fallbackTimeZone;
  const hasExplicitOffset = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(input.scheduledAt);
  const scheduledAt = hasExplicitOffset
    ? instantToWallClock(input.scheduledAt, timeZone)
    : input.scheduledAt.replace("T", " ").slice(0, 19);
  return { ...input, scheduledAt, scheduledTimeZone: timeZone };
}

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
    throw app.httpErrors.badRequest("A coluna informada não pertence a esta conta.");
  }
}

export async function listKanbanCards(
  app: FastifyInstance,
  clientAccountId: string,
  query: ListCardsQueryInput,
) {
  const client = await findClientAccountById(app.db, clientAccountId);
  if (!client) {
    throw app.httpErrors.notFound("Conta do cliente não encontrada.");
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
    throw app.httpErrors.notFound("Conta do cliente não encontrada.");
  }

  const archived = parseArchivedValue(query.archived) ?? false;
  const [columns, cards, tags] = await Promise.all([
    listColumnsByClientAccountId(app.db, clientAccountId),
    listCardsByClientAccountId(app.db, clientAccountId, {
      archived,
      search: query.search,
    }),
    listClientTags(app.db, clientAccountId),
  ]);

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
    throw app.httpErrors.notFound("Conta do cliente não encontrada.");
  }

  await assertColumnBelongsToClient(app, clientAccountId, input.columnId);

  const created = await createCard(app.db, clientAccountId, createdByUserId, normalizeScheduleInput(input, app.appEnv.APP_TIMEZONE));
  if (!created) {
    throw app.httpErrors.badRequest("Não foi possível criar o card.");
  }

  await upsertCalendarEventFromCard(app.db, created);
  return findCardById(app.db, created.id);
}

export async function updateKanbanCard(
  app: FastifyInstance,
  clientAccountId: string,
  cardId: string,
  input: UpdateCardInput,
  actor: { id: string; fullName: string; globalRole: string },
) {
  const card = await findCardById(app.db, cardId);
  if (!card || card.clientAccountId !== clientAccountId) {
    throw app.httpErrors.notFound("Card não encontrado nesta conta.");
  }

  if (input.expectedApprovalRevision !== undefined && input.expectedApprovalRevision !== card.approvalRevision) {
    throw app.httpErrors.conflict("A aprovação deste post mudou. Reabra o card antes de salvar novamente; seu rascunho foi preservado.");
  }
  const convertingBrief = isBriefApprovalConversion(card, input);
  if (card.approvalState && !convertingBrief) {
    if (input.clientLabel !== undefined && input.clientLabel !== card.clientLabel) {
      throw app.httpErrors.conflict("Use Enviar novamente para aprovação para reabrir o retorno do cliente.");
    }
    if (input.status) {
      const statuses = approvalStatuses(input.status, card.approvalState);
      // Only the explicit resend action forces visibility. Preserve the existing
      // admin visibility checkbox when a user intentionally hides a card.
      input = { ...input, status: card.approvalState === "pending" && !input.status.includes("Enviar para Cliente")
        ? statuses.filter((status) => status !== "Enviar para Cliente") : statuses };
    }
  }
  input = { ...input, expectedApprovalRevision: card.approvalRevision };

  if (input.caption !== undefined && (input.caption ?? null) !== (card.caption ?? null)) {
    await recordCaptionVersion(app.db, {
      cardId,
      caption: card.caption,
      authorUserId: actor.id,
      authorName: actor.fullName,
      authorRole: actor.globalRole,
    });
  }

  const normalizedInput = normalizeScheduleInput(input, app.appEnv.APP_TIMEZONE);
  const isBeingScheduled = typeof normalizedInput.scheduledAt === "string" && normalizedInput.scheduledAt.trim().length > 0;
  const updateInput = isBeingScheduled
    ? {
        ...normalizedInput,
        status: ["Agendado", ...(normalizedInput.status ?? card.status).filter((status) => !/^agendados?$/i.test(status.trim()))],
      }
    : normalizedInput;
  const updated = convertingBrief
    ? await convertBriefApprovalToPost(app, clientAccountId, cardId, actor, updateInput)
    : await updateCard(app.db, cardId, updateInput);
  if (!updated) {
    throw app.httpErrors.badRequest("Não foi possível atualizar o card.");
  }

  const automations = input.tags
    ? (await listActiveAutomations(app, clientAccountId)).filter((rule) => (
      rule.triggerType === "tag_added" &&
      !card.tags.includes(rule.triggerValue) &&
      updated.tags.includes(rule.triggerValue)
    ))
    : [];
  let result = await runAutomationActions(app, clientAccountId, updated, automations);
  if (isBeingScheduled) {
    const normalizeColumnName = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const columns = await listColumnsByClientAccountId(app.db, clientAccountId);
    let scheduledColumn = columns.find((column) => /^agendados?$/i.test(normalizeColumnName(column.name)));
    if (!scheduledColumn) {
      scheduledColumn = await createColumn(app.db, clientAccountId, {
        name: "Agendados",
        color: "#3c8ee9",
        visibleToClient: true,
        autoCreated: true,
      }) ?? undefined;
    }
    if (scheduledColumn && result.columnId !== scheduledColumn.id) {
      const moved = await moveCard(app.db, cardId, result, { columnId: scheduledColumn.id });
      if (moved) {
        const columnAutomations = (await listActiveAutomations(app, clientAccountId)).filter((rule) => (
          rule.triggerType === "column_moved" && rule.triggerValue === scheduledColumn?.id
        ));
        result = await runAutomationActions(app, clientAccountId, moved, columnAutomations);
      }
    }
  }
  await upsertCalendarEventFromCard(app.db, result);
  return result;
}

export async function listKanbanCaptionVersions(app: FastifyInstance, clientAccountId: string, cardId: string) {
  const card = await findCardById(app.db, cardId);
  if (!card || card.clientAccountId !== clientAccountId) throw app.httpErrors.notFound("Card não encontrado nesta conta.");
  return listCaptionVersions(app.db, cardId);
}

export async function restoreKanbanCaptionVersion(
  app: FastifyInstance,
  clientAccountId: string,
  cardId: string,
  versionId: string,
  actor: { id: string; fullName: string; globalRole: string },
) {
  const card = await findCardById(app.db, cardId);
  if (!card || card.clientAccountId !== clientAccountId) throw app.httpErrors.notFound("Card não encontrado nesta conta.");
  const version = await findCaptionVersion(app.db, cardId, versionId);
  if (!version) throw app.httpErrors.notFound("Versão da legenda não encontrada.");
  if ((card.caption ?? null) !== (version.caption ?? null)) {
    await recordCaptionVersion(app.db, { cardId, caption: card.caption, authorUserId: actor.id, authorName: actor.fullName, authorRole: actor.globalRole });
  }
  const updated = await updateCard(app.db, cardId, { caption: version.caption });
  if (!updated) throw app.httpErrors.badRequest("Não foi possível restaurar a legenda.");
  return { card: updated, versions: await listCaptionVersions(app.db, cardId) };
}

export async function moveKanbanCard(
  app: FastifyInstance,
  clientAccountId: string,
  cardId: string,
  input: MoveCardInput,
) {
  const card = await findCardById(app.db, cardId);
  if (!card || card.clientAccountId !== clientAccountId) {
    throw app.httpErrors.notFound("Card não encontrado nesta conta.");
  }

  await assertColumnBelongsToClient(app, clientAccountId, input.columnId);

  const moved = await moveCard(app.db, cardId, card, input);
  if (!moved) {
    throw app.httpErrors.badRequest("Não foi possível mover o card.");
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
    throw app.httpErrors.notFound("Card não encontrado nesta conta.");
  }

  const updated = await setCardArchived(app.db, cardId, archived);
  if (!updated) {
    throw app.httpErrors.badRequest("Não foi possível atualizar o arquivo do card.");
  }

  await upsertCalendarEventFromCard(app.db, updated);
  return updated;
}

export async function deleteKanbanCard(app: FastifyInstance, clientAccountId: string, cardId: string) {
  const card = await findCardById(app.db, cardId);
  if (!card || card.clientAccountId !== clientAccountId) {
    throw app.httpErrors.notFound("Card não encontrado nesta conta.");
  }

  if (!(await deleteCard(app.db, cardId))) {
    throw app.httpErrors.badRequest("Não foi possível excluir o card.");
  }
}
