import assert from "node:assert/strict";
import test from "node:test";
import type { FastifyInstance } from "fastify";
import { signAccessToken, verifyAccessToken } from "../auth/auth.tokens.js";
import { pkceChallenge, signMcpAccessToken, verifyMcpAccessToken } from "./mcp.security.js";
import Fastify from "fastify";
import formbody from "@fastify/formbody";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { hashPassword } from "../auth/auth.crypto.js";
import { mcpOAuthRoutes } from "./mcp.oauth.routes.js";
import { mcpRoutes } from "./mcp.routes.js";
import { createPlanningMcpServer } from "./mcp.server.js";
import { saveRefreshToken } from "./mcp.repository.js";
import type { AuthContext } from "../auth/auth.types.js";

const app = {
  appEnv: {
    API_URL: "https://app.example.com",
    JWT_SECRET: "a-test-secret-that-is-long-enough",
    JWT_EXPIRES_IN: "1h",
  },
} as unknown as FastifyInstance;

test("application and MCP access tokens are cryptographically separated", () => {
  const appToken = signAccessToken(app, { userId: "user-1", role: "super_admin" });
  const mcpToken = signMcpAccessToken(app, { userId: "user-1", clientId: "chatgpt", scope: "planning:read" });

  assert.equal(verifyAccessToken(app, appToken).type, "access");
  assert.equal(verifyMcpAccessToken(app, mcpToken).type, "mcp_access");
  assert.throws(() => verifyAccessToken(app, mcpToken));
  assert.throws(() => verifyMcpAccessToken(app, appToken));
});

