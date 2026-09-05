import type { FastifyPluginAsync } from "fastify";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { findAuthContextByUserId } from "../auth/auth.repository.js";
import { createPlanningMcpServer } from "./mcp.server.js";
import { MCP_READ_SCOPE, mcpPublicUrls, verifyMcpAccessToken } from "./mcp.security.js";

const requestCounts = new Map<string, { count: number; resetAt: number }>();

function allowed(key: string) {
  const now = Date.now();
  const current = requestCounts.get(key);
  if (!current || current.resetAt <= now) {
    requestCounts.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  current.count += 1;
  return current.count <= 60;
}

export const mcpRoutes: FastifyPluginAsync = async (app) => {
  app.post("/mcp", async (request, reply) => {
    const urls = mcpPublicUrls(app);
    const authorization = request.headers.authorization ?? "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
    let claims;
    try {
      if (!token) throw new Error("missing token");
      claims = verifyMcpAccessToken(app, token);
    } catch {
      return reply
        .code(401)
        .header("WWW-Authenticate", `Bearer resource_metadata="${new URL("/.well-known/oauth-protected-resource/mcp", urls.issuer)}", scope="${MCP_READ_SCOPE}"`)
        .send({ jsonrpc: "2.0", error: { code: -32001, message: "Autorização MCP obrigatória." }, id: null });
    }
    if (!allowed(`${claims.client_id}:${claims.sub}`)) {
      return reply.code(429).send({ jsonrpc: "2.0", error: { code: -32002, message: "Limite temporário de consultas excedido." }, id: null });
    }
    const auth = await findAuthContextByUserId(app.db, claims.sub);
    if (!auth?.user.isActive || auth.user.globalRole !== "super_admin") {
      return reply.code(403).send({ jsonrpc: "2.0", error: { code: -32003, message: "Esta autorização não possui mais acesso." }, id: null });
    }

    const server = createPlanningMcpServer(app, auth, claims.client_id);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
      enableDnsRebindingProtection: true,
      allowedHosts: [new URL(urls.resource).host],
    });
    try {
      await server.connect(transport);
      Object.assign(request.raw, { auth: { token, clientId: claims.client_id, scopes: [MCP_READ_SCOPE], expiresAt: claims.exp, resource: new URL(urls.resource), extra: { userId: auth.user.id } } });
      reply.hijack();
      await transport.handleRequest(request.raw, reply.raw, request.body);
    } catch (error) {
      app.log.error(error, "Unable to handle MCP request");
      if (!reply.raw.headersSent) {
        reply.raw.statusCode = 500;
        reply.raw.setHeader("Content-Type", "application/json");
        reply.raw.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32603, message: "Erro interno da integração." }, id: null }));
      }
    } finally {
      await transport.close().catch(() => undefined);
      await server.close().catch(() => undefined);
    }
  });

  app.get("/mcp", async (_request, reply) => reply.code(405).header("Allow", "POST").send({ error: "Use POST para conectar ao MCP." }));
  app.delete("/mcp", async (_request, reply) => reply.code(405).header("Allow", "POST").send({ error: "Sessões persistentes não são utilizadas." }));
};

