import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import type { FastifyInstance } from "fastify";
import type { Pool } from "mysql2/promise";
import { cancelScheduledPublicationGroup, countActivePublicationsForDestination, createMetaSavedLocation, createScheduledPublications, deleteMetaSavedLocation, findClientMetaInsightsContext, findMetaPublishDestination, listGlobalScheduledPublications, listMetaPublishDestinations, listMetaSavedLocations, listScheduledPublicationsForClient, rescheduleScheduledPublications, updateMetaPublishDestination, updateMetaSavedLocation } from "./meta.repository.js";
import { clientMetaPublicationsQuerySchema, createMetaPublicationSchema, createMetaPublishDestinationSchema, createMetaSavedLocationSchema, metaBestTimesQuerySchema, metaInsightsQuerySchema, metaPublicationsQuerySchema, updateMetaSavedLocationSchema } from "./meta.schemas.js";
import { searchMetaPlaces } from "./meta.service.js";
import { ensureMetaStorage } from "./meta.storage.js";

const publicationRow = (overrides: Record<string, unknown> = {}) => ({
  id: "publication-1", client_account_id: "client-1", card_id: "card-1", destination_id: "destination-1", destination_name: "Minas Home", platform: "instagram", meta_asset_id: "ig-1",
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
  assert.equal(result.items[0]?.destinationId, "destination-1");
  assert.equal(result.items[0]?.destinationName, "Minas Home");
  assert.match(calls[0]?.sql ?? "", /INNER JOIN client_accounts.+LEFT JOIN kanban_cards/);
  assert.match(calls[0]?.sql ?? "", /p\.client_account_id = \?/);
});

