import assert from "node:assert/strict";
import test from "node:test";
import type { FastifyInstance } from "fastify";
import type { Pool } from "mysql2/promise";
import Fastify from "fastify";
import { httpErrorsPluginRegistered } from "../../plugins/http-errors.js";
import { metaRoutes } from "./meta.routes.js";
import { completeMetaAuthorization } from "./meta.service.js";
import { resolveMetaTokenExpiry, type MetaExpiryDiagnostics } from "./meta-expiry.js";

const APP_ID = "test-app-id";
const APP_SECRET = "test-app-secret";
const USER_TOKEN = "test-user-access-token";
const EXISTING_EXPIRY = new Date("2026-11-27T12:00:00.000Z");

type AuthorizationScenario = {
  shortExpiresIn?: number;
  longExpiresIn?: number;
  debug?: { expires_at?: number; data_access_expires_at?: number; is_valid?: boolean } | Error;
  existingExpiresAt?: Date | null;
};

function authorizationHarness(scenario: AuthorizationScenario) {
  const saved: { expiresAt?: Date | null; diagnostics?: MetaExpiryDiagnostics } = {};
  const logs: unknown[] = [];
  const requests: URL[] = [];
  const db = {
    async query(sql: string, params: unknown[] = []) {
      if (sql.includes("FROM meta_connections")) {
        return scenario.existingExpiresAt === undefined
          ? [[], []]
          : [[{ access_token_encrypted: "existing", token_expires_at: scenario.existingExpiresAt, meta_user_id: "meta-existing", meta_account_name: "Existing account", expiry_diagnostics_json: null }], []];
      }
      if (sql.startsWith("INSERT INTO meta_connections")) {
        saved.expiresAt = params[3] as Date | null;
        saved.diagnostics = JSON.parse(String(params[6])) as MetaExpiryDiagnostics;
        return [{ affectedRows: 1 }, []];
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  } as unknown as Pool;
  const app = {
    db,
    appEnv: {
      META_APP_ID: APP_ID,
      META_APP_SECRET: APP_SECRET,
      META_REDIRECT_URI: "https://app.example.com/api/meta/callback",
      META_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
    },
    log: {
      info(...args: unknown[]) { logs.push(args); },
      warn(...args: unknown[]) { logs.push(args); },
      error(...args: unknown[]) { logs.push(args); },
    },
  } as unknown as FastifyInstance;
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(String(input));
    requests.push(url);
    if (url.pathname.endsWith("/oauth/access_token") && url.searchParams.get("grant_type") !== "fb_exchange_token") {
      return Response.json({ access_token: "short-user-token", ...(scenario.shortExpiresIn === undefined ? {} : { expires_in: scenario.shortExpiresIn }) });
    }
    if (url.pathname.endsWith("/oauth/access_token")) {
      return Response.json({ access_token: USER_TOKEN, ...(scenario.longExpiresIn === undefined ? {} : { expires_in: scenario.longExpiresIn }) });
    }
    if (url.pathname.endsWith("/debug_token")) {
      if (scenario.debug instanceof Error) throw scenario.debug;
      return Response.json({ data: scenario.debug ?? {} });
    }
    if (url.pathname.endsWith("/me")) return Response.json({ id: "meta-user", name: "Meta Account" });
    throw new Error(`Unexpected Meta request: ${url.pathname}`);
  };
  return { app, fetchImpl, saved, logs, requests };
}

async function runAuthorization(scenario: AuthorizationScenario) {
  const harness = authorizationHarness(scenario);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = harness.fetchImpl;
  try {
    await completeMetaAuthorization(harness.app, { code: "oauth-code", userId: "user-1" });
    return harness;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("pure expiry resolver classifies every source without using data-access expiry", () => {
  const debug = { lookupStatus: "succeeded" as const, isValid: true, expiresAt: 1_790_000_000, dataAccessExpiresAt: 1_800_000_000 };
  assert.equal(resolveMetaTokenExpiry({ oauthExpiresIn: 3_600, debug, persistedExpiresAt: EXISTING_EXPIRY, now: new Date(0) }).diagnostics.source, "oauth");
  assert.equal(resolveMetaTokenExpiry({ oauthExpiresIn: null, debug, persistedExpiresAt: EXISTING_EXPIRY }).diagnostics.source, "debug_token");
  assert.equal(resolveMetaTokenExpiry({ oauthExpiresIn: null, debug: { ...debug, expiresAt: 0 }, persistedExpiresAt: EXISTING_EXPIRY }).diagnostics.source, "persisted");
  const none = resolveMetaTokenExpiry({ oauthExpiresIn: null, debug: { ...debug, expiresAt: 0 }, persistedExpiresAt: null });
  assert.equal(none.diagnostics.source, "none");
  assert.equal(none.expiresAt, null);
  assert.equal(none.diagnostics.debugDataAccessExpiresAt, 1_800_000_000);
});

test("OAuth expires_in has priority and skips token debugging", async () => {
  const before = Date.now();
  const result = await runAuthorization({ longExpiresIn: 3_600, debug: { is_valid: true, expires_at: 1_900_000_000 } });
  const savedTime = result.saved.expiresAt?.getTime() ?? 0;
  assert.ok(savedTime >= before + 3_600_000 && savedTime <= Date.now() + 3_600_000);
  assert.equal(result.requests.some((url) => url.pathname.endsWith("/debug_token")), false);
  assert.deepEqual(result.saved.diagnostics, {
    source: "oauth", oauthExpiresInPresent: true, oauthExpiresInSeconds: 3_600, debugLookupStatus: "not_needed",
    debugIsValid: null, debugExpiresAt: null, debugDataAccessExpiresAt: null, persistedExpiryPresent: false,
  });
});

test("debug_token expires_at supplies expiry when OAuth omits expires_in", async () => {
  const expiresAt = 1_790_000_000;
  const result = await runAuthorization({ debug: { is_valid: true, expires_at: expiresAt, data_access_expires_at: 1_800_000_000 } });
  assert.equal(result.saved.expiresAt?.toISOString(), new Date(expiresAt * 1000).toISOString());
  const debugRequest = result.requests.find((url) => url.pathname.endsWith("/debug_token"));
  assert.equal(debugRequest?.searchParams.get("input_token"), USER_TOKEN);
  assert.equal(debugRequest?.searchParams.get("access_token"), `${APP_ID}|${APP_SECRET}`);
  assert.equal(result.saved.diagnostics?.source, "debug_token");
  assert.equal(result.saved.diagnostics?.debugIsValid, true);
  assert.equal(result.saved.diagnostics?.debugExpiresAt, expiresAt);
  assert.equal(result.saved.diagnostics?.debugDataAccessExpiresAt, 1_800_000_000);
});

test("a debug failure preserves the previous expiry", async () => {
  const result = await runAuthorization({ debug: new Error("network failure"), existingExpiresAt: EXISTING_EXPIRY });
  assert.equal(result.saved.expiresAt?.toISOString(), EXISTING_EXPIRY.toISOString());
  assert.equal(result.saved.diagnostics?.source, "persisted");
  assert.equal(result.saved.diagnostics?.debugLookupStatus, "failed");
  assert.equal(result.saved.diagnostics?.persistedExpiryPresent, true);
});

test("zero debug expiry is diagnostic only and data-access expiry is never used as token expiry", async () => {
  const result = await runAuthorization({ debug: { is_valid: true, expires_at: 0, data_access_expires_at: 1_800_000_000 } });
  assert.equal(result.saved.expiresAt, null);
  assert.equal(result.saved.diagnostics?.source, "none");
  assert.equal(result.saved.diagnostics?.debugExpiresAt, 0);
  assert.equal(result.saved.diagnostics?.debugDataAccessExpiresAt, 1_800_000_000);
});

test("an invalid debug token never contributes an expiry", async () => {
  const result = await runAuthorization({ debug: { is_valid: false, expires_at: 1_790_000_000 } });
  assert.equal(result.saved.expiresAt, null);
  assert.equal(result.saved.diagnostics?.source, "none");
  assert.equal(result.saved.diagnostics?.debugIsValid, false);
});

test("a debug network failure never blocks reconnection or leaks credentials", async () => {
  const result = await runAuthorization({ debug: new Error(`failed ${USER_TOKEN} ${APP_SECRET} ${APP_ID}|${APP_SECRET}`) });
  assert.equal(result.saved.expiresAt, null);
  const serializedLogs = JSON.stringify(result.logs);
  assert.doesNotMatch(serializedLogs, new RegExp(USER_TOKEN));
  assert.doesNotMatch(serializedLogs, new RegExp(APP_SECRET));
  assert.doesNotMatch(serializedLogs, new RegExp(`${APP_ID}\\|${APP_SECRET}`));
  assert.match(serializedLogs, /Meta token expiry resolution completed/);
  assert.equal(result.saved.diagnostics?.source, "none");
  assert.equal(result.saved.diagnostics?.debugLookupStatus, "failed");
});

test("expiry diagnostics endpoint is restricted to super_admin and never returns secrets", async () => {
  const diagnostics: MetaExpiryDiagnostics = {
    source: "debug_token", oauthExpiresInPresent: false, oauthExpiresInSeconds: null, debugLookupStatus: "succeeded",
    debugIsValid: true, debugExpiresAt: 1_790_000_000, debugDataAccessExpiresAt: 1_800_000_000, persistedExpiryPresent: false,
  };
  const db = { async query(sql: string) {
    if (!sql.includes("FROM meta_connections")) throw new Error(`Unexpected SQL: ${sql}`);
    return [[{
      access_token_encrypted: `encrypted-${USER_TOKEN}`, token_expires_at: new Date(1_790_000_000 * 1000),
      meta_user_id: "meta-user", meta_account_name: "Meta Account",
      expiry_diagnostics_json: JSON.stringify({ ...diagnostics, access_token: USER_TOKEN, app_secret: APP_SECRET }),
    }], []];
  } } as unknown as Pool;
  const app = Fastify();
  await app.register(httpErrorsPluginRegistered);
  app.decorate("db", db);
  app.addHook("preHandler", async (request) => {
    const role = request.headers["x-test-role"];
    if (!role) return;
    request.auth = {
      user: { id: "user-1", fullName: "Test", email: "test@example.invalid", globalRole: role === "super_admin" ? "super_admin" : "admin", avatarUrl: null, locale: "pt", isActive: true },
      memberships: [],
    };
  });
  await app.register(metaRoutes, { prefix: "/api" });
  try {
    assert.equal((await app.inject({ method: "GET", url: "/api/meta/status/debug" })).statusCode, 401);
    assert.equal((await app.inject({ method: "GET", url: "/api/meta/status/debug", headers: { "x-test-role": "admin" } })).statusCode, 403);
    const response = await app.inject({ method: "GET", url: "/api/meta/status/debug", headers: { "x-test-role": "super_admin" } });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { expiryDiagnostics: diagnostics });
    assert.doesNotMatch(response.body, /test-user-access-token|test-app-secret|appsecret_proof|access_token/i);
  } finally {
    await app.close();
  }
});
