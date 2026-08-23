import crypto from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import type {
  CreateColumnInput,
  UpdateColumnInput,
} from "./columns.schemas.js";

type ColumnRow = RowDataPacket & {
  id: string;
  client_account_id: string;
  name: string;
  color: string | null;
  position: number;
  visible_to_client: number;
  auto_created: number;
  created_at: Date | string;
  updated_at: Date | string;
};

export async function listColumnsByClientAccountId(
  db: Pool,
  clientAccountId: string,
) {
  const [rows] = await db.query<ColumnRow[]>(
    [
      "SELECT id, client_account_id, name, color, position, visible_to_client, auto_created, created_at, updated_at",
      "FROM kanban_columns",
      "WHERE client_account_id = ?",
      "ORDER BY position ASC, created_at ASC",
    ].join(" "),
    [clientAccountId],
  );

  return rows.map(mapColumnRow);
}

export async function findColumnById(db: Pool, columnId: string) {
  const [rows] = await db.query<ColumnRow[]>(
    [
      "SELECT id, client_account_id, name, color, position, visible_to_client, auto_created, created_at, updated_at",
      "FROM kanban_columns",
      "WHERE id = ?",
      "LIMIT 1",
    ].join(" "),
    [columnId],
  );

  const row = rows[0];
  return row ? mapColumnRow(row) : null;
}

export async function createColumn(
  db: Pool,
  clientAccountId: string,
  input: CreateColumnInput,
) {
  const [positionRows] = await db.query<RowDataPacket[]>(
    [
      "SELECT COALESCE(MAX(position), -1) AS max_position",
      "FROM kanban_columns",
      "WHERE client_account_id = ?",
    ].join(" "),
    [clientAccountId],
  );

  const nextPosition = Number(positionRows[0]?.max_position ?? -1) + 1;
  const id = crypto.randomUUID();

  await db.query(
    [
      "INSERT INTO kanban_columns",
      "(id, client_account_id, name, color, position, visible_to_client, auto_created)",
      "VALUES (?, ?, ?, ?, ?, ?, ?)",
    ].join(" "),
    [
      id,
      clientAccountId,
      input.name,
      input.color ?? null,
      nextPosition,
      input.visibleToClient ? 1 : 0,
      input.autoCreated ? 1 : 0,
    ],
  );

  return findColumnById(db, id);
}

export async function findColumnByClientAndName(
  db: Pool,
  clientAccountId: string,
  name: string,
) {
  const [rows] = await db.query<ColumnRow[]>(
    [
      "SELECT id, client_account_id, name, color, position, visible_to_client, auto_created, created_at, updated_at",
      "FROM kanban_columns",
      "WHERE client_account_id = ? AND LOWER(name) = LOWER(?)",
      "LIMIT 1",
    ].join(" "),
    [clientAccountId, name],
  );

  const row = rows[0];
  return row ? mapColumnRow(row) : null;
}

export async function updateColumn(
  db: Pool,
  columnId: string,
  input: UpdateColumnInput,
) {
  const fields: string[] = [];
  const params: Array<string | number | null> = [];

  if (typeof input.name !== "undefined") {
    fields.push("name = ?");
    params.push(input.name);
  }
  if (typeof input.color !== "undefined") {
    fields.push("color = ?");
    params.push(input.color ?? null);
  }
  if (typeof input.visibleToClient !== "undefined") {
    fields.push("visible_to_client = ?");
    params.push(input.visibleToClient ? 1 : 0);
  }
  if (typeof input.autoCreated !== "undefined") {
    fields.push("auto_created = ?");
    params.push(input.autoCreated ? 1 : 0);
  }

  if (fields.length === 0) {
    return findColumnById(db, columnId);
  }

  await db.query(
    `UPDATE kanban_columns SET ${fields.join(", ")} WHERE id = ?`,
    [...params, columnId],
  );

  return findColumnById(db, columnId);
}

export async function deleteColumn(db: Pool, columnId: string) {
  await db.query("DELETE FROM kanban_columns WHERE id = ?", [columnId]);
}

export async function reorderColumns(
  db: Pool,
  clientAccountId: string,
  orderedColumnIds: string[],
) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    for (const [position, columnId] of orderedColumnIds.entries()) {
      await connection.query(
        [
          "UPDATE kanban_columns",
          "SET position = ?",
          "WHERE id = ? AND client_account_id = ?",
        ].join(" "),
        [position, columnId, clientAccountId],
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return listColumnsByClientAccountId(db, clientAccountId);
}

function mapColumnRow(row: ColumnRow) {
  return {
    id: row.id,
    clientAccountId: row.client_account_id,
    name: row.name,
    color: row.color,
    position: row.position,
    visibleToClient: Boolean(row.visible_to_client),
    autoCreated: Boolean(row.auto_created),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
