import type { FastifyPluginAsync } from "fastify";
import { assertClientAccess, assertInternalAccess } from "../auth/auth.access.js";
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
      comment: await addCardComment(app, params.clientAccountId, params.cardId, input, {
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
    const input = createCommentSchema.parse(request.body);
    const actor = request.auth!.user;

    return {
      ok: true,
      comment: await addCardComment(app, params.clientAccountId, params.cardId, input, {
        userId: actor.id,
        authorName: actor.fullName,
        authorRole: actor.globalRole,
        canCreateInternal: actor.globalRole !== "cliente",
      }),
    };
  });
};
