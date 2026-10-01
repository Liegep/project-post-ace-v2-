export type MetaExpirySource = "oauth" | "debug_token" | "persisted" | "none";
export type MetaDebugLookupStatus = "not_needed" | "succeeded" | "failed";

export type MetaExpiryDiagnostics = {
  source: MetaExpirySource;
  oauthExpiresInPresent: boolean;
  oauthExpiresInSeconds: number | null;
  debugLookupStatus: MetaDebugLookupStatus;
  debugIsValid: boolean | null;
  debugExpiresAt: number | null;
  debugDataAccessExpiresAt: number | null;
  persistedExpiryPresent: boolean;
};

export type MetaDebugExpiryMetadata = {
  lookupStatus: MetaDebugLookupStatus;
  isValid: boolean | null;
  expiresAt: number | null;
  dataAccessExpiresAt: number | null;
};

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function validDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function hasUsableOAuthExpiry(expiresIn: unknown) {
  const seconds = finiteNumber(expiresIn);
  return seconds !== null && seconds > 0;
}

export function resolveMetaTokenExpiry(input: {
  oauthExpiresIn: unknown;
  debug: MetaDebugExpiryMetadata;
  persistedExpiresAt: Date | string | null | undefined;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const oauthExpiresIn = finiteNumber(input.oauthExpiresIn);
  const debugExpiresAt = finiteNumber(input.debug.expiresAt);
  const debugDataAccessExpiresAt = finiteNumber(input.debug.dataAccessExpiresAt);
  const persistedExpiresAt = validDate(input.persistedExpiresAt);
  const diagnostics: MetaExpiryDiagnostics = {
    source: "none",
    oauthExpiresInPresent: oauthExpiresIn !== null,
    oauthExpiresInSeconds: oauthExpiresIn,
    debugLookupStatus: input.debug.lookupStatus,
    debugIsValid: typeof input.debug.isValid === "boolean" ? input.debug.isValid : null,
    debugExpiresAt,
    debugDataAccessExpiresAt,
    persistedExpiryPresent: Boolean(input.persistedExpiresAt),
  };

  if (oauthExpiresIn !== null && oauthExpiresIn > 0) {
    diagnostics.source = "oauth";
    return { expiresAt: new Date(now.getTime() + oauthExpiresIn * 1000), diagnostics };
  }
  if (input.debug.isValid === true && debugExpiresAt !== null && debugExpiresAt > 0) {
    diagnostics.source = "debug_token";
    return { expiresAt: new Date(debugExpiresAt * 1000), diagnostics };
  }
  if (persistedExpiresAt) {
    diagnostics.source = "persisted";
    return { expiresAt: persistedExpiresAt, diagnostics };
  }
  return { expiresAt: null, diagnostics };
}

export function parseMetaExpiryDiagnostics(value: unknown): MetaExpiryDiagnostics | null {
  let parsed = value;
  if (typeof value === "string") {
    try { parsed = JSON.parse(value) as unknown; } catch { return null; }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  if (!["oauth", "debug_token", "persisted", "none"].includes(String(record.source))) return null;
  if (!["not_needed", "succeeded", "failed"].includes(String(record.debugLookupStatus))) return null;
  return {
    source: record.source as MetaExpirySource,
    oauthExpiresInPresent: record.oauthExpiresInPresent === true,
    oauthExpiresInSeconds: finiteNumber(record.oauthExpiresInSeconds),
    debugLookupStatus: record.debugLookupStatus as MetaDebugLookupStatus,
    debugIsValid: typeof record.debugIsValid === "boolean" ? record.debugIsValid : null,
    debugExpiresAt: finiteNumber(record.debugExpiresAt),
    debugDataAccessExpiresAt: finiteNumber(record.debugDataAccessExpiresAt),
    persistedExpiryPresent: record.persistedExpiryPresent === true,
  };
}
