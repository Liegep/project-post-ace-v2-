import crypto from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { assertClientAccess, assertInternalAccess, getClientScope } from "../auth/auth.access.js";
import { createAgendaEventSchema, createAgendaLabelSchema, listAgendaEventsSchema, updateAgendaEventSchema } from "./agenda.schemas.js";

export const agendaRoutes: FastifyPluginAsync = async (app) => {
  app.get("/agenda/events", async (request) => {
    assertInternalAccess(request);

    const query = listAgendaEventsSchema.parse(request.query);
    const auth = request.auth!;
    const scope = getClientScope(auth.user.globalRole, auth.user.id, auth.memberships);

    let scopeSql = "";
    const scopeParams: unknown[] = [];

    if (scope.mode !== "global") {
      if (scope.clientIds.length > 0) {
        scopeSql = ` AND (
          e.created_by_user_id = ?
          OR e.client_account_id IN (${scope.clientIds.map(() => "?").join(", ")})
        )`;
        scopeParams.push(auth.user.id, ...scope.clientIds);
      } else {
        scopeSql = " AND e.created_by_user_id = ?";
        scopeParams.push(auth.user.id);
      }
    }

    const params = [query.to, query.from, ...scopeParams];

    const [rows] = await app.db.query(
      "SELECT e.id, e.title, e.task_description AS taskDescription, e.starts_at AS startsAt, e.ends_at AS endsAt, e.recurrence_type AS recurrenceType, e.repeat_until AS repeatUntil, e.color, e.is_completed AS isCompleted, e.client_account_id AS clientAccountId, e.agenda_label_id AS labelId, e.meet_link AS meetLink, a.name AS clientName, l.name AS labelName FROM agenda_events e LEFT JOIN client_accounts a ON a.id = e.client_account_id LEFT JOIN agenda_labels l ON l.id = e.agenda_label_id WHERE e.starts_at < ? AND (e.recurrence_type <> 'none' OR e.starts_at >= ?)" + scopeSql + " ORDER BY e.starts_at ASC",
      params,
    );

    return { items: rows };
  });

  app.get("/portal/accounts/:clientAccountId/appointments", async (request) => {
    const params = request.params as { clientAccountId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador", "cliente"]);

    const query = listAgendaEventsSchema.parse(request.query);

    const [rows] = await app.db.query(
      "SELECT e.id, e.title, e.task_description AS taskDescription, e.starts_at AS startsAt, e.ends_at AS endsAt, e.recurrence_type AS recurrenceType, e.repeat_until AS repeatUntil, e.color, e.is_completed AS isCompleted, e.client_account_id AS clientAccountId, e.meet_link AS meetLink, a.name AS clientName FROM agenda_events e LEFT JOIN client_accounts a ON a.id = e.client_account_id WHERE e.client_account_id = ? AND e.meet_link IS NOT NULL AND TRIM(e.meet_link) <> '' AND e.starts_at < ? AND (e.recurrence_type <> 'none' OR e.starts_at >= ?) ORDER BY e.starts_at ASC",
      [params.clientAccountId, query.to, query.from],
    );

    return { items: rows };
  });

  app.post("/agenda/events", async (request) => {
    assertInternalAccess(request);

    const input = createAgendaEventSchema.parse(request.body);
    const id = crypto.randomUUID();

    await app.db.query(
      "INSERT INTO agenda_events (id, client_account_id, agenda_label_id, title, task_description, starts_at, ends_at, recurrence_type, repeat_until, color, meet_link, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        id,
        input.clientAccountId ?? null,
        input.labelId ?? null,
        input.title,
        input.taskDescription?.trim() || null,
        input.startsAt,
        input.endsAt ?? null,
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

    if (!updates.length) {
      return { ok: true };
    }

    const isSuperAdmin = request.auth!.user.globalRole === "super_admin";

    values.push(eventId);

    if (!isSuperAdmin) {
      values.push(request.auth!.user.id);
    }

    const [result] = await app.db.query<import("mysql2/promise").ResultSetHeader>(
      `UPDATE agenda_events SET ${updates.join(", ")} WHERE id = ?${isSuperAdmin ? "" : " AND created_by_user_id = ?"}`,
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

    const { eventId } = request.params as { eventId: string };
    const isSuperAdmin = request.auth!.user.globalRole === "super_admin";

    const [result] = await app.db.query<import("mysql2/promise").ResultSetHeader>(
      `DELETE FROM agenda_events WHERE id = ?${isSuperAdmin ? "" : " AND created_by_user_id = ?"}`,
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

    const input = createAgendaLabelSchema.parse(request.body);

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

    return { ok: true, label };
  });

  app.delete("/agenda/labels/:labelId", async (request) => {
    assertInternalAccess(request);

    const { labelId } = request.params as { labelId: string };

    const [owned] = await app.db.query(
      "SELECT id FROM agenda_labels WHERE id = ? AND user_id = ?",
      [labelId, request.auth!.user.id],
    );

    if (!Array.isArray(owned) || owned.length === 0) {
      throw app.httpErrors.notFound("Etiqueta não encontrada.");
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