test("client calendar publications stay scoped to one client and the visible range", async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const db = { async query(sql: string, params: unknown[] = []) {
    calls.push({ sql, params });
    return [[publicationRow({ client_account_id: "client-a", card_title: "Post Primavera" })], []];
  } } as unknown as Pool;
  const range = clientMetaPublicationsQuerySchema.parse({ from: "2026-09-28T00:00:00Z", to: "2026-11-02T00:00:00Z" });
  const result = await listScheduledPublicationsForClient(db, "client-a", range);
  assert.equal(result.length, 1);
  assert.equal(result[0]?.clientAccountId, "client-a");
  assert.equal(result[0]?.cardTitle, "Post Primavera");
  assert.match(calls[0]?.sql ?? "", /p\.client_account_id = \?/);
  assert.match(calls[0]?.sql ?? "", /p\.scheduled_at >= \?.+p\.scheduled_at < \?/);
  assert.match(calls[0]?.sql ?? "", /LEFT JOIN kanban_cards/);
  assert.deepEqual(calls[0]?.params, ["client-a", "2026-09-28 00:00:00.000", "2026-11-02 00:00:00.000"]);
  assert.doesNotMatch(calls[0]?.sql ?? "", /client-b/);
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

const destinationRow = (overrides: Record<string, unknown> = {}) => ({
  id: "destination-1", client_account_id: "client-1", name: "Marca principal",
  facebook_page_id: "page-1", facebook_page_name: "Marca principal",
  instagram_account_id: "ig-1", instagram_username: "marca.principal", is_default: 1,
  created_at: "2026-09-30T10:00:00Z", updated_at: "2026-09-30T10:00:00Z", ...overrides,
});

test("destination schema supports FB+IG, Facebook-only and Instagram-only but rejects an empty destination", () => {
  const both = createMetaPublishDestinationSchema.parse({ name: "Marca A", facebookPageId: "page-a", facebookPageName: "Marca A", instagramAccountId: "ig-a", instagramUsername: "marca.a", isDefault: true });
  const facebookOnly = createMetaPublishDestinationSchema.parse({ name: "Marca B", facebookPageId: "page-b", facebookPageName: "Marca B" });
  const instagramOnly = createMetaPublishDestinationSchema.parse({ name: "Marca C", instagramAccountId: "ig-c", instagramUsername: "marca.c" });
  assert.equal(both.isDefault, true);
  assert.equal(facebookOnly.instagramAccountId, undefined);
  assert.equal(instagramOnly.facebookPageId, undefined);
  assert.equal(createMetaPublishDestinationSchema.safeParse({ name: "Vazio" }).success, false);
});

test("one or two destinations remain scoped to their client, including missing and cross-client ids", async () => {
  const rows = [destinationRow(), destinationRow({ id: "destination-2", name: "Marca secundária", is_default: 0 })];
  const db = { async query(sql: string, params: unknown[] = []) {
    if (sql.includes("WHERE client_account_id = ? ORDER BY")) return [params[0] === "client-1" ? rows : [], []];
    if (sql.includes("WHERE id = ? AND client_account_id = ?")) return [rows.filter((row) => row.id === params[0] && row.client_account_id === params[1]), []];
    throw new Error(`Unexpected SQL: ${sql}`);
  } } as unknown as Pool;
  const listed = await listMetaPublishDestinations(db, "client-1");
  assert.equal(listed.length, 2);
  assert.equal(listed.filter((item) => item.isDefault).length, 1);
  assert.equal((await findMetaPublishDestination(db, "destination-2", "client-1"))?.name, "Marca secundária");
  assert.equal(await findMetaPublishDestination(db, "destination-2", "client-2"), null);
  assert.equal(await findMetaPublishDestination(db, "missing", "client-1"), null);
});

test("organic insights resolve the requested destination, default destination and legacy fallback", async () => {
  const commercial = destinationRow({ id: "destination-commercial", name: "Commercial", facebook_page_id: "page-commercial", facebook_page_name: "Commercial Facebook", instagram_account_id: "ig-commercial", instagram_username: "commercial.instagram" });
  const detection = destinationRow({ id: "destination-detection", name: "Detection", facebook_page_id: "page-detection", facebook_page_name: "Detection Facebook", instagram_account_id: "ig-detection", instagram_username: "detection.instagram", is_default: 0 });
  const destinationDb = { async query(sql: string, params: unknown[] = []) {
    if (sql.includes("WHERE id = ? AND client_account_id = ?")) {
      const row = [commercial, detection].find((item) => item.id === params[0] && item.client_account_id === params[1]);
      return [row ? [row] : [], []];
    }
    if (sql.includes("WHERE client_account_id = ? ORDER BY")) return [params[0] === "client-1" ? [commercial] : [], []];
    throw new Error(`Unexpected SQL: ${sql}`);
  } } as unknown as Pool;

  const explicit = await findClientMetaInsightsContext(destinationDb, "client-1", "destination-detection");
  assert.deepEqual(explicit, {
    destinationId: "destination-detection", destinationName: "Detection",
    assets: { facebookPageId: "page-detection", facebookPageName: "Detection Facebook", instagramAccountId: "ig-detection", instagramUsername: "detection.instagram" },
  });
  assert.equal(await findClientMetaInsightsContext(destinationDb, "other-client", "destination-detection"), null);
  assert.equal(await findClientMetaInsightsContext(destinationDb, "client-1", "missing"), null);
  assert.equal((await findClientMetaInsightsContext(destinationDb, "client-1"))?.destinationId, "destination-commercial");

  const legacyDb = { async query(sql: string) {
    if (sql.includes("FROM meta_publish_destinations")) return [[], []];
    if (sql.includes("FROM client_accounts")) return [[{
      facebook_page_id: "legacy-page", facebook_page_name: "Legacy Facebook",
      instagram_account_id: "legacy-ig", instagram_username: "legacy.instagram",
      meta_ad_account_id: "act-legacy", meta_ad_account_name: "Legacy Ads", updated_at: "2026-09-30T10:00:00Z",
    }], []];
    throw new Error(`Unexpected SQL: ${sql}`);
  } } as unknown as Pool;
  assert.deepEqual(await findClientMetaInsightsContext(legacyDb, "client-legacy"), {
    destinationId: null, destinationName: null,
    assets: { facebookPageId: "legacy-page", facebookPageName: "Legacy Facebook", instagramAccountId: "legacy-ig", instagramUsername: "legacy.instagram" },
  });
});

test("insights query accepts an optional destination without changing the reporting period", () => {
  assert.deepEqual(metaInsightsQuerySchema.parse({ since: "2026-09-01", until: "2026-09-30", destinationId: "destination-detection" }), {
    since: "2026-09-01", until: "2026-09-30", destinationId: "destination-detection",
  });
  assert.deepEqual(metaInsightsQuerySchema.parse({ since: "2026-09-01", until: "2026-09-30" }), {
    since: "2026-09-01", until: "2026-09-30",
  });
});

test("changing the default clears the previous default and keeps exactly one selected", async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const connection = {
    async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
    async query(sql: string, params: unknown[] = []) {
      calls.push({ sql, params });
      if (sql.includes("FROM meta_publish_destinations") && sql.includes("FOR UPDATE")) return [[destinationRow({ id: "destination-2", is_default: 0 })], []];
      return [{ affectedRows: 1 }, []];
    },
  };
  const db = {
    async getConnection() { return connection; },
    async query(sql: string) {
      if (sql.includes("FROM meta_publish_destinations")) return [[destinationRow({ id: "destination-2", is_default: 1 })], []];
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  } as unknown as Pool;
  const updated = await updateMetaPublishDestination(db, "client-1", "destination-2", { isDefault: true });
  assert.equal(updated?.isDefault, true);
  assert.equal(calls.some((call) => call.sql.includes("SET is_default = FALSE WHERE client_account_id")), true);
  assert.equal(calls.some((call) => call.sql.includes("SET is_default = ?") && call.params[0] === true), true);
});

test("future publications are detected before destination deletion", async () => {
  const db = { async query(sql: string, params: unknown[]) {
    assert.match(sql, /destination_id = \?.+status IN \('scheduled', 'publishing', 'failed'\)/);
    assert.deepEqual(params, ["client-1", "destination-1"]);
    return [[{ total: 2 }], []];
  } } as unknown as Pool;
  assert.equal(await countActivePublicationsForDestination(db, "client-1", "destination-1"), 2);
});

test("a scheduled post persists the chosen destination and immutable Meta asset", async () => {
  let insertParams: unknown[] = [];
  const connection = {
    async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
    async query(sql: string, params: unknown[] = []) {
      if (sql.startsWith("INSERT INTO meta_scheduled_publications")) { insertParams = params; return [{ affectedRows: 1 }, []]; }
      if (sql.includes("FROM meta_scheduled_publications")) return [[publicationRow({ destination_id: "destination-2", destination_name: "Marca secundária", meta_asset_id: "ig-secondary" })], []];
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  const db = { async getConnection() { return connection; } } as unknown as Pool;
  const [result] = await createScheduledPublications(db, [{
    clientAccountId: "client-1", cardId: "card-1", destinationId: "destination-2", destinationName: "Marca secundária",
    platform: "instagram", metaAssetId: "ig-secondary", scheduledAt: "2026-10-02T14:00:00Z", timezone: "Europe/Stockholm",
    caption: "Legenda", mediaUrl: "https://cdn.example.com/post.jpg", mediaUrls: ["https://cdn.example.com/post.jpg"], mediaType: "image",
    reelCoverUrl: null, locationId: null, locationName: null, instagramUserTags: [], createdByUserId: "user-1", idempotencyKey: "immutable-key",
  }]);
  assert.deepEqual(insertParams.slice(3, 7), ["destination-2", "Marca secundária", "instagram", "ig-secondary"]);
  assert.equal(result?.publication.destinationId, "destination-2");
  assert.equal(result?.publication.metaAssetId, "ig-secondary");
});

test("best-times query carries the selected destination without changing timezone handling", () => {
  assert.deepEqual(metaBestTimesQuerySchema.parse({ timeZone: "Europe/Stockholm", destinationId: "destination-2" }), { timeZone: "Europe/Stockholm", destinationId: "destination-2" });
});

test("storage bootstrap contains idempotent legacy backfill for destinations and scheduled jobs", async () => {
  const statements: string[] = [];
  const db = { async query(sql: string | { sql: string }) {
    const text = typeof sql === "string" ? sql : sql.sql;
    statements.push(text);
    if (text.includes("SHOW COLUMNS FROM meta_connections")) return [[], []];
    if (text.startsWith("SHOW COLUMNS")) return [[{ Field: "present" }], []];
    if (text.startsWith("SHOW INDEX")) return [[{ Key_name: "idx_meta_sched_pub_destination" }], []];
    if (text.includes("information_schema.REFERENTIAL_CONSTRAINTS")) return [[{ CONSTRAINT_NAME: "fk_meta_sched_pub_destination" }], []];
    return [{ affectedRows: 0 }, []];
  } } as unknown as Pool;
  await ensureMetaStorage(db);
  assert.equal(statements.some((sql) => sql.includes("CREATE TABLE IF NOT EXISTS meta_publish_destinations")), true);
  assert.equal(statements.some((sql) => sql.includes("ALTER TABLE meta_connections ADD COLUMN expiry_diagnostics_json")), true);
  assert.equal(statements.some((sql) => sql.includes("ALTER TABLE meta_connections ADD COLUMN data_access_expires_at")), true);
  assert.equal(statements.some((sql) => sql.includes("UPDATE meta_connections SET data_access_expires_at = TIMESTAMPADD")), true);
  assert.equal(statements.some((sql) => sql.includes("INSERT INTO meta_publish_destinations") && sql.includes("NOT EXISTS")), true);
  assert.equal(statements.some((sql) => sql.includes("UPDATE meta_scheduled_publications") && sql.includes("p.destination_id IS NULL")), true);
});

test("saved location schemas require a numeric Meta Place ID and allow partial edits", () => {
  assert.deepEqual(createMetaSavedLocationSchema.parse({ name: " Venezia ", metaPlaceId: "1234567890", notes: " Centro histórico " }), {
    name: "Venezia", metaPlaceId: "1234567890", notes: "Centro histórico",
  });
  assert.deepEqual(updateMetaSavedLocationSchema.parse({ notes: "" }), { notes: null });
  assert.equal(createMetaSavedLocationSchema.safeParse({ name: "Venezia", metaPlaceId: "abc" }).success, false);
  assert.equal(updateMetaSavedLocationSchema.safeParse({}).success, false);
});

test("saved locations repository lists, creates, updates and deletes global locations", async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const row = { id: "location-1", name: "Venezia", meta_place_id: "1234567890", notes: null, created_at: "2026-09-30T10:00:00Z", updated_at: "2026-09-30T10:00:00Z" };
  const db = { async query(sql: string, params: unknown[] = []) {
    calls.push({ sql, params });
    if (sql.startsWith("SELECT")) return [[row], []];
    return [{ affectedRows: 1 }, []];
  } } as unknown as Pool;
  const listed = await listMetaSavedLocations(db);
  assert.deepEqual(listed[0], { id: "location-1", name: "Venezia", metaPlaceId: "1234567890", notes: null, createdAt: "2026-09-30T10:00:00.000Z", updatedAt: "2026-09-30T10:00:00.000Z" });
  await createMetaSavedLocation(db, { name: "Venezia", metaPlaceId: "1234567890", notes: null });
  await updateMetaSavedLocation(db, "location-1", { name: "Venezia Centro" });
  assert.equal(await deleteMetaSavedLocation(db, "location-1"), true);
  assert.equal(calls.some((call) => call.sql.includes("INSERT INTO meta_saved_locations")), true);
  assert.equal(calls.some((call) => call.sql.includes("UPDATE meta_saved_locations SET name = ?")), true);
  assert.equal(calls.some((call) => call.sql.includes("DELETE FROM meta_saved_locations")), true);
  assert.equal(calls.every((call) => !call.sql.includes("client_account_id")), true);
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
