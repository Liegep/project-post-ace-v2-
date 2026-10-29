import { cardTransferRoutes } from "./card-transfers.routes.js";
import type { FastifyPluginAsync } from "fastify";
import { assertClientAccess, assertInternalAccess } from "../auth/auth.access.js";
import {
  archiveCardSchema,
  boardQuerySchema,
  createCardSchema,
  listCardsQuerySchema,
  moveCardSchema,
  updateCardSchema,
} from "./cards.schemas.js";
import {
  archiveKanbanCard,
  createKanbanCard,
  deleteKanbanCard,
  getKanbanBoard,
  listKanbanCaptionVersions,
  listKanbanCards,
  moveKanbanCard,
  restoreKanbanCaptionVersion,
  updateKanbanCard,
} from "./cards.service.js";
import { getInternalCardDetail } from "./card-detail.service.js";

export const cardRoutes: FastifyPluginAsync = async (app) => {
  await app.register(cardTransferRoutes);
  app.get("/clients/:clientAccountId/board", async (request) => {
    assertInternalAccess(request);

    const params = request.params as { clientAccountId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador"]);
    const query = boardQuerySchema.parse(request.query);

    return getKanbanBoard(app, params.clientAccountId, query);
  });

  app.get("/clients/:clientAccountId/cards", async (request) => {
    assertInternalAccess(request);

    const params = request.params as { clientAccountId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador"]);
    const query = listCardsQuerySchema.parse(request.query);

    return listKanbanCards(app, params.clientAccountId, query);
  });

  app.get("/clients/:clientAccountId/cards/:cardId", async (request) => {
    assertInternalAccess(request);

    const params = request.params as { clientAccountId: string; cardId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador"]);

    return getInternalCardDetail(app, params.clientAccountId, params.cardId);
  });

  app.get("/clients/:clientAccountId/cards/:cardId/caption-versions", async (request) => {
    assertInternalAccess(request);
    const params = request.params as { clientAccountId: string; cardId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador"]);
    return { items: await listKanbanCaptionVersions(app, params.clientAccountId, params.cardId) };
  });

  app.post("/clients/:clientAccountId/cards/:cardId/caption-versions/:versionId/restore", async (request) => {
    assertInternalAccess(request);
    const params = request.params as { clientAccountId: string; cardId: string; versionId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador"]);
    return { ok: true, ...(await restoreKanbanCaptionVersion(app, params.clientAccountId, params.cardId, params.versionId, request.auth!.user)) };
  });

  app.post("/clients/:clientAccountId/cards", async (request, reply) => {
    assertInternalAccess(request);

    const params = request.params as { clientAccountId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador"]);
    const parsed = createCardSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ ok: false, message: "Dados do cartão inválidos.", issues: parsed.error.issues });
    const input = parsed.data;

    return {
      ok: true,
      card: await createKanbanCard(
        app,
        params.clientAccountId,
        request.auth!.user.id,
        input,
      ),
    };
  });

  app.patch("/clients/:clientAccountId/cards/:cardId", async (request) => {
    assertInternalAccess(request);

    const params = request.params as { clientAccountId: string; cardId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador"]);
    const input = updateCardSchema.parse(request.body);

    return {
      ok: true,
      card: await updateKanbanCard(app, params.clientAccountId, params.cardId, input, request.auth!.user),
    };
  });

  app.post("/clients/:clientAccountId/cards/:cardId/move", async (request) => {
    assertInternalAccess(request);

    const params = request.params as { clientAccountId: string; cardId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador"]);
    const input = moveCardSchema.parse(request.body);

    return {
      ok: true,
      card: await moveKanbanCard(app, params.clientAccountId, params.cardId, input, request.auth!.user),
    };
  });

  app.post("/clients/:clientAccountId/cards/:cardId/archive", async (request) => {
    assertInternalAccess(request);

    const params = request.params as { clientAccountId: string; cardId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador"]);
    const input = archiveCardSchema.parse(request.body);

    return {
      ok: true,
      card: await archiveKanbanCard(
        app,
        params.clientAccountId,
        params.cardId,
        input.archived,
      ),
    };
  });

  app.delete("/clients/:clientAccountId/cards/:cardId", async (request) => {
    assertInternalAccess(request);
    const params = request.params as { clientAccountId: string; cardId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador"]);
    await deleteKanbanCard(app, params.clientAccountId, params.cardId);
    return { ok: true };
  });
};