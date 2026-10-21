import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import mysql, { type PoolConnection, type RowDataPacket } from "mysql2/promise";
import { clearCompletedTimeEntries, createTimeEntry, ensureTimeTrackingTable, findActiveTimeEntry, listTimeEntries, resumeTimeEntry, stopTimeEntry } from "./time-tracking.repository.js";

// Never loads .env or TCP/database credentials. Only a dedicated temporary local
// instance is accepted; every fixture creates and drops its own random database.
const socketPath = process.env.TIME_TRACKING_TEST_SOCKET;
if (!socketPath || !/^\/(?:private\/)?tmp\/designhub-time-audit\.[^/]+\/mysql\.sock$/.test(socketPath)) {
  throw new Error("TIME_TRACKING_TEST_SOCKET must point to /tmp/designhub-time-audit.*/mysql.sock; staging/production connections are refused.");
}
const options = { socketPath, user: "root", charset: "utf8mb4", timezone: "Z" };

async function fixture() {
  const admin = await mysql.createConnection(options);
  const database = `time_test_${randomUUID().replace(/-/g, "")}`;
  await admin.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  const pool = mysql.createPool({ ...options, database, connectionLimit: 1, maxIdle: 1, waitForConnections: true, queueLimit: 50 });
  const connections = new Set<PoolConnection>();
  pool.on("connection", connection => connections.add(connection));
  const close = async () => {
    // Also permits a regression to fail promptly instead of hanging pool.end().
    for (const connection of connections) connection.destroy();
    await pool.end();
    try { await admin.query(`DROP DATABASE \`${database}\``); } finally { await admin.end(); }
  };
  try {
    await pool.query("CREATE TABLE users (id CHAR(36) PRIMARY KEY, full_name VARCHAR(100)) ENGINE=InnoDB");
    await pool.query("CREATE TABLE client_accounts (id CHAR(36) PRIMARY KEY, name VARCHAR(100)) ENGINE=InnoDB");
    await pool.query("CREATE TABLE kanban_cards (id CHAR(36) PRIMARY KEY, title VARCHAR(100)) ENGINE=InnoDB");
    await pool.query("INSERT INTO users VALUES ('u', 'Synthetic User')");
    await pool.query("INSERT INTO client_accounts VALUES ('c', 'Synthetic Client')");
    await ensureTimeTrackingTable(pool);
    return { pool, close };
  } catch (error) { await close(); throw error; }
}

async function deadline<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Operation blocked with a one-connection pool")), 1500);
    })]);
  } finally { clearTimeout(timer); }
}
const input = { userId: "u", clientAccountId: "c", cardId: null, description: "Synthetic task" };
async function assertReleased(pool: Awaited<ReturnType<typeof fixture>>["pool"]) {
  // Acquiring and querying the ONLY connection proves it was returned, without
  // inspecting private driver fields or enlarging the pool.
  const connection = await deadline(pool.getConnection());
  try { await connection.query("SELECT 1"); } finally { connection.release(); }
}

test("start, pause (stop), resume and final stop reuse and release the sole connection", async () => {
  const f = await fixture();
  try {
    const entry = await deadline(createTimeEntry(f.pool, input));
    assert.equal(entry.endedAt, null);
    await assertReleased(f.pool);
    // Synthetic historical timestamp makes elapsed-time checks deterministic.
    await f.pool.query("UPDATE time_entries SET last_started_at = DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 2 HOUR) WHERE id = ?", [entry.id]);
    const paused = await deadline(stopTimeEntry(f.pool, entry.id, "u"));
    assert.ok(paused?.endedAt);
    assert.ok(paused.durationSeconds! >= 7200);
    await assertReleased(f.pool);
    const resumed = await deadline(resumeTimeEntry(f.pool, entry.id, "u"));
    assert.equal(resumed?.endedAt, null);
    assert.equal(resumed?.durationSeconds, paused.durationSeconds);
    await assertReleased(f.pool);
    const stopped = await deadline(stopTimeEntry(f.pool, entry.id, "u"));
    assert.ok(stopped?.endedAt);
    assert.ok(stopped.durationSeconds! >= paused.durationSeconds!);
    assert.equal(await findActiveTimeEntry(f.pool, "u"), null);
    await assertReleased(f.pool);
  } finally { await f.close(); }
});

test("simultaneous starts yield one active entry and one conflict; pool remains usable", async () => {
  const f = await fixture();
  try {
    const results = await deadline(Promise.allSettled([createTimeEntry(f.pool, input), createTimeEntry(f.pool, input)]));
    assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
    const rejected = results.filter(result => result.status === "rejected");
    assert.equal(rejected.length, 1);
    assert.equal(rejected[0].reason.code, "ACTIVE_TIMER_EXISTS");
    const [rows] = await f.pool.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM time_entries WHERE ended_at IS NULL");
    assert.equal(Number(rows[0].total), 1);
    await assertReleased(f.pool);
  } finally { await f.close(); }
});

test("conflicts and missing resume roll back and release; list and clear still work", async () => {
  const f = await fixture();
  try {
    assert.equal(await deadline(resumeTimeEntry(f.pool, "missing", "u")), null);
    await assertReleased(f.pool);
    const entry = await deadline(createTimeEntry(f.pool, input));
    await assert.rejects(deadline(createTimeEntry(f.pool, input)), { code: "ACTIVE_TIMER_EXISTS" });
    await assertReleased(f.pool);
    await assert.rejects(deadline(resumeTimeEntry(f.pool, entry.id, "u")), { code: "ACTIVE_TIMER_EXISTS" });
    await assertReleased(f.pool);
    await stopTimeEntry(f.pool, entry.id, "u");
    const range = { from: new Date("2020-01-01"), to: new Date("2030-01-01"), clientIds: null };
    assert.equal((await listTimeEntries(f.pool, range)).length, 1);
    assert.equal(await clearCompletedTimeEntries(f.pool, range), 1);
    assert.equal((await listTimeEntries(f.pool, range)).length, 0);
    await assertReleased(f.pool);
  } finally { await f.close(); }
});
