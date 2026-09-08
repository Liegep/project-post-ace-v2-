import type { FastifyPluginAsync } from "fastify";
import { assertInternalAccess } from "../auth/auth.access.js";
import { createDashboardNote, deleteDashboardNote, ensureDashboardNotesTable, listDashboardNotes, updateDashboardNote } from "./dashboard-notes.repository.js";
import { createDashboardNoteSchema, updateDashboardNoteSchema } from "./dashboard-notes.schemas.js";

export const dashboardNotesRoutes: FastifyPluginAsync = async (app) => {
  await ensureDashboardNotesTable(app.db);

  app.get("/dashboard/notes", async (request) => {
    assertInternalAccess(request);
    return { items: await listDashboardNotes(app.db, request.auth!.user.id) };
  });

  app.post("/dashboard/notes", async (request) => {
    assertInternalAccess(request);
    const input = createDashboardNoteSchema.parse(request.body);
    return { note: await createDashboardNote(app.db, { userId: request.auth!.user.id, ...input }) };
  });

  app.patch("/dashboard/notes/:noteId", async (request) => {
    assertInternalAccess(request);
    const { noteId } = request.params as { noteId: string };
    const note = await updateDashboardNote(app.db, noteId, request.auth!.user.id, updateDashboardNoteSchema.parse(request.body));
    if (!note) throw app.httpErrors.notFound("Lembrete não encontrado.");
    return { note };
  });

  app.delete("/dashboard/notes/:noteId", async (request) => {
    assertInternalAccess(request);
    if (!await deleteDashboardNote(app.db, (request.params as { noteId: string }).noteId, request.auth!.user.id)) throw app.httpErrors.notFound("Lembrete não encontrado.");
    return { ok: true };
  });
};
