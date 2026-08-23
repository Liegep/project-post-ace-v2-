import type { FastifyPluginAsync } from "fastify";
import { assertClientAccess, assertInternalAccess } from "../auth/auth.access.js";
import {
  createColumnSchema,
  reorderColumnsSchema,
  updateColumnSchema,
} from "./columns.schemas.js";
import {
  createKanbanColumn,
  deleteKanbanColumn,
  listKanbanColumns,
  reorderKanbanColumns,
  updateKanbanColumn,
} from "./columns.service.js";

export const columnRoutes: FastifyPluginAsync = async (app) => {
  app.get("/clients/:clientAccountId/columns", async (request) => {
    assertInternalAccess(request);

    const params = request.params as { clientAccountId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador"]);

    return listKanbanColumns(app, params.clientAccountId);
  });

  app.post("/clients/:clientAccountId/columns", async (request) => {
    assertInternalAccess(request);

    const params = request.params as { clientAccountId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador"]);
    const input = createColumnSchema.parse(request.body);

    return {
      ok: true,
      column: await createKanbanColumn(app, params.clientAccountId, input),
    };
  });

  app.patch("/clients/:clientAccountId/columns/:columnId", async (request) => {
    assertInternalAccess(request);

    const params = request.params as { clientAccountId: string; columnId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador"]);
    const input = updateColumnSchema.parse(request.body);

    return {
      ok: true,
      column: await updateKanbanColumn(app, params.clientAccountId, params.columnId, input),
    };
  });

  app.delete("/clients/:clientAccountId/columns/:columnId", async (request) => {
    assertInternalAccess(request);

    const params = request.params as { clientAccountId: string; columnId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador"]);

    await deleteKanbanColumn(app, params.clientAccountId, params.columnId);

    return {
      ok: true,
    };
  });

  app.post("/clients/:clientAccountId/columns/reorder", async (request) => {
    assertInternalAccess(request);

    const params = request.params as { clientAccountId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador"]);
    const input = reorderColumnsSchema.parse(request.body);

    return {
      ok: true,
      columns: await reorderKanbanColumns(app, params.clientAccountId, input),
    };
  });
};
