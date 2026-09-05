import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { findAuthContextByUserId } from "../modules/auth/auth.repository.js";
import { verifyAccessToken } from "../modules/auth/auth.tokens.js";

async function authPlugin(app: FastifyInstance) {
  app.addHook("onRequest", async (request) => {
    // OAuth and MCP tokens have their own verifier and cannot authenticate the
    // regular application API.
    if (
      request.url.split("?", 1)[0] === "/mcp" ||
      request.url.startsWith("/oauth/") ||
      request.url.startsWith("/.well-known/oauth-")
    ) {
      request.auth = null;
      return;
    }

    const authorization = request.headers.authorization;
    const bearerToken =
      typeof authorization === "string" && authorization.startsWith("Bearer ")
        ? authorization.slice("Bearer ".length).trim()
        : "";

    if (bearerToken) {
      let payload;
      try {
        payload = verifyAccessToken(app, bearerToken);
      } catch {
        throw app.httpErrors.unauthorized("Token inválido ou expirado.");
      }
      const auth = await findAuthContextByUserId(app.db, payload.sub);
      if (!auth?.user.isActive) {
        throw app.httpErrors.unauthorized("Usuário inativo ou não encontrado.");
      }
      request.auth = auth;
      return;
    }

    // Authentication must never be inferred from a caller-controlled user id.
    // Earlier local builds accepted `x-user-id`, which allowed impersonation if
    // that shortcut reached a deployed environment. All protected requests now
    // require a signed access token.
    request.auth = null;
  });
}

export const authPluginRegistered = fp(authPlugin, {
  name: "auth-plugin",
  dependencies: ["db-plugin"],
});
