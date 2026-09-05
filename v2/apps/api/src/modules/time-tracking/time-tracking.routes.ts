import type { FastifyPluginAsync } from "fastify";
import { assertClientAccess, assertInternalAccess, getClientScope } from "../auth/auth.access.js";
import { findCardById } from "../cards/cards.repository.js";
import { clearCompletedTimeEntries, createTimeEntry, ensureTimeTrackingTable, findActiveTimeEntry, listTimeEntries, resumeTimeEntry, stopTimeEntry } from "./time-tracking.repository.js";
import { listTimeEntriesSchema, startTimeEntrySchema } from "./time-tracking.schemas.js";

export const timeTrackingRoutes: FastifyPluginAsync = async (app) => {
  await ensureTimeTrackingTable(app.db);

  app.get("/time-tracking/active", async (request) => {
    assertInternalAccess(request);
    return { entry: await findActiveTimeEntry(app.db, request.auth!.user.id) };
  });

  app.get("/time-tracking/entries", async (request) => {
    assertInternalAccess(request);
    const query = listTimeEntriesSchema.parse(request.query);
    const auth = request.auth!;
    const scope = getClientScope(auth.user.globalRole, auth.user.id, auth.memberships);
    if (query.clientAccountId) assertClientAccess(request, query.clientAccountId, ["admin", "colaborador"]);
    return { items: await listTimeEntries(app.db, {
      from: new Date(query.from),
      to: new Date(query.to),
      clientIds: scope.mode === "global" ? null : scope.clientIds,
      clientAccountId: query.clientAccountId,
    }) };
  });

  app.post("/time-tracking/start", async (request) => {
    assertInternalAccess(request);
    const input = startTimeEntrySchema.parse(request.body);
    assertClientAccess(request, input.clientAccountId, ["admin", "colaborador"]);
    let cardTitle = "";
    if (input.cardId) {
      const card = await findCardById(app.db, input.cardId);
      if (!card || card.clientAccountId !== input.clientAccountId) throw app.httpErrors.badRequest("Este card não pertence ao cliente selecionado.");
      cardTitle = card.title;
    }
    const description = input.description?.trim() || cardTitle;
    if (!description) throw app.httpErrors.badRequest("Informe o que será feito.");
    try {
      return { entry: await createTimeEntry(app.db, { userId: request.auth!.user.id, clientAccountId: input.clientAccountId, cardId: input.cardId ?? null, description }) };
    } catch (error) {
      if (error instanceof Error && (error as Error & { code?: string }).code === "ACTIVE_TIMER_EXISTS") throw app.httpErrors.conflict(error.message);
      throw error;
    }
  });

  app.post("/time-tracking/:entryId/stop", async (request) => {
    assertInternalAccess(request);
    const { entryId } = request.params as { entryId: string };
    const entry = await stopTimeEntry(app.db, entryId, request.auth!.user.id);
    if (!entry) throw app.httpErrors.notFound("Cronômetro não encontrado ou já encerrado.");
    return { entry };
  });

  app.post("/time-tracking/:entryId/resume", async (request) => {
    assertInternalAccess(request);
    const { entryId } = request.params as { entryId: string };
    try {
      const entry = await resumeTimeEntry(app.db, entryId, request.auth!.user.id);
      if (!entry) throw app.httpErrors.notFound("Registro de tempo não encontrado.");
      return { entry };
    } catch (error) {
      if (error instanceof Error && (error as Error & { code?: string }).code === "ACTIVE_TIMER_EXISTS") throw app.httpErrors.conflict(error.message);
      throw error;
    }
  });

  app.delete("/time-tracking/entries", async (request) => {
    assertInternalAccess(request);
    const query = listTimeEntriesSchema.parse(request.query);
    const auth = request.auth!;
    const scope = getClientScope(auth.user.globalRole, auth.user.id, auth.memberships);
    if (query.clientAccountId) assertClientAccess(request, query.clientAccountId, ["admin", "colaborador"]);
    const removed = await clearCompletedTimeEntries(app.db, {
      from: new Date(query.from), to: new Date(query.to),
      clientIds: scope.mode === "global" ? null : scope.clientIds,
      clientAccountId: query.clientAccountId,
      userId: auth.user.globalRole === "colaborador" ? auth.user.id : undefined,
    });
    return { ok: true, removed };
  });
};
