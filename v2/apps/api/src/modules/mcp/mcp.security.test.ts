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
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { readFileSync } from "node:fs";

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

const defaultScope = "planning:read pauta:create";
const supportedScopes = ["planning:read", "pauta:create", "radar:suggest"];
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
    if (sql.startsWith("SELECT a.id, a.name, a.slug, a.locale FROM client_accounts")) {
      return [[{ id: userId, name: "Test client", slug: "test", locale: "pt-BR" }]];
    }
    if (sql.startsWith("INSERT INTO mcp_audit_log")) return [{}];
    if (sql.startsWith("INSERT INTO mcp_oauth_codes")) {
      const [hash, client, user, redirect, challenge, scope, resource, expiry, radarAiAuthorized] = values;
      codes.set(String(hash), { client_id: client, user_id: user, redirect_uri: redirect,
        code_challenge: challenge, scope, resource, expires_at_ms: expiry, used_at_ms: null, radar_ai_authorized: radarAiAuthorized });
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
      const [hash, client, user, scope, resource, expiry, radarAiAuthorized] = values;
      refreshes.set(String(hash), { client_id: client, user_id: user, scope, resource,
        expires_at_ms: expiry, revoked_at_ms: null, radar_ai_authorized: radarAiAuthorized });
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
  return { server, authorization, codes, refreshes, authorize };
}

async function listedTools(server: FastifyInstance, accessToken: string) {
  const claims = verifyMcpAccessToken(server, accessToken);
  const auth: AuthContext = { user: { id: userId, fullName: "Test", email: "test@example.org",
    globalRole: "super_admin", avatarUrl: null, locale: "pt-BR", isActive: true }, memberships: [] };
  const mcp = createPlanningMcpServer(server, auth, claims.client_id, claims.scope.split(/\s+/), { radarAiAuthorized: claims.radar_ai_authorized === true });
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
      assert.deepEqual(response.json().scopes_supported, supportedScopes);
    }
    const denied = await f.server.inject({ method: "POST", url: "/mcp", payload: {} });
    assert.equal(denied.statusCode, 401);
    assert.equal(denied.headers["www-authenticate"],
      'Bearer resource_metadata="https://app.example.com/.well-known/oauth-protected-resource/mcp", scope="' + defaultScope + '"');
    assert.equal(f.codes.size, 0);
  } finally { await f.server.close(); }
});

test("OAuth real ChatGPT URL shows optional unchecked internal Radar consent", async () => {
  const f = await oauthFixture();
  try {
    const params = new URLSearchParams({ ...f.authorization, scope: defaultScope });
    assert.match(params.toString(), /scope=planning%3Aread\+pauta%3Acreate/);
    const page = await f.server.inject("/oauth/authorize?" + params);
    assert.equal(page.statusCode, 200);
    assert.match(page.body, /name="scope" value="planning:read pauta:create"/);
    assert.match(page.body, /name="radar_consent" value="yes"/);
    assert.match(page.body, /Autorizo sugestões do Radar com uso de IA\./);
    assert.doesNotMatch(page.body, /radar_consent[^>]*(?:checked|required)/);
    const noScopePage = await f.server.inject("/oauth/authorize?" + new URLSearchParams(f.authorization));
    assert.match(noScopePage.body, /name="scope" value="planning:read pauta:create"/);
  } finally { await f.server.close(); }
});

