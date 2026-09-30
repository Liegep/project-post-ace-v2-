import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import type { FastifyInstance } from "fastify";
import type { Pool } from "mysql2/promise";
import { cancelScheduledPublicationGroup, listGlobalScheduledPublications, rescheduleScheduledPublications } from "./meta.repository.js";
import { createMetaPublicationSchema, metaPublicationsQuerySchema } from "./meta.schemas.js";
import { searchMetaPlaces } from "./meta.service.js";

const publicationRow = (overrides: Record<string, unknown> = {}) => ({
  id: "publication-1", client_account_id: "client-1", card_id: "card-1", platform: "instagram", meta_asset_id: "ig-1",
  scheduled_at: "2026-09-30T12:00:00.000000Z", timezone: "Europe/Stockholm", caption: "Legenda", media_url: "https://cdn.example.com/image.jpg",
  media_urls_json: ["https://cdn.example.com/image.jpg"], media_type: "image", reel_cover_url: null, location_id: "123", location_name: "Piazza San Marco",
  instagram_user_tags_json: [], status: "scheduled", attempt_count: 0, idempotency_key: "key", published_meta_id: null,
  published_permalink: null, last_error: null, created_by_user_id: "user-1", created_at: "2026-09-30T10:00:00Z", updated_at: "2026-09-30T10:00:00Z", published_at: null,
  client_name: "Minas Home", client_slug: "minas-home", card_title: "Post Primavera", ...overrides,
});

test("global publications query keeps supported filters and pagination", () => {
  const parsed = metaPublicationsQuerySchema.parse({ clientAccountId: "client-1", platform: "facebook", mediaType: "carousel", status: "failed", from: "2026-09-01T00:00:00Z", to: "2026-10-01T00:00:00Z", limit: "50", offset: "10" });
  assert.deepEqual(parsed, { clientAccountId: "client-1", platform: "facebook", mediaType: "carousel", status: "failed", from: "2026-09-01T00:00:00Z", to: "2026-10-01T00:00:00Z", limit: 50, offset: 10 });
});

test("global listing joins clients and cards while preserving each platform status", async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const db = { async query(sql: string, params: unknown[] = []) {
    calls.push({ sql, params });
    if (sql.includes("COUNT(*) AS total")) return [[{ total: 2 }], []];
    if (sql.includes("SUM(status = 'scheduled')")) return [[{ scheduled: 1, publishing: 0, published_today: 1, failed: 0 }], []];
    return [[publicationRow(), publicationRow({ id: "publication-2", platform: "facebook", status: "published", published_meta_id: "post-2" })], []];
  } } as unknown as Pool;
  const result = await listGlobalScheduledPublications(db, { clientAccountId: "client-1", limit: 100, offset: 0 });
  assert.equal(result.items.length, 2);
  assert.deepEqual(result.items.map((item) => [item.platform, item.status]), [["instagram", "scheduled"], ["facebook", "published"]]);
  assert.equal(result.items[0]?.clientName, "Minas Home");
  assert.equal(result.items[0]?.cardTitle, "Post Primavera");
  assert.equal(result.items[0]?.locationName, "Piazza San Marco");
  assert.match(calls[0]?.sql ?? "", /INNER JOIN client_accounts.+LEFT JOIN kanban_cards/);
  assert.match(calls[0]?.sql ?? "", /p\.client_account_id = \?/);
});

function transactionPool(statuses: string[]) {
  const updates: string[] = [];
  const connection = {
    async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
    async query(sql: string) {
      if (sql.includes("FOR UPDATE")) return [statuses.map((status, index) => publicationRow({ id: `publication-${index + 1}`, status })), []];
      updates.push(sql); return [{ affectedRows: statuses.length }, []];
    },
  };
  return { db: { async getConnection() { return connection; } } as unknown as Pool, updates };
}

