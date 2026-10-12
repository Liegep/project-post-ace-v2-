import { z } from "zod";
import { radarInput } from "../brand-brain-ai/brand-brain-ai.schemas.js";
export const recoveryParams = z.object({ clientId: z.string().uuid(), runId: z.string().uuid() }).strict();
export const recoveryRequest = z.object({
  requestId: z.string().uuid(), expectedAttempts: z.number().int().min(0).max(2),
  aiConsent: z.literal(true), sourceReviewed: z.literal(true), source: radarInput,
}).strict();
