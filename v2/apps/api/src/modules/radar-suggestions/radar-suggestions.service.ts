import { createHash } from "node:crypto";
import { radarSuggestionInputSchema } from "./radar-suggestions.schemas.js";
import type { RadarSuggestionsStore } from "./radar-suggestions.repository.js";
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const normalize = (value: string) => value.normalize("NFKC").replace(/\s+/gu, " ").trim().toLocaleLowerCase("en-US");
export function radarSuggestionKeys(input: ReturnType<typeof radarSuggestionInputSchema.parse>) {
  let source: unknown;
  if (input.sourceUrl) {
    const url = new URL(input.sourceUrl);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^utm_/i.test(key) || /^(fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    source = url.toString();
  } else source = [normalize(input.radarName), normalize(input.sourceTitle), input.sourceDate];
  const sourceKey = hash(source);
  // Exact normalized editorial angle, not title alone. Different angles on one source remain possible.
  const dedupeHash = hash([sourceKey, ...[input.title, input.concept, input.hook, input.contentType].map(normalize)]);
  return { sourceKey, dedupeHash };
}
export class RadarSuggestionsService {
  constructor(private readonly store: RadarSuggestionsStore) {}
  async resolve(clientId: string, id: string, userId: string, action: "accept" | "dismiss") {
    return this.store.resolve(clientId, id, userId, action);
  }
  async createPending(clientId: string, userId: string, value: unknown) {
    const input = radarSuggestionInputSchema.parse(value);
    return this.store.createPending(clientId, userId, input, radarSuggestionKeys(input));
  }
}
