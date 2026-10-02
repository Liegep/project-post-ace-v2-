import { safeInsightsDiagnostics } from "./meta-insight-metrics.js";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { findClientAccountById } from "../clients/clients.repository.js";
import { findCardById } from "../cards/cards.repository.js";
import { clientMetaAssetsSchema, clientMetaPublicationsQuerySchema, createMetaPublicationSchema, createMetaPublishDestinationSchema, createMetaSavedLocationSchema, manageMetaPublicationsSchema, metaBestTimesQuerySchema, metaCallbackSchema, metaConnectQuerySchema, metaInsightsQuerySchema, metaPlaceSearchQuerySchema, metaPublicationsQuerySchema, rescheduleMetaPublicationsSchema, updateMetaPublishDestinationSchema, updateMetaSavedLocationSchema } from "./meta.schemas.js";
import { cancelScheduledPublication, cancelScheduledPublicationGroup, consumeMetaOAuthState, countActivePublicationsForDestination, createMetaPublishDestination, createMetaSavedLocation, deleteMetaPublishDestination, deleteMetaSavedLocation, findClientMetaAssets, findClientMetaInsightsContext, findDefaultMetaPublishDestination, findMetaPublishDestination, findMetaSavedLocation, findScheduledPublication, listGlobalScheduledPublications, listMetaPublishDestinations, listMetaSavedLocations, listScheduledPublicationsForClient, rescheduleScheduledPublications, updateMetaPublishDestination, updateMetaSavedLocation, upsertClientMetaAssets } from "./meta.repository.js";
import { archiveMetaCardIfPublicationGroupComplete, completeMetaAuthorization, createMetaAuthorizationUrl, getInstagramBestPublishingTimes, getMetaAdsInsights, getMetaExpiryDiagnostics, getMetaInsights, getMetaStatus, listMetaAdAccounts, listMetaAssets, scheduleMetaCardPublications, searchMetaPlaces } from "./meta.service.js";

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

function isDuplicateEntry(error: unknown) {
  return Boolean(error && typeof error === "object" && (error as { code?: string }).code === "ER_DUP_ENTRY");
}

function publicationResponse(publication: NonNullable<Awaited<ReturnType<typeof findScheduledPublication>>>) {
  return {
    id: publication.id,
    cardId: publication.cardId,
    destinationId: publication.destinationId,
    destinationName: publication.destinationName,
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
    cardTitle: publication.cardTitle,
  };
}

