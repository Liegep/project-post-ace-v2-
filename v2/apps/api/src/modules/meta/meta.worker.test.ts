import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import type { FastifyInstance } from "fastify";
import type { Pool } from "mysql2/promise";
import { canArchiveScheduledPublicationCard, markStalePublishingFailed } from "./meta.repository.js";
import {
  META_FACEBOOK_REEL_COVER_FETCH_TIMEOUT_MS,
  META_FACEBOOK_REEL_COVER_UPLOAD_TIMEOUT_MS,
  META_FACEBOOK_REEL_BINARY_UPLOAD_TIMEOUT_MS,
  META_FACEBOOK_REEL_DOWNLOAD_TIMEOUT_MS,
  META_FACEBOOK_REEL_FINISH_TIMEOUT_MS,
  META_FACEBOOK_REEL_PERMALINK_TIMEOUT_MS,
  META_FACEBOOK_REEL_START_TIMEOUT_MS,
  META_FACEBOOK_REEL_STATUS_TIMEOUT_MS,
  META_FACEBOOK_REEL_UPLOAD_TIMEOUT_MS,
  META_FACEBOOK_REEL_MAX_DOWNLOAD_BYTES,
  META_INSTAGRAM_CREATE_TIMEOUT_MS,
  META_INSTAGRAM_REEL_CREATE_TIMEOUT_MS,
  META_INSTAGRAM_STORY_CREATE_TIMEOUT_MS,
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
  platform?: "instagram" | "facebook";
  mediaType?: "image" | "reel" | "story";
  mediaUrl?: string;
  caption?: string | null;
  locationId?: string | null;
  reelCoverUrl?: string | null;
  instagramUserTags?: Array<{ username: string; x: number; y: number }>;
} = {}) {
  const encryptionKey = Buffer.alloc(32, 7);
  const state = { status: "scheduled", lastError: null as string | null, attemptCount: 0, fetchCalls: 0, logs: [] as unknown[][] };
  const publicationRow = {
    id: "publication-1",
    client_account_id: "client-1",
    card_id: null,
    platform: overrides.platform ?? "instagram",
    meta_asset_id: overrides.platform === "facebook" ? "facebook-1" : "instagram-1",
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
        return [[{ facebook_page_id: "facebook-1", facebook_page_name: "Design Hub", instagram_account_id: "instagram-1", instagram_username: "designhub", meta_ad_account_id: null, meta_ad_account_name: null, updated_at: new Date() }], []];
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
    log: {
      info(...args: unknown[]) { state.logs.push(args); },
      warn(...args: unknown[]) { state.logs.push(args); },
      error(...args: unknown[]) { state.logs.push(args); },
    },
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
  assert.equal(META_INSTAGRAM_STORY_CREATE_TIMEOUT_MS, 45_000);
  assert.equal(META_INSTAGRAM_STATUS_TIMEOUT_MS, 15_000);
  assert.equal(META_INSTAGRAM_PUBLISH_TIMEOUT_MS, 45_000);
  assert.equal(META_INSTAGRAM_PERMALINK_TIMEOUT_MS, 15_000);
});

