import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { findClientAccountById } from "../clients/clients.repository.js";
import { findCardById } from "../cards/cards.repository.js";
import { clientMetaAssetsSchema, createMetaPublicationSchema, manageMetaPublicationsSchema, metaCallbackSchema, metaConnectQuerySchema, metaInsightsQuerySchema, metaPlaceSearchQuerySchema, metaPublicationsQuerySchema, rescheduleMetaPublicationsSchema } from "./meta.schemas.js";
import { cancelScheduledPublication, cancelScheduledPublicationGroup, consumeMetaOAuthState, findClientMetaAssets, findScheduledPublication, listGlobalScheduledPublications, listScheduledPublicationsForClient, rescheduleScheduledPublications, upsertClientMetaAssets } from "./meta.repository.js";
import { archiveMetaCardIfPublicationGroupComplete, completeMetaAuthorization, createMetaAuthorizationUrl, getMetaAdsInsights, getMetaInsights, getMetaStatus, listMetaAdAccounts, listMetaAssets, scheduleMetaCardPublications, searchMetaPlaces } from "./meta.service.js";

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

function publicationResponse(publication: NonNullable<Awaited<ReturnType<typeof findScheduledPublication>>>) {
  return {
    id: publication.id,
    cardId: publication.cardId,
    platform: publication.platform,
    scheduledAt: publication.scheduledAt,
    timezone: publication.timezone,
    reelCoverUrl: publication.reelCoverUrl,
    locationId: publication.locationId,
    locationName: publication.locationName,
    caption: publication.caption,
    mediaUrl: publication.mediaUrl,
    mediaUrls: publication.mediaUrls,
    mediaType: publication.mediaType,
    instagramUserTags: publication.instagramUserTags,
    status: publication.status,
    attemptCount: publication.attemptCount,
    publishedMetaId: publication.publishedMetaId,
    publishedPermalink: publication.publishedPermalink,
    lastError: publication.lastError,
    createdAt: publication.createdAt,
    updatedAt: publication.updatedAt,
    publishedAt: publication.publishedAt,
  };
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

  app.get("/meta/ad-accounts", async (request) => {
    const auth = assertSuperAdmin(request);
    return listMetaAdAccounts(app, auth.user.id);
  });

  app.get("/meta/places/search", async (request) => {
    const auth = assertSuperAdmin(request);
    const parsed = metaPlaceSearchQuerySchema.safeParse(request.query);
    if (!parsed.success) throw app.httpErrors.badRequest(parsed.error.issues[0]?.message ?? "Busca inválida.");
    if (parsed.data.q.length < 3) return { places: [] };
    return { places: await searchMetaPlaces(app, auth.user.id, parsed.data.q) };
  });

  app.get("/meta/publications", async (request) => {
    assertSuperAdmin(request);
    const parsed = metaPublicationsQuerySchema.safeParse(request.query);
    if (!parsed.success) throw app.httpErrors.badRequest(parsed.error.issues[0]?.message ?? "Filtros inválidos.");
    const result = await listGlobalScheduledPublications(app.db, parsed.data);
    return { total: result.total, summary: result.summary, publications: result.items.map((publication) => ({
      ...publicationResponse(publication),
      clientAccountId: publication.clientAccountId,
      clientName: publication.clientName,
      clientSlug: publication.clientSlug,
      cardTitle: publication.cardTitle,
    })) };
  });

  app.patch("/meta/publications/reschedule", async (request) => {
    assertSuperAdmin(request);
    const parsed = rescheduleMetaPublicationsSchema.safeParse(request.body);
    if (!parsed.success) throw app.httpErrors.badRequest(parsed.error.issues[0]?.message ?? "Reagendamento inválido.");
    if (!await rescheduleScheduledPublications(app.db, parsed.data)) {
      throw app.httpErrors.conflict("Somente publicações ainda agendadas podem ser reagendadas.");
    }
    const publications = await Promise.all(parsed.data.publicationIds.map((id) => findScheduledPublication(app.db, id)));
    return { publications: publications.filter((item): item is NonNullable<typeof item> => Boolean(item)).map(publicationResponse) };
  });

  app.post("/meta/publications/cancel", async (request) => {
    assertSuperAdmin(request);
    const parsed = manageMetaPublicationsSchema.safeParse(request.body);
    if (!parsed.success) throw app.httpErrors.badRequest(parsed.error.issues[0]?.message ?? "Cancelamento inválido.");
    const previous = await cancelScheduledPublicationGroup(app.db, parsed.data.publicationIds);
    if (!previous) throw app.httpErrors.conflict("Somente publicações agendadas ou com falha podem ser canceladas.");
    for (const publication of previous) {
      try {
        await archiveMetaCardIfPublicationGroupComplete(app, publication);
      } catch (error) {
        request.log.error({ err: error, publicationId: publication.id, cardId: publication.cardId }, "Meta card could not be archived after group cancellation");
      }
    }
    const publications = await Promise.all(parsed.data.publicationIds.map((id) => findScheduledPublication(app.db, id)));
    return { publications: publications.filter((item): item is NonNullable<typeof item> => Boolean(item)).map(publicationResponse) };
  });

  app.get("/clients/:clientAccountId/meta-assets", async (request) => {
    assertSuperAdmin(request);
    const { clientAccountId } = request.params as { clientAccountId: string };
    if (!await findClientAccountById(app.db, clientAccountId)) throw app.httpErrors.notFound("Cliente não encontrado.");
    return { assets: await findClientMetaAssets(app.db, clientAccountId) };
  });

  app.get("/clients/:clientAccountId/meta-insights", async (request) => {
    const auth = assertSuperAdmin(request);
    const { clientAccountId } = request.params as { clientAccountId: string };
    if (!await findClientAccountById(app.db, clientAccountId)) throw app.httpErrors.notFound("Cliente não encontrado.");
    const parsed = metaInsightsQuerySchema.safeParse(request.query);
    if (!parsed.success) throw app.httpErrors.badRequest(parsed.error.issues[0]?.message ?? "Período inválido.");
    const assets = await findClientMetaAssets(app.db, clientAccountId);
    if (!assets || (!assets.facebookPageId && !assets.instagramAccountId)) {
      throw app.httpErrors.badRequest("O cliente ainda não possui ativos Meta vinculados.");
    }
    const startedAt = Date.now();
    request.log.info({ clientAccountId, since: parsed.data.since, until: parsed.data.until, hasInstagram: Boolean(assets.instagramAccountId), hasFacebook: Boolean(assets.facebookPageId) }, "Meta Insights import started");
    try {
      const result = await getMetaInsights(app, auth.user.id, assets, parsed.data);
      request.log.info({ clientAccountId, durationMs: Date.now() - startedAt, status: result.status, sources: result.sources, warningCount: result.warnings.length }, "Meta Insights import completed");
      return result;
    } catch (error) {
      request.log.error({ err: error, clientAccountId, durationMs: Date.now() - startedAt }, "Meta Insights import failed");
      throw error;
    }
  });

  app.get("/clients/:clientAccountId/meta-ads-insights", async (request) => {
    const auth = assertSuperAdmin(request);
    const { clientAccountId } = request.params as { clientAccountId: string };
    if (!await findClientAccountById(app.db, clientAccountId)) throw app.httpErrors.notFound("Cliente não encontrado.");
    const parsed = metaInsightsQuerySchema.safeParse(request.query);
    if (!parsed.success) throw app.httpErrors.badRequest(parsed.error.issues[0]?.message ?? "Período inválido.");
    const assets = await findClientMetaAssets(app.db, clientAccountId);
    if (!assets?.metaAdAccountId) {
      throw app.httpErrors.badRequest("O cliente ainda não possui uma Conta de anúncios Meta vinculada.");
    }
    const startedAt = Date.now();
    request.log.info({ clientAccountId, since: parsed.data.since, until: parsed.data.until, adAccountId: assets.metaAdAccountId }, "Meta Ads Insights request started");
    try {
      const result = await getMetaAdsInsights(app, auth.user.id, {
        metaAdAccountId: assets.metaAdAccountId,
        metaAdAccountName: assets.metaAdAccountName,
      }, parsed.data);
      request.log.info({ clientAccountId, durationMs: Date.now() - startedAt, campaignCount: result.campaigns.length, adCount: result.topAds.length, warningCount: result.warnings.length }, "Meta Ads Insights request completed");
      return result;
    } catch (error) {
      request.log.error({ err: error, clientAccountId, durationMs: Date.now() - startedAt }, "Meta Ads Insights request failed");
      throw error;
    }
  });

  app.get("/clients/:clientAccountId/meta-publications", async (request) => {
    assertSuperAdmin(request);
    const { clientAccountId } = request.params as { clientAccountId: string };
    if (!await findClientAccountById(app.db, clientAccountId)) throw app.httpErrors.notFound("Cliente não encontrado.");
    const publications = await listScheduledPublicationsForClient(app.db, clientAccountId);
    return { publications: publications.map(publicationResponse) };
  });

  app.post("/clients/:clientAccountId/meta-publications", async (request, reply) => {
    const auth = assertSuperAdmin(request);
    const { clientAccountId } = request.params as { clientAccountId: string };
    if (!await findClientAccountById(app.db, clientAccountId)) throw app.httpErrors.notFound("Cliente não encontrado.");
    const parsed = createMetaPublicationSchema.safeParse(request.body);
    if (!parsed.success) throw app.httpErrors.badRequest(parsed.error.issues[0]?.message ?? "Agendamento inválido.");
    const assets = await findClientMetaAssets(app.db, clientAccountId);
    const platforms = parsed.data.platforms.map((platform) => ({
      platform,
      metaAssetId: platform === "instagram" ? assets?.instagramAccountId : assets?.facebookPageId,
    }));
    const unavailable = platforms.find((item) => !item.metaAssetId)?.platform;
    if (unavailable) throw app.httpErrors.badRequest(unavailable === "instagram"
      ? "Vincule uma conta do Instagram a este cliente antes de agendar."
      : "Vincule uma Página do Facebook a este cliente antes de agendar.");
    const card = await findCardById(app.db, parsed.data.cardId);
    if (!card) throw app.httpErrors.notFound("Card não encontrado.");
    const results = await scheduleMetaCardPublications(app, {
      userId: auth.user.id,
      clientAccountId,
      platforms: platforms.map((item) => ({ platform: item.platform, metaAssetId: item.metaAssetId! })),
      card,
      scheduledAt: parsed.data.scheduledAt,
      timezone: parsed.data.timezone,
      publicationFormat: parsed.data.publicationFormat,
      reelCoverUrl: parsed.data.reelCoverUrl,
      locationId: parsed.data.locationId,
      locationName: parsed.data.locationName,
      instagramUserTags: parsed.data.instagramUserTags,
    });
    if (results.some((result) => !result.publication)) throw new Error("O agendamento foi salvo, mas não pôde ser carregado.");
    const publications = results.map((result) => publicationResponse(result.publication));
    return reply.code(results.some((result) => result.created) ? 201 : 200).send({
      publications,
      publication: publications[0],
      created: results.some((result) => result.created),
    });
  });

  app.post("/clients/:clientAccountId/meta-publications/:publicationId/cancel", async (request) => {
    assertSuperAdmin(request);
    const { clientAccountId, publicationId } = request.params as { clientAccountId: string; publicationId: string };
    if (!await findClientAccountById(app.db, clientAccountId)) throw app.httpErrors.notFound("Cliente não encontrado.");
    const publication = await findScheduledPublication(app.db, publicationId, clientAccountId);
    if (!publication) throw app.httpErrors.notFound("Agendamento Meta não encontrado.");
    if (!(["scheduled", "failed"] as const).includes(publication.status as "scheduled" | "failed")) {
      throw app.httpErrors.badRequest("Somente publicações agendadas ou com falha podem ser canceladas.");
    }
    if (!await cancelScheduledPublication(app.db, publicationId, clientAccountId)) {
      throw app.httpErrors.conflict("O status da publicação mudou. Atualize a tela e tente novamente.");
    }
    const cancelled = await findScheduledPublication(app.db, publicationId, clientAccountId);
    if (!cancelled) throw app.httpErrors.notFound("Agendamento Meta não encontrado.");
    try {
      await archiveMetaCardIfPublicationGroupComplete(app, cancelled);
    } catch (error) {
      request.log.error({ err: error, publicationId, cardId: cancelled.cardId }, "Meta card could not be archived after sibling publication cancellation");
    }
    return { publication: publicationResponse(cancelled) };
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
    if (parsed.data.metaAdAccountId) {
      const availableAdAccounts = await listMetaAdAccounts(app, auth.user.id);
      if (availableAdAccounts.error) throw app.httpErrors.badRequest(availableAdAccounts.error.message);
      const adAccount = availableAdAccounts.adAccounts.find((item) => item.id === parsed.data.metaAdAccountId);
      const adAccountName = adAccount ? (adAccount.name ?? adAccount.account_id ?? adAccount.id) : null;
      if (!adAccount || adAccountName !== parsed.data.metaAdAccountName) {
        throw app.httpErrors.badRequest("A Conta de anúncios selecionada não está disponível na conexão Meta.");
      }
    }
    return { assets: await upsertClientMetaAssets(app.db, clientAccountId, parsed.data) };
  });
};
