import crypto from "node:crypto";
import net from "node:net";
import type { FastifyInstance } from "fastify";
import {
  createScheduledPublication,
  findClientMetaAssets,
  findMetaConnection,
  listDueScheduledPublications,
  markPublicationFailed,
  markPublicationPublished,
  markPublicationPublishing,
  saveMetaOAuthState,
  upsertMetaConnection,
} from "./meta.repository.js";
import type { MetaInsightsPeriod } from "./meta.schemas.js";

const GRAPH_VERSION = "v26.0";
const META_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_read_user_content",
  "instagram_basic",
  "instagram_manage_insights",
  "business_management",
  "ads_read",
  "instagram_content_publish",
];

type MetaTokenResponse = { access_token?: string; token_type?: string; expires_in?: number; error?: { message?: string } };
type MetaProfileResponse = { id?: string; name?: string; error?: { message?: string } };
type MetaAccountsResponse = {
  data?: Array<{ id?: string; name?: string; instagram_business_account?: { id?: string; username?: string } | null }>;
  paging?: { next?: string };
  error?: { message?: string };
};

type MetaAdAccount = {
  id?: string;
  account_id?: string;
  name?: string;
  account_status?: number;
  currency?: string;
  timezone_name?: string;
  business?: { id?: string; name?: string } | null;
};

type MetaAdAccountsResponse = MetaApiError & {
  data?: MetaAdAccount[];
  paging?: { next?: string };
};

type MetaAdsActionValue = { action_type?: string; value?: string | number };
type MetaAdsInsightsRow = {
  spend?: string | number;
  reach?: string | number;
  impressions?: string | number;
  frequency?: string | number;
  clicks?: string | number;
  inline_link_clicks?: string | number;
  ctr?: string | number;
  cpc?: string | number;
  cpm?: string | number;
  cpp?: string | number;
  unique_clicks?: string | number;
  unique_ctr?: string | number;
  actions?: MetaAdsActionValue[];
  action_values?: MetaAdsActionValue[];
  cost_per_action_type?: MetaAdsActionValue[];
  campaign_id?: string;
  campaign_name?: string;
  objective?: string;
  ad_id?: string;
  ad_name?: string;
  adset_id?: string;
  adset_name?: string;
};

type MetaAdsInsightsPayload = MetaApiError & {
  data?: MetaAdsInsightsRow[];
  paging?: { next?: string };
};

type MetaInsightsAssets = {
  facebookPageId: string | null;
  facebookPageName: string | null;
  instagramAccountId: string | null;
  instagramUsername: string | null;
};

type MetaInsightsWarning = {
  endpoint: string;
  code: number | null;
  message: string;
  metricOrOperation: string;
  kind: "api_error" | "network_error" | "timeout" | "unavailable";
  httpStatus?: number;
  durationMs?: number;
};

type MetaApiError = { error?: { code?: number; message?: string } };
type MetaInsight = {
  name?: string;
  values?: Array<{ value?: number }>;
  total_value?: { value?: number };
};

type MetaInsightsPayload = MetaApiError & { data?: MetaInsight[] };

type InstagramProfilePayload = MetaApiError & {
  id?: string;
  username?: string;
  followers_count?: number;
};

type InstagramMedia = {
  id?: string;
  caption?: string;
  media_type?: string;
  timestamp?: string;
  permalink?: string;
  thumbnail_url?: string;
  media_url?: string;
  like_count?: number;
  comments_count?: number;
};

type InstagramMediaPayload = MetaApiError & {
  data?: InstagramMedia[];
  paging?: { next?: string };
};

type FacebookPagePayload = MetaApiError & {
  id?: string;
  name?: string;
  access_token?: string;
  followers_count?: number;
  fan_count?: number;
};

type FacebookPost = {
  id?: string;
  message?: string;
  created_time?: string;
  permalink_url?: string;
  full_picture?: string;
  reactions?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
  shares?: { count?: number };
};

type FacebookPostsPayload = MetaApiError & { data?: FacebookPost[]; paging?: { next?: string } };

const META_INSIGHTS_REQUEST_TIMEOUT_MS = 7_000;

function requireMetaConfig(app: FastifyInstance) {
  const { META_APP_ID, META_APP_SECRET, META_REDIRECT_URI, META_TOKEN_ENCRYPTION_KEY } = app.appEnv;
  if (!META_APP_ID || !META_APP_SECRET || !META_REDIRECT_URI || !META_TOKEN_ENCRYPTION_KEY) {
    throw app.httpErrors.badRequest("A integração Meta ainda não foi configurada no servidor.");
  }
  let encryptionKey: Buffer;
  try {
    encryptionKey = Buffer.from(META_TOKEN_ENCRYPTION_KEY, "base64");
  } catch {
    throw app.httpErrors.badRequest("A chave de criptografia Meta é inválida.");
  }
  if (encryptionKey.length !== 32) throw app.httpErrors.badRequest("A chave de criptografia Meta deve ter 32 bytes em base64.");
  return { appId: META_APP_ID, appSecret: META_APP_SECRET, redirectUri: META_REDIRECT_URI, encryptionKey };
}

function encryptToken(token: string, key: Buffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

function decryptToken(value: string, key: Buffer) {
  const [version, ivValue, tagValue, encryptedValue] = value.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) throw new Error("Invalid encrypted Meta token");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
}

function appSecretProof(accessToken: string, appSecret: string) {
  return crypto.createHmac("sha256", appSecret).update(accessToken).digest("hex");
}

async function getMetaJson<T>(url: URL): Promise<T> {
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
  const payload = await response.json().catch(() => ({})) as T & { error?: { message?: string } };
  if (!response.ok || payload.error) throw new Error(payload.error?.message || `Meta Graph API respondeu com HTTP ${response.status}`);
  return payload;
}

