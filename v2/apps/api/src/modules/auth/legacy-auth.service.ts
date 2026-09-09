import type { FastifyInstance } from "fastify";

const LEGACY_AUTH_TIMEOUT_MS = 8_000;

/**
 * Validates a password against the retired V1 identity provider.
 *
 * This is intentionally a one-way bridge: no V1 token or user data is kept.
 * Once V1 accepts the credentials, auth.service hashes the supplied password
 * in V2 and activates the already-imported account.
 */
export async function verifyLegacyPassword(
  app: FastifyInstance,
  email: string,
  password: string,
): Promise<boolean> {
  const baseUrl = app.appEnv.LEGACY_SUPABASE_URL;
  const anonKey = app.appEnv.LEGACY_SUPABASE_ANON_KEY;
  if (!baseUrl || !anonKey) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LEGACY_AUTH_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ email: email.toLowerCase(), password }),
      signal: controller.signal,
    });

    if (!response.ok) return false;
    const body = await response.json() as { user?: { email?: string | null } };
    return body.user?.email?.toLowerCase() === email.toLowerCase();
  } catch {
    // Authentication keeps returning the same generic 401 when the legacy
    // provider is unavailable, without leaking infrastructure details.
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