test("rescheduling is atomic and allowed only while every record is scheduled", async () => {
  const allowed = transactionPool(["scheduled", "scheduled"]);
  assert.equal(await rescheduleScheduledPublications(allowed.db, { publicationIds: ["publication-1", "publication-2"], scheduledAt: "2026-10-02T14:00:00Z", timezone: "Europe/Stockholm" }), true);
  assert.equal(allowed.updates.some((sql) => sql.includes("SET scheduled_at")), true);
  const blocked = transactionPool(["scheduled", "published"]);
  assert.equal(await rescheduleScheduledPublications(blocked.db, { publicationIds: ["publication-1", "publication-2"], scheduledAt: "2026-10-02T14:00:00Z", timezone: "Europe/Stockholm" }), false);
  assert.equal(blocked.updates.length, 0);
});

test("individual and grouped cancellation preserve publishing safety", async () => {
  const individual = transactionPool(["scheduled"]);
  assert.equal((await cancelScheduledPublicationGroup(individual.db, ["publication-1"]))?.length, 1);
  const group = transactionPool(["scheduled", "failed"]);
  assert.equal((await cancelScheduledPublicationGroup(group.db, ["publication-1", "publication-2"]))?.length, 2);
  const blocked = transactionPool(["scheduled", "publishing"]);
  assert.equal(await cancelScheduledPublicationGroup(blocked.db, ["publication-1", "publication-2"]), null);
  assert.equal(blocked.updates.length, 0);
});

test("location name is optional, stored with its id, and manual id remains valid", () => {
  const selected = createMetaPublicationSchema.parse({ cardId: "card-1", platforms: ["facebook"], scheduledAt: "2026-10-02T14:00:00Z", timezone: "Europe/Stockholm", locationId: "123", locationName: "Piazza San Marco" });
  assert.equal(selected.locationId, "123");
  assert.equal(selected.locationName, "Piazza San Marco");
  const manual = createMetaPublicationSchema.parse({ cardId: "card-1", platforms: ["facebook"], scheduledAt: "2026-10-02T14:00:00Z", timezone: "Europe/Stockholm", locationId: "456" });
  assert.equal(manual.locationId, "456");
  assert.equal(manual.locationName, null);
});

function encryptToken(token: string, key: Buffer) {
  const iv = Buffer.alloc(12, 4);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

test("short place query does not access Meta", async () => {
  let fetchCalls = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async () => { fetchCalls += 1; return new Response(); };
  try {
    assert.deepEqual(await searchMetaPlaces({} as FastifyInstance, "user-1", "Ve"), []);
    assert.equal(fetchCalls, 0);
  } finally { globalThis.fetch = original; }
});

test("official pages search returns safe place data without exposing tokens", async () => {
  const key = Buffer.alloc(32, 8);
  const token = "EA-test-secret-token-value";
  const requests: URL[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (input) => {
    requests.push(new URL(String(input)));
    return new Response(JSON.stringify({ data: [{ id: "321", name: "Piazza San Marco", location: { city: "Venezia", state: "Veneto", country: "Italy", zip: 30124 } }] }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const app = {
    db: { async query(sql: string) { if (sql.includes("FROM meta_connections")) return [[{ access_token_encrypted: encryptToken(token, key), token_expires_at: null, meta_user_id: "meta-1", meta_account_name: "Conta" }], []]; throw new Error(`Unexpected SQL: ${sql}`); } },
    appEnv: { META_APP_ID: "app", META_APP_SECRET: "app-secret", META_REDIRECT_URI: "https://app.example.com/api/meta/callback", META_TOKEN_ENCRYPTION_KEY: key.toString("base64") },
    httpErrors: { badRequest: (message: string) => new Error(message) }, log: { info() {}, warn() {}, error() {} },
  } as unknown as FastifyInstance;
  try {
    const places = await searchMetaPlaces(app, "user-1", "Venezia");
    assert.deepEqual(places, [{ id: "321", name: "Piazza San Marco", location: { city: "Venezia", state: "Veneto", country: "Italy", street: null, zip: "30124" } }]);
    assert.equal(requests[0]?.pathname, "/v26.0/pages/search");
    assert.equal(requests[0]?.searchParams.get("q"), "Venezia");
    assert.equal(requests[0]?.searchParams.get("fields"), "id,name,location");
    assert.doesNotMatch(JSON.stringify(places), /EA-test|app-secret|appsecret_proof/);
  } finally { globalThis.fetch = original; }
});
