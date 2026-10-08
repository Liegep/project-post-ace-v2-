import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { mcpOAuthRoutes } from "./mcp.oauth.routes.js";
import { pkceChallenge } from "./mcp.security.js";

const clientId = "oauth-csp-test";
const verifier = "v".repeat(50);

async function fixture(redirectUris: string[]) {
  const server = Fastify();
  const db = {
    async query(sql: string) {
      if (sql.includes("FROM mcp_oauth_clients")) return [[{
        client_id: clientId,
        client_name: "CSP Test",
        redirect_uris_json: redirectUris,
      }], []];
      throw new Error("Unexpected SQL in CSP test");
    },
  };
  server.decorate("db", db as never);
  server.decorate("appEnv", {
    API_URL: "https://app.example.com",
    NODE_ENV: "test",
  } as never);
  await server.register(mcpOAuthRoutes);
  return server;
}

function authorizeUrl(redirectUri: string) {
  return "/oauth/authorize?" + new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    code_challenge_method: "S256",
    code_challenge: pkceChallenge(verifier),
    state: "opaque-state",
    scope: "planning:read pauta:create",
    resource: "https://app.example.com/mcp",
  });
}

test("OAuth CSP allows the API origin and only the registered callback origin", async () => {
  const redirectUri = "https://chatgpt.example.net/connector/oauth/test?mode=1";
  const server = await fixture([redirectUri]);
  try {
    const response = await server.inject(authorizeUrl(redirectUri));
    assert.equal(response.statusCode, 200);
    const csp = response.headers["content-security-policy"] ?? "";
    assert.equal(
      csp,
      "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https://app.example.com https://chatgpt.example.net; base-uri 'none'; frame-ancestors 'none'",
    );
    assert.doesNotMatch(csp, /connector|mode=1|opaque-state/);
  } finally {
    await server.close();
  }
});

test("OAuth CSP follows a different registered callback origin without broadening the allowlist", async () => {
  const redirectUri = "https://second.example.org/oauth/callback";
  const server = await fixture([redirectUri]);
  try {
    const response = await server.inject(authorizeUrl(redirectUri));
    assert.equal(response.statusCode, 200);
    const csp = response.headers["content-security-policy"] ?? "";
    assert.match(csp, /form-action 'self' https:\/\/app\.example\.com https:\/\/second\.example\.org;/);
    assert.doesNotMatch(csp, /chatgpt\.example\.net|\/oauth\/callback/);
  } finally {
    await server.close();
  }
});

test("OAuth rejects an unregistered redirect URI before emitting an allowlisted CSP", async () => {
  const registered = "https://chatgpt.example.net/connector/oauth/test";
  const server = await fixture([registered]);
  try {
    const response = await server.inject(authorizeUrl("https://unregistered.example/callback"));
    assert.equal(response.statusCode, 400);
    assert.equal(response.headers["content-security-policy"], undefined);
  } finally {
    await server.close();
  }
});
