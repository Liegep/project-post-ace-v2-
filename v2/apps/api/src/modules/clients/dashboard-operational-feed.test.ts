import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Pool } from "mysql2/promise";
import { dismissDashboardItem, ensureDashboardDismissalsTable, filterDismissedDashboardItems } from "./dashboard-dismissals.service.js";

const routesSource = readFileSync(new URL("./clients.routes.ts", import.meta.url), "utf8");
const webSource = readFileSync(new URL("../../../../web/src/App.tsx", import.meta.url), "utf8");
const approvedPautasQuery = routesSource.slice(
  routesSource.indexOf('"SELECT c.id, c.title, COALESCE(MAX(ae.created_at), c.updated_at) AS approvedAt,"'),
  routesSource.indexOf('"SELECT item_type AS itemType'),
);

test("dashboard approval feedback uses only the current non-legacy decision", () => {
  assert.match(routesSource, /e\.source <> 'legacy'/);
  assert.match(routesSource, /e\.action IN \('approved', 'changes_requested'\)/);
  assert.match(routesSource, /e\.revision = c\.approval_revision/);
  assert.match(routesSource, /e\.decision = c\.approval_state/);
  assert.doesNotMatch(routesSource, /CONCAT\('Estado anterior preservado:/);
  assert.doesNotMatch(routesSource, /CONCAT\('decision-', c\.id\)/);
});

test("standalone client comments remain actionable only while they are the latest card response", () => {
  assert.match(routesSource, /cc\.author_role IN \('cliente', 'guest'\)/);
  assert.match(routesSource, /NOT EXISTS \(SELECT 1 FROM card_comments newer WHERE newer\.card_id = cc\.card_id/);
  assert.match(routesSource, /c\.archived = 0 AND c\.scheduled_at IS NULL AND c\.published_at IS NULL/);
});

test("approved pautas require a current real approval and exclude converted or archived history", () => {
  assert.match(approvedPautasQuery, /ae\.revision = c\.approval_revision AND ae\.action = 'approved' AND ae\.decision = 'approved' AND ae\.source <> 'legacy'/);
  assert.match(approvedPautasQuery, /c\.archived = 0 AND c\.is_brief_approval = 1 AND c\.approval_state = 'approved'/);
  assert.match(approvedPautasQuery, /converted\.action = 'converted_to_post'/);
  assert.doesNotMatch(approvedPautasQuery, /LOWER\(c\.client_label\)|approval_links/);
});

test("persisted dismissals filter the operational response after reload", async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const db = { async query(sql: string, params: unknown[] = []) { calls.push({ sql, params }); return [{ affectedRows: 1 }, []]; } } as unknown as Pool;
  await ensureDashboardDismissalsTable(db);
  await dismissDashboardItem(db, { userId: "user-1", itemType: "approved_pauta", itemId: "pauta-1" });
  assert.match(calls[0]!.sql, /CREATE TABLE IF NOT EXISTS dashboard_dismissals/);
  assert.match(calls[1]!.sql, /INSERT IGNORE INTO dashboard_dismissals/);
  assert.deepEqual(calls[1]!.params, ["user-1", "approved_pauta", "pauta-1"]);
  assert.deepEqual(filterDismissedDashboardItems([{ id: "pauta-1" }, { id: "pauta-2" }], new Set(["pauta-1"])), [{ id: "pauta-2" }]);
  assert.match(routesSource, /NOT EXISTS \(SELECT 1 FROM dashboard_dismissals dd WHERE dd\.user_id = \?/);
  assert.match(routesSource, /dd\.item_type = 'client_feedback'/);
  assert.match(approvedPautasQuery, /dd\.item_type = 'approved_pauta'/);
});

test("widget counters use visible items and both dismiss buttons persist through the API", () => {
  assert.match(webSource, /Pautas aprovadas[\s\S]*<span>\{visibleItems\.length\}<\/span>/);
  assert.match(webSource, /Feedback dos clientes[\s\S]*<span>\{visibleItems\.length\}<\/span>/);
  assert.match(webSource, /dismissDashboardItem\("approved_pauta", id\)/);
  assert.match(webSource, /dismissDashboardItem\("client_feedback", id\)/);
});
