import type { FastifyPluginAsync } from "fastify";
import path from "node:path";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  // Liveness must not depend on MySQL. The hosting platform uses this route to
  // decide whether the Node process itself is healthy.
  app.get("/health", async () => ({
      ok: true,
      service: app.appEnv.APP_NAME,
      environment: app.appEnv.NODE_ENV,
      uploads: {
        persistent: path.isAbsolute(app.appEnv.UPLOAD_DIR),
      },
  }));

  // Readiness is intentionally separate so database outages remain observable
  // without taking the website and its static assets offline.
  app.get("/health/ready", async (_request, reply) => {
    try {
      await app.db.query("SELECT 1 AS ok");
      return { ok: true, database: "available" };
    } catch {
      return reply.code(503).send({ ok: false, database: "unavailable" });
    }
  });
};
