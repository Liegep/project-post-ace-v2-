import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import type { FastifyInstance } from "fastify";
import type { Pool } from "mysql2/promise";
import { markStalePublishingFailed } from "./meta.repository.js";
import {
  META_INSTAGRAM_CREATE_TIMEOUT_MS,
  META_INSTAGRAM_REEL_CREATE_TIMEOUT_MS,
  META_INSTAGRAM_PERMALINK_TIMEOUT_MS,
  META_INSTAGRAM_PUBLISH_TIMEOUT_MS,
  META_INSTAGRAM_STATUS_TIMEOUT_MS,
  processDueMetaPublications,
} from "./meta.service.js";

function encryptToken(token: string, key: Buffer) {
  const iv = Buffer.alloc(12, 3);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

function timeoutError() {
  const error = new Error("simulated timeout");
  error.name = "TimeoutError";
  return error;
}

function metaResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
}

function publishingHarness(fetchImpl: typeof fetch, overrides: {
  mediaType?: "image" | "reel";
  mediaUrl?: string;
  caption?: string | null;
  locationId?: string | null;
  reelCoverUrl?: string | null;
  instagramUserTags?: Array<{ username: string; x: number; y: number }>;
} = {}) {
  const encryptionKey = Buffer.alloc(32, 7);
  const state = { status: "scheduled", lastError: null as string | null, attemptCount: 0, fetchCalls: 0 };
  const publicationRow = {
    id: "publication-1",
    client_account_id: "client-1",
    card_id: null,
    platform: "instagram",
    meta_asset_id: "instagram-1",
    scheduled_at: "2026-09-29T16:00:00.000000Z",
    timezone: "Europe/Stockholm",
    caption: overrides.caption === undefined ? "Legenda" : overrides.caption,
    media_url: overrides.mediaUrl ?? "https://cdn.example.com/image.jpg",
    media_urls_json: [overrides.mediaUrl ?? "https://cdn.example.com/image.jpg"],
    media_type: overrides.mediaType ?? "image",
    reel_cover_url: overrides.reelCoverUrl ?? null,
    location_id: overrides.locationId ?? null,
    instagram_user_tags_json: overrides.instagramUserTags ?? [],
    status: "scheduled",
    attempt_count: 0,
    idempotency_key: "key-1",
    published_meta_id: null,
    published_permalink: null,
    last_error: null,
    created_by_user_id: "user-1",
    created_at: "2026-09-29T15:00:00.000Z",
    updated_at: "2026-09-29T15:00:00.000Z",
    published_at: null,
  };
  const db = {
    async query(sql: string, params: unknown[] = []) {
      if (sql.includes("WHERE status = 'publishing' AND updated_at < ?")) return [{ affectedRows: 0 }, []];
      if (sql.includes("WHERE status = 'scheduled' AND scheduled_at <=")) {
        return [state.status === "scheduled" ? [{ ...publicationRow, status: state.status, attempt_count: state.attemptCount }] : [], []];
      }
      if (sql.includes("SET status = 'publishing'")) {
        if (state.status !== "scheduled") return [{ affectedRows: 0 }, []];
        state.status = "publishing";
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes("FROM client_meta_assets")) {
        return [[{ facebook_page_id: null, facebook_page_name: null, instagram_account_id: "instagram-1", instagram_username: "designhub", meta_ad_account_id: null, meta_ad_account_name: null, updated_at: new Date() }], []];
      }
      if (sql.includes("FROM meta_connections")) {
        return [[{ access_token_encrypted: encryptToken("test-token", encryptionKey), token_expires_at: null, meta_user_id: "meta-user-1", meta_account_name: "Test" }], []];
      }
      if (sql.includes("SET status = 'published'")) {
        state.status = "published";
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes("SET status = 'failed'")) {
        state.status = "failed";
        state.attemptCount += 1;
        state.lastError = String(params[0]);
        return [{ affectedRows: 1 }, []];
      }
      throw new Error(`Unexpected SQL in Meta worker test: ${sql}`);
    },
  };
  const app = {
    db,
    appEnv: {
      META_APP_ID: "app-id",
      META_APP_SECRET: "app-secret",
      META_REDIRECT_URI: "https://app.example.com/api/meta/callback",
      META_TOKEN_ENCRYPTION_KEY: encryptionKey.toString("base64"),
    },
    httpErrors: { badRequest: (message: string) => new Error(message) },
    log: { info() {}, warn() {}, error() {} },
  } as unknown as FastifyInstance;
  const wrappedFetch: typeof fetch = async (...args) => {
    state.fetchCalls += 1;
    return fetchImpl(...args);
  };
  return { app, state, wrappedFetch };
}

