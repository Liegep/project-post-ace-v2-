import type { FastifyPluginAsync } from "fastify";
import { assertClientAccess } from "../auth/auth.access.js";
import { getPortalCardDetail } from "../cards/card-detail.service.js";
import { portalBoardQuerySchema } from "./portal.schemas.js";
import { getPortalBoard, getPortalHome } from "./portal.service.js";

export const portalRoutes: FastifyPluginAsync = async (app) => {
  app.get("/portal/accounts/:clientAccountId/home", async (request) => {
    const params = request.params as { clientAccountId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador", "cliente"]);

    return getPortalHome(app, params.clientAccountId);
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

  app.get("/portal/accounts/:clientAccountId/cards/:cardId", async (request) => {
    const params = request.params as { clientAccountId: string; cardId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador", "cliente"]);

    return getPortalCardDetail(app, params.clientAccountId, params.cardId);
  });
};
