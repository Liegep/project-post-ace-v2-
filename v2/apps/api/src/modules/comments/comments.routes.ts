import type { FastifyPluginAsync } from "fastify";
import { assertClientAccess, assertInternalAccess, assertPortalAccessLevel } from "../auth/auth.access.js";
import { createCommentSchema } from "./comments.schemas.js";
import { addCardComment, getCardComments } from "./comments.service.js";

export const commentRoutes: FastifyPluginAsync = async (app) => {
  app.get("/clients/:clientAccountId/cards/:cardId/comments", async (request) => {
    assertInternalAccess(request);

    const params = request.params as { clientAccountId: string; cardId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador"]);

    return getCardComments(app, params.clientAccountId, params.cardId, {
      includeInternal: true,
    });
  });

  app.post("/clients/:clientAccountId/cards/:cardId/comments", async (request) => {
    assertInternalAccess(request);

    const params = request.params as { clientAccountId: string; cardId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador"]);
    const input = createCommentSchema.parse(request.body);
    const actor = request.auth!.user;

    return {
      ok: true,
      comment: await addCardComment(app, params.clientAccountId, params.cardId, {
        ...input,
        // Comments created from the administrative workspace are always internal.
        // They must never be exposed in the client portal.
        isInternal: true,
      }, {
        userId: actor.id,
        authorName: actor.fullName,
        authorRole: actor.globalRole,
        canCreateInternal: true,
      }),
    };
  });

  app.get("/portal/accounts/:clientAccountId/cards/:cardId/comments", async (request) => {
    const params = request.params as { clientAccountId: string; cardId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador", "cliente"]);

    return getCardComments(app, params.clientAccountId, params.cardId, {
      includeInternal: false,
    });
  });

  app.post("/portal/accounts/:clientAccountId/cards/:cardId/comments", async (request) => {
    const params = request.params as { clientAccountId: string; cardId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador", "cliente"]);
    assertPortalAccessLevel(request, params.clientAccountId, ["admin", "approver"]);
    const input = createCommentSchema.parse(request.body);
    const actor = request.auth!.user;
    const isAdministrativeAuthor = actor.globalRole !== "cliente";

    return {
      ok: true,
      comment: await addCardComment(app, params.clientAccountId, params.cardId, {
        ...input,
        // Even when an administrator opens the portal view, their comment remains
        // internal. Only client-authored portal comments are client-visible.
        isInternal: isAdministrativeAuthor ? true : false,
      }, {
        userId: actor.id,
        authorName: actor.fullName,
        authorRole: actor.globalRole,
        canCreateInternal: isAdministrativeAuthor,
      }),
    };
  });
};
