import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { findMetaConnection, saveMetaOAuthState, upsertMetaConnection } from "./meta.repository.js";
import type { MetaInsightsPeriod } from "./meta.schemas.js";

const GRAPH_VERSION = "v26.0";
const META_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_read_user_content",
  "instagram_basic",
  "instagram_manage_insights",
  "business_management",
];

type MetaTokenResponse = { access_token?: string; token_type?: string; expires_in?: number; error?: { message?: string } };
type MetaProfileResponse = { id?: string; name?: string; error?: { message?: string } };
type MetaAccountsResponse = {
  data?: Array<{ id?: string; name?: string; instagram_business_account?: { id?: string; username?: string } | null }>;
  paging?: { next?: string };
  error?: { message?: string };
};

type MetaDiagnosticError = {
  endpoint: string;
  code: number | null;
  message: string;
  apparentlyRequiredPermission: string;
};

type MetaPaging = {
  cursors?: { before?: string; after?: string };
  next?: string;
  previous?: string;
};

type MetaDiagnosticResponse<T> = {
  data?: T[];
  paging?: MetaPaging;
  error?: { code?: number; message?: string };
};

type MetaDiagnosticPage = {
  id?: string;
  name?: string;
  tasks?: string[];
  instagram_business_account?: { id?: string; username?: string } | null;
};

type MetaDiagnosticBusiness = { id?: string; name?: string };

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
  reactions?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
  shares?: { count?: number };
};

type FacebookPostsPayload = MetaApiError & { data?: FacebookPost[] };

type FacebookPageInsightDiagnosticPayload = MetaApiError & {
  data?: Array<{
    name?: string;
    period?: string;
    values?: unknown;
    total_value?: unknown;
    [key: string]: unknown;
  }>;
};

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

function safePaging(paging: MetaPaging | undefined, page: number) {
  return {
    page,
    cursors: paging?.cursors ?? null,
    hasNext: Boolean(paging?.next),
    hasPrevious: Boolean(paging?.previous),
  };
}

function redactMetaSecrets(message: string, accessToken: string, appSecret: string) {
  const proof = appSecretProof(accessToken, appSecret);
  return message
    .split(accessToken).join("[REDACTED]")
    .split(proof).join("[REDACTED]")
    .replace(/(access_token|appsecret_proof)=([^&\s]+)/gi, "$1=[REDACTED]");
}

async function fetchMetaResult<T extends MetaApiError>(input: {
  path: string;
  token: string;
  appSecret: string;
  params?: Record<string, string>;
  metricOrOperation: string;
}): Promise<{ payload: T | null; warning: MetaInsightsWarning | null }> {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}${input.path}`);
  for (const [key, value] of Object.entries(input.params ?? {})) url.searchParams.set(key, value);
  url.searchParams.set("access_token", input.token);
  url.searchParams.set("appsecret_proof", appSecretProof(input.token, input.appSecret));

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    const payload = await response.json().catch(() => ({})) as T;
    if (!response.ok || payload.error) {
      return {
        payload: null,
        warning: {
          endpoint: input.path,
          code: payload.error?.code ?? null,
          message: redactMetaSecrets(
            payload.error?.message ?? `Meta Graph API respondeu com HTTP ${response.status}`,
            input.token,
            input.appSecret,
          ),
          metricOrOperation: input.metricOrOperation,
        },
      };
    }
    return { payload, warning: null };
  } catch {
    return {
      payload: null,
      warning: {
        endpoint: input.path,
        code: null,
        message: "Falha de rede ao consultar a Meta Graph API.",
        metricOrOperation: input.metricOrOperation,
      },
    };
  }
}

async function getFacebookPageAccessContext(input: {
  pageId: string;
  userToken: string;
  appSecret: string;
}) {
  const path = `/${input.pageId}`;
  const result = await fetchMetaResult<FacebookPagePayload>({
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

async function fetchInsightMetric(input: {
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

async function fetchMetaDiagnosticCollection<T>(input: {
  path: string;
  fields: string;
  token: string;
  appSecret: string;
  apparentlyRequiredPermission: string;
}) {
  const data: T[] = [];
  const paging: ReturnType<typeof safePaging>[] = [];
  let next: string | undefined;
  let page = 0;
  let error: MetaDiagnosticError | null = null;

  do {
    page += 1;
    const url = next
      ? new URL(next)
      : new URL(`https://graph.facebook.com/${GRAPH_VERSION}${input.path}`);
    if (!next) {
      url.searchParams.set("fields", input.fields);
      url.searchParams.set("limit", "100");
      url.searchParams.set("access_token", input.token);
    }
    url.searchParams.set("appsecret_proof", appSecretProof(input.token, input.appSecret));

    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      });
      const payload = await response.json().catch(() => ({})) as MetaDiagnosticResponse<T>;
      if (!response.ok || payload.error) {
        const message = payload.error?.message ?? `Meta Graph API respondeu com HTTP ${response.status}`;
        error = {
          endpoint: input.path,
          code: payload.error?.code ?? null,
          message: redactMetaSecrets(message, input.token, input.appSecret),
          apparentlyRequiredPermission: input.apparentlyRequiredPermission,
        };
        break;
      }
      data.push(...(payload.data ?? []));
      paging.push(safePaging(payload.paging, page));
      next = payload.paging?.next;
    } catch {
      error = {
        endpoint: input.path,
        code: null,
        message: "Falha de rede ao consultar a Meta Graph API.",
        apparentlyRequiredPermission: input.apparentlyRequiredPermission,
      };
      break;
    }
  } while (next);

  return { data, paging, totalCount: data.length, error };
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