test("OAuth real ChatGPT scopes work without consent, preserve old tools and never grant Radar", async () => {
  const f = await oauthFixture();
  try {
    const token = await f.authorize(defaultScope);
    assert.equal(token.scope, defaultScope);
    assert.equal(verifyMcpAccessToken(f.server, token.access_token).radar_ai_authorized, false);
    assert.ok([...f.codes.values()].every(code => code.radar_ai_authorized === 0));
    assert.ok([...f.refreshes.values()].every(token => token.radar_ai_authorized === 0));
    const tools = await listedTools(f.server, token.access_token);
    assert.ok(!tools.includes("create_radar_suggestion"));
    assert.ok(tools.includes("create_pauta_draft"));
    assert.ok(tools.includes("list_clients"));
    const renewed = await f.server.inject({ method: "POST", url: "/oauth/token",
      payload: { grant_type: "refresh_token", client_id: clientId,
        refresh_token: token.refresh_token, radar_consent: "yes", radar_ai_authorized: true } });
    assert.equal(renewed.statusCode, 200);
    assert.equal(renewed.json().scope, defaultScope);
    assert.equal(verifyMcpAccessToken(f.server, renewed.json().access_token).radar_ai_authorized, false);
    assert.ok(!(await listedTools(f.server, renewed.json().access_token)).includes("create_radar_suggestion"));
  } finally { await f.server.close(); }
});

test("OAuth explicit internal consent enables Radar without adding OAuth scopes; refresh preserves decision", async () => {
  const f = await oauthFixture();
  try {
    const token = await f.authorize(defaultScope, true);
    assert.equal(token.scope, defaultScope);
    const claims = verifyMcpAccessToken(f.server, token.access_token);
    assert.equal(claims.scope, defaultScope);
    assert.equal(claims.radar_ai_authorized, true);
    assert.ok([...f.codes.values()].every(code => code.radar_ai_authorized === 1));
    assert.ok([...f.refreshes.values()].every(token => token.radar_ai_authorized === 1));
    const legacyToken = signMcpAccessToken(f.server, { userId, clientId, scope: legacyScope });
    const legacyTools = await listedTools(f.server, legacyToken);
    const tools = await listedTools(f.server, token.access_token);
    assert.ok(tools.includes("create_radar_suggestion"));
    assert.deepEqual(tools.filter(name => name !== "create_radar_suggestion").sort(), legacyTools.sort());
    let current = token;
    for (let i = 0; i < 2; i++) {
      const refresh = await f.server.inject({ method: "POST", url: "/oauth/token",
        payload: { grant_type: "refresh_token", client_id: clientId, refresh_token: current.refresh_token } });
      assert.equal(refresh.statusCode, 200);
      current = refresh.json();
      assert.equal(current.scope, defaultScope);
      assert.equal(verifyMcpAccessToken(f.server, current.access_token).radar_ai_authorized, true);
      assert.ok((await listedTools(f.server, current.access_token)).includes("create_radar_suggestion"));
    }
    const noConsentConnection = await f.authorize(defaultScope, false);
    assert.equal(verifyMcpAccessToken(f.server, noConsentConnection.access_token).radar_ai_authorized, false);
    assert.equal(verifyMcpAccessToken(f.server, current.access_token).radar_ai_authorized, true);
    const down = await f.server.inject({ method: "POST", url: "/oauth/token", payload: {
      grant_type: "refresh_token", client_id: clientId, refresh_token: current.refresh_token, scope: "planning:read" } });
    assert.equal(down.statusCode, 200);
    assert.equal(down.json().scope, "planning:read");
    assert.equal(verifyMcpAccessToken(f.server, down.json().access_token).radar_ai_authorized, true);
    assert.ok(!(await listedTools(f.server, down.json().access_token)).includes("create_radar_suggestion"));
  } finally { await f.server.close(); }
});

