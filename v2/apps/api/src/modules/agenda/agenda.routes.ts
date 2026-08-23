import crypto from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { assertInternalAccess, getClientScope } from "../auth/auth.access.js";
import { createAgendaEventSchema, createAgendaLabelSchema, listAgendaEventsSchema, updateAgendaEventSchema } from "./agenda.schemas.js";

export const agendaRoutes: FastifyPluginAsync = async (app) => {
  app.get("/agenda/events", async (request) => {
    assertInternalAccess(request);
    const query = listAgendaEventsSchema.parse(request.query);
    const auth = request.auth!;
    const scope = getClientScope(auth.user.globalRole, auth.user.id, auth.memberships);
    if (scope.mode === "scoped" && scope.clientIds.length === 0) return { items: [] };
    const scopeSql = scope.mode === "global" ? "" : ` AND (e.client_account_id IS NULL OR e.client_account_id IN (${scope.clientIds.map(() => "?").join(", ")}))`;
    const params = [query.to, query.from, ...(scope.mode === "global" ? [] : scope.clientIds)];
    const [rows] = await app.db.query(
      "SELECT e.id, e.title, e.task_description AS taskDescription, e.starts_at AS startsAt, e.ends_at AS endsAt, e.recurrence_type AS recurrenceType, e.repeat_until AS repeatUntil, e.color, e.is_completed AS isCompleted, e.client_account_id AS clientAccountId, e.agenda_label_id AS labelId, a.name AS clientName, l.name AS labelName FROM agenda_events e LEFT JOIN client_accounts a ON a.id = e.client_account_id LEFT JOIN agenda_labels l ON l.id = e.agenda_label_id WHERE e.starts_at < ? AND (e.recurrence_type <> 'none' OR e.starts_at >= ?)" + scopeSql + " ORDER BY e.starts_at ASC",
      params,
    );
    return { items: rows };
  });

  app.post("/agenda/events", async (request) => {
    assertInternalAccess(request);
    const input = createAgendaEventSchema.parse(request.body);
    const id = crypto.randomUUID();
    await app.db.query(
      "INSERT INTO agenda_events (id, client_account_id, agenda_label_id, title, task_description, starts_at, ends_at, recurrence_type, repeat_until, color, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [id, input.clientAccountId ?? null, input.labelId ?? null, input.title, input.taskDescription?.trim() || null, input.startsAt, input.endsAt ?? null, input.recurrenceType, input.repeatUntil ?? null, input.color, request.auth!.user.id],
    );
    return { ok: true, id };
  });

  app.patch("/agenda/events/:eventId", async (request) => {
    assertInternalAccess(request);
    const { eventId } = request.params as { eventId: string };
    const input = updateAgendaEventSchema.parse(request.body);
    const updates: string[] = [];
    const values: unknown[] = [];
    const mappings: Array<[keyof typeof input, string]> = [["title", "title"], ["taskDescription", "task_description"], ["startsAt", "starts_at"], ["endsAt", "ends_at"], ["color", "color"], ["clientAccountId", "client_account_id"], ["labelId", "agenda_label_id"], ["recurrenceType", "recurrence_type"], ["repeatUntil", "repeat_until"]];
    for (const [key, column] of mappings) if (key in input) { updates.push(`${column} = ?`); values.push(input[key] ?? null); }
    if (!updates.length) return { ok: true };
    values.push(eventId, request.auth!.user.id);
    await app.db.query(`UPDATE agenda_events SET ${updates.join(", ")} WHERE id = ? AND created_by_user_id = ?`, values);
    return { ok: true };
  });

  app.delete("/agenda/events/:eventId", async (request) => {
    assertInternalAccess(request);
    const { eventId } = request.params as { eventId: string };
    await app.db.query("DELETE FROM agenda_events WHERE id = ? AND created_by_user_id = ?", [eventId, request.auth!.user.id]);
    return { ok: true };
  });

  app.get("/agenda/labels", async (request) => {
    assertInternalAccess(request);
    const [rows] = await app.db.query("SELECT id, name, color FROM agenda_labels WHERE user_id = ? ORDER BY created_at ASC", [request.auth!.user.id]);
    return { items: rows };
  });

  app.post("/agenda/labels", async (request) => {
    assertInternalAccess(request);
    const input = createAgendaLabelSchema.parse(request.body);
    const label = { id: crypto.randomUUID(), name: input.name.trim(), color: input.color };
    await app.db.query("INSERT INTO agenda_labels (id, user_id, name, color) VALUES (?, ?, ?, ?)", [label.id, request.auth!.user.id, label.name, label.color]);
    return { ok: true, label };
  });

  app.delete("/agenda/labels/:labelId", async (request) => {
    assertInternalAccess(request);
    const { labelId } = request.params as { labelId: string };
    const [owned] = await app.db.query("SELECT id FROM agenda_labels WHERE id = ? AND user_id = ?", [labelId, request.auth!.user.id]);
    if (!Array.isArray(owned) || owned.length === 0) throw app.httpErrors.notFound("Etiqueta não encontrada.");
    await app.db.query("UPDATE agenda_events SET agenda_label_id = NULL WHERE agenda_label_id = ?", [labelId]);
    await app.db.query("DELETE FROM agenda_labels WHERE id = ?", [labelId]);
    return { ok: true };
  });
};
