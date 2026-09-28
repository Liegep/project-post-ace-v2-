import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { findMetaConnection, saveMetaOAuthState, upsertMetaConnection } from "./meta.repository.js";

const GRAPH_VERSION = "v26.0";
const META_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
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
  return message.split(accessToken).join("[REDACTED]").split(proof).join("[REDACTED]");
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
