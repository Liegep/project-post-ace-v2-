import type { FastifyPluginAsync } from "fastify";
import { assertClientAccess, assertInternalAccess } from "../auth/auth.access.js";
import { createHashtagGroup, deleteHashtagGroup, listHashtagGroups } from "./hashtags.repository.js";
import { createHashtagGroupSchema } from "./hashtags.schemas.js";

export const hashtagRoutes: FastifyPluginAsync = async (app) => {
  app.get("/clients/:clientAccountId/hashtag-groups", async (request) => {
    assertInternalAccess(request); const { clientAccountId } = request.params as { clientAccountId: string };
    assertClientAccess(request, clientAccountId, ["admin", "colaborador"]);
    return { items: await listHashtagGroups(app.db, clientAccountId) };
  });
  app.post("/clients/:clientAccountId/hashtag-groups", async (request) => {
    assertInternalAccess(request); const { clientAccountId } = request.params as { clientAccountId: string };
    assertClientAccess(request, clientAccountId, ["admin", "colaborador"]);
    const group = await createHashtagGroup(app.db, clientAccountId, createHashtagGroupSchema.parse(request.body));
    return { ok: true, group };
  });
  app.delete("/clients/:clientAccountId/hashtag-groups/:groupId", async (request) => {
    assertInternalAccess(request); const { clientAccountId, groupId } = request.params as { clientAccountId: string; groupId: string };
    assertClientAccess(request, clientAccountId, ["admin", "colaborador"]);
    await deleteHashtagGroup(app.db, clientAccountId, groupId); return { ok: true };
  });
};
