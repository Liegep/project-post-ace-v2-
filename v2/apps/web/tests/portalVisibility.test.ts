import assert from "node:assert/strict";
import test from "node:test";
import { portalKnowledgeNavigation } from "../src/portalVisibility.js";
import { normalizeClientPermissions, toggleClientPermission } from "../../../shared/client-permissions.mjs";
import { createClientAccountSchema, updateClientTrackerSchema } from "../../api/src/modules/clients/clients.schemas.js";
import type { BriefInstance } from "../src/api.js";

const none = { allowClientEditBrandBrain: false, allowClientViewBrandBrain: false };
test("tracker toggles and server writes preserve Edit implies View", () => {
  const edit = toggleClientPermission(none, "allowClientEditBrandBrain");
  assert.deepEqual(edit, { allowClientEditBrandBrain: true, allowClientViewBrandBrain: true });
  assert.deepEqual(toggleClientPermission(edit, "allowClientViewBrandBrain"), none);
  assert.deepEqual(normalizeClientPermissions({ ...none, allowClientEditBrandBrain: true }), edit);
  const created = createClientAccountSchema.parse({ name: "Cliente", slug: "cliente", portalTitle: "Portal", clientPermissions: { ...none, allowClientEditBrandBrain: true } });
  assert.equal(created.clientPermissions.allowClientViewBrandBrain, true);
  const tracker = { locale: "pt", trackingEnabled: false, trackingVisibleToClient: false, showUpcomingPosts: false, showArchivedToClient: false, visibleColumnIds: [], clientPermissions: { ...created.clientPermissions, allowClientViewBrandBrain: false } };
  assert.equal(updateClientTrackerSchema.parse(tracker).clientPermissions.allowClientViewBrandBrain, true);
  assert.equal(updateClientTrackerSchema.parse({ ...tracker, clientPermissions: { ...created.clientPermissions, ...none } }).clientPermissions.allowClientEditBrandBrain, false);
});
test("menu reflects the portal list and counts only pending responses", () => {
  assert.deepEqual(portalKnowledgeNavigation(false, []), []);
  assert.deepEqual(portalKnowledgeNavigation(true, []), [{ view: "brand", label: "Brand Brain", count: 0 }]);
  const items = (...statuses: BriefInstance["status"][]) => statuses.map((status) => ({ status }) as BriefInstance);
  assert.deepEqual(portalKnowledgeNavigation(false, items("sent")), [{ view: "briefs", label: "Briefs", count: 1 }]);
  assert.deepEqual(portalKnowledgeNavigation(false, items("answered")), [{ view: "briefs", label: "Briefs", count: 0 }]);
  assert.equal(portalKnowledgeNavigation(false, items("sent", "reopened", "answered", "archived"))[0].count, 2);
});
