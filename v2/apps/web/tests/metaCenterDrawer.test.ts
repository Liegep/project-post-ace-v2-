import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { adminCardRoute } from "../src/metaCenterNavigation";

test("Central Meta builds the official HashRouter card route for each client", () => {
  assert.equal(adminCardRoute("cliente-a", "card-1"), "/admin/cliente-a?card=card-1");
  assert.equal(adminCardRoute("cliente b", "card/2"), "/admin/cliente%20b?card=card%2F2");
  assert.equal(adminCardRoute("cliente-a", null), null);
});

test("reschedule backdrop is above the detail drawer and remains portaled", () => {
  const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const drawerLayer = Number(styles.match(/\.meta-center-backdrop\s*\{[^}]*z-index:\s*(\d+)/)?.[1]);
  const rescheduleLayer = Number(styles.match(/\.meta-reschedule-backdrop\s*\{[^}]*z-index:\s*(\d+)/)?.[1]);
  assert.ok(rescheduleLayer > drawerLayer);
  assert.match(app, /className="modal-backdrop meta-reschedule-backdrop"/);
  assert.match(app, /meta-reschedule-modal[\s\S]*document\.body/);
  assert.match(app, /role="dialog" aria-modal="true"/);
  assert.match(app, /input autoFocus type="datetime-local"/);
  assert.match(app, /onMouseDown=\{closeReschedule\}/);
});
