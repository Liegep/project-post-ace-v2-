import { normalizeBrandBrainPillars } from "../../../../../shared/brand-brain-pillars.mjs";
import { createHash } from "node:crypto";
import { brandBrainCompletion } from "../../../../../shared/brand-brain-completion.mjs";
export type OfficialClientData = { id: string; name: string; locale: string; brain: Record<string, unknown>; recentPautas: unknown[]; publishedVersion?: number };
const trim = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const list = (value: unknown, count = 8, max = 180) => Array.isArray(value) ? value.filter(item => typeof item === "string" && item.trim()).slice(0, count).map(item => trim(item, max)) : [];
export function buildBrandBrainContext(client: OfficialClientData, visual = false) {
  const brain: Record<string, unknown> = {};
  for (const key of ["positioning", "brandPromise", "mission", "vision", "audience", "voice"]) brain[key] = trim(client.brain[key], 700);
  for (const key of ["audiencePains", "audienceDesires", "personalityTraits", "voiceExamples", "voiceAvoidExamples", "approvedWords", "avoidWords", "expressions", "differentiators", "proofPoints", "references"]) brain[key] = list(client.brain[key]);
  brain.pillars = normalizeBrandBrainPillars(client.brain.pillars).slice(0, 8).map(item => ({ name: trim(item.name, 120), focus: trim(item.focus, 240), weight: item.weight })).filter(item => item.name);
  if (visual) brain.visualNotes = trim(client.brain.visualNotes, 700);
  const recentPautas = client.recentPautas.slice(0, 30).filter((item): item is Record<string, unknown> => !!item && typeof item === "object").sort((a,b) => trim(b.createdAt, 40).localeCompare(trim(a.createdAt, 40))).slice(0, 20).map(item => ({ title: trim(item.title, 200), description: trim(item.description, 240), contentType: trim(item.contentType, 60) }));
  const context = { client: { id: client.id, name: trim(client.name, 120), locale: trim(client.locale, 35) || "pt" }, brandBrain: brain, recentPautas, completion: brandBrainCompletion(client.brain) };
  const contextHash = createHash("sha256").update(JSON.stringify(context)).digest("hex");
  return { ...context, brandBrainVersion: client.publishedVersion ?? null, contextHash, contextVersion: "compact-v2" };
}
export type BrandBrainContext = ReturnType<typeof buildBrandBrainContext>;
