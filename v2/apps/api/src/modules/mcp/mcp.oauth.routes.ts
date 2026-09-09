import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { findUserByEmail } from "../auth/auth.repository.js";
import { verifyPassword } from "../auth/auth.crypto.js";
import {
  consumeAuthorizationCode,
  createMcpClient,
  findMcpClient,
  revokeRefreshToken,
  rotateRefreshToken,
  saveAuthorizationCode,
  saveRefreshToken,
} from "./mcp.repository.js";
import {
  MCP_ACCESS_TTL_SECONDS,
  MCP_PAUTA_CREATE_SCOPE,
  MCP_READ_SCOPE,
  MCP_REFRESH_TTL_MS,
  MCP_SUPPORTED_SCOPES,
  mcpPublicUrls,
  opaqueToken,
  pkceChallenge,
  signMcpAccessToken,
} from "./mcp.security.js";

type FormBody = Record<string, string | undefined>;

const attempts = new Map<string, { count: number; resetAt: number }>();

function withinLimit(key: string, max: number) {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  current.count += 1;
  return current.count <= max;
}

function oauthError(reply: FastifyReply, status: number, error: string, description: string) {
  return reply
    .code(status)
    .header("Cache-Control", "no-store")
    .header("Pragma", "no-cache")
    .send({ error, error_description: description });
}

