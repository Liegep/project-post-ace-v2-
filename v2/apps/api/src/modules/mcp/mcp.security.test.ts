import assert from "node:assert/strict";
import test from "node:test";
import type { FastifyInstance } from "fastify";
import { signAccessToken, verifyAccessToken } from "../auth/auth.tokens.js";
import { pkceChallenge, signMcpAccessToken, verifyMcpAccessToken } from "./mcp.security.js";

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