export async function debugMetaAssets(app: FastifyInstance, userId: string) {
  const config = requireMetaConfig(app);
  const connection = await findMetaConnection(app.db, userId);
  if (!connection) throw app.httpErrors.badRequest("Conecte uma conta Meta antes de executar o diagnóstico.");
  if (connection.expiresAt && new Date(connection.expiresAt).getTime() <= Date.now()) {
    throw app.httpErrors.badRequest("A conexão Meta expirou. Atualize a conexão antes do diagnóstico.");
  }

  const token = decryptToken(connection.encryptedToken, config.encryptionKey);
  const errors: MetaDiagnosticError[] = [];
  const accounts = await fetchMetaDiagnosticCollection<MetaDiagnosticPage>({
    path: "/me/accounts",
    fields: "id,name,tasks,instagram_business_account{id,username}",
    token,
    appSecret: config.appSecret,
    apparentlyRequiredPermission: "pages_show_list; pages_read_engagement e instagram_basic para os campos relacionados",
  });
  if (accounts.error) errors.push(accounts.error);

  const businesses = await fetchMetaDiagnosticCollection<MetaDiagnosticBusiness>({
    path: "/me/businesses",
    fields: "id,name",
    token,
    appSecret: config.appSecret,
    apparentlyRequiredPermission: "business_management",
  });
  if (businesses.error) errors.push(businesses.error);

  const businessPortfolios = [];
  if (!businesses.error) {
    for (const business of businesses.data) {
      if (!business.id) continue;
      const [ownedPages, clientPages] = await Promise.all([
        fetchMetaDiagnosticCollection<MetaDiagnosticPage>({
          path: `/${business.id}/owned_pages`,
          fields: "id,name,instagram_business_account{id,username}",
          token,
          appSecret: config.appSecret,
          apparentlyRequiredPermission: "business_management",
        }),
        fetchMetaDiagnosticCollection<MetaDiagnosticPage>({
          path: `/${business.id}/client_pages`,
          fields: "id,name,instagram_business_account{id,username}",
          token,
          appSecret: config.appSecret,
          apparentlyRequiredPermission: "business_management",
        }),
      ]);
      if (ownedPages.error) errors.push(ownedPages.error);
      if (clientPages.error) errors.push(clientPages.error);
      businessPortfolios.push({
        id: business.id,
        name: business.name ?? null,
        ownedPages: { data: ownedPages.data, paging: ownedPages.paging, totalCount: ownedPages.totalCount },
        clientPages: { data: clientPages.data, paging: clientPages.paging, totalCount: clientPages.totalCount },
      });
    }
  }

  return {
    graphVersion: GRAPH_VERSION,
    accounts: {
      endpoint: "/me/accounts",
      fields: ["id", "name", "tasks", "instagram_business_account{id,username}"],
      data: accounts.data,
      paging: accounts.paging,
      totalCount: accounts.totalCount,
    },
    businesses: {
      endpoint: "/me/businesses",
      data: businessPortfolios,
      paging: businesses.paging,
      totalCount: businesses.totalCount,
    },
    errors,
  };
}

