import { normalizeBrandBrainPillars } from "../../../../../shared/brand-brain-pillars.mjs";
import { createHash } from "node:crypto";
import { brandBrainCompletion } from "../../../../../shared/brand-brain-completion.mjs";
export type OfficialClientData = { id: string; name: string; locale: string; brain: Record<string, unknown>; recentPautas: unknown[]; publishedVersion?: number };
const trim = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const list = (value: unknown, count = 8, max = 180) => Array.isArray(value) ? value.filter(item => typeof item === "string" && item.trim()).slice(0, count).map(item => trim(item, max)) : [];
type PublishedValidation = { clientId: string; pillarNames: readonly string[]; avoidWords: readonly string[] };
// Full validation memory is server-only: it cannot be serialized into requests or logs.
const validationSnapshots = new WeakMap<object, PublishedValidation>();
const fullList = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && !!item.trim()).map(item => item.trim()) : [];
export function publishedValidation(context: BrandBrainContext): PublishedValidation {
  const snapshot = validationSnapshots.get(context);
  if (!snapshot) throw new Error("Contexto de validação indisponível.");
  return snapshot;
}
export function buildBrandBrainContext(client: OfficialClientData, visual = false) {
  const brain: Record<string, unknown> = {};
  for (const key of ["positioning", "brandPromise", "mission", "vision", "audience", "voice"]) brain[key] = trim(client.brain[key], 700);
  for (const key of ["audiencePains", "audienceDesires", "personalityTraits", "voiceExamples", "voiceAvoidExamples", "approvedWords", "avoidWords", "expressions", "differentiators", "proofPoints", "references"]) brain[key] = list(client.brain[key]);
  const pillars = normalizeBrandBrainPillars(client.brain.pillars).filter(item => item.name);
  const validation = Object.freeze({ clientId: client.id, pillarNames: Object.freeze(pillars.map(item => item.name)), avoidWords: Object.freeze(fullList(client.brain.avoidWords)) });
  // Identity is exact and complete; only presentation (focus/other prose) is compacted.
  brain.pillars = pillars.map(item => ({ name: item.name, focus: trim(item.focus, 240), weight: item.weight }));
  if (visual) brain.visualNotes = trim(client.brain.visualNotes, 700);
  const recentPautas = client.recentPautas.slice(0, 30).filter((item): item is Record<string, unknown> => !!item && typeof item === "object").sort((a,b) => trim(b.createdAt, 40).localeCompare(trim(a.createdAt, 40))).slice(0, 20).map(item => ({ title: trim(item.title, 200), description: trim(item.description, 240), contentType: trim(item.contentType, 60) }));
  const context = { client: { id: client.id, name: trim(client.name, 120), locale: trim(client.locale, 35) || "pt" }, brandBrain: brain, recentPautas, completion: brandBrainCompletion(client.brain) };
  const missingFields = ["positioning", "audience", "voice"].filter(key => !trim(client.brain[key], 1));
  if (!pillars.length) missingFields.push("pillars");
  const personalization = { status: missingFields.length ? "limited" as const : "brand_brain" as const, missingFields };
  // Changes outside the compact prompt still invalidate the validation-context hash.
  const contextHash = createHash("sha256").update(JSON.stringify({ ...context, validation, personalization })).digest("hex");
  const result = { ...context, personalization, brandBrainVersion: client.publishedVersion ?? null, contextHash, contextVersion: "compact-v3" };
  validationSnapshots.set(result, validation);
  return result;
}
export type BrandBrainContext = ReturnType<typeof buildBrandBrainContext>;