function redactMetaSecrets(message: string, accessToken: string, appSecret: string) {
  const proof = appSecretProof(accessToken, appSecret);
  return message
    .split(accessToken).join("[REDACTED]")
    .split(proof).join("[REDACTED]")
    .replace(/(access_token|appsecret_proof)=([^&\s]+)/gi, "$1=[REDACTED]");
}

async function fetchMetaResult<T extends MetaApiError>(input: {
  app: FastifyInstance;
  path: string;
  token: string;
  appSecret: string;
  params?: Record<string, string>;
  metricOrOperation: string;
  nextUrl?: string;
  method?: "GET" | "POST";
}): Promise<{ payload: T | null; warning: MetaInsightsWarning | null }> {
  const url = input.nextUrl ? new URL(input.nextUrl) : new URL(`https://graph.facebook.com/${GRAPH_VERSION}${input.path}`);
  for (const [key, value] of Object.entries(input.params ?? {})) url.searchParams.set(key, value);
  url.searchParams.set("access_token", input.token);
  url.searchParams.set("appsecret_proof", appSecretProof(input.token, input.appSecret));

  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      method: input.method ?? "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(META_INSIGHTS_REQUEST_TIMEOUT_MS),
    });
    const payload = await response.json().catch(() => ({})) as T;
    const durationMs = Date.now() - startedAt;
    if (!response.ok || payload.error) {
      const message = redactMetaSecrets(
        payload.error?.message ?? `Meta Graph API respondeu com HTTP ${response.status}`,
        input.token,
        input.appSecret,
      );
      input.app.log.warn({ endpoint: input.path, operation: input.metricOrOperation, durationMs, httpStatus: response.status, metaCode: payload.error?.code ?? null }, "Meta Graph request failed");
      return {
        payload: null,
        warning: {
          endpoint: input.path,
          code: payload.error?.code ?? null,
          message,
          metricOrOperation: input.metricOrOperation,
          kind: "api_error",
          httpStatus: response.status,
          durationMs,
        },
      };
    }
    input.app.log.info({ endpoint: input.path, operation: input.metricOrOperation, durationMs, httpStatus: response.status }, "Meta Graph request completed");
    return { payload, warning: null };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    input.app.log.warn({ endpoint: input.path, operation: input.metricOrOperation, durationMs, timedOut }, "Meta Graph request did not complete");
    return {
      payload: null,
      warning: {
        endpoint: input.path,
        code: null,
        message: timedOut ? "A consulta à Meta Graph API excedeu o tempo limite." : "Falha de rede ao consultar a Meta Graph API.",
        metricOrOperation: input.metricOrOperation,
        kind: timedOut ? "timeout" : "network_error",
        durationMs,
      },
    };
  }
}

async function getFacebookPageAccessContext(input: {
  app: FastifyInstance;
  pageId: string;
  userToken: string;
  appSecret: string;
}) {
  const path = `/${input.pageId}`;
  const result = await fetchMetaResult<FacebookPagePayload>({
    app: input.app,
    path,
    token: input.userToken,
    appSecret: input.appSecret,
    params: { fields: "id,name,access_token,followers_count,fan_count" },
    metricOrOperation: "facebook.page",
  });
  return {
    path,
    page: result.payload,
    pageToken: result.payload?.access_token ?? input.userToken,
    tokenSource: result.payload?.access_token ? "page" as const : "user_fallback" as const,
    warning: result.warning,
  };
}

function insightNumber(payload: MetaInsightsPayload | null) {
  const insight = payload?.data?.[0];
  if (typeof insight?.total_value?.value === "number") return insight.total_value.value;
  const values = insight?.values?.map((item) => item.value).filter((value): value is number => typeof value === "number") ?? [];
  return values.length ? values.reduce((total, value) => total + value, 0) : null;
}

function insightNumbers<T extends string>(payload: MetaInsightsPayload | null, metrics: readonly T[]) {
  return Object.fromEntries(metrics.map((metric) => {
    const insight = payload?.data?.find((item) => item.name === metric);
    return [metric, insightNumber(insight ? { data: [insight] } : null)];
  })) as Record<T, number | null>;
}

async function fetchInsightMetric(input: {
  app: FastifyInstance;
  objectId: string;
  metric: string;
  token: string;
  appSecret: string;
  period: MetaInsightsPeriod;
  totalValue?: boolean;
  warnings: MetaInsightsWarning[];
  operationPrefix: string;
}) {
  const path = `/${input.objectId}/insights`;
  const result = await fetchMetaResult<MetaInsightsPayload>({
    app: input.app,
    path,
    token: input.token,
    appSecret: input.appSecret,
    params: {
      metric: input.metric,
      period: "day",
      since: input.period.since,
      until: input.period.until,
      ...(input.totalValue ? { metric_type: "total_value" } : {}),
    },
    metricOrOperation: `${input.operationPrefix}.${input.metric}`,
  });
  if (result.warning) input.warnings.push(result.warning);
  return insightNumber(result.payload);
}

export async function createMetaAuthorizationUrl(app: FastifyInstance, userId: string, returnPath: string) {
  const config = requireMetaConfig(app);
  const state = crypto.randomBytes(32).toString("base64url");
  await saveMetaOAuthState(app.db, { state, userId, returnPath });
  const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", META_SCOPES.join(","));
  url.searchParams.set("response_type", "code");
  return url.toString();
}

