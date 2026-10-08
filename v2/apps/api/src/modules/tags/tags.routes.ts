import type { FastifyPluginAsync } from "fastify";
import { assertClientAccess, assertInternalAccess } from "../auth/auth.access.js";
import { createClientTagSchema } from "./tags.schemas.js";
import { createClientTag, listClientTags, updateClientTag } from "./tags.repository.js";

export const tagRoutes: FastifyPluginAsync = async (app) => {
  app.get("/clients/:clientAccountId/tags", async (request) => {
    assertInternalAccess(request);
    const { clientAccountId } = request.params as { clientAccountId: string };
    assertClientAccess(request, clientAccountId, ["admin", "colaborador"]);
    return { items: await listClientTags(app.db, clientAccountId) };
  });

  app.post("/clients/:clientAccountId/tags", async (request) => {
    assertInternalAccess(request);
    const { clientAccountId } = request.params as { clientAccountId: string };
    assertClientAccess(request, clientAccountId, ["admin", "colaborador"]);
    const input = createClientTagSchema.parse(request.body);
    const existing = await listClientTags(app.db, clientAccountId);
    if (existing.some((tag) => tag.name.localeCompare(input.name.trim(), undefined, { sensitivity: "accent" }) === 0)) {
      throw app.httpErrors.badRequest(`A etiqueta “${input.name.trim()}” já existe nesta conta.`);
    }
    const tag = await createClientTag(app.db, clientAccountId, input);
    return { ok: true, tag };
  });

  app.patch("/clients/:clientAccountId/tags/:tagId", async (request) => {
    assertInternalAccess(request);
    const { clientAccountId, tagId } = request.params as { clientAccountId: string; tagId: string };
    assertClientAccess(request, clientAccountId, ["admin", "colaborador"]);
    const input = createClientTagSchema.parse(request.body);
    try {
      const tag = await updateClientTag(app.db, clientAccountId, tagId, input);
      if (!tag) throw app.httpErrors.notFound("Etiqueta não encontrada.");
      return { ok: true, tag };
    } catch (error) {
      if (error instanceof Error && error.message === "TAG_NAME_ALREADY_EXISTS") {
        throw app.httpErrors.badRequest(`A etiqueta “${input.name.trim()}” já existe nesta conta.`);
      }
      throw error;
    }
  });
};
