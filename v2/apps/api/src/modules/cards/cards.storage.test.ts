import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "mysql2/promise";
import { ensureCardTimeZoneStorage } from "./cards.storage.js";

test("startup storage repair restores and marks previously published calendar events", async () => {
  const statements: string[] = [];
  const db = {
    query: async (sql: string) => {
      if (sql.startsWith("SHOW COLUMNS")) return [[{ Field: "present" }], []];
      statements.push(sql);
      return [{ affectedRows: 0 }, []];
    },
  } as unknown as Pool;

  await ensureCardTimeZoneStorage(db, "Europe/Stockholm");

  assert.ok(statements.some((sql) => sql.includes("INSERT IGNORE INTO card_calendar_events") && sql.includes("c.published_at IS NOT NULL")));
  assert.ok(statements.some((sql) => sql.includes("SET e.status = 'published'") && sql.includes("c.published_at IS NOT NULL")));
});
