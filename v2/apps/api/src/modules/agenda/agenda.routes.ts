import crypto from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import type { RowDataPacket } from "mysql2/promise";
import { assertClientAccess, assertInternalAccess } from "../auth/auth.access.js";
import {
  createAgendaEventSchema,
  createAgendaLabelSchema,
  listAgendaEventsSchema,
  updateAgendaEventSchema,
} from "./agenda.schemas.js";
import { zonedWallClockToIso } from "../../lib/zoned-date-time.js";

type AgendaRow = RowDataPacket & {
  startsAt: string;
  endsAt: string | null;
  eventTimeZone: string | null;
};

function serializeAgendaRows(rows: AgendaRow[], fallbackTimeZone: string) {
  return rows.map((row) => ({
    ...row,
    startsAt: zonedWallClockToIso(row.startsAt, row.eventTimeZone || fallbackTimeZone),
    endsAt: zonedWallClockToIso(row.endsAt, row.eventTimeZone || fallbackTimeZone),
    timeZone: row.eventTimeZone || fallbackTimeZone,
    eventTimeZone: undefined,
  }));
}

export const agendaRoutes: FastifyPluginAsync = async (app) => {
  app.get("/agenda/events", async (request) => {
    assertInternalAccess(request);

    const query = listAgendaEventsSchema.parse(request.query);
    const auth = request.auth!;

    const isSuperAdmin = auth.user.globalRole === "super_admin";

    const scopeSql = isSuperAdmin
      ? ""
      : " AND e.created_by_user_id = ?";

    const params = isSuperAdmin
      ? [query.to, query.from]
      : [query.to, query.from, auth.user.id];

    const [rows] = await app.db.query<AgendaRow[]>(
      "SELECT e.id, e.title, e.task_description AS taskDescription, DATE_FORMAT(e.starts_at, '%Y-%m-%d %H:%i:%s') AS startsAt, DATE_FORMAT(e.ends_at, '%Y-%m-%d %H:%i:%s') AS endsAt, e.event_timezone AS eventTimeZone, e.recurrence_type AS recurrenceType, e.repeat_until AS repeatUntil, e.color, e.is_completed AS isCompleted, e.client_account_id AS clientAccountId, e.agenda_label_id AS labelId, e.meet_link AS meetLink, a.name AS clientName, l.name AS labelName FROM agenda_events e LEFT JOIN client_accounts a ON a.id = e.client_account_id LEFT JOIN agenda_labels l ON l.id = e.agenda_label_id WHERE e.starts_at < DATE_ADD(?, INTERVAL 1 DAY) AND (e.recurrence_type <> 'none' OR e.starts_at >= DATE_SUB(?, INTERVAL 1 DAY))" + scopeSql + " ORDER BY e.starts_at ASC",
      params,
    );

    return { items: serializeAgendaRows(rows, app.appEnv.APP_TIMEZONE) };
  });

  app.get("/portal/accounts/:clientAccountId/appointments", async (request) => {
    const params = request.params as { clientAccountId: string };

    assertClientAccess(
      request,
      params.clientAccountId,
      ["admin", "colaborador", "cliente"],
    );

    const query = listAgendaEventsSchema.parse(request.query);

    const [rows] = await app.db.query<AgendaRow[]>(
      "SELECT e.id, e.title, e.task_description AS taskDescription, DATE_FORMAT(e.starts_at, '%Y-%m-%d %H:%i:%s') AS startsAt, DATE_FORMAT(e.ends_at, '%Y-%m-%d %H:%i:%s') AS endsAt, e.event_timezone AS eventTimeZone, e.recurrence_type AS recurrenceType, e.repeat_until AS repeatUntil, e.color, e.is_completed AS isCompleted, e.client_account_id AS clientAccountId, e.meet_link AS meetLink, a.name AS clientName FROM agenda_events e LEFT JOIN client_accounts a ON a.id = e.client_account_id WHERE e.client_account_id = ? AND e.meet_link IS NOT NULL AND TRIM(e.meet_link) <> '' AND e.starts_at < DATE_ADD(?, INTERVAL 1 DAY) AND (e.recurrence_type <> 'none' OR e.starts_at >= DATE_SUB(?, INTERVAL 1 DAY)) ORDER BY e.starts_at ASC",
      [params.clientAccountId, query.to, query.from],
    );

    return { items: serializeAgendaRows(rows, app.appEnv.APP_TIMEZONE) };
  });

  app.post("/agenda/events", async (request) => {
    assertInternalAccess(request);

    const input = createAgendaEventSchema.parse(request.body);
    const id = crypto.randomUUID();

    await app.db.query(
      "INSERT INTO agenda_events (id, client_account_id, agenda_label_id, title, task_description, starts_at, ends_at, event_timezone, recurrence_type, repeat_until, color, meet_link, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        id,
        input.clientAccountId ?? null,
        input.labelId ?? null,
        input.title,
        input.taskDescription?.trim() || null,
        input.startsAt,
        input.endsAt ?? null,
        input.timeZone ?? app.appEnv.APP_TIMEZONE,
        input.recurrenceType,
        input.repeatUntil ?? null,
        input.color,
        input.meetLink?.trim() || null,
        request.auth!.user.id,
      ],
    );

    return { ok: true, id };
  });

  app.patch("/agenda/events/:eventId", async (request) => {
    assertInternalAccess(request);

    const { eventId } = request.params as { eventId: string };
    const input = updateAgendaEventSchema.parse(request.body);

    const updates: string[] = [];
    const values: unknown[] = [];

    const mappings: Array<[keyof typeof input, string]> = [
      ["title", "title"],
      ["taskDescription", "task_description"],
      ["startsAt", "starts_at"],
      ["endsAt", "ends_at"],
      ["color", "color"],
      ["clientAccountId", "client_account_id"],
      ["labelId", "agenda_label_id"],
      ["recurrenceType", "recurrence_type"],
      ["repeatUntil", "repeat_until"],
      ["meetLink", "meet_link"],
      ["isCompleted", "is_completed"],
    ];

    for (const [key, column] of mappings) {
      if (key in input) {
        updates.push(`${column} = ?`);
        values.push(input[key] ?? null);
      }
    }

    if ("startsAt" in input || "endsAt" in input) {
      updates.push("event_timezone = ?");
      values.push(input.timeZone ?? app.appEnv.APP_TIMEZONE);
    }

    if (!updates.length) {
      return { ok: true };
    }

    const isSuperAdmin =
      request.auth!.user.globalRole === "super_admin";

    values.push(eventId);

    if (!isSuperAdmin) {
      values.push(request.auth!.user.id);
    }

    const [result] = await app.db.query<
      import("mysql2/promise").ResultSetHeader
    >(
      `UPDATE agenda_events SET ${updates.join(", ")} WHERE id = ?${
        isSuperAdmin
          ? ""
          : " AND created_by_user_id = ?"
      }`,
      values,
    );

    if (result.affectedRows === 0) {
      throw app.httpErrors.notFound(
        "Compromisso não encontrado ou sem permissão para alterar.",
      );
    }

    return { ok: true };
  });

  app.delete("/agenda/events/:eventId", async (request) => {
    assertInternalAccess(request);

    const { eventId } = request.params as {
      eventId: string;
    };

    const isSuperAdmin =
      request.auth!.user.globalRole === "super_admin";

    const [result] = await app.db.query<
      import("mysql2/promise").ResultSetHeader
    >(
      `DELETE FROM agenda_events WHERE id = ?${
        isSuperAdmin
          ? ""
          : " AND created_by_user_id = ?"
      }`,
      isSuperAdmin
        ? [eventId]
        : [eventId, request.auth!.user.id],
    );

    if (result.affectedRows === 0) {
      throw app.httpErrors.notFound(
        "Compromisso não encontrado ou sem permissão para excluir.",
      );
    }

    return { ok: true };
  });

  app.get("/agenda/labels", async (request) => {
    assertInternalAccess(request);

    const [rows] = await app.db.query(
      "SELECT id, name, color FROM agenda_labels WHERE user_id = ? ORDER BY created_at ASC",
      [request.auth!.user.id],
    );

    return { items: rows };
  });

  app.post("/agenda/labels", async (request) => {
    assertInternalAccess(request);

    const input = createAgendaLabelSchema.parse(
      request.body,
    );

    const label = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      color: input.color,
    };

    await app.db.query(
      "INSERT INTO agenda_labels (id, user_id, name, color) VALUES (?, ?, ?, ?)",
      [
        label.id,
        request.auth!.user.id,
        label.name,
        label.color,
      ],
    );

    return {
      ok: true,
      label,
    };
  });

  app.delete("/agenda/labels/:labelId", async (request) => {
    assertInternalAccess(request);

    const { labelId } = request.params as {
      labelId: string;
    };

    const [owned] = await app.db.query(
      "SELECT id FROM agenda_labels WHERE id = ? AND user_id = ?",
      [
        labelId,
        request.auth!.user.id,
      ],
    );

    if (
      !Array.isArray(owned) ||
      owned.length === 0
    ) {
      throw app.httpErrors.notFound(
        "Etiqueta não encontrada.",
      );
    }

    await app.db.query(
      "UPDATE agenda_events SET agenda_label_id = NULL WHERE agenda_label_id = ?",
      [labelId],
    );

    await app.db.query(
      "DELETE FROM agenda_labels WHERE id = ?",
      [labelId],
    );

    return { ok: true };
  });
};
