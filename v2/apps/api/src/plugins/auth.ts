import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { findAuthContextByUserId } from "../modules/auth/auth.repository.js";
import { verifyAccessToken } from "../modules/auth/auth.tokens.js";

async function authPlugin(app: FastifyInstance) {
  app.addHook("onRequest", async (request) => {
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
        throw app.httpErrors.unauthorized("Token invalido ou expirado.");
      }
      const auth = await findAuthContextByUserId(app.db, payload.sub);
      request.auth = auth;
      return;
    }

    const headerUserId = request.headers["x-user-id"];
    const userId =
      typeof headerUserId === "string"
        ? headerUserId.trim()
        : Array.isArray(headerUserId)
          ? headerUserId[0]?.trim()
          : "";

    if (!userId) {
      request.auth = null;
      return;
    }

    const auth = await findAuthContextByUserId(app.db, userId);
    request.auth = auth;
  });
}

export const authPluginRegistered = fp(authPlugin, {
  name: "auth-plugin",
  dependencies: ["db-plugin"],
});