export async function completeMetaAuthorization(app: FastifyInstance, input: { code: string; userId: string }) {
  const config = requireMetaConfig(app);
  const tokenUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`);
  tokenUrl.searchParams.set("client_id", config.appId);
  tokenUrl.searchParams.set("client_secret", config.appSecret);
  tokenUrl.searchParams.set("redirect_uri", config.redirectUri);
  tokenUrl.searchParams.set("code", input.code);
  const shortToken = await getMetaJson<MetaTokenResponse>(tokenUrl);
  if (!shortToken.access_token) throw new Error("A Meta não retornou um token de acesso.");

  const longUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`);
  longUrl.searchParams.set("grant_type", "fb_exchange_token");
  longUrl.searchParams.set("client_id", config.appId);
  longUrl.searchParams.set("client_secret", config.appSecret);
  longUrl.searchParams.set("fb_exchange_token", shortToken.access_token);
  const longToken = await getMetaJson<MetaTokenResponse>(longUrl).catch(() => shortToken);
  const accessToken = longToken.access_token ?? shortToken.access_token;
  const expiresIn = longToken.expires_in ?? shortToken.expires_in;

  const profileUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/me`);
  profileUrl.searchParams.set("fields", "id,name");
  profileUrl.searchParams.set("access_token", accessToken);
  profileUrl.searchParams.set("appsecret_proof", appSecretProof(accessToken, config.appSecret));
  const profile = await getMetaJson<MetaProfileResponse>(profileUrl);
  if (!profile.id) throw new Error("A Meta não retornou a identificação da conta.");

  await upsertMetaConnection(app.db, {
    userId: input.userId,
    encryptedToken: encryptToken(accessToken, config.encryptionKey),
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
    metaUserId: profile.id,
    accountName: profile.name ?? null,
  });
}

export async function getMetaStatus(app: FastifyInstance, userId: string) {
  const connection = await findMetaConnection(app.db, userId);
  if (!connection) return { connected: false, expiresAt: null, accountName: null, metaUserId: null };
  return {
    connected: !connection.expiresAt || new Date(connection.expiresAt).getTime() > Date.now(),
    expiresAt: connection.expiresAt ? new Date(connection.expiresAt).toISOString() : null,
    accountName: connection.accountName,
    metaUserId: connection.metaUserId,
  };
}

export async function listMetaAssets(app: FastifyInstance, userId: string) {
  const config = requireMetaConfig(app);
  const connection = await findMetaConnection(app.db, userId);
  if (!connection) throw app.httpErrors.badRequest("Conecte uma conta Meta antes de listar os ativos.");
  if (connection.expiresAt && new Date(connection.expiresAt).getTime() <= Date.now()) {
    throw app.httpErrors.badRequest("A conexão Meta expirou. Atualize a conexão.");
  }
  const token = decryptToken(connection.encryptedToken, config.encryptionKey);
  const pages: Array<{ id: string; name: string; instagramAccount: { id: string; username: string } | null }> = [];
  let next: string | undefined;
  do {
    const url = next ? new URL(next) : new URL(`https://graph.facebook.com/${GRAPH_VERSION}/me/accounts`);
    if (!next) {
      url.searchParams.set("fields", "id,name,instagram_business_account{id,username}");
      url.searchParams.set("limit", "200");
      url.searchParams.set("access_token", token);
    }
    url.searchParams.set("appsecret_proof", appSecretProof(token, config.appSecret));
    const response = await getMetaJson<MetaAccountsResponse>(url);
    for (const page of response.data ?? []) {
      if (!page.id || !page.name) continue;
      const instagram = page.instagram_business_account;
      pages.push({
        id: page.id,
        name: page.name,
        instagramAccount: instagram?.id && instagram.username ? { id: instagram.id, username: instagram.username } : null,
      });
    }
    next = response.paging?.next;
  } while (next);
  return { pages };
}

export async function listMetaAdAccounts(app: FastifyInstance, userId: string) {
  const config = requireMetaConfig(app);
  const connection = await findMetaConnection(app.db, userId);
  if (!connection) throw app.httpErrors.badRequest("Conecte uma conta Meta antes de listar as contas de anúncios.");
  if (connection.expiresAt && new Date(connection.expiresAt).getTime() <= Date.now()) {
    throw app.httpErrors.badRequest("A conexão Meta expirou. Atualize a conexão.");
  }

  const token = decryptToken(connection.encryptedToken, config.encryptionKey);
  const adAccounts: Array<{
    id: string;
    account_id: string | null;
    name: string | null;
    account_status: number | null;
    currency: string | null;
    timezone_name: string | null;
    business: { id: string | null; name: string | null } | null;
  }> = [];
  let next: string | undefined;
  let pagesFetched = 0;

  do {
    const path = "/me/adaccounts";
    const url = next ? new URL(next) : new URL(`https://graph.facebook.com/${GRAPH_VERSION}${path}`);
    if (!next) {
      url.searchParams.set("fields", "id,account_id,name,account_status,currency,timezone_name,business{id,name}");
      url.searchParams.set("limit", "100");
      url.searchParams.set("access_token", token);
    }
    url.searchParams.set("appsecret_proof", appSecretProof(token, config.appSecret));

    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      });
      const payload = await response.json().catch(() => ({})) as MetaAdAccountsResponse;
      if (!response.ok || payload.error) {
        return {
          adAccounts,
          totalCount: adAccounts.length,
          pagesFetched,
          error: {
            endpoint: path,
            code: payload.error?.code ?? null,
            message: redactMetaSecrets(
              payload.error?.message ?? `Meta Graph API respondeu com HTTP ${response.status}`,
              token,
              config.appSecret,
            ),
            requiredPermission: "ads_read",
          },
        };
      }

      pagesFetched += 1;
      for (const account of payload.data ?? []) {
        if (!account.id) continue;
        adAccounts.push({
          id: account.id,
          account_id: account.account_id ?? null,
          name: account.name ?? null,
          account_status: account.account_status ?? null,
          currency: account.currency ?? null,
          timezone_name: account.timezone_name ?? null,
          business: account.business ? {
            id: account.business.id ?? null,
            name: account.business.name ?? null,
          } : null,
        });
      }
      next = payload.paging?.next;
    } catch {
      return {
        adAccounts,
        totalCount: adAccounts.length,
        pagesFetched,
        error: {
          endpoint: path,
          code: null,
          message: "Falha de rede ao consultar as contas de anúncios na Meta Graph API.",
          requiredPermission: "ads_read",
        },
      };
    }
  } while (next);

  return { adAccounts, totalCount: adAccounts.length, pagesFetched, error: null };
}

function metaAdsNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeMetaAdsActions(values: MetaAdsActionValue[] | undefined) {
  return (values ?? []).flatMap((item) => {
    const value = metaAdsNumber(item.value);
    return item.action_type && value !== null ? [{ actionType: item.action_type, value }] : [];
  });
}

function normalizeMetaAdsMetrics(row: MetaAdsInsightsRow | undefined) {
  return {
    spend: metaAdsNumber(row?.spend),
    reach: metaAdsNumber(row?.reach),
    impressions: metaAdsNumber(row?.impressions),
    frequency: metaAdsNumber(row?.frequency),
    clicks: metaAdsNumber(row?.clicks),
    inlineLinkClicks: metaAdsNumber(row?.inline_link_clicks),
    ctr: metaAdsNumber(row?.ctr),
    cpc: metaAdsNumber(row?.cpc),
    cpm: metaAdsNumber(row?.cpm),
  };
}

function normalizeMetaAdsSummary(row: MetaAdsInsightsRow | undefined) {
  return {
    ...normalizeMetaAdsMetrics(row),
    cpp: metaAdsNumber(row?.cpp),
    uniqueClicks: metaAdsNumber(row?.unique_clicks),
    uniqueCtr: metaAdsNumber(row?.unique_ctr),
  };
}

async function fetchMetaAdsInsightRows(input: {
  app: FastifyInstance;
  adAccountId: string;
  token: string;
  appSecret: string;
  period: MetaInsightsPeriod;
  level: "account" | "campaign" | "ad";
  fields: readonly string[];
  operation: string;
  warnings: MetaInsightsWarning[];
}) {
  const path = `/${input.adAccountId}/insights`;
  const rows: MetaAdsInsightsRow[] = [];
  let nextUrl: string | undefined;
  do {
    const result = await fetchMetaResult<MetaAdsInsightsPayload>({
      app: input.app,
      path,
      token: input.token,
      appSecret: input.appSecret,
      params: nextUrl ? undefined : {
        fields: input.fields.join(","),
        level: input.level,
        time_range: JSON.stringify(input.period),
        limit: "100",
      },
      metricOrOperation: input.operation,
      nextUrl,
    });
    if (result.warning) {
      input.warnings.push(result.warning);
      break;
    }
    rows.push(...(result.payload?.data ?? []));
    nextUrl = result.payload?.paging?.next;
  } while (nextUrl);
  return rows;
}

export async function getMetaAdsInsights(
  app: FastifyInstance,
  userId: string,
  asset: { metaAdAccountId: string; metaAdAccountName: string | null },
  period: MetaInsightsPeriod,
) {
  const config = requireMetaConfig(app);
  const connection = await findMetaConnection(app.db, userId);
  if (!connection) throw app.httpErrors.badRequest("Conecte uma conta Meta antes de consultar os anúncios.");
  if (connection.expiresAt && new Date(connection.expiresAt).getTime() <= Date.now()) {
    throw app.httpErrors.badRequest("A conexão Meta expirou. Atualize a conexão antes de consultar os anúncios.");
  }

  const token = decryptToken(connection.encryptedToken, config.encryptionKey);
  const adAccountId = `act_${asset.metaAdAccountId.replace(/^act_/i, "")}`;
  const warnings: MetaInsightsWarning[] = [];
  const commonFields = ["spend", "reach", "impressions", "frequency", "clicks", "inline_link_clicks", "ctr", "cpc", "cpm", "actions", "action_values", "cost_per_action_type"] as const;
  const accountPath = `/${adAccountId}`;

  const [accountResult, summaryRows, campaignRows, adRows] = await Promise.all([
    fetchMetaResult<MetaApiError & MetaAdAccount>({
      app,
      path: accountPath,
      token,
      appSecret: config.appSecret,
      params: { fields: "id,name,currency,timezone_name" },
      metricOrOperation: "ads.account",
    }),
    fetchMetaAdsInsightRows({
      app,
      adAccountId,
      token,
      appSecret: config.appSecret,
      period,
      level: "account",
      fields: [...commonFields, "cpp", "unique_clicks", "unique_ctr"],
      operation: "ads.insights.summary",
      warnings,
    }),
    fetchMetaAdsInsightRows({
      app,
      adAccountId,
      token,
      appSecret: config.appSecret,
      period,
      level: "campaign",
      fields: ["campaign_id", "campaign_name", "objective", ...commonFields],
      operation: "ads.insights.campaigns",
      warnings,
    }),
    fetchMetaAdsInsightRows({
      app,
      adAccountId,
      token,
      appSecret: config.appSecret,
      period,
      level: "ad",
      fields: ["ad_id", "ad_name", "adset_id", "adset_name", "campaign_id", "campaign_name", ...commonFields],
      operation: "ads.insights.ads",
      warnings,
    }),
  ]);
  if (accountResult.warning) warnings.push(accountResult.warning);

  const summaryRow = summaryRows[0];
  const campaigns = campaignRows
    .filter((row) => (metaAdsNumber(row.spend) ?? 0) > 0 || (metaAdsNumber(row.impressions) ?? 0) > 0)
    .map((row) => ({
      campaignId: row.campaign_id ?? null,
      campaignName: row.campaign_name ?? null,
      objective: row.objective ?? null,
      ...normalizeMetaAdsMetrics(row),
      actions: normalizeMetaAdsActions(row.actions),
      costPerAction: normalizeMetaAdsActions(row.cost_per_action_type),
      actionValues: normalizeMetaAdsActions(row.action_values),
    }))
    .sort((left, right) => (right.spend ?? -1) - (left.spend ?? -1));

  const topAds = adRows
    .filter((row) => (metaAdsNumber(row.spend) ?? 0) > 0 || (metaAdsNumber(row.impressions) ?? 0) > 0)
    .map((row) => ({
      adId: row.ad_id ?? null,
      adName: row.ad_name ?? null,
      adsetId: row.adset_id ?? null,
      adsetName: row.adset_name ?? null,
      campaignId: row.campaign_id ?? null,
      campaignName: row.campaign_name ?? null,
      ...normalizeMetaAdsMetrics(row),
      actions: normalizeMetaAdsActions(row.actions),
      costPerAction: normalizeMetaAdsActions(row.cost_per_action_type),
    }))
    .sort((left, right) => (right.spend ?? -1) - (left.spend ?? -1))
    .slice(0, 10);

  return {
    period,
    adAccount: {
      id: accountResult.payload?.id ?? adAccountId,
      name: accountResult.payload?.name ?? asset.metaAdAccountName,
      currency: accountResult.payload?.currency ?? null,
      timezoneName: accountResult.payload?.timezone_name ?? null,
    },
    summary: normalizeMetaAdsSummary(summaryRow),
    actions: normalizeMetaAdsActions(summaryRow?.actions),
    costPerAction: normalizeMetaAdsActions(summaryRow?.cost_per_action_type),
    actionValues: normalizeMetaAdsActions(summaryRow?.action_values),
    campaigns,
    topAds,
    warnings: warnings.map((warning) => ({
      operation: warning.metricOrOperation,
      code: warning.code,
      message: warning.message,
    })),
  };
}

