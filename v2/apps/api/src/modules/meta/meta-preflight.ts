import type { FastifyInstance } from "fastify";
import { findMetaCrossClientLinks, findMetaPublishDestination, findMetaRoutingCard } from "./meta.repository.js";
import { readMetaPreflightAssets } from "./meta.service.js";

export type PreflightAssetRead = {
  facebook: { id: string; name: string; instagramAccountId: string | null } | null;
  instagram: { id: string; username: string } | null;
  accessiblePages: { id: string; instagramAccountId: string | null }[];
  accessListComplete: boolean;
  issues: { platform: "facebook" | "instagram" | "connection"; code: string }[];
};

export async function getMetaPreflight(app: FastifyInstance, input: {
  userId: string; clientAccountId: string; destinationId: string; cardId?: string;
}) {
  const destination = await findMetaPublishDestination(app.db, input.destinationId, input.clientAccountId);
  const card = input.cardId ? await findMetaRoutingCard(app.db, input.cardId) : null;
  const checks = {
    destinationBelongsToClient: Boolean(destination),
    cardBelongsToClient: input.cardId ? card?.clientAccountId === input.clientAccountId : null,
    facebookAssetMatches: null as boolean | null,
    instagramAssetMatches: null as boolean | null,
    facebookAccessOk: null as boolean | null,
    instagramAccessOk: null as boolean | null,
    instagramLinkedToFacebook: null as boolean | null,
    noCrossClientCollision: null as boolean | null,
  };
  const issues: { platform: "facebook" | "instagram" | "connection" | "routing"; code: string }[] = [];
  const result = {
    clientAccountId: input.clientAccountId, destinationId: input.destinationId, destinationName: destination?.name ?? null,
    cardId: input.cardId ?? null, checks,
    facebook: { savedId: destination?.facebookPageId ?? null, savedName: destination?.facebookPageName ?? null, liveId: null as string | null, liveName: null as string | null },
    instagram: { savedId: destination?.instagramAccountId ?? null, savedUsername: destination?.instagramUsername ?? null, liveId: null as string | null, liveUsername: null as string | null },
    collisions: [] as Awaited<ReturnType<typeof findMetaCrossClientLinks>>, issues,
    status: "blocked" as "safe" | "warning" | "blocked",
  };
  if (!destination || checks.cardBelongsToClient === false) {
    issues.push({ platform: "routing", code: !destination ? "destination_not_owned_or_missing" : "card_not_owned_or_missing" });
    return result;
  }
  const [live, collisions] = await Promise.all([
    readMetaPreflightAssets(app, input.userId, destination),
    findMetaCrossClientLinks(app.db, destination),
  ]);
  issues.push(...live.issues);
  result.collisions = collisions;
  checks.noCrossClientCollision = collisions.length === 0;
  if (collisions.length) issues.push({ platform: "routing", code: "asset_linked_to_multiple_clients" });
  let blocked = !destination.facebookPageId && !destination.instagramAccountId;
  if (blocked) issues.push({ platform: "routing", code: "no_assets_configured" });
  if (destination.facebookPageId) {
    result.facebook.liveId = live.facebook?.id ?? null;
    result.facebook.liveName = live.facebook?.name ?? null;
    const idMatches = live.facebook?.id === destination.facebookPageId;
    checks.facebookAssetMatches = Boolean(idMatches && live.facebook?.name === destination.facebookPageName);
    checks.facebookAccessOk = live.accessListComplete ? live.accessiblePages.some((page) => page.id === destination.facebookPageId) && idMatches : null;
    if (!idMatches || checks.facebookAccessOk !== true) blocked = true;
    if (idMatches && !checks.facebookAssetMatches) issues.push({ platform: "facebook", code: "asset_name_changed" });
    if (checks.facebookAccessOk === false) issues.push({ platform: "facebook", code: "asset_access_not_confirmed" });
  }
  if (destination.instagramAccountId) {
    result.instagram.liveId = live.instagram?.id ?? null;
    result.instagram.liveUsername = live.instagram?.username ?? null;
    const idMatches = live.instagram?.id === destination.instagramAccountId;
    const normalize = (value: string | null | undefined) => value?.replace(/^@/, "").toLowerCase();
    checks.instagramAssetMatches = Boolean(idMatches && normalize(live.instagram?.username) === normalize(destination.instagramUsername));
    checks.instagramAccessOk = live.accessListComplete ? live.accessiblePages.some((page) => page.instagramAccountId === destination.instagramAccountId) && idMatches : null;
    if (!idMatches || checks.instagramAccessOk !== true) blocked = true;
    if (idMatches && !checks.instagramAssetMatches) issues.push({ platform: "instagram", code: "asset_username_changed" });
    if (checks.instagramAccessOk === false) issues.push({ platform: "instagram", code: "asset_access_not_confirmed" });
    if (destination.facebookPageId) {
      checks.instagramLinkedToFacebook = live.facebook ? live.facebook.instagramAccountId === destination.instagramAccountId : null;
      if (checks.instagramLinkedToFacebook !== true) {
        blocked = true;
        issues.push({ platform: "instagram", code: "instagram_page_link_mismatch" });
      }
    }
  }
  result.status = blocked ? "blocked" : issues.length ? "warning" : "safe";
  app.log.info({ clientAccountId: input.clientAccountId, destinationId: input.destinationId, result: result.status }, "Meta preflight validation");
  return result;
}