async function withFetch<T>(fetchImpl: typeof fetch, run: () => Promise<T>) {
  const original = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    return await run();
  } finally {
    globalThis.fetch = original;
  }
}

test("Instagram publishing uses operation-specific timeouts", () => {
  assert.equal(META_INSTAGRAM_CREATE_TIMEOUT_MS, 30_000);
  assert.equal(META_INSTAGRAM_REEL_CREATE_TIMEOUT_MS, 45_000);
  assert.equal(META_INSTAGRAM_STATUS_TIMEOUT_MS, 15_000);
  assert.equal(META_INSTAGRAM_PUBLISH_TIMEOUT_MS, 45_000);
  assert.equal(META_INSTAGRAM_PERMALINK_TIMEOUT_MS, 15_000);
});

test("create-container timeout marks the job failed without retry", async () => {
  const harness = publishingHarness(async () => { throw timeoutError(); });
  const result = await withFetch(harness.wrappedFetch, () => processDueMetaPublications(harness.app, 10));
  assert.equal(result.failed, 1);
  assert.equal(harness.state.status, "failed");
  assert.match(harness.state.lastError ?? "", /criar o container/i);
  assert.equal(harness.state.fetchCalls, 1);
});

test("container-status timeout marks the job failed without retry", async () => {
  const harness = publishingHarness(async (input, init) => {
    const url = String(input);
    if (init?.method === "POST" && url.includes("/media?")) return metaResponse({ id: "container-1" });
    throw timeoutError();
  });
  const result = await withFetch(harness.wrappedFetch, () => processDueMetaPublications(harness.app, 10));
  assert.equal(result.failed, 1);
  assert.equal(harness.state.status, "failed");
  assert.match(harness.state.lastError ?? "", /consultar o processamento/i);
  assert.equal(harness.state.fetchCalls, 2);
});

test("media-publish timeout marks the job failed without retry", async () => {
  const harness = publishingHarness(async (input, init) => {
    const url = String(input);
    if (init?.method === "POST" && url.includes("/media_publish?")) throw timeoutError();
    if (init?.method === "POST" && url.includes("/media?")) return metaResponse({ id: "container-1" });
    if (url.includes("/container-1?")) return metaResponse({ status_code: "FINISHED" });
    throw new Error(`Unexpected Meta request: ${url}`);
  });
  const result = await withFetch(harness.wrappedFetch, () => processDueMetaPublications(harness.app, 10));
  assert.equal(result.failed, 1);
  assert.equal(harness.state.status, "failed");
  assert.match(harness.state.lastError ?? "", /publicação final/i);
  assert.equal(harness.state.fetchCalls, 3);
});

test("a scheduled Instagram publication still completes normally", async () => {
  const harness = publishingHarness(async (input, init) => {
    const url = String(input);
    if (init?.method === "POST" && url.includes("/media_publish?")) return metaResponse({ id: "media-1" });
    if (init?.method === "POST" && url.includes("/media?")) return metaResponse({ id: "container-1" });
    if (url.includes("/container-1?")) return metaResponse({ status_code: "FINISHED" });
    if (url.includes("/media-1?")) return metaResponse({ permalink: "https://instagram.com/p/test" });
    throw new Error(`Unexpected Meta request: ${url}`);
  });
  const result = await withFetch(harness.wrappedFetch, () => processDueMetaPublications(harness.app, 10));
  assert.equal(result.published, 1);
  assert.equal(harness.state.status, "published");
  assert.equal(harness.state.fetchCalls, 4);
});