async function getInstagramInsights(input: {
  app: FastifyInstance;
  accountId: string;
  savedUsername: string | null;
  token: string;
  appSecret: string;
  period: MetaInsightsPeriod;
  warnings: MetaInsightsWarning[];
}) {
  const profilePath = `/${input.accountId}`;
  const metricNames = ["reach", "views", "profile_views", "profile_links_taps", "total_interactions", "accounts_engaged"] as const;
  const mediaPath = `/${input.accountId}/media`;
  const [profile, metricValues, mediaResult] = await Promise.all([
    fetchMetaResult<InstagramProfilePayload>({ app: input.app, path: profilePath, token: input.token, appSecret: input.appSecret, params: { fields: "id,username,followers_count" }, metricOrOperation: "instagram.account" }),
    Promise.all(metricNames.map(async (metric) => [metric, await fetchInsightMetric({ app: input.app, objectId: input.accountId, metric, token: input.token, appSecret: input.appSecret, period: input.period, totalValue: true, warnings: input.warnings, operationPrefix: "instagram.account" })] as const)),
    fetchMetaResult<InstagramMediaPayload>({ app: input.app, path: mediaPath, token: input.token, appSecret: input.appSecret, params: { fields: "id,caption,media_type,timestamp,permalink,thumbnail_url,media_url,like_count,comments_count", since: input.period.since, until: input.period.until, limit: "100" }, metricOrOperation: "instagram.media.list" }),
  ]);
  if (profile.warning) input.warnings.push(profile.warning);
  const metrics = Object.fromEntries(metricValues) as Record<typeof metricNames[number], number | null>;
  if (mediaResult.warning) input.warnings.push(mediaResult.warning);
  if (mediaResult.payload?.paging?.next) {
    input.warnings.push({
      endpoint: mediaPath,
      code: null,
      message: "O período possui mais de 100 mídias; o ranking considera as 100 primeiras retornadas pela Meta.",
      metricOrOperation: "instagram.media.pagination",
      kind: "unavailable",
    });
  }

  const candidates = (mediaResult.payload?.data ?? [])
    .filter((media) => media.id)
    .sort((left, right) => ((right.like_count ?? 0) + (right.comments_count ?? 0)) - ((left.like_count ?? 0) + (left.comments_count ?? 0)))
    .slice(0, 10);
  const topContent = await Promise.all(candidates.map(async (media) => {
    const mediaMetrics = ["reach", "views", "saved", "shares", "total_interactions"] as const;
    const path = `/${media.id}/insights`;
    const result = await fetchMetaResult<MetaInsightsPayload>({ app: input.app, path, token: input.token, appSecret: input.appSecret, params: { metric: mediaMetrics.join(",") }, metricOrOperation: `instagram.media.${media.id}.insights` });
    if (result.warning) input.warnings.push(result.warning);
    const mediaInsight = insightNumbers(result.payload, mediaMetrics);
    return {
      id: media.id,
      caption: media.caption ?? null,
      mediaType: media.media_type ?? null,
      timestamp: media.timestamp ?? null,
      permalink: media.permalink ?? null,
      thumbnailUrl: media.thumbnail_url ?? media.media_url ?? null,
      reach: mediaInsight.reach,
      views: mediaInsight.views,
      likes: media.like_count ?? null,
      comments: media.comments_count ?? null,
      saved: mediaInsight.saved,
      shares: mediaInsight.shares,
      totalInteractions: mediaInsight.total_interactions,
    };
  }));
  topContent.sort((left, right) => (
    (right.totalInteractions ?? ((right.likes ?? 0) + (right.comments ?? 0))) -
    (left.totalInteractions ?? ((left.likes ?? 0) + (left.comments ?? 0)))
  ));

  return {
    accountId: input.accountId,
    username: profile.payload?.username ?? input.savedUsername,
    metrics: {
      reach: metrics.reach,
      views: metrics.views,
      followers: profile.payload?.followers_count ?? null,
      profileViews: metrics.profile_views,
      interactions: metrics.total_interactions,
      linkClicks: metrics.profile_links_taps,
      accountsEngaged: metrics.accounts_engaged,
    },
    topContent,
  };
}

