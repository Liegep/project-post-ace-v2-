import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { ensureMetaStorage } from "./meta.storage.js";
import { cancelScheduledPublication, cancelScheduledPublicationGroup, createScheduledPublications, markPublicationPublishing, markPublicationFailed, markPublicationPublished, type CreateScheduledPublicationInput } from "./meta.repository.js";

// Never reads .env or accepts TCP/production credentials. Run only against an
// isolated temporary MariaDB server with --skip-networking.
const socketPath = process.env.META_TEST_SOCKET;
if (socketPath && !/^\/(?:private\/)?tmp\/meta-mariadb-[^/]+\/server\.sock$/.test(socketPath)) {
  throw new Error("META_TEST_SOCKET must be /tmp/meta-mariadb-*/server.sock");
}

test("Meta slot generations preserve history and deduplicate concurrent active requests", { skip: !socketPath }, async () => {
  const database = `meta_test_${randomUUID().replace(/-/g, "")}`;
  const server = await mysql.createConnection({ socketPath, user: "root" });
  await server.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  const db = mysql.createPool({ socketPath, user: "root", database, connectionLimit: 12, multipleStatements: true, timezone: "Z" });
  try {
    const schema = readFileSync(new URL("../../../db/schema.sql", import.meta.url), "utf8").split("-- Additive foundation only.")[0];
    await db.query(schema);
    await ensureMetaStorage(db);
    const client = randomUUID(), card = randomUUID(), destination = randomUUID(), user = randomUUID();
    await db.query("INSERT INTO users (id, full_name, email, password_hash, global_role, locale) VALUES (?, 'Test', 'test@invalid.test', 'unused', 'super_admin', 'pt')", [user]);
    await db.query("INSERT INTO client_accounts (id, name, slug, portal_title, locale) VALUES (?, 'Test', 'test', 'Test', 'pt')", [client]);
    await db.query("INSERT INTO kanban_cards (id, client_account_id, title) VALUES (?, ?, 'Test card')", [card, client]);
    await db.query("INSERT INTO meta_publish_destinations (id, client_account_id, name, instagram_account_id, facebook_page_id) VALUES (?, ?, 'Test', 'ig-test', 'fb-test')", [destination, client]);
    const input = (platform: "instagram" | "facebook" = "instagram", changes: Partial<CreateScheduledPublicationInput> = {}): CreateScheduledPublicationInput => ({
      clientAccountId: client, cardId: card, destinationId: destination, destinationName: "Test", platform,
      metaAssetId: platform === "instagram" ? "ig-test" : "fb-test", scheduledAt: "2026-12-01T18:00:00.000Z", timezone: "UTC",
      caption: "Caption", mediaUrl: "https://example.invalid/post.jpg", mediaUrls: ["https://example.invalid/post.jpg"], mediaType: "image",
      reelCoverUrl: null, locationId: "old-place", locationName: "Old location", instagramUserTags: [], createdByUserId: user,
      idempotencyKey: createHash("sha256").update(`${client}:${destination}:${card}:${platform}:2026-12-01T18:00:00.000Z`).digest("hex"), ...changes,
    });
    const initial = await Promise.all(Array.from({ length: 8 }, () => createScheduledPublications(db, [input()])));
    assert.equal(initial.filter(([item]) => item.created).length, 1);
    const first = initial[0][0];
    assert.ok(initial.every(([item]) => item.publication.id === first.publication.id));
    const replays = await Promise.all(Array.from({ length: 8 }, () => createScheduledPublications(db, [input()])));
    assert.ok(replays.every(([item]) => !item.created && item.publication.id === first.publication.id));
    assert.equal(await cancelScheduledPublication(db, first.publication.id, client), true);
    const replacements = await Promise.all(Array.from({ length: 8 }, () => createScheduledPublications(db, [input("instagram", { locationId: "new-place", locationName: "New location" })])));
    assert.equal(replacements.filter(([item]) => item.created).length, 1);
    const replacement = replacements[0][0].publication;
    assert.ok(replacements.every(([item]) => item.publication.id === replacement.id));
    assert.notEqual(replacement.id, first.publication.id);
    assert.equal(replacement.status, "scheduled");
    assert.equal(replacement.locationId, "new-place");
    assert.equal(replacement.locationName, "New location");
    const [history] = await db.query<RowDataPacket[]>("SELECT * FROM meta_scheduled_publications WHERE id = ?", [first.publication.id]);
    assert.equal(history[0].status, "cancelled");
    assert.equal(history[0].location_id, "old-place");
    assert.equal(history[0].idempotency_key, input().idempotencyKey);

    const [facebook] = await createScheduledPublications(db, [input("facebook")]);
    assert.ok(await cancelScheduledPublicationGroup(db, [replacement.id, facebook.publication.id]));
    // Opposite platform ordering must not deadlock or create two generations.
    const groups = await Promise.all(Array.from({ length: 8 }, (_, i) => createScheduledPublications(db, i % 2 ? [input(), input("facebook")] : [input("facebook"), input()])));
    assert.equal(groups.flat().filter((item) => item.created).length, 2);
    const active = groups[0].map(({ publication }) => publication);
    assert.ok(active.every((item) => item.status === "scheduled"));
    assert.ok(active.every((item) => item.id !== replacement.id && item.id !== facebook.publication.id));
    assert.equal(new Set(groups.flat().map(({ publication }) => publication.id)).size, 2);

    const instagram = active.find((item) => item.platform === "instagram")!;
    assert.equal(await markPublicationPublishing(db, instagram.id), true);
    const [publishingReplay] = await createScheduledPublications(db, [input()]);
    assert.equal(publishingReplay.created, false);
    assert.equal(publishingReplay.publication.status, "publishing");
    assert.equal(await cancelScheduledPublication(db, instagram.id, client), false);
    assert.equal(await markPublicationFailed(db, instagram.id, "Test failure"), true);
    const [afterFailure] = await createScheduledPublications(db, [input()]);
    assert.equal(afterFailure.created, true);
    assert.notEqual(afterFailure.publication.id, instagram.id);
    assert.equal(afterFailure.publication.status, "scheduled");
    const [failedHistory] = await db.query<RowDataPacket[]>("SELECT status FROM meta_scheduled_publications WHERE id = ?", [instagram.id]);
    assert.equal(failedHistory[0].status, "failed");

    // Published generations retain replay protection, even after cancelled ancestors.
    await markPublicationPublishing(db, afterFailure.publication.id);
    await markPublicationPublished(db, afterFailure.publication.id, { publishedMetaId: "published-test", publishedPermalink: null });
    const [publishedReplay] = await createScheduledPublications(db, [input()]);
    assert.equal(publishedReplay.created, false);
    assert.equal(publishedReplay.publication.status, "published");
    assert.equal(publishedReplay.publication.id, afterFailure.publication.id);

    // A later invalid input rolls back every newly inserted platform in the group.
    const newKey = createHash("sha256").update("rollback-test").digest("hex");
    await assert.rejects(createScheduledPublications(db, [input("instagram", { idempotencyKey: newKey }), input("facebook", { idempotencyKey: createHash("sha256").update("invalid").digest("hex"), destinationId: randomUUID() })]));
    const [rolledBack] = await db.query<RowDataPacket[]>("SELECT id FROM meta_scheduled_publications WHERE idempotency_key = ?", [newKey]);
    assert.equal(rolledBack.length, 0);
  } finally {
    await db.end();
    await server.query(`DROP DATABASE \`${database}\``);
    await server.end();
  }
});