test("a finished Reel container publishes with its caption and without image-only fields", async () => {
  const requests: URL[] = [];
  const harness = publishingHarness(async (input, init) => {
    const url = new URL(String(input));
    requests.push(url);
    if (init?.method === "POST" && url.pathname.endsWith("/media_publish")) return metaResponse({ id: "reel-media-1" });
    if (init?.method === "POST" && url.pathname.endsWith("/media")) return metaResponse({ id: "reel-container-1" });
    if (url.pathname.endsWith("/reel-container-1")) return metaResponse({ status_code: "FINISHED" });
    if (url.pathname.endsWith("/reel-media-1")) return metaResponse({ permalink: "https://instagram.com/reel/test" });
    throw new Error(`Unexpected Meta request: ${url}`);
  }, {
    mediaType: "reel",
    mediaUrl: "https://cdn.example.com/reel.mp4",
    caption: "Legenda original do Reel",
    locationId: "123456",
    instagramUserTags: [{ username: "designhub", x: 0.5, y: 0.5 }],
  });
  const result = await withFetch(harness.wrappedFetch, () => processDueMetaPublications(harness.app, 10, { reelPollIntervalMs: 1, reelMaxWaitMs: 20 }));
  assert.equal(result.published, 1);
  const create = requests.find((url) => url.pathname.endsWith("/media"));
  assert.equal(create?.searchParams.get("media_type"), "REELS");
  assert.equal(create?.searchParams.get("video_url"), "https://cdn.example.com/reel.mp4");
  assert.equal(create?.searchParams.get("caption"), "Legenda original do Reel");
  assert.equal(create?.searchParams.has("cover_url"), false);
  assert.equal(create?.searchParams.has("user_tags"), false);
  assert.equal(create?.searchParams.has("location_id"), false);
});

test("a Reel sends cover_url only when a custom cover is present", async () => {
  let createUrl: URL | null = null;
  const harness = publishingHarness(async (input, init) => {
    const url = new URL(String(input));
    if (init?.method === "POST" && url.pathname.endsWith("/media_publish")) return metaResponse({ id: "reel-media-1" });
    if (init?.method === "POST" && url.pathname.endsWith("/media")) {
      createUrl = url;
      return metaResponse({ id: "reel-container-1" });
    }
    if (url.pathname.endsWith("/reel-container-1")) return metaResponse({ status_code: "FINISHED" });
    if (url.pathname.endsWith("/reel-media-1")) return metaResponse({ permalink: "https://instagram.com/reel/test" });
    throw new Error(`Unexpected Meta request: ${url}`);
  }, {
    mediaType: "reel",
    mediaUrl: "https://cdn.example.com/reel.mp4",
    reelCoverUrl: "https://app.example.com/api/uploads/cover.webp?format=jpeg",
  });
  const result = await withFetch(harness.wrappedFetch, () => processDueMetaPublications(harness.app, 10, { reelPollIntervalMs: 1, reelMaxWaitMs: 20 }));
  assert.equal(result.published, 1);
  assert.equal((createUrl as URL | null)?.searchParams.get("cover_url"), "https://app.example.com/api/uploads/cover.webp?format=jpeg");
});

test("a Reel container ERROR marks the publication failed", async () => {
  const harness = publishingHarness(async (input, init) => {
    const url = String(input);
    if (init?.method === "POST" && url.includes("/media?")) return metaResponse({ id: "reel-container-1" });
    if (url.includes("/reel-container-1?")) return metaResponse({ status_code: "ERROR", error_message: "Video processing failed" });
    throw new Error(`Unexpected Meta request: ${url}`);
  }, { mediaType: "reel", mediaUrl: "https://cdn.example.com/reel.mp4" });
  const result = await withFetch(harness.wrappedFetch, () => processDueMetaPublications(harness.app, 10, { reelPollIntervalMs: 1, reelMaxWaitMs: 20 }));
  assert.equal(result.failed, 1);
  assert.equal(harness.state.status, "failed");
  assert.match(harness.state.lastError ?? "", /Video processing failed/i);
});

test("a Reel status request timeout marks the publication failed", async () => {
  const harness = publishingHarness(async (input, init) => {
    const url = String(input);
    if (init?.method === "POST" && url.includes("/media?")) return metaResponse({ id: "reel-container-1" });
    throw timeoutError();
  }, { mediaType: "reel", mediaUrl: "https://cdn.example.com/reel.mp4" });
  const result = await withFetch(harness.wrappedFetch, () => processDueMetaPublications(harness.app, 10, { reelPollIntervalMs: 1, reelMaxWaitMs: 20 }));
  assert.equal(result.failed, 1);
  assert.equal(harness.state.status, "failed");
  assert.match(harness.state.lastError ?? "", /processamento do Reel/i);
});