async function validateDestinationAssets(app: Parameters<typeof listMetaAssets>[0], userId: string, input: { facebookPageId?: string | null; facebookPageName?: string | null; instagramAccountId?: string | null; instagramUsername?: string | null }) {
  const available = await listMetaAssets(app, userId);
  const page = input.facebookPageId ? available.pages.find((item) => item.id === input.facebookPageId) : null;
  if (input.facebookPageId && (!page || page.name !== input.facebookPageName)) {
    throw app.httpErrors.badRequest("A Página selecionada não está disponível na conexão Meta.");
  }
  const instagramPage = input.instagramAccountId
    ? available.pages.find((item) => item.instagramAccount?.id === input.instagramAccountId && item.instagramAccount?.username === input.instagramUsername)
    : null;
  if (input.instagramAccountId && !instagramPage) {
    throw app.httpErrors.badRequest("A conta do Instagram não está disponível na conexão Meta.");
  }
  if (page && input.instagramAccountId && page.instagramAccount?.id !== input.instagramAccountId) {
    throw app.httpErrors.badRequest("A conta do Instagram não pertence à Página selecionada.");
  }
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

  app.get("/meta/status/debug", async (request) => {
    const auth = assertSuperAdmin(request);
    return getMetaExpiryDiagnostics(app, auth.user.id);
  });

  app.get("/meta/assets", async (request) => {
    const auth = assertSuperAdmin(request);
    return listMetaAssets(app, auth.user.id);
  });

  app.get("/meta/ad-accounts", async (request) => {
    const auth = assertSuperAdmin(request);
    return listMetaAdAccounts(app, auth.user.id);
  });

  app.get("/meta/saved-locations", async (request) => {
    assertSuperAdmin(request);
    return { locations: await listMetaSavedLocations(app.db) };
  });

  app.post("/meta/saved-locations", async (request, reply) => {
    assertSuperAdmin(request);
    const parsed = createMetaSavedLocationSchema.safeParse(request.body);
    if (!parsed.success) throw app.httpErrors.badRequest(parsed.error.issues[0]?.message ?? "Localização inválida.");
    try {
      const location = await createMetaSavedLocation(app.db, parsed.data);
      return reply.code(201).send({ location });
    } catch (error) {
      if (isDuplicateEntry(error)) throw app.httpErrors.conflict("Este Meta Place ID já está salvo.");
      throw error;
    }
  });

  app.patch("/meta/saved-locations/:id", async (request) => {
    assertSuperAdmin(request);
    const { id } = request.params as { id: string };
    if (!await findMetaSavedLocation(app.db, id)) throw app.httpErrors.notFound("Localização salva não encontrada.");
    const parsed = updateMetaSavedLocationSchema.safeParse(request.body);
    if (!parsed.success) throw app.httpErrors.badRequest(parsed.error.issues[0]?.message ?? "Localização inválida.");
    try {
      const location = await updateMetaSavedLocation(app.db, id, parsed.data);
      if (!location) throw app.httpErrors.notFound("Localização salva não encontrada.");
      return { location };
    } catch (error) {
      if (isDuplicateEntry(error)) throw app.httpErrors.conflict("Este Meta Place ID já está salvo.");
      throw error;
    }
  });

  app.delete("/meta/saved-locations/:id", async (request) => {
    assertSuperAdmin(request);
    const { id } = request.params as { id: string };
    if (!await deleteMetaSavedLocation(app.db, id)) throw app.httpErrors.notFound("Localização salva não encontrada.");
    return { ok: true };
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

  app.get("/clients/:clientAccountId/meta-destinations", async (request) => {
    assertSuperAdmin(request);
    const { clientAccountId } = request.params as { clientAccountId: string };
    if (!await findClientAccountById(app.db, clientAccountId)) throw app.httpErrors.notFound("Cliente não encontrado.");
    return { destinations: await listMetaPublishDestinations(app.db, clientAccountId) };
  });

  app.post("/clients/:clientAccountId/meta-destinations", async (request, reply) => {
    const auth = assertSuperAdmin(request);
    const { clientAccountId } = request.params as { clientAccountId: string };
    if (!await findClientAccountById(app.db, clientAccountId)) throw app.httpErrors.notFound("Cliente não encontrado.");
    const parsed = createMetaPublishDestinationSchema.safeParse(request.body);
    if (!parsed.success) throw app.httpErrors.badRequest(parsed.error.issues[0]?.message ?? "Destino Meta inválido.");
    await validateDestinationAssets(app, auth.user.id, parsed.data);
    try {
      const destination = await createMetaPublishDestination(app.db, clientAccountId, parsed.data);
      return reply.code(201).send({ destination });
    } catch (error) {
      if (isDuplicateEntry(error)) throw app.httpErrors.conflict("Já existe um destino Meta com esse nome para o cliente.");
      throw error;
    }
  });

  app.patch("/clients/:clientAccountId/meta-destinations/:destinationId", async (request) => {
    const auth = assertSuperAdmin(request);
    const { clientAccountId, destinationId } = request.params as { clientAccountId: string; destinationId: string };
    if (!await findClientAccountById(app.db, clientAccountId)) throw app.httpErrors.notFound("Cliente não encontrado.");
    const current = await findMetaPublishDestination(app.db, destinationId, clientAccountId);
    if (!current) throw app.httpErrors.notFound("Destino Meta não encontrado.");
    const patch = updateMetaPublishDestinationSchema.safeParse(request.body);
    if (!patch.success) throw app.httpErrors.badRequest(patch.error.issues[0]?.message ?? "Destino Meta inválido.");
    const merged = createMetaPublishDestinationSchema.safeParse({ ...current, ...patch.data });
    if (!merged.success) throw app.httpErrors.badRequest(merged.error.issues[0]?.message ?? "Destino Meta inválido.");
    await validateDestinationAssets(app, auth.user.id, merged.data);
    try {
      const destination = await updateMetaPublishDestination(app.db, clientAccountId, destinationId, patch.data);
      if (!destination) throw app.httpErrors.notFound("Destino Meta não encontrado.");
      return { destination };
    } catch (error) {
      if (isDuplicateEntry(error)) throw app.httpErrors.conflict("Já existe um destino Meta com esse nome para o cliente.");
      throw error;
    }
  });

  app.delete("/clients/:clientAccountId/meta-destinations/:destinationId", async (request) => {
    assertSuperAdmin(request);
    const { clientAccountId, destinationId } = request.params as { clientAccountId: string; destinationId: string };
    if (!await findClientAccountById(app.db, clientAccountId)) throw app.httpErrors.notFound("Cliente não encontrado.");
    if (!await findMetaPublishDestination(app.db, destinationId, clientAccountId)) throw app.httpErrors.notFound("Destino Meta não encontrado.");
    if (await countActivePublicationsForDestination(app.db, clientAccountId, destinationId) > 0) {
      throw app.httpErrors.conflict("Este destino possui publicações agendadas ou pendentes e não pode ser removido.");
    }
    await deleteMetaPublishDestination(app.db, clientAccountId, destinationId);
    return { ok: true };
  });

  app.get("/clients/:clientAccountId/meta-best-times", async (request) => {
    const auth = assertSuperAdmin(request);
    const query = metaBestTimesQuerySchema.safeParse(request.query);
    if (!query.success) throw app.httpErrors.badRequest(query.error.issues[0]?.message ?? "Timezone inválido.");
    const { clientAccountId } = request.params as { clientAccountId: string };
    if (!await findClientAccountById(app.db, clientAccountId)) throw app.httpErrors.notFound("Cliente não encontrado.");
    const destination = query.data.destinationId
      ? await findMetaPublishDestination(app.db, query.data.destinationId, clientAccountId)
      : await findDefaultMetaPublishDestination(app.db, clientAccountId);
    if (query.data.destinationId && !destination) throw app.httpErrors.notFound("Destino Meta não encontrado para este cliente.");
    const instagramAccountId = destination?.instagramAccountId ?? (!query.data.destinationId ? (await findClientMetaAssets(app.db, clientAccountId))?.instagramAccountId : null);
    if (!instagramAccountId) {
      return { available: false, source: "instagram_online_followers", sourceTimeZone: "UTC-07:00", timeZone: query.data.timeZone, recommendations: [], message: "O cliente não possui Instagram profissional vinculado." };
    }
    const startedAt = Date.now();
    request.log.info({ timeZone: query.data.timeZone }, "Meta best publishing times request started");
    try {
      const result = await getInstagramBestPublishingTimes(app, auth.user.id, instagramAccountId, query.data.timeZone);
      request.log.info({ durationMs: Date.now() - startedAt, available: result.available, recommendationCount: result.recommendations.length, timeZone: query.data.timeZone }, "Meta best publishing times request completed");
      return result;
    } catch (error) {
      request.log.error({ err: error, durationMs: Date.now() - startedAt }, "Meta best publishing times request failed");
      return { available: false, source: "instagram_online_followers", sourceTimeZone: "UTC-07:00", timeZone: query.data.timeZone, recommendations: [], message: "Os melhores horários estão temporariamente indisponíveis." };
    }
  });

  app.get("/meta/insights/debug", async (request) => {
    const auth = assertSuperAdmin(request);
    const query = request.query as Record<string, unknown>;
    const clientAccountId = typeof query.clientAccountId === "string" ? query.clientAccountId : "";
    const parsed = metaInsightsQuerySchema.safeParse(query);
    if (!clientAccountId || !parsed.success) throw app.httpErrors.badRequest("Informe cliente e período válidos.");
    if (!await findClientAccountById(app.db, clientAccountId)) throw app.httpErrors.notFound("Cliente não encontrado.");
    const context = await findClientMetaInsightsContext(app.db, clientAccountId, parsed.data.destinationId);
    if (!context) throw app.httpErrors.notFound("Destino Meta não encontrado para este cliente.");
    const result = await getMetaInsights(app, auth.user.id, context.assets, { since: parsed.data.since, until: parsed.data.until });
    return { version: "v26.0", period: result.period, metrics: safeInsightsDiagnostics(result) };
  });

  app.get("/clients/:clientAccountId/meta-insights", async (request) => {
    const auth = assertSuperAdmin(request);
    const { clientAccountId } = request.params as { clientAccountId: string };
    if (!await findClientAccountById(app.db, clientAccountId)) throw app.httpErrors.notFound("Cliente não encontrado.");
    const parsed = metaInsightsQuerySchema.safeParse(request.query);
    if (!parsed.success) throw app.httpErrors.badRequest(parsed.error.issues[0]?.message ?? "Período inválido.");
    const context = await findClientMetaInsightsContext(app.db, clientAccountId, parsed.data.destinationId);
    if (parsed.data.destinationId && !context) throw app.httpErrors.notFound("Destino Meta não encontrado para este cliente.");
    const assets = context?.assets;
    if (!assets || (!assets.facebookPageId && !assets.instagramAccountId)) {
      throw app.httpErrors.badRequest("O cliente ainda não possui ativos Meta vinculados.");
    }
    const startedAt = Date.now();
    request.log.info({ clientAccountId, since: parsed.data.since, until: parsed.data.until, hasInstagram: Boolean(assets.instagramAccountId), hasFacebook: Boolean(assets.facebookPageId) }, "Meta Insights import started");
    try {
      const result = await getMetaInsights(app, auth.user.id, assets, { since: parsed.data.since, until: parsed.data.until });
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
      }, { since: parsed.data.since, until: parsed.data.until });
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
    const parsed = clientMetaPublicationsQuerySchema.safeParse(request.query);
    if (!parsed.success) throw app.httpErrors.badRequest(parsed.error.issues[0]?.message ?? "Período inválido.");
    const publications = await listScheduledPublicationsForClient(app.db, clientAccountId, parsed.data);
    return { publications: publications.map(publicationResponse) };
  });

  app.post("/clients/:clientAccountId/meta-publications", async (request, reply) => {
    const auth = assertSuperAdmin(request);
    const { clientAccountId } = request.params as { clientAccountId: string };
    if (!await findClientAccountById(app.db, clientAccountId)) throw app.httpErrors.notFound("Cliente não encontrado.");
    const parsed = createMetaPublicationSchema.safeParse(request.body);
    if (!parsed.success) throw app.httpErrors.badRequest(parsed.error.issues[0]?.message ?? "Agendamento inválido.");
    const destination = parsed.data.destinationId
      ? await findMetaPublishDestination(app.db, parsed.data.destinationId, clientAccountId)
      : await findDefaultMetaPublishDestination(app.db, clientAccountId);
    if (parsed.data.destinationId && !destination) throw app.httpErrors.badRequest("O destino Meta selecionado não pertence a este cliente.");
    const assets = destination ?? await findClientMetaAssets(app.db, clientAccountId);
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
      actor: { id: auth.user.id, fullName: auth.user.fullName, globalRole: auth.user.globalRole },
      clientAccountId,
      destinationId: destination?.id ?? null,
      destinationName: destination?.name ?? null,
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