test("Facebook Reel publishing uses operation-specific timeouts", () => {
  assert.equal(META_FACEBOOK_REEL_START_TIMEOUT_MS, 30_000);
  assert.equal(META_FACEBOOK_REEL_UPLOAD_TIMEOUT_MS, 60_000);
  assert.equal(META_FACEBOOK_REEL_DOWNLOAD_TIMEOUT_MS, 60_000);
  assert.equal(META_FACEBOOK_REEL_BINARY_UPLOAD_TIMEOUT_MS, 120_000);
  assert.equal(META_FACEBOOK_REEL_MAX_DOWNLOAD_BYTES, 250 * 1024 * 1024);
  assert.equal(META_FACEBOOK_REEL_STATUS_TIMEOUT_MS, 15_000);
  assert.equal(META_FACEBOOK_REEL_FINISH_TIMEOUT_MS, 45_000);
  assert.equal(META_FACEBOOK_REEL_PERMALINK_TIMEOUT_MS, 15_000);
  assert.equal(META_FACEBOOK_REEL_COVER_FETCH_TIMEOUT_MS, 30_000);
  assert.equal(META_FACEBOOK_REEL_COVER_UPLOAD_TIMEOUT_MS, 45_000);
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

test("an Instagram image Story publishes without caption, tags, location, cover or permalink lookup", async () => {
  const requests: URL[] = [];
  const harness = publishingHarness(async (input, init) => {
    const url = new URL(String(input));
    requests.push(url);
    if (init?.method === "HEAD" && url.href === "https://cdn.example.com/story.jpg") return new Response(null, { status: 200, headers: { "content-type": "image/jpeg", "content-length": "2048" } });
    if (init?.method === "POST" && url.pathname.endsWith("/media_publish")) return metaResponse({ id: "story-media-1" });
    if (init?.method === "POST" && url.pathname.endsWith("/media")) return metaResponse({ id: "story-container-1" });
    if (url.pathname.endsWith("/story-container-1")) return metaResponse({ status_code: "FINISHED" });
    throw new Error(`Unexpected Meta request: ${url}`);
  }, {
    mediaType: "story",
    mediaUrl: "https://cdn.example.com/story.jpg",
    caption: "Esta legenda não deve ser enviada",
    locationId: "123456",
    reelCoverUrl: "https://cdn.example.com/cover.jpg",
    instagramUserTags: [{ username: "designhub", x: 0.5, y: 0.5 }],
  });
  const result = await withFetch(harness.wrappedFetch, () => processDueMetaPublications(harness.app, 10, { storyPollIntervalMs: 1, storyMaxWaitMs: 20 }));
  assert.equal(result.published, 1);
  const create = requests.find((url) => url.pathname.endsWith("/media"));
  assert.equal(create?.searchParams.get("media_type"), "STORIES");
  assert.equal(create?.searchParams.get("image_url"), "https://cdn.example.com/story.jpg");
  assert.equal(create?.searchParams.has("video_url"), false);
  assert.equal(create?.searchParams.has("caption"), false);
  assert.equal(create?.searchParams.has("user_tags"), false);
  assert.equal(create?.searchParams.has("location_id"), false);
  assert.equal(create?.searchParams.has("cover_url"), false);
  assert.equal(requests.some((url) => url.pathname.endsWith("/story-media-1")), false);
});

test("an Instagram video Story waits for FINISHED before publishing", async () => {
  const requests: URL[] = [];
  let statusChecks = 0;
  const harness = publishingHarness(async (input, init) => {
    const url = new URL(String(input));
    requests.push(url);
    if (init?.method === "HEAD" && url.href === "https://cdn.example.com/story.mp4") return new Response(null, { status: 200, headers: { "content-type": "video/mp4", "content-length": "4096" } });
    if (init?.method === "POST" && url.pathname.endsWith("/media_publish")) return metaResponse({ id: "story-media-1" });
    if (init?.method === "POST" && url.pathname.endsWith("/media")) return metaResponse({ id: "story-container-1" });
    if (url.pathname.endsWith("/story-container-1")) {
      statusChecks += 1;
      return metaResponse({ status_code: statusChecks === 1 ? "IN_PROGRESS" : "FINISHED" });
    }
    throw new Error(`Unexpected Meta request: ${url}`);
  }, { mediaType: "story", mediaUrl: "https://cdn.example.com/story.mp4" });
  const result = await withFetch(harness.wrappedFetch, () => processDueMetaPublications(harness.app, 10, { storyPollIntervalMs: 1, storyMaxWaitMs: 20 }));
  assert.equal(result.published, 1);
  assert.equal(statusChecks, 2);
  const create = requests.find((url) => url.pathname.endsWith("/media"));
  assert.equal(create?.searchParams.get("media_type"), "STORIES");
  assert.equal(create?.searchParams.get("video_url"), "https://cdn.example.com/story.mp4");
  assert.equal(create?.searchParams.has("image_url"), false);
  const statusIndex = requests.findIndex((url) => url.pathname.endsWith("/story-container-1"));
  const publishIndex = requests.findIndex((url) => url.pathname.endsWith("/media_publish"));
  assert.ok(statusIndex >= 0 && publishIndex > statusIndex);
});

test("an oversized Instagram video Story fails before creating a Meta container", async () => {
  let createCalls = 0;
  const harness = publishingHarness(async (input, init) => {
    const url = new URL(String(input));
    if (init?.method === "HEAD" && url.href === "https://cdn.example.com/story.mp4") return new Response(null, { status: 200, headers: { "content-type": "video/mp4", "content-length": String(100 * 1024 * 1024 + 1) } });
    if (init?.method === "POST" && url.pathname.endsWith("/media")) {
      createCalls += 1;
      return metaResponse({ id: "story-container-1" });
    }
    throw new Error(`Unexpected Meta request: ${url}`);
  }, { mediaType: "story", mediaUrl: "https://cdn.example.com/story.mp4" });
  const result = await withFetch(harness.wrappedFetch, () => processDueMetaPublications(harness.app, 10, { storyPollIntervalMs: 1, storyMaxWaitMs: 20 }));
  assert.equal(result.failed, 1);
  assert.equal(createCalls, 0);
  assert.match(harness.state.lastError ?? "", /100 MB/i);
});

test("an Instagram Story processing ERROR marks the publication failed", async () => {
  const harness = publishingHarness(async (input, init) => {
    const url = new URL(String(input));
    if (init?.method === "POST" && url.pathname.endsWith("/media")) return metaResponse({ id: "story-container-1" });
    if (url.pathname.endsWith("/story-container-1")) return metaResponse({ status_code: "ERROR", error_message: "Story video is incompatible" });
    throw new Error(`Unexpected Meta request: ${url}`);
  }, { mediaType: "story", mediaUrl: "https://cdn.example.com/story.mp4" });
  const result = await withFetch(harness.wrappedFetch, () => processDueMetaPublications(harness.app, 10, { storyPollIntervalMs: 1, storyMaxWaitMs: 20 }));
  assert.equal(result.failed, 1);
  assert.match(harness.state.lastError ?? "", /Story video is incompatible/i);
});

test("an Instagram Story final publish timeout is not retried", async () => {
  let publishCalls = 0;
  const harness = publishingHarness(async (input, init) => {
    const url = new URL(String(input));
    if (init?.method === "POST" && url.pathname.endsWith("/media_publish")) {
      publishCalls += 1;
      throw timeoutError();
    }
    if (init?.method === "POST" && url.pathname.endsWith("/media")) return metaResponse({ id: "story-container-1" });
    if (url.pathname.endsWith("/story-container-1")) return metaResponse({ status_code: "FINISHED" });
    throw new Error(`Unexpected Meta request: ${url}`);
  }, { mediaType: "story", mediaUrl: "https://cdn.example.com/story.jpg" });
  const result = await withFetch(harness.wrappedFetch, () => processDueMetaPublications(harness.app, 10, { storyPollIntervalMs: 1, storyMaxWaitMs: 20 }));
  assert.equal(result.failed, 1);
  assert.equal(publishCalls, 1);
  assert.match(harness.state.lastError ?? "", /publicação final/i);
});

test("a Facebook Reel completes start, hosted upload, status polling, finish and permalink", async () => {
  const requests: Array<{ url: URL; init?: RequestInit }> = [];
  let statusChecks = 0;
  const harness = publishingHarness(async (input, init) => {
    const url = new URL(String(input));
    requests.push({ url, init });
    if (url.hostname === "rupload.facebook.com") return metaResponse({ success: true });
    if (url.pathname.endsWith("/facebook-1") && url.searchParams.get("fields")?.includes("access_token")) {
      return metaResponse({ id: "facebook-1", name: "Design Hub", access_token: "page-token" });
    }
    if (url.pathname.endsWith("/facebook-1/video_reels") && url.searchParams.get("upload_phase") === "start") {
      return metaResponse({ video_id: "fb-video-1", upload_url: "https://rupload.facebook.com/video-upload/v26.0/fb-video-1" });
    }
    if (url.pathname.endsWith("/fb-video-1") && url.searchParams.get("fields") === "status") {
      statusChecks += 1;
      return metaResponse({ status: { video_status: statusChecks === 1 ? "processing" : "ready", processing_phase: { status: statusChecks === 1 ? "in_progress" : "completed" } } });
    }
    if (url.pathname.endsWith("/facebook-1/video_reels") && url.searchParams.get("upload_phase") === "finish") {
      return metaResponse({ success: true, post_id: "facebook-1_42" });
    }
    if (url.pathname.endsWith("/fb-video-1") && url.searchParams.get("fields") === "permalink_url") {
      return metaResponse({ permalink_url: "https://www.facebook.com/reel/42" });
    }
    throw new Error(`Unexpected Meta request: ${url}`);
  }, {
    platform: "facebook",
    mediaType: "reel",
    mediaUrl: "https://cdn.example.com/reel.mp4",
    caption: "Legenda do Facebook Reel",
    locationId: "123456789",
  });
  const result = await withFetch(harness.wrappedFetch, () => processDueMetaPublications(harness.app, 10, { facebookReelPollIntervalMs: 1, facebookReelMaxWaitMs: 30 }));
  assert.equal(result.published, 1);
  assert.equal(harness.state.status, "published");
  assert.equal(statusChecks, 2);
  assert.equal(requests.filter(({ url }) => url.hostname === "rupload.facebook.com").length, 1);
  assert.equal(requests.some(({ url }) => url.href === "https://cdn.example.com/reel.mp4"), false);
  const upload = requests.find(({ url }) => url.hostname === "rupload.facebook.com");
  assert.equal(new Headers(upload?.init?.headers).get("authorization"), "OAuth page-token");
  assert.equal(new Headers(upload?.init?.headers).get("file_url"), "https://cdn.example.com/reel.mp4");
  const finish = requests.find(({ url }) => url.pathname.endsWith("/facebook-1/video_reels") && url.searchParams.get("upload_phase") === "finish")?.url;
  assert.equal(finish?.searchParams.get("video_state"), "PUBLISHED");
  assert.equal(finish?.searchParams.get("description"), "Legenda do Facebook Reel");
  assert.equal(finish?.searchParams.get("place"), "123456789");
  assert.equal(finish?.searchParams.get("access_token"), "page-token");
  const finishIndex = requests.findIndex(({ url }) => url.pathname.endsWith("/facebook-1/video_reels") && url.searchParams.get("upload_phase") === "finish");
  const statusIndex = requests.findIndex(({ url }) => url.pathname.endsWith("/fb-video-1") && url.searchParams.get("fields") === "status");
  assert.ok(finishIndex >= 0 && statusIndex > finishIndex);
  assert.equal(requests.some(({ url }) => url.pathname.endsWith("/thumbnails")), false);
});

test("Facebook Reel hosted upload 400 or 422 falls back to binary upload in the same session", async (t) => {
  for (const hostedStatus of [400, 422]) {
    await t.test(`HTTP ${hostedStatus}`, async () => {
      const requests: Array<{ url: URL; init?: RequestInit }> = [];
      let startCalls = 0;
      let finishCalls = 0;
      const harness = publishingHarness(async (input, init) => {
        const url = new URL(String(input));
        requests.push({ url, init });
        if (url.href === "https://cdn.example.com/reel.mp4") {
          return new Response(new Uint8Array([0, 1, 2, 3, 4, 5]), { status: 200, headers: { "content-type": "video/mp4", "content-length": "6" } });
        }
        if (url.hostname === "rupload.facebook.com") {
          const headers = new Headers(init?.headers);
          if (headers.has("file_url")) {
            return new Response(`hosted rejected access_token=page-token`, { status: hostedStatus, headers: { "content-type": "text/plain" } });
          }
          return metaResponse({ success: true });
        }
        if (url.pathname.endsWith("/facebook-1") && url.searchParams.get("fields")?.includes("access_token")) return metaResponse({ id: "facebook-1", access_token: "page-token" });
        if (url.pathname.endsWith("/facebook-1/video_reels") && url.searchParams.get("upload_phase") === "start") {
          startCalls += 1;
          return metaResponse({ video_id: "fb-video-1", upload_url: "https://rupload.facebook.com/video-upload/v26.0/fb-video-1" });
        }
        if (url.pathname.endsWith("/facebook-1/video_reels") && url.searchParams.get("upload_phase") === "finish") {
          finishCalls += 1;
          return metaResponse({ success: true });
        }
        if (url.pathname.endsWith("/fb-video-1") && url.searchParams.get("fields") === "status") return metaResponse({ status: { video_status: "ready" } });
        if (url.pathname.endsWith("/fb-video-1") && url.searchParams.get("fields") === "permalink_url") return metaResponse({});
        throw new Error(`Unexpected Meta request: ${url}`);
      }, { platform: "facebook", mediaType: "reel", mediaUrl: "https://cdn.example.com/reel.mp4" });
      const result = await withFetch(harness.wrappedFetch, () => processDueMetaPublications(harness.app, 10, { facebookReelPollIntervalMs: 1, facebookReelMaxWaitMs: 20 }));
      assert.equal(result.published, 1);
      assert.equal(startCalls, 1);
      assert.equal(finishCalls, 1);
      const uploads = requests.filter(({ url }) => url.hostname === "rupload.facebook.com");
      assert.equal(uploads.length, 2);
      const binaryHeaders = new Headers(uploads[1]?.init?.headers);
      assert.equal(binaryHeaders.get("authorization"), "OAuth page-token");
      assert.equal(binaryHeaders.get("offset"), "0");
      assert.equal(binaryHeaders.get("file_size"), "6");
      assert.equal(binaryHeaders.get("content-type"), "application/octet-stream");
      assert.ok(uploads[1]?.init?.body instanceof ArrayBuffer);
      assert.doesNotMatch(JSON.stringify(harness.state.logs), /page-token/);
    });
  }
});

test("Facebook Reel binary fallback failure marks the publication failed without finish or a second start", async () => {
  let startCalls = 0;
  let finishCalls = 0;
  let uploadCalls = 0;
  const harness = publishingHarness(async (input, init) => {
    const url = new URL(String(input));
    if (url.href === "https://cdn.example.com/reel.mp4") {
      return new Response(new Uint8Array([0, 1, 2]), { status: 200, headers: { "content-type": "video/mp4" } });
    }
    if (url.hostname === "rupload.facebook.com") {
      uploadCalls += 1;
      const isHosted = new Headers(init?.headers).has("file_url");
      return new Response(isHosted ? "hosted failed page-token app-secret" : "binary failed Authorization: OAuth page-token app-secret", { status: isHosted ? 422 : 400, headers: { "content-type": "text/plain" } });
    }
    if (url.pathname.endsWith("/facebook-1") && url.searchParams.get("fields")?.includes("access_token")) return metaResponse({ id: "facebook-1", access_token: "page-token" });
    if (url.pathname.endsWith("/facebook-1/video_reels") && url.searchParams.get("upload_phase") === "start") {
      startCalls += 1;
      return metaResponse({ video_id: "fb-video-1", upload_url: "https://rupload.facebook.com/video-upload/v26.0/fb-video-1" });
    }
    if (url.pathname.endsWith("/facebook-1/video_reels") && url.searchParams.get("upload_phase") === "finish") {
      finishCalls += 1;
      return metaResponse({ success: true });
    }
    throw new Error(`Unexpected Meta request: ${url}`);
  }, { platform: "facebook", mediaType: "reel", mediaUrl: "https://cdn.example.com/reel.mp4" });
  const result = await withFetch(harness.wrappedFetch, () => processDueMetaPublications(harness.app, 10, { facebookReelPollIntervalMs: 1, facebookReelMaxWaitMs: 20 }));
  assert.equal(result.failed, 1);
  assert.equal(harness.state.status, "failed");
  assert.equal(startCalls, 1);
  assert.equal(uploadCalls, 2);
  assert.equal(finishCalls, 0);
  assert.match(harness.state.lastError ?? "", /tanto por URL quanto por upload direto/i);
  assert.doesNotMatch(harness.state.lastError ?? "", /page-token/);
  assert.doesNotMatch(harness.state.lastError ?? "", /app-secret/);
  assert.doesNotMatch(JSON.stringify(harness.state.logs), /page-token/);
  assert.doesNotMatch(JSON.stringify(harness.state.logs), /app-secret/);
});

test("the existing Facebook single-image flow remains unchanged", async () => {
  const requests: URL[] = [];
  const harness = publishingHarness(async (input, init) => {
    const url = new URL(String(input));
    requests.push(url);
    if (url.pathname.endsWith("/facebook-1") && url.searchParams.get("fields")?.includes("access_token")) return metaResponse({ id: "facebook-1", access_token: "page-token" });
    if (init?.method === "POST" && url.pathname.endsWith("/facebook-1/photos")) return metaResponse({ post_id: "facebook-1_10" });
    if (url.pathname.endsWith("/facebook-1_10")) return metaResponse({ permalink_url: "https://www.facebook.com/designhub/posts/10" });
    throw new Error(`Unexpected Meta request: ${url}`);
  }, { platform: "facebook", mediaType: "image", mediaUrl: "https://cdn.example.com/image.jpg", caption: "Imagem única" });
  const result = await withFetch(harness.wrappedFetch, () => processDueMetaPublications(harness.app, 10));
  assert.equal(result.published, 1);
  assert.equal(harness.state.status, "published");
  assert.equal(requests.some((url) => url.pathname.endsWith("/facebook-1/photos")), true);
  assert.equal(requests.some((url) => url.pathname.endsWith("/facebook-1/video_reels")), false);
});

test("a Facebook Reel uploads an optional custom cover through the official thumbnails endpoint", async () => {
  let thumbnailBody: FormData | null = null;
  const harness = publishingHarness(async (input, init) => {
    const url = new URL(String(input));
    if (url.href.startsWith("https://cdn.example.com/cover.jpg")) {
      return new Response(new Uint8Array([255, 216, 255, 217]), { status: 200, headers: { "content-type": "image/jpeg" } });
    }
    if (url.hostname === "rupload.facebook.com") return metaResponse({ success: true });
    if (url.pathname.endsWith("/facebook-1") && url.searchParams.get("fields")?.includes("access_token")) return metaResponse({ id: "facebook-1", access_token: "page-token" });
    if (url.pathname.endsWith("/facebook-1/video_reels") && url.searchParams.get("upload_phase") === "start") return metaResponse({ video_id: "fb-video-1", upload_url: "https://rupload.facebook.com/video-upload/v26.0/fb-video-1" });
    if (url.pathname.endsWith("/fb-video-1") && url.searchParams.get("fields") === "status") return metaResponse({ status: { video_status: "ready", processing_phase: { status: "completed" } } });
    if (url.pathname.endsWith("/fb-video-1/thumbnails")) {
      thumbnailBody = init?.body as FormData;
      return metaResponse({ success: true });
    }
    if (url.pathname.endsWith("/facebook-1/video_reels") && url.searchParams.get("upload_phase") === "finish") return metaResponse({ success: true });
    if (url.pathname.endsWith("/fb-video-1") && url.searchParams.get("fields") === "permalink_url") return metaResponse({});
    throw new Error(`Unexpected Meta request: ${url}`);
  }, {
    platform: "facebook",
    mediaType: "reel",
    mediaUrl: "https://cdn.example.com/reel.mp4",
    reelCoverUrl: "https://cdn.example.com/cover.jpg",
  });
  const result = await withFetch(harness.wrappedFetch, () => processDueMetaPublications(harness.app, 10, { facebookReelPollIntervalMs: 1, facebookReelMaxWaitMs: 20 }));
  assert.equal(result.published, 1);
  assert.equal((thumbnailBody as FormData | null)?.get("is_preferred"), "true");
  assert.ok((thumbnailBody as FormData | null)?.get("source") instanceof Blob);
});

test("a Facebook Reel processing error after finish is marked failed", async () => {
  let finishCalls = 0;
  const harness = publishingHarness(async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "rupload.facebook.com") return metaResponse({ success: true });
    if (url.pathname.endsWith("/facebook-1") && url.searchParams.get("fields")?.includes("access_token")) return metaResponse({ id: "facebook-1", access_token: "page-token" });
    if (url.pathname.endsWith("/facebook-1/video_reels") && url.searchParams.get("upload_phase") === "start") return metaResponse({ video_id: "fb-video-1", upload_url: "https://rupload.facebook.com/video-upload/v26.0/fb-video-1" });
    if (url.pathname.endsWith("/fb-video-1") && url.searchParams.get("fields") === "status") return metaResponse({ status: { video_status: "error", processing_phase: { status: "error", errors: [{ error_message: "Unsupported video codec" }] } } });
    if (url.pathname.endsWith("/facebook-1/video_reels") && url.searchParams.get("upload_phase") === "finish") {
      finishCalls += 1;
      return metaResponse({ success: true });
    }
    throw new Error(`Unexpected Meta request: ${url}`);
  }, { platform: "facebook", mediaType: "reel", mediaUrl: "https://cdn.example.com/reel.mp4" });
  const result = await withFetch(harness.wrappedFetch, () => processDueMetaPublications(harness.app, 10, { facebookReelPollIntervalMs: 1, facebookReelMaxWaitMs: 20 }));
  assert.equal(result.failed, 1);
  assert.equal(harness.state.status, "failed");
  assert.equal(finishCalls, 1);
  assert.match(harness.state.lastError ?? "", /Unsupported video codec/i);
});