test("a Reel that stays IN_PROGRESS until the polling deadline is marked failed", async () => {
  let statusChecks = 0;
  const harness = publishingHarness(async (input, init) => {
    const url = String(input);
    if (init?.method === "POST" && url.includes("/media?")) return metaResponse({ id: "reel-container-1" });
    if (url.includes("/reel-container-1?")) {
      statusChecks += 1;
      return metaResponse({ status_code: "IN_PROGRESS" });
    }
    throw new Error(`Unexpected Meta request: ${url}`);
  }, { mediaType: "reel", mediaUrl: "https://cdn.example.com/reel.mp4" });
  const result = await withFetch(harness.wrappedFetch, () => processDueMetaPublications(harness.app, 10, { reelPollIntervalMs: 1, reelMaxWaitMs: 5 }));
  assert.equal(result.failed, 1);
  assert.equal(harness.state.status, "failed");
  assert.ok(statusChecks >= 1);
  assert.match(harness.state.lastError ?? "", /ainda não concluiu/i);
});

test("a Reel tolerates multiple IN_PROGRESS cycles before FINISHED", async () => {
  let statusChecks = 0;
  const harness = publishingHarness(async (input, init) => {
    const url = String(input);
    if (init?.method === "POST" && url.includes("/media_publish?")) return metaResponse({ id: "reel-media-1" });
    if (init?.method === "POST" && url.includes("/media?")) return metaResponse({ id: "reel-container-1" });
    if (url.includes("/reel-container-1?")) {
      statusChecks += 1;
      return metaResponse({ status_code: statusChecks < 4 ? "IN_PROGRESS" : "FINISHED" });
    }
    if (url.includes("/reel-media-1?")) return metaResponse({ permalink: "https://instagram.com/reel/test" });
    throw new Error(`Unexpected Meta request: ${url}`);
  }, { mediaType: "reel", mediaUrl: "https://cdn.example.com/reel.mp4" });
  const result = await withFetch(harness.wrappedFetch, () => processDueMetaPublications(harness.app, 10, { reelPollIntervalMs: 1, reelMaxWaitMs: 30 }));
  assert.equal(result.published, 1);
  assert.equal(statusChecks, 4);
});

test("only stale publishing rows are recovered as failed", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("CREATE TABLE meta_scheduled_publications (id TEXT PRIMARY KEY, status TEXT NOT NULL, attempt_count INTEGER NOT NULL, last_error TEXT, updated_at TEXT NOT NULL)");
  sqlite.exec("INSERT INTO meta_scheduled_publications VALUES ('stale', 'publishing', 0, NULL, '2026-09-29 15:00:00.000'), ('recent', 'publishing', 0, NULL, '2026-09-29 15:15:00.000'), ('scheduled', 'scheduled', 0, NULL, '2026-09-29 14:00:00.000')");
  const db = {
    async query(sql: string, params: unknown[] = []) {
      const result = sqlite.prepare(sql).run(...params as (string | number | null)[]);
      return [{ affectedRows: Number(result.changes) }, []];
    },
  } as unknown as Pool;
  const affected = await markStalePublishingFailed(db, {
    updatedBefore: "2026-09-29T15:10:00.000Z",
    lastError: "stale publishing",
  });
  assert.equal(affected, 1);
  const rows = (sqlite.prepare("SELECT id, status, attempt_count, last_error FROM meta_scheduled_publications ORDER BY id").all() as Array<{ id: string; status: string; attempt_count: number; last_error: string | null }>).map((row) => ({ ...row }));
  assert.deepEqual(rows, [
    { id: "recent", status: "publishing", attempt_count: 0, last_error: null },
    { id: "scheduled", status: "scheduled", attempt_count: 0, last_error: null },
    { id: "stale", status: "failed", attempt_count: 1, last_error: "stale publishing" },
  ]);
  sqlite.close();
});