test("OAuth old refresh tokens and the compatibility radar scope never imply internal consent", async () => {
  const f = await oauthFixture();
  try {
    await saveRefreshToken(f.server.db, { token: "existing-refresh-token", clientId, userId,
      scope: legacyScope, resource: "https://app.example.com/mcp", expiresAtMs: Date.now() + 60_000 });
    const denied = await f.server.inject({ method: "POST", url: "/oauth/token", payload: {
      grant_type: "refresh_token", client_id: clientId, refresh_token: "existing-refresh-token",
      scope: legacyScope + " radar:suggest" } });
    assert.equal(denied.statusCode, 400);
    assert.equal(denied.json().error, "invalid_scope");
    const renewed = await f.server.inject({ method: "POST", url: "/oauth/token", payload: {
      grant_type: "refresh_token", client_id: clientId, refresh_token: "existing-refresh-token" } });
    assert.equal(renewed.statusCode, 200);
    assert.equal(renewed.json().scope, legacyScope);
    assert.equal(verifyMcpAccessToken(f.server, renewed.json().access_token).radar_ai_authorized, false);
    const compatibility = await f.authorize(defaultScope + " radar:suggest", false);
    assert.equal(compatibility.scope, defaultScope + " radar:suggest");
    assert.ok(!(await listedTools(f.server, compatibility.access_token)).includes("create_radar_suggestion"));
    const readOnly = await f.authorize("planning:read", true);
    assert.equal(verifyMcpAccessToken(f.server, readOnly.access_token).radar_ai_authorized, false);
    assert.ok(!(await listedTools(f.server, readOnly.access_token)).includes("create_radar_suggestion"));
  } finally { await f.server.close(); }
});

test("signed legacy access tokens missing internal consent stay unauthorized for Radar", async () => {
  const f = await oauthFixture();
  try {
    const claims = jwt.decode(signMcpAccessToken(f.server, {
      userId, clientId, scope: defaultScope + " radar:suggest",
    })) as jwt.JwtPayload;
    delete claims.radar_ai_authorized;
    const secret = crypto.createHmac("sha256", f.server.appEnv.JWT_SECRET)
      .update("design-hub-v2:mcp-oauth:v1").digest("hex");
    const legacy = jwt.sign(claims, secret);
    assert.equal(verifyMcpAccessToken(f.server, legacy).radar_ai_authorized, undefined);
    assert.ok(!(await listedTools(f.server, legacy)).includes("create_radar_suggestion"));
  } finally { await f.server.close(); }
});

test("HTTP MCP tools/list uses signed consent and keeps existing read tools operational", async () => {
  const f = await oauthFixture();
  try {
    for (const consent of [false, true]) {
      const token = await f.authorize(defaultScope, consent);
      const headers = { authorization: "Bearer " + token.access_token,
        accept: "application/json, text/event-stream", host: "app.example.com" };
      const listed = await f.server.inject({ method: "POST", url: "/mcp", headers,
        payload: { jsonrpc: "2.0", id: 1, method: "tools/list" } });
      assert.equal(listed.statusCode, 200);
      const names = listed.json().result.tools.map((tool: { name: string }) => tool.name);
      assert.equal(names.includes("create_radar_suggestion"), consent);
      assert.ok(names.includes("create_pauta_draft"));
      const clients = await f.server.inject({ method: "POST", url: "/mcp", headers,
        payload: { jsonrpc: "2.0", id: 2, method: "tools/call", params: {
          name: "list_clients", arguments: {},
        } } });
      assert.equal(clients.statusCode, 200);
      assert.equal(clients.json().result.isError, undefined);
      assert.equal(JSON.parse(clients.json().result.content[0].text).clients[0].name, "Test client");
    }
  } finally { await f.server.close(); }
});

test("consent migration is additive, defaults to denied and contains no legacy scope inference", () => {
  const sql = readFileSync(new URL("../../../../../database/migrations/20261008_mcp_radar_internal_consent.sql", import.meta.url), "utf8");
  assert.match(sql, /ALTER TABLE mcp_oauth_codes/);
  assert.match(sql, /ALTER TABLE mcp_oauth_refresh_tokens/);
  assert.equal((sql.match(/ADD COLUMN IF NOT EXISTS radar_ai_authorized TINYINT\(1\) NOT NULL DEFAULT 0/g) ?? []).length, 2);
  assert.doesNotMatch(sql, /\b(?:UPDATE|DELETE|DROP|INSERT)\b|radar:suggest/i);
});
