import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { findClientAccountById } from "../clients/clients.repository.js";
import { clientMetaAssetsSchema, metaCallbackSchema, metaConnectQuerySchema } from "./meta.schemas.js";
import { consumeMetaOAuthState, findClientMetaAssets, upsertClientMetaAssets } from "./meta.repository.js";
import { completeMetaAuthorization, createMetaAuthorizationUrl, getMetaStatus, listMetaAssets } from "./meta.service.js";

function assertSuperAdmin(request: FastifyRequest) {
  if (!request.auth) throw request.server.httpErrors.unauthorized("Sessão obrigatória.");
  if (request.auth.user.globalRole !== "super_admin") {
    throw request.server.httpErrors.forbidden("Somente o super admin pode gerenciar a integração Meta.");
  }
  return request.auth;
}

function callbackLocation(appUrl: string, returnPath: string, status: "connected" | "error") {
  const base = appUrl.replace(/\/$/, "");
  const separator = returnPath.includes("?") ? "&" : "?";
  return `${base}/${returnPath}${separator}meta=${status}`;
}

export const metaRoutes: FastifyPluginAsync = async (app) => {
  app.get("/meta/connect", async (request) => {
    const auth = assertSuperAdmin(request);
    const parsed = metaConnectQuerySchema.safeParse(request.query);
    if (!parsed.success) throw app.httpErrors.badRequest("Destino de retorno inválido.");
    const authorizationUrl = await createMetaAuthorizationUrl(app, auth.user.id, parsed.data.returnTo ?? "#/dashboard");
    return { authorizationUrl };
  });

  app.get("/meta/callback", async (request, reply) => {
    const parsed = metaCallbackSchema.safeParse(request.query);
    if (!parsed.success) throw app.httpErrors.badRequest("Retorno OAuth inválido.");
    const state = await consumeMetaOAuthState(app.db, parsed.data.state);
    if (!state) throw app.httpErrors.badRequest("O estado OAuth é inválido ou expirou.");
    if (parsed.data.error || !parsed.data.code) {
      return reply.redirect(callbackLocation(app.appEnv.APP_URL, state.returnPath, "error"));
    }
    try {
      await completeMetaAuthorization(app, { code: parsed.data.code, userId: state.userId });
      return reply.redirect(callbackLocation(app.appEnv.APP_URL, state.returnPath, "connected"));
    } catch {
      app.log.error("Meta OAuth callback failed");
      return reply.redirect(callbackLocation(app.appEnv.APP_URL, state.returnPath, "error"));
    }
  });

  app.get("/meta/status", async (request) => {
    const auth = assertSuperAdmin(request);
    return getMetaStatus(app, auth.user.id);
  });

  app.get("/meta/assets", async (request) => {
    const auth = assertSuperAdmin(request);
    return listMetaAssets(app, auth.user.id);
  });

  app.get("/clients/:clientAccountId/meta-assets", async (request) => {
    assertSuperAdmin(request);
    const { clientAccountId } = request.params as { clientAccountId: string };
    if (!await findClientAccountById(app.db, clientAccountId)) throw app.httpErrors.notFound("Cliente não encontrado.");
    return { assets: await findClientMetaAssets(app.db, clientAccountId) };
  });

  app.put("/clients/:clientAccountId/meta-assets", async (request) => {
    const auth = assertSuperAdmin(request);
    const { clientAccountId } = request.params as { clientAccountId: string };
    if (!await findClientAccountById(app.db, clientAccountId)) throw app.httpErrors.notFound("Cliente não encontrado.");
    const parsed = clientMetaAssetsSchema.safeParse(request.body);
    if (!parsed.success) throw app.httpErrors.badRequest(parsed.error.issues[0]?.message ?? "Ativos Meta inválidos.");
    const available = await listMetaAssets(app, auth.user.id);
    const page = parsed.data.facebookPageId ? available.pages.find((item) => item.id === parsed.data.facebookPageId) : null;
    if (parsed.data.facebookPageId && (!page || page.name !== parsed.data.facebookPageName)) {
      throw app.httpErrors.badRequest("A Página selecionada não está disponível na conexão Meta.");
    }
    if (parsed.data.instagramAccountId && (
      page?.instagramAccount?.id !== parsed.data.instagramAccountId ||
      page.instagramAccount.username !== parsed.data.instagramUsername
    )) {
      throw app.httpErrors.badRequest("A conta do Instagram não pertence à Página selecionada.");
    }
    return { assets: await upsertClientMetaAssets(app.db, clientAccountId, parsed.data) };
  });
};