async function fetchFacebookPageInsightDiagnostic(input: {
  pageId: string;
  metric: string;
  period: "day" | "week" | "days_28";
  since: string;
  until: string;
  pageToken: string;
  appSecret: string;
}) {
  const path = `/${input.pageId}/insights`;
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}${path}`);
  url.searchParams.set("metric", input.metric);
  url.searchParams.set("period", input.period);
  url.searchParams.set("since", input.since);
  url.searchParams.set("until", input.until);
  url.searchParams.set("access_token", input.pageToken);
  url.searchParams.set("appsecret_proof", appSecretProof(input.pageToken, input.appSecret));

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    const payload = await response.json().catch(() => ({})) as FacebookPageInsightDiagnosticPayload;
    const firstItem = payload.data?.[0];
    const error = payload.error ? {
      code: payload.error.code ?? null,
      message: redactMetaSecrets(payload.error.message ?? "Erro sem mensagem retornado pela Meta.", input.pageToken, input.appSecret),
    } : !response.ok ? {
      code: null,
      message: `Meta Graph API respondeu com HTTP ${response.status}`,
    } : null;
    return {
      httpStatus: response.status,
      metric: input.metric,
      period: input.period,
      data: payload.data ?? null,
      values: firstItem?.values ?? null,
      total_value: firstItem?.total_value ?? null,
      error,
    };
  } catch {
    return {
      httpStatus: null,
      metric: input.metric,
      period: input.period,
      data: null,
      values: null,
      total_value: null,
      error: { code: null, message: "Falha de rede ao consultar a Meta Graph API." },
    };
  }
}

export async function debugFacebookPageInsights(
  app: FastifyInstance,
  userId: string,
  pageId: string,
  period: MetaInsightsPeriod,
) {
  const config = requireMetaConfig(app);
  const connection = await findMetaConnection(app.db, userId);
  if (!connection) throw app.httpErrors.badRequest("Conecte uma conta Meta antes de executar o diagnóstico.");
  if (connection.expiresAt && new Date(connection.expiresAt).getTime() <= Date.now()) {
    throw app.httpErrors.badRequest("A conexão Meta expirou. Atualize a conexão antes do diagnóstico.");
  }

  const userToken = decryptToken(connection.encryptedToken, config.encryptionKey);
  const pageAccess = await getFacebookPageAccessContext({ pageId, userToken, appSecret: config.appSecret });
  const metricNames = [
    "page_total_media_view_unique",
    "page_media_view",
    "page_post_engagements",
    "page_views_total",
  ] as const;
  const metrics = [];
  for (const metric of metricNames) {
    const day = await fetchFacebookPageInsightDiagnostic({
      pageId,
      metric,
      period: "day",
      since: period.since,
      until: period.until,
      pageToken: pageAccess.pageToken,
      appSecret: config.appSecret,
    });
    const results = [day];
    if (!day.error) {
      results.push(...await Promise.all((["week", "days_28"] as const).map((insightPeriod) => (
        fetchFacebookPageInsightDiagnostic({
          pageId,
          metric,
          period: insightPeriod,
          since: period.since,
          until: period.until,
          pageToken: pageAccess.pageToken,
          appSecret: config.appSecret,
        })
      ))));
    }
    metrics.push({ metric, results });
  }

  return {
    graphVersion: GRAPH_VERSION,
    pageId,
    period,
    pageAccess: {
      tokenSource: pageAccess.tokenSource,
      error: pageAccess.warning ? {
        endpoint: pageAccess.warning.endpoint,
        code: pageAccess.warning.code,
        message: pageAccess.warning.message,
      } : null,
    },
    metrics,
  };
}

async function getInstagramInsights(input: {
  accountId: string;
  savedUsername: string | null;
  token: string;
  appSecret: string;
  period: MetaInsightsPeriod;
  warnings: MetaInsightsWarning[];
}) {
  const profilePath = `/${input.accountId}`;
  const profile = await fetchMetaResult<InstagramProfilePayload>({
    path: profilePath,
    token: input.token,
    appSecret: input.appSecret,
    params: { fields: "id,username,followers_count" },
    metricOrOperation: "instagram.account",
  });
  if (profile.warning) input.warnings.push(profile.warning);

  const metricNames = ["reach", "views", "profile_views", "profile_links_taps", "total_interactions", "accounts_engaged"] as const;
  const metricValues = await Promise.all(metricNames.map(async (metric) => [
    metric,
    await fetchInsightMetric({
      objectId: input.accountId,
      metric,
      token: input.token,
      appSecret: input.appSecret,
      period: input.period,
      totalValue: true,
      warnings: input.warnings,
      operationPrefix: "instagram.account",
    }),
  ] as const));
  const metrics = Object.fromEntries(metricValues) as Record<typeof metricNames[number], number | null>;

  const mediaPath = `/${input.accountId}/media`;
  const mediaResult = await fetchMetaResult<InstagramMediaPayload>({
    path: mediaPath,
    token: input.token,
    appSecret: input.appSecret,
    params: {
      fields: "id,caption,media_type,timestamp,permalink,like_count,comments_count",
      since: input.period.since,
      until: input.period.until,
      limit: "100",
    },
    metricOrOperation: "instagram.media.list",
  });
  if (mediaResult.warning) input.warnings.push(mediaResult.warning);
  if (mediaResult.payload?.paging?.next) {
    input.warnings.push({
      endpoint: mediaPath,
      code: null,
      message: "O período possui mais de 100 mídias; o ranking considera as 100 primeiras retornadas pela Meta.",
      metricOrOperation: "instagram.media.pagination",
    });
  }

  const candidates = (mediaResult.payload?.data ?? [])
    .filter((media) => media.id)
    .sort((left, right) => ((right.like_count ?? 0) + (right.comments_count ?? 0)) - ((left.like_count ?? 0) + (left.comments_count ?? 0)))
    .slice(0, 10);
  const topContent = [];
  for (const media of candidates) {
    const mediaMetrics = ["reach", "views", "saved", "shares", "total_interactions"] as const;
    const values = await Promise.all(mediaMetrics.map(async (metric) => {
      const path = `/${media.id}/insights`;
      const result = await fetchMetaResult<MetaInsightsPayload>({
        path,
        token: input.token,
        appSecret: input.appSecret,
        params: { metric },
        metricOrOperation: `instagram.media.${media.id}.${metric}`,
      });
      if (result.warning) input.warnings.push(result.warning);
      return [metric, insightNumber(result.payload)] as const;
    }));
    const mediaInsight = Object.fromEntries(values) as Record<typeof mediaMetrics[number], number | null>;
    topContent.push({
      id: media.id,
      caption: media.caption ?? null,
      mediaType: media.media_type ?? null,
      timestamp: media.timestamp ?? null,
      permalink: media.permalink ?? null,
      reach: mediaInsight.reach,
      views: mediaInsight.views,
      likes: media.like_count ?? null,
      comments: media.comments_count ?? null,
      saved: mediaInsight.saved,
      shares: mediaInsight.shares,
      totalInteractions: mediaInsight.total_interactions,
    });
  }
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
  pageId: string;
  savedPageName: string | null;
  userToken: string;
  appSecret: string;
  period: MetaInsightsPeriod;
  warnings: MetaInsightsWarning[];
}) {
  const pageAccess = await getFacebookPageAccessContext({
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
    });
  }

  const metricNames = ["page_total_media_view_unique", "page_media_view", "page_post_engagements", "page_views_total"] as const;
  const metricValues = await Promise.all(metricNames.map(async (metric) => [
    metric,
    await fetchInsightMetric({
      objectId: input.pageId,
      metric,
      token: pageToken,
      appSecret: input.appSecret,
      period: input.period,
      warnings: input.warnings,
      operationPrefix: "facebook.page",
    }),
  ] as const));
  const metrics = Object.fromEntries(metricValues) as Record<typeof metricNames[number], number | null>;
  input.warnings.push({
    endpoint: `/${input.pageId}/insights`,
    code: null,
    message: "page_impressions não é uma métrica válida na Graph API v26 e não possui equivalente direto. page_media_view é retornada separadamente como views.",
    metricOrOperation: "facebook.page.impressions",
  });
  for (const metric of metricNames) {
    const operation = `facebook.page.${metric}`;
    if (metrics[metric] === null && !input.warnings.some((warning) => warning.metricOrOperation === operation)) {
      input.warnings.push({
        endpoint: `/${input.pageId}/insights`,
        code: null,
        message: "A Meta não retornou valor numérico para esta métrica no período informado.",
        metricOrOperation: operation,
      });
    }
  }

  const postsPath = `/${input.pageId}/posts`;
  const posts = await fetchMetaResult<FacebookPostsPayload>({
    path: postsPath,
    token: pageToken,
    appSecret: input.appSecret,
    params: {
      fields: "id,message,created_time,permalink_url,reactions.limit(0).summary(true),comments.limit(0).summary(true),shares",
      since: input.period.since,
      until: input.period.until,
      limit: "100",
    },
    metricOrOperation: "facebook.posts.list",
  });
  if (posts.warning) input.warnings.push(posts.warning);
  const postCandidates = (posts.payload?.data ?? []).filter((post) => post.id).map((post) => {
    const reactions = post.reactions?.summary?.total_count ?? null;
    const comments = post.comments?.summary?.total_count ?? null;
    const shares = post.shares?.count ?? null;
    return {
      id: post.id,
      message: post.message ?? null,
      timestamp: post.created_time ?? null,
      permalink: post.permalink_url ?? null,
      reactions,
      comments,
      shares,
      interactions: (reactions ?? 0) + (comments ?? 0) + (shares ?? 0),
    };
  }).sort((left, right) => right.interactions - left.interactions).slice(0, 10);
  const topContent = [];
  for (const post of postCandidates) {
    const postMetrics = ["post_total_media_view_unique", "post_media_view", "post_clicks"] as const;
    const values = await Promise.all(postMetrics.map(async (metric) => {
      const path = `/${post.id}/insights`;
      const result = await fetchMetaResult<MetaInsightsPayload>({
        path,
        token: pageToken,
        appSecret: input.appSecret,
        params: { metric, period: "lifetime" },
        metricOrOperation: `facebook.post.${post.id}.${metric}`,
      });
      if (result.warning) input.warnings.push(result.warning);
      return [metric, insightNumber(result.payload)] as const;
    }));
    const postInsight = Object.fromEntries(values) as Record<typeof postMetrics[number], number | null>;
    topContent.push({
      ...post,
      reach: postInsight.post_total_media_view_unique,
      views: postInsight.post_media_view,
      clicks: postInsight.post_clicks,
    });
  }
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

  const instagram = assets.instagramAccountId ? await getInstagramInsights({
    accountId: assets.instagramAccountId,
    savedUsername: assets.instagramUsername,
    token,
    appSecret: config.appSecret,
    period,
    warnings,
  }) : null;
  const facebook = assets.facebookPageId ? await getFacebookInsights({
    pageId: assets.facebookPageId,
    savedPageName: assets.facebookPageName,
    userToken: token,
    appSecret: config.appSecret,
    period,
    warnings,
  }) : null;

  return { period, instagram, facebook, warnings };
}
