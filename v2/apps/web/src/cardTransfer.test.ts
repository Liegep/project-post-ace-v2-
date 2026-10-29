import { test } from "node:test";
import assert from "node:assert/strict";
import { cardTransferPayload } from "./cardTransfer";
import { createCardSchema } from "../../api/src/modules/cards/cards.schemas";
import type { BoardCard } from "./types";

for (const zone of [null, undefined, "", "Europe/Stockholm"]) {
  test(`transfer payload validates with zone ${zone}`, () => {
    const card = { title: "Teste", scheduledTimeZone: zone, scheduledAt: "2026-11-01", approvalToken: "secret", metaPublicationId: "job" } as unknown as BoardCard;
    const payload = cardTransferPayload(card, "copy", null);
    assert.equal(createCardSchema.safeParse(payload).success, true);
    assert.equal(Object.prototype.hasOwnProperty.call(payload, "scheduledTimeZone"), Boolean(zone));
    if (zone) assert.equal(payload.scheduledTimeZone, zone);
    for (const field of ["scheduledAt", "approvalToken", "metaPublicationId"]) assert.equal(Object.prototype.hasOwnProperty.call(payload, field), false);
  });
}

import { transferCard, CardMovePartialError } from "./cardTransfer";
test("failed creation never deletes original", async () => {
  let deleted = false;
  await assert.rejects(transferCard(async () => { throw Error("API"); }, async () => { deleted = true; }, "move"));
  assert.equal(deleted, false);
});
test("failed deletion reports partial move explicitly", async () => {
  let created = 0;
  await assert.rejects(transferCard(async () => { created++; }, async () => { throw Error("delete"); }, "move"), CardMovePartialError);
  assert.equal(created, 1);
});
test("copy never deletes; move deletes after creation", async () => {
  const steps: string[] = [];
  const create = async () => { steps.push("create"); };
  const remove = async () => { steps.push("delete"); };
  await transferCard(create, remove, "copy");
  await transferCard(create, remove, "move");
  assert.deepEqual(steps, ["create", "create", "delete"]);
});

test("applicable media and editorial fields survive the allowlist", () => {
  const card = {title:"Conteúdo",mediaType:"video",mediaUrls:["/api/uploads/abc.mp4","/api/uploads/abc.pdf"],editorialBrief:{concept:"Conceito"},priorityLevel:"high",eventColor:"#123456",keepFiles:true} as BoardCard;
  const payload=cardTransferPayload(card,"move","destination");
  assert.equal(createCardSchema.safeParse(payload).success,true);
  for(const key of ["mediaType","mediaUrls","editorialBrief","priorityLevel","eventColor","keepFiles"] as const) assert.deepEqual(payload[key],card[key]);
});
