import type { FastifyPluginAsync } from "fastify";
import { assertClientAccess, assertInternalAccess } from "../auth/auth.access.js";
import {
  createApprovalLinkSchema,
  submitApprovalDecisionSchema,
} from "./approvals.schemas.js";
import {
  createCardApprovalLink,
  getCardApprovalHistory,
  getPublicApprovalView,
  submitPublicApprovalDecision,
} from "./approvals.service.js";

export const approvalRoutes: FastifyPluginAsync = async (app) => {
  app.get("/clients/:clientAccountId/cards/:cardId/approval-links", async (request) => {
    assertInternalAccess(request);

    const params = request.params as { clientAccountId: string; cardId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador"]);

    return getCardApprovalHistory(app, params.clientAccountId, params.cardId);
  });

  app.post("/clients/:clientAccountId/cards/:cardId/approval-links", async (request) => {
    assertInternalAccess(request);

    const params = request.params as { clientAccountId: string; cardId: string };
    assertClientAccess(request, params.clientAccountId, ["admin", "colaborador"]);
    const input = createApprovalLinkSchema.parse(request.body);

    return {
      ok: true,
      approvalLink: await createCardApprovalLink(
        app,
        params.clientAccountId,
        params.cardId,
        request.auth!.user.id,
        input,
      ),
    };
  });

  app.get("/portal/approval/:token", async (request) => {
    const params = request.params as { token: string };
    return getPublicApprovalView(app, params.token);
  });

  app.post("/portal/approval/:token/decision", async (request) => {
    const params = request.params as { token: string };
    const input = submitApprovalDecisionSchema.parse(request.body);

    return {
      ok: true,
      result: await submitPublicApprovalDecision(app, params.token, input),
    };
  });
};