test("PKCE challenge is URL-safe and deterministic", () => {
  const verifier = "test-verifier-abcdefghijklmnopqrstuvwxyz-1234567890";
  const challenge = pkceChallenge(verifier);
  assert.match(challenge, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(challenge, pkceChallenge(verifier));
});

const defaultScope = "planning:read pauta:create radar:suggest";
const legacyScope = "planning:read pauta:create";
const clientId = "oauth-test-client";
const userId = "11111111-1111-4111-8111-111111111111";
const callback = "https://example.org/callback";
const verifier = "v".repeat(50);

// Exercise the real routes, signing, repository and refresh logic with storage in memory.
// Unknown SQL fails immediately, so these tests never connect to a database or provider.
async function oauthFixture() {
  const codes = new Map<string, Record<string, unknown>>();
  const refreshes = new Map<string, Record<string, unknown>>();
  const passwordHash = await hashPassword("test-password-only");
  const query = async (sql: string, values: unknown[] = []) => {
    if (sql.includes("FROM mcp_oauth_clients")) return [[{
      client_id: clientId, client_name: "Test", redirect_uris_json: [callback],
    }]];
    if (sql.includes("FROM users")) return [[{
      id: userId, full_name: "Test", email: "test@example.org", global_role: "super_admin",
      is_active: 1, password_hash: passwordHash, locale: "pt-BR", avatar_url: null,
    }]];
    if (sql.includes("FROM client_memberships")) return [[]];
    if (sql.startsWith("INSERT INTO mcp_oauth_codes")) {
      const [hash, client, user, redirect, challenge, scope, resource, expiry] = values;
      codes.set(String(hash), { client_id: client, user_id: user, redirect_uri: redirect,
        code_challenge: challenge, scope, resource, expires_at_ms: expiry, used_at_ms: null });
      return [{}];
    }
    if (sql.includes("FROM mcp_oauth_codes")) {
      const row = codes.get(String(values[0]));
      return [row ? [{ ...row }] : []];
    }
    if (sql.startsWith("UPDATE mcp_oauth_codes")) {
      codes.get(String(values[1]))!.used_at_ms = values[0];
      return [{}];
    }
    if (sql.startsWith("INSERT INTO mcp_oauth_refresh_tokens")) {
      const [hash, client, user, scope, resource, expiry] = values;
      refreshes.set(String(hash), { client_id: client, user_id: user, scope, resource,
        expires_at_ms: expiry, revoked_at_ms: null });
      return [{}];
    }
    if (sql.includes("FROM mcp_oauth_refresh_tokens")) {
      const row = refreshes.get(String(values[0]));
      return [row ? [{ ...row }] : []];
    }
    if (sql.startsWith("UPDATE mcp_oauth_refresh_tokens")) {
      refreshes.get(String(values[1]))!.revoked_at_ms = values[0];
      return [{}];
    }
    throw Error("Unexpected test SQL: " + sql);
  };
  const db = { query, getConnection: async () => ({
    query, beginTransaction: async () => {}, commit: async () => {},
    rollback: async () => {}, release: () => {},
  }) };
  const server = Fastify();
  server.decorate("db", db as never);
  server.decorate("appEnv", { ...app.appEnv, NODE_ENV: "test" } as never);
  await server.register(formbody);
  await server.register(mcpOAuthRoutes);
  await server.register(mcpRoutes);
  const authorization = {
    client_id: clientId, redirect_uri: callback, response_type: "code",
    code_challenge_method: "S256", code_challenge: pkceChallenge(verifier), state: "test-state",
  };
  async function authorize(scope?: string, consent = false) {
    const response = await server.inject({ method: "POST", url: "/oauth/authorize",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: new URLSearchParams({ ...authorization, email: "test@example.org",
        password: "test-password-only", ...(scope === undefined ? {} : { scope }),
        ...(consent ? { radar_consent: "yes" } : {}) }).toString() });
    assert.equal(response.statusCode, 302);
    const location = new URL(response.headers.location!);
    assert.equal(location.searchParams.get("state"), "test-state");
    const token = await server.inject({ method: "POST", url: "/oauth/token",
      payload: { grant_type: "authorization_code", client_id: clientId,
        redirect_uri: callback, code: location.searchParams.get("code"), code_verifier: verifier } });
    assert.equal(token.statusCode, 200);
    return token.json();
  }
  return { server, authorization, codes, authorize };
}

async function listedTools(server: FastifyInstance, accessToken: string) {
  const claims = verifyMcpAccessToken(server, accessToken);
  const auth: AuthContext = { user: { id: userId, fullName: "Test", email: "test@example.org",
    globalRole: "super_admin", avatarUrl: null, locale: "pt-BR", isActive: true }, memberships: [] };
  const mcp = createPlanningMcpServer(server, auth, claims.client_id, claims.scope.split(/\s+/));
  const client = new Client({ name: "oauth-scope-test", version: "1" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await mcp.connect(serverTransport);
    await client.connect(clientTransport);
    return (await client.listTools()).tools.map(tool => tool.name);
  } finally { await client.close(); await mcp.close(); }
}

test("OAuth discovery advertises all new-connection scopes without granting access", async () => {
  const f = await oauthFixture();
  try {
    for (const path of ["/.well-known/oauth-authorization-server", "/.well-known/oauth-protected-resource/mcp"]) {
      const response = await f.server.inject(path);
      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.json().scopes_supported, defaultScope.split(" "));
    }
    const denied = await f.server.inject({ method: "POST", url: "/mcp", payload: {} });
    assert.equal(denied.statusCode, 401);
    assert.equal(denied.headers["www-authenticate"],
      'Bearer resource_metadata="https://app.example.com/.well-known/oauth-protected-resource/mcp", scope="' + defaultScope + '"');
    assert.equal(f.codes.size, 0);
  } finally { await f.server.close(); }
});

test("OAuth no-scope authorization displays unchecked Radar consent and rejects missing consent", async () => {
  const f = await oauthFixture();
  try {
    const page = await f.server.inject("/oauth/authorize?" + new URLSearchParams(f.authorization));
    assert.equal(page.statusCode, 200);
    assert.match(page.body, /name="scope" value="planning:read pauta:create radar:suggest"/);
    assert.match(page.body, /name="radar_consent" value="yes" required/);
    assert.match(page.body, /Autorizo sugestões do Radar com uso de IA\./);
    assert.doesNotMatch(page.body, /radar_consent[^>]*checked/);
    for (const scope of [undefined, defaultScope]) {
      const denied = await f.server.inject({ method: "POST", url: "/oauth/authorize",
        payload: { ...f.authorization, ...(scope === undefined ? {} : { scope }),
          email: "test@example.org", password: "test-password-only" } });
      assert.equal(denied.statusCode, 400);
      assert.match(denied.body, /consentimento para radar:suggest/);
      assert.equal(f.codes.size, 0);
    }
  } finally { await f.server.close(); }
});

test("OAuth explicit consent grants Radar in token/tools list; refresh preserves it and old tools", async () => {
  const f = await oauthFixture();
  try {
    const token = await f.authorize(undefined, true);
    assert.equal(token.scope, defaultScope);
    assert.equal(verifyMcpAccessToken(f.server, token.access_token).scope, defaultScope);
    const legacyToken = signMcpAccessToken(f.server, { userId, clientId, scope: legacyScope });
    const legacyTools = await listedTools(f.server, legacyToken);
    const tools = await listedTools(f.server, token.access_token);
    assert.ok(tools.includes("create_radar_suggestion"));
    assert.ok(tools.includes("create_pauta_draft"));
    assert.ok(tools.includes("list_clients"));
    assert.deepEqual(tools.filter(name => name !== "create_radar_suggestion").sort(), legacyTools.sort());
    const refresh = await f.server.inject({ method: "POST", url: "/oauth/token",
      payload: { grant_type: "refresh_token", client_id: clientId, refresh_token: token.refresh_token } });
    assert.equal(refresh.statusCode, 200);
    assert.equal(refresh.json().scope, defaultScope);
    assert.equal(verifyMcpAccessToken(f.server, refresh.json().access_token).scope, defaultScope);
  } finally { await f.server.close(); }
});

test("OAuth legacy authorizations and existing access/refresh tokens never acquire Radar silently", async () => {
  const f = await oauthFixture();
  try {
    const page = await f.server.inject("/oauth/authorize?" + new URLSearchParams({
      ...f.authorization, scope: legacyScope }));
    assert.doesNotMatch(page.body, /name="radar_consent"/);
    const token = await f.authorize(legacyScope);
    assert.equal(token.scope, legacyScope);
    assert.ok(!(await listedTools(f.server, token.access_token)).includes("create_radar_suggestion"));
    await saveRefreshToken(f.server.db, { token: "existing-refresh-token", clientId, userId,
      scope: legacyScope, resource: "https://app.example.com/mcp", expiresAtMs: Date.now() + 60_000 });
    const denied = await f.server.inject({ method: "POST", url: "/oauth/token",
      payload: { grant_type: "refresh_token", client_id: clientId,
        refresh_token: "existing-refresh-token", scope: defaultScope } });
    assert.equal(denied.statusCode, 400);
    assert.equal(denied.json().error, "invalid_scope");
    const renewed = await f.server.inject({ method: "POST", url: "/oauth/token",
      payload: { grant_type: "refresh_token", client_id: clientId, refresh_token: "existing-refresh-token" } });
    assert.equal(renewed.statusCode, 200);
    assert.equal(renewed.json().scope, legacyScope);
    assert.equal(verifyMcpAccessToken(f.server, token.access_token).scope, legacyScope);
    assert.ok(!(await listedTools(f.server, renewed.json().access_token)).includes("create_radar_suggestion"));
  } finally { await f.server.close(); }
});