async function getFacebookInsights(input: {
  app: FastifyInstance;
  pageId: string;
  savedPageName: string | null;
  userToken: string;
  appSecret: string;
  period: MetaInsightsPeriod;
  warnings: MetaInsightsWarning[];
}) {
  const pageAccess = await getFacebookPageAccessContext({
    app: input.app,
    pageId: input.pageId,
    userToken: input.userToken,
    appSecret: input.appSecret,
  });
  if (pageAccess.warning) input.warnings.push(pageAccess.warning);
  const page = pageAccess.page;
  const pageToken = pageAccess.pageToken;
  if (page && pageAccess.tokenSource === "user_fallback") {
    input.warnings.push({
      endpoint: pageAccess.path,
      code: null,
      message: "A Meta não retornou um Page Access Token; as leituras da Página serão tentadas com o token atual.",
      metricOrOperation: "facebook.pageAccessToken",
      kind: "unavailable",
    });
  }

  const metricNames = ["page_total_media_view_unique", "page_media_view", "page_post_engagements", "page_views_total"] as const;
  const postsPath = `/${input.pageId}/posts`;
  const [metricValues, posts] = await Promise.all([
    Promise.all(metricNames.map(async (metric) => [metric, await fetchInsightMetric({ app: input.app, objectId: input.pageId, metric, token: pageToken, appSecret: input.appSecret, period: input.period, warnings: input.warnings, operationPrefix: "facebook.page" })] as const)),
    fetchMetaResult<FacebookPostsPayload>({ app: input.app, path: postsPath, token: pageToken, appSecret: input.appSecret, params: { fields: "id,message,created_time,permalink_url,full_picture,reactions.limit(0).summary(true),comments.limit(0).summary(true),shares", since: input.period.since, until: input.period.until, limit: "100" }, metricOrOperation: "facebook.posts.list" }),
  ]);
  const metrics = Object.fromEntries(metricValues) as Record<typeof metricNames[number], number | null>;
  input.warnings.push({ endpoint: `/${input.pageId}/insights`, code: null, message: "page_impressions não é uma métrica válida na Graph API v26 e não possui equivalente direto. page_media_view é retornada separadamente como views.", metricOrOperation: "facebook.page.impressions", kind: "unavailable" });
  for (const metric of metricNames) { const operation = `facebook.page.${metric}`; if (metrics[metric] === null && !input.warnings.some((warning) => warning.metricOrOperation === operation)) input.warnings.push({ endpoint: `/${input.pageId}/insights`, code: null, message: "A Meta não retornou valor numérico para esta métrica no período informado.", metricOrOperation: operation, kind: "unavailable" }); }
  if (posts.warning) input.warnings.push(posts.warning);
  if (posts.payload?.paging?.next) input.warnings.push({ endpoint: postsPath, code: null, message: "O período possui mais de 100 publicações; o ranking considera as 100 primeiras retornadas pela Meta.", metricOrOperation: "facebook.posts.pagination", kind: "unavailable" });
  const postCandidates = (posts.payload?.data ?? []).filter((post) => post.id).map((post) => {
    const reactions = post.reactions?.summary?.total_count ?? null;
    const comments = post.comments?.summary?.total_count ?? null;
    const shares = post.shares?.count ?? null;
    return {
      id: post.id,
      message: post.message ?? null,
      timestamp: post.created_time ?? null,
      permalink: post.permalink_url ?? null,
      thumbnailUrl: post.full_picture ?? null,
      reactions,
      comments,
      shares,
      interactions: (reactions ?? 0) + (comments ?? 0) + (shares ?? 0),
    };
  }).sort((left, right) => right.interactions - left.interactions).slice(0, 10);
  const topContent = await Promise.all(postCandidates.map(async (post) => {
    const postMetrics = ["post_total_media_view_unique", "post_media_view", "post_clicks"] as const;
    const path = `/${post.id}/insights`;
    const result = await fetchMetaResult<MetaInsightsPayload>({ app: input.app, path, token: pageToken, appSecret: input.appSecret, params: { metric: postMetrics.join(","), period: "lifetime" }, metricOrOperation: `facebook.post.${post.id}.insights` });
    if (result.warning) input.warnings.push(result.warning);
    const postInsight = insightNumbers(result.payload, postMetrics);
    return {
      ...post,
      reach: postInsight.post_total_media_view_unique,
      views: postInsight.post_media_view,
      clicks: postInsight.post_clicks,
    };
  }));
  topContent.sort((left, right) => (
    (right.interactions + (right.clicks ?? 0)) - (left.interactions + (left.clicks ?? 0))
  ));

  return {
    pageId: input.pageId,
    pageName: page?.name ?? input.savedPageName,
    metrics: {
      reach: metrics.page_total_media_view_unique,
      views: metrics.page_media_view,
      impressions: null,
      engagement: metrics.page_post_engagements,
      followers: page?.followers_count ?? null,
      fans: page?.fan_count ?? null,
      pageViews: metrics.page_views_total,
    },
    topContent,
  };
}

