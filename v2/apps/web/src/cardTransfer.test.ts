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
