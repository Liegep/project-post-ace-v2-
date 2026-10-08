import type { FastifyPluginAsync } from "fastify";
import { assertSuperAdmin } from "../auth/auth.access.js";
import {
  ensureDesignBriefTables,
  listDesignBriefs,
  listDesignBriefTemplates,
} from "./design-briefs.repository.js";

// V1 records remain readable with their original IDs and answers. Mutations must
// use the new instance/response workflow so no caller can erase legacy history.
export const designBriefRoutes: FastifyPluginAsync = async (app) => {
  await ensureDesignBriefTables(app.db);
  app.get("/design-briefs", async (request) => {
    assertSuperAdmin(request);
    return { items: await listDesignBriefs(app.db) };
  });
  app.get("/design-brief-templates", async (request) => {
    assertSuperAdmin(request);
    return { items: await listDesignBriefTemplates(app.db) };
  });
  for (const [method, url] of [
    ["POST", "/design-briefs"],
    ["PATCH", "/design-briefs/:briefId"],
    ["DELETE", "/design-briefs/:briefId"],
    ["POST", "/design-brief-templates"],
    ["DELETE", "/design-brief-templates/:templateId"],
  ] as const) {
    app.route({
      method,
      url,
      handler: async (request) => {
        assertSuperAdmin(request);
        throw app.httpErrors.conflict(
          "Registro legado protegido. Use o novo fluxo de briefs; o histórico não pode ser sobrescrito ou excluído.",
        );
      },
    });
  }
};
