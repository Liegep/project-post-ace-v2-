import type { FastifyPluginAsync } from "fastify";
import { assertClientAccess, assertInternalAccess } from "../auth/auth.access.js";
import { createClientTagSchema } from "./tags.schemas.js";
import { createClientTag, listClientTags } from "./tags.repository.js";

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
      throw app.httpErrors.badRequest(`A etiqueta “${input.name.trim()}” ja existe nesta conta.`);
    }
    const tag = await createClientTag(app.db, clientAccountId, input);
    return { ok: true, tag };
  });
};
