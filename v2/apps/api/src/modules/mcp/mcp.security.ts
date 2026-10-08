import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { FastifyInstance } from "fastify";

export const MCP_READ_SCOPE = "planning:read";
export const MCP_PAUTA_CREATE_SCOPE = "pauta:create";
export const MCP_RADAR_SUGGEST_SCOPE = "radar:suggest";
export const MCP_DEFAULT_SCOPES = [MCP_READ_SCOPE, MCP_PAUTA_CREATE_SCOPE] as const;
export const MCP_SUPPORTED_SCOPES = [...MCP_DEFAULT_SCOPES, MCP_RADAR_SUGGEST_SCOPE] as const;
export function requestedMcpScopes(value?: string) {
  const scopes = [...new Set((value ?? MCP_DEFAULT_SCOPES.join(" ")).split(/\s+/).filter(Boolean))];
  if (!scopes.includes(MCP_READ_SCOPE) || scopes.some(scope => !(MCP_SUPPORTED_SCOPES as readonly string[]).includes(scope))) throw Error("A conexão solicitou uma permissão não permitida.");
  return scopes.join(" ");
}
export function refreshMcpScopes(granted: string, requested?: string) {
  const scope = requested === undefined ? granted : requestedMcpScopes(requested);
  if (scope.split(/\s+/).some(item => !granted.split(/\s+/).includes(item))) throw Error("Novo scope exige consentimento OAuth explícito.");
  return scope;
}
export const MCP_ACCESS_TTL_SECONDS = 60 * 60;
export const MCP_REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function mcpPublicUrls(app: FastifyInstance) {
  const origin = new URL(app.appEnv.API_URL).origin;
  return {
    issuer: origin,
    resource: `${origin}/mcp`,
    authorizationEndpoint: `${origin}/oauth/authorize`,
    tokenEndpoint: `${origin}/oauth/token`,
    registrationEndpoint: `${origin}/oauth/register`,
    revocationEndpoint: `${origin}/oauth/revoke`,
  };
}

export function opaqueToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function tokenHash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function pkceChallenge(verifier: string) {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

function mcpSigningSecret(app: FastifyInstance) {
  return crypto
    .createHmac("sha256", app.appEnv.JWT_SECRET)
    .update("design-hub-v2:mcp-oauth:v1")
    .digest("hex");
}

type McpAccessClaims = jwt.JwtPayload & {
  type: "mcp_access";
  sub: string;
  client_id: string;
  scope: string;
};

export function signMcpAccessToken(
  app: FastifyInstance,
  input: { userId: string; clientId: string; scope: string },
) {
  const urls = mcpPublicUrls(app);
  return jwt.sign(
    {
      type: "mcp_access",
      client_id: input.clientId,
      scope: input.scope,
    },
    mcpSigningSecret(app),
    {
      subject: input.userId,
      issuer: urls.issuer,
      audience: urls.resource,
      expiresIn: MCP_ACCESS_TTL_SECONDS,
      jwtid: crypto.randomUUID(),
    },
  );
}

export function verifyMcpAccessToken(app: FastifyInstance, token: string): McpAccessClaims {
  const urls = mcpPublicUrls(app);
  const payload = jwt.verify(token, mcpSigningSecret(app), {
    issuer: urls.issuer,
    audience: urls.resource,
  });
  if (
    typeof payload === "string" ||
    payload.type !== "mcp_access" ||
    typeof payload.sub !== "string" ||
    typeof payload.client_id !== "string" ||
    typeof payload.scope !== "string" ||
    !payload.scope.split(/\s+/).includes(MCP_READ_SCOPE)
  ) {
    throw new jwt.JsonWebTokenError("Invalid MCP access token");
  }
  return payload as McpAccessClaims;
}
