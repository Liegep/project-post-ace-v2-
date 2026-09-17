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
import { findCardById } from "./cards.repository.js";
import { getInternalCardDetail } from "./card-detail.service.js";

function isInheritedApprovalStatus(value: string) {
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  return normalized === "aprovado" || normalized === "aprovada" || normalized === "aprovado pelo cliente" || normalized === "pauta aprovada" || normalized === "pautas aprovadas";
}

export const cardRoutes: FastifyPluginAsync = async (app) => {
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

  app.post("/clients/:clientAccountId/cards", async (request) => {
    assertInternalAccess(request);

    const params = request.params as { clientAccountId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador"]);
    const input = createCardSchema.parse(request.body);

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
    const current = await findCardById(app.db, params.cardId);
    if (!current || current.clientAccountId !== params.clientAccountId) {
      throw app.httpErrors.notFound("Card não encontrado nesta conta.");
    }

    const convertingApprovedBriefToPost = current.isBriefApproval && input.isBriefApproval === false;
    const effectiveInput = convertingApprovedBriefToPost
      ? {
          ...input,
          isBriefApproval: false,
          clientLabel: input.clientLabel && !/aprovad/i.test(input.clientLabel.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
            ? input.clientLabel
            : "Pendente",
          status: (input.status ?? current.status).filter((status) => !isInheritedApprovalStatus(status)),
        }
      : input;

    if (convertingApprovedBriefToPost) {
      // Keep the pauta approval in history, but start a fresh approval cycle for
      // the post created from it. Old approval links remain stored in the DB.
      await app.db.query(
        "UPDATE kanban_cards SET approval_reset_at = CURRENT_TIMESTAMP WHERE id = ?",
        [params.cardId],
      );
    }

    return {
      ok: true,
      card: await updateKanbanCard(app, params.clientAccountId, params.cardId, effectiveInput, request.auth!.user),
    };
  });

  app.post("/clients/:clientAccountId/cards/:cardId/move", async (request) => {
    assertInternalAccess(request);

    const params = request.params as { clientAccountId: string; cardId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador"]);
    const input = moveCardSchema.parse(request.body);

    return {
      ok: true,
      card: await moveKanbanCard(app, params.clientAccountId, params.cardId, input),
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