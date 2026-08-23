import crypto from "node:crypto";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type {
  CreateCardInput,
  MoveCardInput,
  UpdateCardInput,
} from "./cards.schemas.js";

type CardRow = RowDataPacket & {
  id: string;
  client_account_id: string;
  column_id: string | null;
  title: string;
  caption: string | null;
  media_type: string;
  primary_media_url: string | null;
  media_urls_json: unknown;
  external_link_url: string | null;
  art_type: string;
  status_json: unknown;
  tags_json: unknown;
  hashtags_json: unknown;
  is_brief_approval: number;
  keep_files: number;
  deadline_at: Date | string | null;
  scheduled_at: Date | string | null;
  scheduled_timezone: string | null;
  published_at: Date | string | null;
  archived: number;
  archived_at: Date | string | null;
  client_label: string;
  event_color: string | null;
  comments_count_cache: number;
  created_by_user_id: string | null;
  position: number;
  legacy_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type CalendarEventRow = RowDataPacket & {
  id: string;
};

function stringifyJson(value: unknown) {
  return JSON.stringify(value ?? []);
}

function parseJsonArray(value: unknown) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function mapCardRow(row: CardRow) {
  return {
    id: row.id,
    clientAccountId: row.client_account_id,
    columnId: row.column_id,
    title: row.title,
    caption: row.caption,
    mediaType: row.media_type,
    primaryMediaUrl: row.primary_media_url,
    mediaUrls: parseJsonArray(row.media_urls_json),
    externalLinkUrl: row.external_link_url,
    artType: row.art_type,
    status: parseJsonArray(row.status_json),
    tags: parseJsonArray(row.tags_json),
    hashtags: parseJsonArray(row.hashtags_json),
    isBriefApproval: Boolean(row.is_brief_approval),
    keepFiles: Boolean(row.keep_files),
    deadlineAt: row.deadline_at,
    scheduledAt: row.scheduled_at,
    scheduledTimeZone: row.scheduled_timezone,
    publishedAt: row.published_at,
    archived: Boolean(row.archived),
    archivedAt: row.archived_at,
    clientLabel: row.client_label,
    eventColor: row.event_color,
    commentsCount: row.comments_count_cache,
    createdByUserId: row.created_by_user_id,
    position: row.position,
    legacyId: row.legacy_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findCardById(db: Pool, cardId: string) {
  const [rows] = await db.query<CardRow[]>(
    [
      "SELECT id, client_account_id, column_id, title, caption, media_type, primary_media_url, media_urls_json, external_link_url, art_type,",
      "status_json, tags_json, hashtags_json, is_brief_approval, keep_files, deadline_at, DATE_FORMAT(scheduled_at, '%Y-%m-%d %H:%i:%s') AS scheduled_at, scheduled_timezone, published_at, archived, archived_at, client_label, event_color,",
      "comments_count_cache, created_by_user_id, position, legacy_id, created_at, updated_at",
      "FROM kanban_cards",
      "WHERE id = ?",
      "LIMIT 1",
    ].join(" "),
    [cardId],
  );

  const row = rows[0];
  return row ? mapCardRow(row) : null;
}

export async function listCardsByClientAccountId(
  db: Pool,
  clientAccountId: string,
  options: {
    archived?: boolean;
    columnId?: string;
    search?: string;
  },
) {
  let sql = [
    "SELECT id, client_account_id, column_id, title, caption, media_type, primary_media_url, media_urls_json, external_link_url, art_type,",
    "status_json, tags_json, hashtags_json, is_brief_approval, keep_files, deadline_at, DATE_FORMAT(scheduled_at, '%Y-%m-%d %H:%i:%s') AS scheduled_at, scheduled_timezone, published_at, archived, archived_at, client_label, event_color,",
    "comments_count_cache, created_by_user_id, position, legacy_id, created_at, updated_at",
    "FROM kanban_cards",
    "WHERE client_account_id = ?",
  ].join(" ");

  const params: Array<string | number> = [clientAccountId];

  if (typeof options.archived === "boolean") {
    sql += " AND archived = ?";
    params.push(options.archived ? 1 : 0);
  }

  if (options.columnId) {
    sql += " AND column_id = ?";
    params.push(options.columnId);
  }

  if (options.search) {
    sql += " AND (title LIKE ? OR caption LIKE ?)";
    const term = `%${options.search}%`;
    params.push(term, term);
  }

  sql += " ORDER BY archived ASC, column_id ASC, position ASC, created_at ASC";

  const [rows] = await db.query<CardRow[]>(sql, params);
  return rows.map(mapCardRow);
}

export async function createCard(
  db: Pool,
  clientAccountId: string,
  createdByUserId: string,
  input: CreateCardInput,
) {
  const [positionRows] = await db.query<RowDataPacket[]>(
    [
      "SELECT COALESCE(MAX(position), -1) AS max_position",
      "FROM kanban_cards",
      "WHERE client_account_id = ? AND archived = 0 AND",
      input.columnId ? "column_id = ?" : "column_id IS NULL",
    ].join(" "),
    input.columnId ? [clientAccountId, input.columnId] : [clientAccountId],
  );

  const nextPosition = Number(positionRows[0]?.max_position ?? -1) + 1;
  const cardId = crypto.randomUUID();

  await db.query(
    [
      "INSERT INTO kanban_cards",
      "(id, client_account_id, column_id, title, caption, media_type, primary_media_url, media_urls_json, external_link_url, art_type, status_json, tags_json, hashtags_json, is_brief_approval, keep_files, deadline_at, scheduled_at, scheduled_timezone, client_label, event_color, created_by_user_id, position)",
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ].join(" "),
    [
      cardId,
      clientAccountId,
      input.columnId ?? null,
      input.title,
      input.caption ?? null,
      input.mediaType,
      input.primaryMediaUrl ?? null,
      stringifyJson(input.mediaUrls),
      input.externalLinkUrl ?? null,
      input.artType,
      stringifyJson(input.status),
      stringifyJson(input.tags),
      stringifyJson(input.hashtags),
      input.isBriefApproval ? 1 : 0,
      input.keepFiles ? 1 : 0,
      input.deadlineAt ?? null,
      input.scheduledAt ?? null,
      input.scheduledTimeZone ?? null,
      input.clientLabel,
      input.eventColor ?? null,
      createdByUserId,
      nextPosition,
    ],
  );

  return findCardById(db, cardId);
}

export async function deleteCard(db: Pool, cardId: string) {
  const [result] = await db.query<ResultSetHeader>("DELETE FROM kanban_cards WHERE id = ?", [cardId]);
  return result.affectedRows > 0;
}

export async function updateCard(
  db: Pool,
  cardId: string,
  input: UpdateCardInput,
) {
  const fields: string[] = [];
  const params: Array<string | number | null> = [];

  if (typeof input.title !== "undefined") {
    fields.push("title = ?");
    params.push(input.title);
  }
  if (typeof input.caption !== "undefined") {
    fields.push("caption = ?");
    params.push(input.caption ?? null);
  }
  if (typeof input.mediaType !== "undefined") {
    fields.push("media_type = ?");
    params.push(input.mediaType);
  }
  if (typeof input.primaryMediaUrl !== "undefined") {
    fields.push("primary_media_url = ?");
    params.push(input.primaryMediaUrl ?? null);
  }
  if (typeof input.mediaUrls !== "undefined") {
    fields.push("media_urls_json = ?");
    params.push(stringifyJson(input.mediaUrls));
  }
  if (typeof input.externalLinkUrl !== "undefined") {
    fields.push("external_link_url = ?");
    params.push(input.externalLinkUrl ?? null);
  }
  if (typeof input.artType !== "undefined") {
    fields.push("art_type = ?");
    params.push(input.artType);
  }
  if (typeof input.status !== "undefined") {
    fields.push("status_json = ?");
    params.push(stringifyJson(input.status));
  }
  if (typeof input.tags !== "undefined") {
    fields.push("tags_json = ?");
    params.push(stringifyJson(input.tags));
  }
  if (typeof input.hashtags !== "undefined") {
    fields.push("hashtags_json = ?");
    params.push(stringifyJson(input.hashtags));
  }
  if (typeof input.isBriefApproval !== "undefined") {
    fields.push("is_brief_approval = ?");
    params.push(input.isBriefApproval ? 1 : 0);
  }
  if (typeof input.keepFiles !== "undefined") {
    fields.push("keep_files = ?");
    params.push(input.keepFiles ? 1 : 0);
  }
  if (typeof input.deadlineAt !== "undefined") {
    fields.push("deadline_at = ?");
    params.push(input.deadlineAt ?? null);
  }
  if (typeof input.scheduledAt !== "undefined") {
    fields.push("scheduled_at = ?");
    params.push(input.scheduledAt ?? null);
  }
  if (typeof input.scheduledTimeZone !== "undefined") {
    fields.push("scheduled_timezone = ?");
    params.push(input.scheduledTimeZone);
  }
  if (typeof input.clientLabel !== "undefined") {
    fields.push("client_label = ?");
    params.push(input.clientLabel);
  }
  if (typeof input.eventColor !== "undefined") {
    fields.push("event_color = ?");
    params.push(input.eventColor ?? null);
  }

  if (fields.length === 0) {
    return findCardById(db, cardId);
  }

  await db.query(
    `UPDATE kanban_cards SET ${fields.join(", ")} WHERE id = ?`,
    [...params, cardId],
  );

  return findCardById(db, cardId);
}

export async function moveCard(
  db: Pool,
  cardId: string,
  card: { clientAccountId: string; columnId: string | null; archived: boolean },
  input: MoveCardInput,
) {
  const [positionRows] = await db.query<RowDataPacket[]>(
    [
      "SELECT id",
      "FROM kanban_cards",
      "WHERE client_account_id = ? AND archived = ? AND id <> ? AND",
      input.columnId ? "column_id = ?" : "column_id IS NULL",
      "ORDER BY position ASC, created_at ASC",
    ].join(" "),
    input.columnId
      ? [card.clientAccountId, card.archived ? 1 : 0, cardId, input.columnId]
      : [card.clientAccountId, card.archived ? 1 : 0, cardId],
  );

  const targetCardIds = positionRows.map((row) => String(row.id));
  const requestedPosition = input.position ?? targetCardIds.length;
  const targetPosition = Math.max(0, Math.min(requestedPosition, targetCardIds.length));
  const orderedCardIds = [
    ...targetCardIds.slice(0, targetPosition),
    cardId,
    ...targetCardIds.slice(targetPosition),
  ];
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();
    // Move existing positions out of the way before applying the new contiguous order.
    await connection.query(
      [
        "UPDATE kanban_cards",
        "SET position = position + 100000",
        "WHERE client_account_id = ? AND archived = ? AND",
        input.columnId ? "column_id = ?" : "column_id IS NULL",
      ].join(" "),
      input.columnId
        ? [card.clientAccountId, card.archived ? 1 : 0, input.columnId]
        : [card.clientAccountId, card.archived ? 1 : 0],
    );

    for (const [position, id] of orderedCardIds.entries()) {
      await connection.query(
        "UPDATE kanban_cards SET column_id = ?, position = ? WHERE id = ?",
        [input.columnId ?? null, position, id],
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return findCardById(db, cardId);
}

export async function setCardArchived(
  db: Pool,
  cardId: string,
  archived: boolean,
) {
  await db.query(
    [
      "UPDATE kanban_cards",
      "SET archived = ?, archived_at = ?",
      "WHERE id = ?",
    ].join(" "),
    [archived ? 1 : 0, archived ? new Date() : null, cardId],
  );

  return findCardById(db, cardId);
}

export async function archiveDueScheduledCards(
  db: Pool,
  isDue: (scheduledAt: string, timeZone: string | null) => boolean,
) {
  const [rows] = await db.query<Array<RowDataPacket & { id: string; scheduled_at: string; scheduled_timezone: string | null }>>(
    [
      "SELECT id, DATE_FORMAT(scheduled_at, '%Y-%m-%d %H:%i:%s') AS scheduled_at, scheduled_timezone",
      "FROM kanban_cards",
      "WHERE archived = 0 AND scheduled_at IS NOT NULL",
    ].join(" "),
  );
  const cardIds = rows.filter((row) => isDue(row.scheduled_at, row.scheduled_timezone)).map((row) => String(row.id));
  if (cardIds.length === 0) return 0;

  const placeholders = cardIds.map(() => "?").join(", ");
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `UPDATE kanban_cards SET archived = 1, archived_at = NOW(), published_at = COALESCE(published_at, NOW()) WHERE id IN (${placeholders})`,
      cardIds,
    );
    await connection.query(`DELETE FROM card_calendar_events WHERE card_id IN (${placeholders})`, cardIds);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return cardIds.length;
}

export async function upsertCalendarEventFromCard(
  db: Pool,
  card: {
    id: string;
    clientAccountId: string;
    title: string;
    caption: string | null;
    mediaType: string;
    mediaUrls: string[];
    scheduledAt: Date | string | null;
    eventColor: string | null;
    createdByUserId: string | null;
    archived: boolean;
  },
) {
  if (!card.scheduledAt || card.archived) {
    await db.query("DELETE FROM card_calendar_events WHERE card_id = ?", [card.id]);
    return;
  }

  const scheduled = normalizeDateTime(card.scheduledAt);
  const publishDate = scheduled.slice(0, 10);
  const publishTime = scheduled.slice(11, 19);

  const [rows] = await db.query<CalendarEventRow[]>(
    [
      "SELECT id",
      "FROM card_calendar_events",
      "WHERE card_id = ?",
      "LIMIT 1",
    ].join(" "),
    [card.id],
  );

  const existing = rows[0];
  const mediaJson = stringifyJson(card.mediaUrls);

  if (existing) {
    await db.query(
      [
        "UPDATE card_calendar_events",
        "SET title = ?, caption = ?, media_type = ?, media_urls_json = ?, publish_date = ?, publish_time = ?, status = 'scheduled', event_color = ?",
        "WHERE id = ?",
      ].join(" "),
      [
        card.title,
        card.caption,
        card.mediaType,
        mediaJson,
        publishDate,
        publishTime,
        card.eventColor,
        existing.id,
      ],
    );
    return;
  }

  await db.query(
    [
      "INSERT INTO card_calendar_events",
      "(id, client_account_id, card_id, title, caption, media_type, media_urls_json, publish_date, publish_time, status, event_color, created_by_user_id)",
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?)",
    ].join(" "),
    [
      crypto.randomUUID(),
      card.clientAccountId,
      card.id,
      card.title,
      card.caption,
      card.mediaType,
      mediaJson,
      publishDate,
      publishTime,
      card.eventColor,
      card.createdByUserId,
    ],
  );
}

function normalizeDateTime(value: Date | string) {
  const raw = typeof value === "string" ? value : value.toISOString();
  const base = raw.replace("T", " ").replace("Z", "");
  if (base.length === 16) return `${base}:00`;
  if (base.length >= 19) return base.slice(0, 19);
  return base;
}
