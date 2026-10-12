import { BrandBrainAiError } from "../brand-brain-ai/brand-brain-ai.service.js";
export const RECOVERY_MAX_ATTEMPTS = 2; // Original attempt + at most two manual recoveries.
export const RECOVERY_COOLDOWN_MS = 15 * 60_000;
export const RECOVERY_DAILY_CLIENT_LIMIT = 10;
export const recoveryMessages = {
  recovery_disabled: "A recuperação manual está desativada.",
  recovery_forbidden: "Recuperação restrita à administração deste cliente.",
  source_not_found: "Execução não encontrada para este cliente.",
  source_mismatch: "Os dados reenviados não identificam a fonte desta execução.",
  source_not_failed: "Somente execuções originais com falha podem ser recuperadas.",
  source_not_recoverable: "O erro original exige investigação antes de uma recuperação.",
  recovery_processing: "Existe uma recuperação em andamento. Não envie outra tentativa.",
  recovery_resolved: "Esta fonte já foi resolvida. Nenhuma nova chamada foi feita.",
  recovery_limit: "Limite de duas recuperações manuais atingido.",
  recovery_cooldown: "Aguarde quinze minutos após a última recuperação.",
  recovery_budget: "Limite diário de recuperações do cliente atingido.",
  recovery_stale_review: "O histórico mudou. Consulte novamente antes de autorizar.",
  recovery_request_conflict: "O identificador desta solicitação já foi usado com outros dados.",
  recovery_storage_unavailable: "Não foi possível confirmar o histórico da recuperação. Consulte o resultado antes de tentar novamente.",
} as const;
export function recoveryError(code: keyof typeof recoveryMessages, statusCode = 409) {
  return new BrandBrainAiError(statusCode, code, recoveryMessages[code]);
}
const recoverable = new Set(["invalid_response", "schema_invalid", "pillar_not_published", "editorial_term_violation", "radar_output_inconsistent", "timeout", "unavailable", "incomplete", "refusal", "storage_unavailable", "busy"]);
export type RecoveryAttempt = {
  id: string; sourceRunId: string; clientId: string; requestId: string; inputHash: string;
  number: number; status: "processing" | "completed" | "no_op" | "failed";
  createdSuggestion: boolean; errorCode: string | null; suggestionId: string | null; aiRunId: string | null;
  createdAtMs: number; finishedAtMs: number | null;
};
export function assertRecoveryPolicy(input: {
  originalStatus: string; originalError: string | null; attempts: RecoveryAttempt[];
  expectedAttempts: number; nowMs: number; clientActive: boolean; clientDaily: number;
}) {
  if (input.originalStatus !== "failed") throw recoveryError("source_not_failed");
  if (!recoverable.has(input.originalError ?? "")) throw recoveryError("source_not_recoverable");
  if (input.attempts.some(a => a.status === "processing") || input.clientActive) throw recoveryError("recovery_processing");
  if (input.attempts.some(a => a.status === "completed" || a.status === "no_op")) throw recoveryError("recovery_resolved");
  if (input.attempts.length !== input.expectedAttempts) throw recoveryError("recovery_stale_review");
  if (input.attempts.length >= RECOVERY_MAX_ATTEMPTS) throw recoveryError("recovery_limit");
  const last = input.attempts.at(-1);
  if (last && input.nowMs - (last.finishedAtMs ?? last.createdAtMs) < RECOVERY_COOLDOWN_MS) throw recoveryError("recovery_cooldown");
  if (input.clientDaily >= RECOVERY_DAILY_CLIENT_LIMIT) throw recoveryError("recovery_budget");
}