function html(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

function validRedirectUri(value: string, production: boolean) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return true;
    return !production && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function consentPage(input: {
  clientName: string;
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  resource: string;
  scope: string;
  error?: string;
}) {
  const hidden = Object.entries({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
    response_type: "code",
    scope: input.scope,
    resource: input.resource,
  }).map(([name, value]) => `<input type="hidden" name="${name}" value="${html(value)}">`).join("");

  const canCreatePauta = input.scope.split(/\s+/).includes(MCP_PAUTA_CREATE_SCOPE);
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Autorizar planejamento</title><style>
  :root{font-family:Inter,ui-sans-serif,system-ui;color:#15213e;background:linear-gradient(135deg,#eef8ff,#fff2f8)}*{box-sizing:border-box}body{min-height:100vh;margin:0;display:grid;place-items:center;padding:24px}.card{width:min(520px,100%);background:rgba(255,255,255,.92);border:1px solid #dce5f4;border-radius:28px;padding:32px;box-shadow:0 22px 60px rgba(61,75,115,.14)}h1{font-size:26px;margin:0 0 10px}p{line-height:1.55;color:#5f6d88}.scope{background:#f4f6ff;border-radius:16px;padding:16px;margin:22px 0}.scope strong{display:block;color:#4438ca;margin-bottom:6px}.scope.write{margin-top:-12px;background:#fff7e8}.scope.write strong{color:#b56808}label{display:block;font-weight:650;margin:14px 0 7px}input[type=email],input[type=password]{width:100%;padding:13px 14px;border:1px solid #cfd8e8;border-radius:12px;font:inherit}button{width:100%;margin-top:22px;border:0;border-radius:13px;padding:14px;background:linear-gradient(90deg,#2fb7e9,#7247ef);color:white;font:700 16px inherit;cursor:pointer}.error{color:#b42318;background:#fff1f0;padding:10px 12px;border-radius:10px}.fine{font-size:13px;color:#7b879d;margin-top:16px}</style></head><body><main class="card"><h1>Conectar ao Design Hub</h1><p><strong>${html(input.clientName)}</strong> está solicitando acesso ao seu planejamento.</p>${input.error ? `<p class="error">${html(input.error)}</p>` : ""}<div class="scope"><strong>Leitura do planejamento e do Radar</strong>Consultar clientes, cards, prazos, aprovações, agenda, comentários e contexto de monitoramento.</div>${canCreatePauta ? `<div class="scope write"><strong>Criação limitada de pautas</strong>Criar somente pautas em rascunho após sua confirmação explícita. Não poderá editar ou excluir conteúdo, mover o Kanban nem publicar.</div>` : ""}<form method="post" action="/oauth/authorize">${hidden}<label for="email">Seu email do Design Hub</label><input id="email" name="email" type="email" autocomplete="username" required><label for="password">Sua senha</label><input id="password" name="password" type="password" autocomplete="current-password" required><button type="submit">Autorizar acesso protegido</button></form><p class="fine">Você poderá desconectar e revogar esta autorização pelo ChatGPT. Sua senha é usada apenas para confirmar sua identidade e não é compartilhada.</p></main></body></html>`;
}

async function validatedAuthorization(app: FastifyRequest["server"], query: FormBody) {
  const urls = mcpPublicUrls(app);
  const clientId = query.client_id ?? "";
  const client = await findMcpClient(app.db, clientId);
  const redirectUri = query.redirect_uri ?? "";
  if (!client || !client.redirectUris.includes(redirectUri)) throw new Error("Aplicativo ou endereço de retorno inválido.");
  if (query.response_type !== "code") throw new Error("Tipo de autorização não suportado.");
  if (query.code_challenge_method !== "S256" || !/^[A-Za-z0-9_-]{43,128}$/.test(query.code_challenge ?? "")) throw new Error("A conexão deve usar PKCE S256 válido.");
  const requestedScopes = (query.scope ?? MCP_SUPPORTED_SCOPES.join(" ")).split(/\s+/).filter(Boolean);
  if (!requestedScopes.includes(MCP_READ_SCOPE) || requestedScopes.some((scope) => !(MCP_SUPPORTED_SCOPES as readonly string[]).includes(scope))) throw new Error("A conexão solicitou uma permissão não permitida.");
  const scope = requestedScopes.join(" ");
  const resource = query.resource ?? urls.resource;
  if (resource !== urls.resource) throw new Error("Recurso MCP inválido.");
  return { client, redirectUri, resource, scope };
}

export const mcpOAuthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/.well-known/oauth-authorization-server", async (_request, reply) => {
    const urls = mcpPublicUrls(app);
    return reply.header("Cache-Control", "public, max-age=3600").send({
      issuer: urls.issuer,
      authorization_endpoint: urls.authorizationEndpoint,
      token_endpoint: urls.tokenEndpoint,
      registration_endpoint: urls.registrationEndpoint,
      revocation_endpoint: urls.revocationEndpoint,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: [...MCP_SUPPORTED_SCOPES],
    });
  });

  app.get("/.well-known/oauth-protected-resource/mcp", async (_request, reply) => {
    const urls = mcpPublicUrls(app);
    return reply.header("Cache-Control", "public, max-age=3600").send({
      resource: urls.resource,
      authorization_servers: [urls.issuer],
      bearer_methods_supported: ["header"],
      scopes_supported: [...MCP_SUPPORTED_SCOPES],
      resource_name: "Design Hub — planejamento e pautas confirmadas",
    });
  });

  app.post("/oauth/register", async (request, reply) => {
    if (!withinLimit(`register:${request.ip}`, 10)) return oauthError(reply, 429, "slow_down", "Muitas tentativas. Tente novamente em um minuto.");
    const body = (request.body ?? {}) as { client_name?: unknown; redirect_uris?: unknown; token_endpoint_auth_method?: unknown };
    const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter((item): item is string => typeof item === "string") : [];
    if (!redirectUris.length || redirectUris.length > 5 || redirectUris.some((uri) => !validRedirectUri(uri, app.appEnv.NODE_ENV === "production"))) {
      return oauthError(reply, 400, "invalid_redirect_uri", "Informe endereços HTTPS válidos.");
    }
    if (body.token_endpoint_auth_method && body.token_endpoint_auth_method !== "none") {
      return oauthError(reply, 400, "invalid_client_metadata", "Este servidor aceita clientes públicos com PKCE.");
    }
    const name = typeof body.client_name === "string" ? body.client_name.trim().slice(0, 190) : "ChatGPT";
    const client = await createMcpClient(app.db, { name: name || "ChatGPT", redirectUris });
    return reply.code(201).send({
      client_id: client.clientId,
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    });
  });

  app.get("/oauth/authorize", async (request, reply) => {
    try {
      const query = request.query as FormBody;
      const validated = await validatedAuthorization(app, query);
      return reply.type("text/html; charset=utf-8").header("Cache-Control", "no-store").header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'").send(consentPage({ clientName: validated.client.clientName, clientId: validated.client.clientId, redirectUri: validated.redirectUri, state: query.state ?? "", codeChallenge: query.code_challenge ?? "", resource: validated.resource, scope: validated.scope }));
    } catch (error) {
      return reply.code(400).type("text/plain; charset=utf-8").send(error instanceof Error ? error.message : "Solicitação inválida.");
    }
  });

  app.post("/oauth/authorize", async (request, reply) => {
    const body = request.body as FormBody;
    try {
      if (!withinLimit(`login:${request.ip}`, 10)) return reply.code(429).type("text/plain").send("Muitas tentativas. Aguarde um minuto.");
      const validated = await validatedAuthorization(app, body);
      const email = body.email?.trim().toLowerCase() ?? "";
      const password = body.password ?? "";
      const user = await findUserByEmail(app.db, email);
      const passwordOk = Boolean(user?.is_active) && await verifyPassword(password, user!.password_hash);
      if (!user || !passwordOk || user.global_role !== "super_admin") {
        return reply.code(401).type("text/html; charset=utf-8").header("Cache-Control", "no-store").send(consentPage({ clientName: validated.client.clientName, clientId: validated.client.clientId, redirectUri: validated.redirectUri, state: body.state ?? "", codeChallenge: body.code_challenge ?? "", resource: validated.resource, scope: validated.scope, error: "Email, senha ou permissão inválidos." }));
      }
      const code = opaqueToken();
      await saveAuthorizationCode(app.db, { code, clientId: validated.client.clientId, userId: user.id, redirectUri: validated.redirectUri, codeChallenge: body.code_challenge ?? "", scope: validated.scope, resource: validated.resource });
      const destination = new URL(validated.redirectUri);
      destination.searchParams.set("code", code);
      if (body.state) destination.searchParams.set("state", body.state);
      return reply.redirect(destination.toString());
    } catch (error) {
      return reply.code(400).type("text/plain; charset=utf-8").send(error instanceof Error ? error.message : "Não foi possível autorizar.");
    }
  });

  app.post("/oauth/token", async (request, reply) => {
    const body = request.body as FormBody;
    const urls = mcpPublicUrls(app);
    reply.header("Cache-Control", "no-store").header("Pragma", "no-cache");
    if (body.grant_type === "authorization_code") {
      const client = await findMcpClient(app.db, body.client_id ?? "");
      if (!client) return oauthError(reply, 401, "invalid_client", "Cliente desconhecido.");
      const grant = await consumeAuthorizationCode(app.db, body.code ?? "");
      const verifier = body.code_verifier ?? "";
      if (!grant || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier) || grant.clientId !== client.clientId || grant.redirectUri !== body.redirect_uri || pkceChallenge(verifier) !== grant.codeChallenge || grant.resource !== (body.resource ?? grant.resource)) {
        return oauthError(reply, 400, "invalid_grant", "Código inválido, expirado ou já utilizado.");
      }
      const refreshToken = opaqueToken();
      await saveRefreshToken(app.db, { token: refreshToken, clientId: grant.clientId, userId: grant.userId, scope: grant.scope, resource: grant.resource, expiresAtMs: Date.now() + MCP_REFRESH_TTL_MS });
      return { access_token: signMcpAccessToken(app, { userId: grant.userId, clientId: grant.clientId, scope: grant.scope }), token_type: "Bearer", expires_in: MCP_ACCESS_TTL_SECONDS, refresh_token: refreshToken, scope: grant.scope, resource: urls.resource };
    }
    if (body.grant_type === "refresh_token") {
      const grant = await rotateRefreshToken(app.db, body.refresh_token ?? "");
      if (!grant || grant.clientId !== body.client_id || grant.resource !== (body.resource ?? grant.resource)) return oauthError(reply, 400, "invalid_grant", "Token de renovação inválido ou expirado.");
      const refreshToken = opaqueToken();
      await saveRefreshToken(app.db, { token: refreshToken, clientId: grant.clientId, userId: grant.userId, scope: grant.scope, resource: grant.resource, expiresAtMs: Date.now() + MCP_REFRESH_TTL_MS });
      return { access_token: signMcpAccessToken(app, { userId: grant.userId, clientId: grant.clientId, scope: grant.scope }), token_type: "Bearer", expires_in: MCP_ACCESS_TTL_SECONDS, refresh_token: refreshToken, scope: grant.scope, resource: urls.resource };
    }
    return oauthError(reply, 400, "unsupported_grant_type", "Fluxo não suportado.");
  });

  app.post("/oauth/revoke", async (request, reply) => {
    const body = request.body as FormBody;
    if (body.token && body.client_id) await revokeRefreshToken(app.db, body.token, body.client_id);
    return reply.code(200).send();
  });
};
