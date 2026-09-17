import type { FastifyPluginAsync } from "fastify";
import { assertSuperAdmin } from "../auth/auth.access.js";
import { createDesignBrief, createDesignBriefTemplate, deleteDesignBrief, deleteDesignBriefTemplate, ensureDesignBriefTables, findDesignBrief, listDesignBriefs, listDesignBriefTemplates, updateDesignBrief } from "./design-briefs.repository.js";
import { createDesignBriefSchema, createDesignBriefTemplateSchema, updateDesignBriefSchema } from "./design-briefs.schemas.js";

export const designBriefRoutes: FastifyPluginAsync = async (app) => {
  await ensureDesignBriefTables(app.db);
  app.get("/design-briefs", async (request) => { assertSuperAdmin(request); return { items: await listDesignBriefs(app.db) }; });
  app.post("/design-briefs", async (request) => { assertSuperAdmin(request); return { brief: await createDesignBrief(app.db, request.auth!.user.id, createDesignBriefSchema.parse(request.body)) }; });
  app.patch("/design-briefs/:briefId", async (request) => { assertSuperAdmin(request); const { briefId }=request.params as {briefId:string}; if(!await findDesignBrief(app.db,briefId)) throw app.httpErrors.notFound("Brief não encontrado."); return { brief: await updateDesignBrief(app.db,briefId,updateDesignBriefSchema.parse(request.body)) }; });
  app.delete("/design-briefs/:briefId", async (request) => { assertSuperAdmin(request); const { briefId }=request.params as {briefId:string}; return { ok: await deleteDesignBrief(app.db,briefId) }; });
  app.get("/design-brief-templates", async (request) => { assertSuperAdmin(request); return { items: await listDesignBriefTemplates(app.db) }; });
  app.post("/design-brief-templates", async (request) => { assertSuperAdmin(request); return { template: await createDesignBriefTemplate(app.db,request.auth!.user.id,createDesignBriefTemplateSchema.parse(request.body)) }; });
  app.delete("/design-brief-templates/:templateId", async (request) => { assertSuperAdmin(request); const { templateId }=request.params as {templateId:string}; return { ok: await deleteDesignBriefTemplate(app.db,templateId) }; });
};
