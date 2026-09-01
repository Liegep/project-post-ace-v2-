import type { FastifyPluginAsync } from "fastify";
import path from "node:path";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async () => {
    const [result] = await app.db.query("SELECT 1 AS ok");

    return {
      ok: true,
      service: app.appEnv.APP_NAME,
      environment: app.appEnv.NODE_ENV,
      database: result,
      uploads: {
        persistent: path.isAbsolute(app.appEnv.UPLOAD_DIR),
      },
    };
  });
};
