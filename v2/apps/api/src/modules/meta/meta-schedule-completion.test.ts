import assert from "node:assert/strict";
import test from "node:test";
import { completeMetaScheduling } from "./meta-schedule-completion.js";

test("a successful Meta schedule moves the card only after persistence", async () => {
  const events: string[] = [];
  const result = await completeMetaScheduling(
    async () => { events.push("publication-created"); return ["publication"]; },
    async () => { events.push("card-moved"); },
  );
  assert.deepEqual(events, ["publication-created", "card-moved"]);
  assert.deepEqual(result, ["publication"]);
});

test("a failed Meta schedule never moves the card", async () => {
  let moved = false;
  await assert.rejects(completeMetaScheduling(
    async () => { throw new Error("Meta schedule failed"); },
    async () => { moved = true; },
  ), /Meta schedule failed/);
  assert.equal(moved, false);
});