export async function getMetaInsights(
  app: FastifyInstance,
  userId: string,
  assets: MetaInsightsAssets,
  period: MetaInsightsPeriod,
) {
  const config = requireMetaConfig(app);
  const connection = await findMetaConnection(app.db, userId);
  if (!connection) throw app.httpErrors.badRequest("Conecte uma conta Meta antes de consultar Insights.");
  if (connection.expiresAt && new Date(connection.expiresAt).getTime() <= Date.now()) {
    throw app.httpErrors.badRequest("A conexão Meta expirou. Atualize a conexão antes de consultar Insights.");
  }
  const token = decryptToken(connection.encryptedToken, config.encryptionKey);
  const warnings: MetaInsightsWarning[] = [];
  const runSource = async <T>(source: "instagram" | "facebook", operation: () => Promise<T>) => {
    try { return await operation(); }
    catch (error) {
      app.log.error({ err: error, source }, "Meta Insights source failed unexpectedly");
      warnings.push({ endpoint: source, code: null, message: `Falha inesperada ao consultar ${source === "instagram" ? "o Instagram" : "o Facebook"}.`, metricOrOperation: `${source}.source`, kind: "api_error" });
      return null;
    }
  };
  const [instagram, facebook] = await Promise.all([
    assets.instagramAccountId ? runSource("instagram", () => getInstagramInsights({ app, accountId: assets.instagramAccountId!, savedUsername: assets.instagramUsername, token, appSecret: config.appSecret, period, warnings })) : Promise.resolve(null),
    assets.facebookPageId ? runSource("facebook", () => getFacebookInsights({ app, pageId: assets.facebookPageId!, savedPageName: assets.facebookPageName, userToken: token, appSecret: config.appSecret, period, warnings })) : Promise.resolve(null),
  ]);

  const errorKinds = new Set<MetaInsightsWarning["kind"]>(["api_error", "network_error", "timeout"]);
  const statusFor = (source: "instagram" | "facebook", linked: boolean, data: typeof instagram | typeof facebook) => {
    if (!linked) return "not_linked" as const;
    if (!data) return "failed" as const;
    const sourceWarnings = warnings.filter((warning) => warning.metricOrOperation.startsWith(`${source}.`) && errorKinds.has(warning.kind));
    const hasValues = Object.values(data.metrics).some((value) => typeof value === "number") || data.topContent.length > 0;
    if (sourceWarnings.length) return hasValues ? "partial" as const : "failed" as const;
    return hasValues ? "complete" as const : "empty" as const;
  };
  const sources = {
    instagram: statusFor("instagram", Boolean(assets.instagramAccountId), instagram),
    facebook: statusFor("facebook", Boolean(assets.facebookPageId), facebook),
  };
  const linkedStatuses = Object.values(sources).filter((status) => status !== "not_linked");
  const status = linkedStatuses.every((source) => source === "failed") ? "failed"
    : linkedStatuses.some((source) => source === "failed" || source === "partial") ? "partial"
      : linkedStatuses.every((source) => source === "empty") ? "empty"
        : "complete";
  return { period, status, sources, instagram, facebook, warnings };
}

type SchedulableCard = {
  id: string;
  clientAccountId: string;
  caption: string | null;
  mediaType: string | null;
  primaryMediaUrl: string | null;
  mediaUrls: string[];
  artType: string | null;
};