test("a Facebook Reel finish timeout is not retried blindly", async () => {
  let finishCalls = 0;
  const harness = publishingHarness(async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "rupload.facebook.com") return metaResponse({ success: true });
    if (url.pathname.endsWith("/facebook-1") && url.searchParams.get("fields")?.includes("access_token")) return metaResponse({ id: "facebook-1", access_token: "page-token" });
    if (url.pathname.endsWith("/facebook-1/video_reels") && url.searchParams.get("upload_phase") === "start") return metaResponse({ video_id: "fb-video-1", upload_url: "https://rupload.facebook.com/video-upload/v26.0/fb-video-1" });
    if (url.pathname.endsWith("/fb-video-1") && url.searchParams.get("fields") === "status") return metaResponse({ status: { video_status: "ready" } });
    if (url.pathname.endsWith("/facebook-1/video_reels") && url.searchParams.get("upload_phase") === "finish") {
      finishCalls += 1;
      throw timeoutError();
    }
    throw new Error(`Unexpected Meta request: ${url}`);
  }, { platform: "facebook", mediaType: "reel", mediaUrl: "https://cdn.example.com/reel.mp4" });
  const result = await withFetch(harness.wrappedFetch, () => processDueMetaPublications(harness.app, 10, { facebookReelPollIntervalMs: 1, facebookReelMaxWaitMs: 20 }));
  assert.equal(result.failed, 1);
  assert.equal(finishCalls, 1);
  assert.match(harness.state.lastError ?? "", /Verifique a Página/i);
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

test("a simultaneous Instagram and Facebook schedule archives only after both publish", async () => {
  let publishedCount = 1;
  const db = {
    async query(sql: string) {
      assert.match(sql, /status <> 'cancelled'/);
      return [[{ publication_count: 2, published_count: publishedCount }], []];
    },
  } as unknown as Pool;
  const input = { clientAccountId: "client-1", cardId: "card-1", scheduledAt: "2026-09-29T16:00:00.000Z" };
  assert.equal(await canArchiveScheduledPublicationCard(db, input), false);
  publishedCount = 2;
  assert.equal(await canArchiveScheduledPublicationCard(db, input), true);
});
