import { decideCardApproval } from "../approvals/approval-workflow.service.js";
import type { FastifyPluginAsync } from "fastify";
import { assertClientAccess, assertPortalAccessLevel } from "../auth/auth.access.js";
import { addCardComment } from "../comments/comments.service.js";
import { getPortalCardDetail } from "../cards/card-detail.service.js";
import { createKanbanCard } from "../cards/cards.service.js";
import { findCardById, listCardsByClientAccountId, moveCard, updateCard } from "../cards/cards.repository.js";
import { recordCaptionVersion } from "../cards/caption-history.repository.js";
import { ensureCardActivityEventsTable } from "../cards/card-activity.service.js";
import { createColumn, listColumnsByClientAccountId, updateColumn } from "../columns/columns.repository.js";
import { findClientPermissionsByAccountId } from "../clients/clients.repository.js";
import { createClientTag, listClientTags } from "../tags/tags.repository.js";
import { createClientTagSchema } from "../tags/tags.schemas.js";
import { createPortalPostSchema, portalBoardQuerySchema, portalCardDecisionSchema, portalSearchQuerySchema, updatePortalCardCaptionSchema, updatePortalCardTagsSchema } from "./portal.schemas.js";
import { getPortalBoard, getPortalHome } from "./portal.service.js";

export const portalRoutes: FastifyPluginAsync = async (app) => {
  await ensureCardActivityEventsTable(app.db);

  app.get("/portal/accounts/:clientAccountId/home", async (request) => {
    const params = request.params as { clientAccountId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador", "cliente"]);

    const accessLevel = request.auth?.user.globalRole === "cliente"
      ? request.auth.memberships.find((item) => item.clientAccountId === params.clientAccountId)?.portalAccessLevel ?? "approver"
      : "admin";
    return getPortalHome(app, params.clientAccountId, accessLevel);
  });

  app.get("/portal/accounts/:clientAccountId/board", async (request) => {
    const params = request.params as { clientAccountId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador", "cliente"]);
    const query = portalBoardQuerySchema.parse(request.query);
    const canUseSearch = request.auth?.user.globalRole !== "cliente";

    return getPortalBoard(app, params.clientAccountId, query, {
      canUseSearch,
    });
  });

  app.get("/portal/accounts/:clientAccountId/search", async (request) => {
    const params = request.params as { clientAccountId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador", "cliente"]);
    const permissions = await findClientPermissionsByAccountId(app.db, params.clientAccountId);
    if (!permissions?.allowClientSearch) {
      throw app.httpErrors.forbidden("A pesquisa não está habilitada para este cliente.");
    }
    const query = portalSearchQuerySchema.parse(request.query);
    const [activeCards, archivedCards] = await Promise.all([
      listCardsByClientAccountId(app.db, params.clientAccountId, { archived: false, search: query.q }),
      listCardsByClientAccountId(app.db, params.clientAccountId, { archived: true, search: query.q }),
    ]);
    const visibleActiveCards = activeCards.filter((card) => card.isBriefApproval || card.status.includes("Enviar para Cliente") || /(aprovad|revis[aã]o solicitada)/i.test(`${card.clientLabel} ${card.status.join(" ")}`));
    return { items: [...visibleActiveCards, ...archivedCards] };
  });

  app.get("/portal/accounts/:clientAccountId/cards/:cardId", async (request) => {
    const params = request.params as { clientAccountId: string; cardId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador", "cliente"]);

    return getPortalCardDetail(app, params.clientAccountId, params.cardId);
  });

  app.post("/portal/accounts/:clientAccountId/cards", async (request) => {
    const params = request.params as { clientAccountId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador", "cliente"]);
    assertPortalAccessLevel(request, params.clientAccountId, ["admin", "approver"]);
    const permissions = await findClientPermissionsByAccountId(app.db, params.clientAccountId);
    if (!permissions?.allowClientCreatePost) {
      throw app.httpErrors.forbidden("A criação de posts não está habilitada para este cliente.");
    }
    const input = createPortalPostSchema.parse(request.body);
    const mediaType = input.mediaUrls.some((url) => /\.(mp4|webm|mov)(\?.*)?$/i.test(url)) ? "video" : "image";
    const actor = request.auth!.user;
    const columns = await listColumnsByClientAccountId(app.db, params.clientAccountId);
    const selectedColumn = columns.find((column) => column.id === input.columnId);
    if (!selectedColumn) throw app.httpErrors.badRequest("Escolha uma coluna válida deste Kanban.");
    if (!selectedColumn.visibleToClient) await updateColumn(app.db, selectedColumn.id, { visibleToClient: true });
    const card = await createKanbanCard(app, params.clientAccountId, actor.id, {
        columnId: selectedColumn.id,
        title: input.title,
        caption: input.caption ?? null,
        mediaType,
        primaryMediaUrl: input.mediaUrls[0] ?? null,
        mediaUrls: input.mediaUrls,
        externalLinkUrl: input.externalLinkUrl ?? null,
        artType: input.artType,
        status: ["Enviar para Cliente", "Sugestão do cliente"],
        tags: [],
        hashtags: [],
        isBriefApproval: false,
        keepFiles: false,
        deadlineAt: null,
        scheduledAt: null,
        clientLabel: "Pendente",
        eventColor: null,
      });
    if (!card) throw app.httpErrors.badRequest("Não foi possível criar o post.");
    if (input.commentText) {
      await addCardComment(app, params.clientAccountId, card.id, {
        commentText: input.commentText,
        isInternal: false,
      }, {
        userId: actor.id,
        authorName: actor.fullName,
        authorRole: actor.globalRole,
        canCreateInternal: false,
      });
    }
    return { ok: true, card };
  });

  app.patch("/portal/accounts/:clientAccountId/cards/:cardId/caption", async (request) => {
    const params = request.params as { clientAccountId: string; cardId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador", "cliente"]);
    assertPortalAccessLevel(request, params.clientAccountId, ["admin", "approver"]);
    const permissions = await findClientPermissionsByAccountId(app.db, params.clientAccountId);
    if (!permissions?.allowClientEditCaption) {
      throw app.httpErrors.forbidden("A edição de legendas não está habilitada para este cliente.");
    }

    const input = updatePortalCardCaptionSchema.parse(request.body);
    const card = await findCardById(app.db, params.cardId);
    if (!card || card.clientAccountId !== params.clientAccountId) {
      throw app.httpErrors.notFound("Card não encontrado nesta conta.");
    }

    const actor = request.auth!.user;
    if ((card.caption ?? null) !== (input.caption ?? null)) {
      await recordCaptionVersion(app.db, { cardId: card.id, caption: card.caption, authorUserId: actor.id, authorName: actor.fullName, authorRole: actor.globalRole });
    }
    const updatedCard = await updateCard(app.db, params.cardId, { caption: input.caption });
    const captionFeedback = (input.caption ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    await addCardComment(app, params.clientAccountId, params.cardId, {
      commentText: captionFeedback ? `Nova legenda: ${captionFeedback.slice(0, 220)}` : "O cliente removeu o texto da legenda.",
      isInternal: false,
    }, {
      userId: actor.id,
      authorName: actor.fullName,
      authorRole: actor.globalRole,
      canCreateInternal: false,
    });

    return { ok: true, card: updatedCard };
  });

  app.get("/portal/accounts/:clientAccountId/tags", async (request) => {
    const params = request.params as { clientAccountId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador", "cliente"]);
    const permissions = await findClientPermissionsByAccountId(app.db, params.clientAccountId);
    if (!permissions?.allowClientCreateTags) {
      throw app.httpErrors.forbidden("O uso de etiquetas não está habilitado para este cliente.");
    }
    return { items: await listClientTags(app.db, params.clientAccountId) };
  });

  app.post("/portal/accounts/:clientAccountId/tags", async (request) => {
    const params = request.params as { clientAccountId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador", "cliente"]);
    assertPortalAccessLevel(request, params.clientAccountId, ["admin", "approver"]);
    const permissions = await findClientPermissionsByAccountId(app.db, params.clientAccountId);
    if (!permissions?.allowClientCreateTags) {
      throw app.httpErrors.forbidden("A criação de etiquetas não está habilitada para este cliente.");
    }
    const input = createClientTagSchema.parse(request.body);
    const existing = await listClientTags(app.db, params.clientAccountId);
    if (existing.some((tag) => tag.name.localeCompare(input.name.trim(), undefined, { sensitivity: "accent" }) === 0)) {
      throw app.httpErrors.badRequest(`A etiqueta “${input.name.trim()}” já existe nesta conta.`);
    }
    return { ok: true, tag: await createClientTag(app.db, params.clientAccountId, input) };
  });

  app.patch("/portal/accounts/:clientAccountId/cards/:cardId/tags", async (request) => {
    const params = request.params as { clientAccountId: string; cardId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador", "cliente"]);
    assertPortalAccessLevel(request, params.clientAccountId, ["admin", "approver"]);
    const permissions = await findClientPermissionsByAccountId(app.db, params.clientAccountId);
    if (!permissions?.allowClientCreateTags) {
      throw app.httpErrors.forbidden("O uso de etiquetas não está habilitado para este cliente.");
    }
    const input = updatePortalCardTagsSchema.parse(request.body);
    const card = await findCardById(app.db, params.cardId);
    if (!card || card.clientAccountId !== params.clientAccountId) {
      throw app.httpErrors.notFound("Card não encontrado nesta conta.");
    }
    const available = await listClientTags(app.db, params.clientAccountId);
    const selected = Array.from(new Set(input.tags));
    if (selected.some((name) => !available.some((tag) => tag.name === name))) {
      throw app.httpErrors.badRequest("Uma das etiquetas selecionadas não pertence a este cliente.");
    }
    const updatedCard = await updateCard(app.db, params.cardId, { tags: selected });
    const actor = request.auth!.user;
    await addCardComment(app, params.clientAccountId, params.cardId, {
      commentText: selected.length ? `Etiquetas atualizadas pelo cliente: ${selected.join(", ")}.` : "Etiquetas removidas pelo cliente.",
      isInternal: false,
    }, {
      userId: actor.id,
      authorName: actor.fullName,
      authorRole: actor.globalRole,
      canCreateInternal: false,
    });
    return { ok: true, card: updatedCard };
  });

  app.post("/portal/accounts/:clientAccountId/cards/:cardId/decision", async (request) => {
    const params = request.params as { clientAccountId: string; cardId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador", "cliente"]);
    assertPortalAccessLevel(request, params.clientAccountId, ["admin", "approver"]);
    const input = portalCardDecisionSchema.parse(request.body);
    const actor = request.auth!.user;
    const result = await decideCardApproval(app, params.clientAccountId, params.cardId, {
      userId: actor.id, name: actor.fullName, role: actor.globalRole,
    }, input);
    return { ok: true, card: result.card };
  });
};