function isPrivateHostname(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized === "localhost" || normalized.endsWith(".localhost") || normalized === "::1") return true;
  if (net.isIP(normalized) === 4) {
    const [a, b] = normalized.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  return net.isIP(normalized) === 6 && (normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:"));
}

function assertPublicHttpUrl(app: FastifyInstance, rawUrl: string) {
  let url: URL;
  try {
    url = rawUrl.startsWith("/api/uploads/") ? new URL(rawUrl, app.appEnv.API_URL) : new URL(rawUrl);
  } catch {
    throw app.httpErrors.badRequest("A imagem precisa ter uma URL pública HTTP/HTTPS para que a Meta consiga acessá-la.");
  }
  if (!["http:", "https:"].includes(url.protocol) || isPrivateHostname(url.hostname)) {
    throw app.httpErrors.badRequest("A imagem precisa estar disponível em uma URL pública HTTP/HTTPS; URLs locais, blob e data não são aceitas.");
  }
  if (rawUrl.startsWith("/api/uploads/")) {
    // Uploads are already public. Convert the stored WebP on demand because
    // Instagram Content Publishing accepts JPEG images, not WebP.
    url.searchParams.set("format", "jpeg");
  } else if (!/\.jpe?g$/i.test(url.pathname)) {
    throw app.httpErrors.badRequest("Esta primeira versão publica somente uma imagem JPEG acessível por URL pública.");
  }
  return url.toString();
}

async function getPublishingContext(app: FastifyInstance, userId: string) {
  const config = requireMetaConfig(app);
  const connection = await findMetaConnection(app.db, userId);
  if (!connection) throw app.httpErrors.badRequest("Conecte novamente a conta Meta antes de agendar uma publicação.");
  if (connection.expiresAt && new Date(connection.expiresAt).getTime() <= Date.now()) {
    throw app.httpErrors.badRequest("A conexão Meta expirou. Reconecte a conta antes de publicar.");
  }
  return { token: decryptToken(connection.encryptedToken, config.encryptionKey), appSecret: config.appSecret };
}

function singleImageFromCard(app: FastifyInstance, card: SchedulableCard) {
  const media = [...new Set((card.mediaUrls.length ? card.mediaUrls : card.primaryMediaUrl ? [card.primaryMediaUrl] : []).filter(Boolean))];
  const unsupportedType = /video|reel|story|carousel/i.test(`${card.mediaType ?? ""} ${card.artType ?? ""}`);
  if (media.length !== 1 || unsupportedType) {
    throw app.httpErrors.badRequest("Esta primeira versão aceita somente um card com uma única imagem.");
  }
  return assertPublicHttpUrl(app, media[0]);
}

export async function scheduleInstagramCardPublication(app: FastifyInstance, input: {
  userId: string;
  clientAccountId: string;
  instagramAccountId: string;
  card: SchedulableCard;
  scheduledAt: string;
  timezone: string;
}) {
  await getPublishingContext(app, input.userId);
  if (input.card.clientAccountId !== input.clientAccountId) throw app.httpErrors.badRequest("O card não pertence a este cliente.");
  const mediaUrl = singleImageFromCard(app, input.card);
  const scheduledAt = new Date(input.scheduledAt).toISOString();
  const idempotencyKey = crypto.createHash("sha256")
    .update([input.clientAccountId, input.card.id, "instagram", scheduledAt].join(":"))
    .digest("hex");
  return createScheduledPublication(app.db, {
    clientAccountId: input.clientAccountId,
    cardId: input.card.id,
    platform: "instagram",
    metaAssetId: input.instagramAccountId,
    scheduledAt,
    timezone: input.timezone,
    caption: input.card.caption?.trim() || null,
    mediaUrl,
    mediaUrls: [mediaUrl],
    mediaType: "image",
    createdByUserId: input.userId,
    idempotencyKey,
  });
}

const INSTAGRAM_CONTAINER_POLL_ATTEMPTS = 10;
const INSTAGRAM_CONTAINER_POLL_INTERVAL_MS = 2_000;

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForInstagramContainer(app: FastifyInstance, input: {
  publicationId: string;
  containerId: string;
  token: string;
  appSecret: string;
}) {
  for (let attempt = 1; attempt <= INSTAGRAM_CONTAINER_POLL_ATTEMPTS; attempt += 1) {
    await wait(INSTAGRAM_CONTAINER_POLL_INTERVAL_MS);
    const result = await fetchMetaResult<MetaApiError & { status_code?: string; error_message?: string }>({
      app,
      path: `/${input.containerId}`,
      token: input.token,
      appSecret: input.appSecret,
      params: { fields: "status_code" },
      metricOrOperation: "instagram.publish.containerStatus",
    });
    if (!result.payload) {
      throw new Error(result.warning?.message || "Não foi possível consultar o processamento da imagem na Meta.");
    }
    const statusCode = result.payload.status_code?.trim().toUpperCase() || "UNKNOWN";
    app.log.info({
      publicationId: input.publicationId,
      containerId: input.containerId,
      attempt,
      status_code: statusCode,
    }, "Instagram media container status checked");
    if (statusCode === "FINISHED") return;
    if (statusCode === "ERROR" || result.payload.error_message) {
      throw new Error(result.payload.error_message || "A Meta encontrou um erro ao processar a imagem.");
    }
    if (statusCode === "EXPIRED") {
      throw new Error("O container da imagem expirou antes da publicação.");
    }
    if (statusCode === "PUBLISHED") {
      throw new Error("A Meta informou que este container já foi publicado.");
    }
    if (statusCode !== "IN_PROGRESS") {
      throw new Error(`A Meta retornou um status inesperado ao processar a imagem: ${statusCode}.`);
    }
  }
  throw new Error("A Meta ainda não concluiu o processamento da imagem. Tente publicar novamente.");
}

async function publishInstagramImage(app: FastifyInstance, input: {
  publicationId: string;
  userId: string;
  instagramAccountId: string;
  imageUrl: string;
  caption: string | null;
}) {
  const context = await getPublishingContext(app, input.userId);
  const create = await fetchMetaResult<MetaApiError & { id?: string }>({
    app,
    path: `/${input.instagramAccountId}/media`,
    token: context.token,
    appSecret: context.appSecret,
    params: { image_url: input.imageUrl, ...(input.caption ? { caption: input.caption } : {}) },
    metricOrOperation: "instagram.publish.createContainer",
    method: "POST",
  });
  if (!create.payload?.id) throw new Error(create.warning?.message || "A Meta não criou o container da publicação.");
  await waitForInstagramContainer(app, {
    publicationId: input.publicationId,
    containerId: create.payload.id,
    token: context.token,
    appSecret: context.appSecret,
  });
  const publish = await fetchMetaResult<MetaApiError & { id?: string }>({
    app,
    path: `/${input.instagramAccountId}/media_publish`,
    token: context.token,
    appSecret: context.appSecret,
    params: { creation_id: create.payload.id },
    metricOrOperation: "instagram.publish.media",
    method: "POST",
  });
  if (!publish.payload?.id) throw new Error(publish.warning?.message || "A Meta não confirmou a publicação no Instagram.");
  const permalink = await fetchMetaResult<MetaApiError & { permalink?: string }>({
    app,
    path: `/${publish.payload.id}`,
    token: context.token,
    appSecret: context.appSecret,
    params: { fields: "permalink" },
    metricOrOperation: "instagram.publish.permalink",
  });
  return { publishedMetaId: publish.payload.id, publishedPermalink: permalink.payload?.permalink ?? null };
}

function safePublicationError(error: unknown) {
  const message = error instanceof Error ? error.message : "Falha inesperada ao publicar no Instagram.";
  return message
    .replace(/(access_token|appsecret_proof)=([^&\s]+)/gi, "$1=[REDACTED]")
    .replace(/EA[A-Za-z0-9_-]{20,}/g, "[REDACTED]")
    .slice(0, 4000);
}

export async function processDueMetaPublications(app: FastifyInstance, limit = 10) {
  const due = await listDueScheduledPublications(app.db, limit);
  let published = 0;
  let failed = 0;
  for (const publication of due) {
    if (!await markPublicationPublishing(app.db, publication.id)) continue;
    try {
      if (publication.platform !== "instagram" || !publication.mediaUrl || !publication.createdByUserId) {
        throw new Error("O agendamento não possui todos os dados necessários para publicação.");
      }
      const assets = await findClientMetaAssets(app.db, publication.clientAccountId);
      if (!assets?.instagramAccountId || assets.instagramAccountId !== publication.metaAssetId) {
        throw new Error("A conta do Instagram vinculada ao cliente mudou desde o agendamento.");
      }
      const result = await publishInstagramImage(app, {
        publicationId: publication.id,
        userId: publication.createdByUserId,
        instagramAccountId: publication.metaAssetId,
        imageUrl: publication.mediaUrl,
        caption: publication.caption,
      });
      await markPublicationPublished(app.db, publication.id, result);
      published += 1;
    } catch (error) {
      const message = safePublicationError(error);
      await markPublicationFailed(app.db, publication.id, message);
      app.log.error({ publicationId: publication.id, clientAccountId: publication.clientAccountId, message }, "Instagram scheduled publication failed");
      failed += 1;
    }
  }
  return { examined: due.length, published, failed };
}
