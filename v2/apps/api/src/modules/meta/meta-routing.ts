import type { FastifyInstance } from "fastify";
import { findClientMetaAssets, findMetaPublishDestination, findMetaRoutingCard } from "./meta.repository.js";

export type RoutingPlatform = "facebook" | "instagram";

/** Re-read ownership and immutable asset IDs before any scheduling side effect. */
export async function validateMetaSchedulingRouting(app: FastifyInstance, input: {
  clientAccountId: string;
  destinationId: string | null;
  card: { id: string; clientAccountId: string };
  platforms: { platform: RoutingPlatform; metaAssetId: string }[];
}) {
  const card = await findMetaRoutingCard(app.db, input.card.id);
  if (!card || card.clientAccountId !== input.clientAccountId || input.card.clientAccountId !== input.clientAccountId) {
    throw app.httpErrors.badRequest("O card não pertence a este cliente.");
  }
  const destination = input.destinationId ? await findMetaPublishDestination(app.db, input.destinationId, input.clientAccountId) : null;
  if (input.destinationId && !destination) throw app.httpErrors.badRequest("O destino Meta selecionado não corresponde ao cliente deste card.");
  const assets = destination ?? await findClientMetaAssets(app.db, input.clientAccountId);
  for (const item of input.platforms) {
    const savedId = item.platform === "instagram" ? assets?.instagramAccountId : assets?.facebookPageId;
    if (!savedId || savedId !== item.metaAssetId) throw app.httpErrors.badRequest(item.platform === "instagram"
      ? "O Instagram selecionado não pertence ao destino Meta deste cliente."
      : "O Facebook selecionado não pertence ao destino Meta deste cliente.");
  }
  return { destinationName: destination?.name ?? null };
}
