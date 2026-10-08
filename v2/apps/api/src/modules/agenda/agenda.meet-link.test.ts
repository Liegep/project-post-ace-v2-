import assert from "node:assert/strict";
import test from "node:test";
import { normalizeMeetLink } from "./agenda.meet-link.js";

test("keeps complete Google Meet links unchanged", () => {
  assert.equal(normalizeMeetLink("https://meet.google.com/abc-defg-hij"), "https://meet.google.com/abc-defg-hij");
});

test("adds https to links pasted without a protocol", () => {
  assert.equal(normalizeMeetLink(" meet.google.com/abc-defg-hij "), "https://meet.google.com/abc-defg-hij");
});

test("accepts protocol-relative links", () => {
  assert.equal(normalizeMeetLink("//meet.google.com/abc-defg-hij"), "https://meet.google.com/abc-defg-hij");
});

test("extracts a Meet address pasted together with explanatory text", () => {
  assert.equal(
    normalizeMeetLink("Reunião: https://meet.google.com/abc-defg-hij (cliente)"),
    "https://meet.google.com/abc-defg-hij",
  );
});

test("repairs a duplicated protocol", () => {
  assert.equal(
    normalizeMeetLink("https://https://meet.google.com/abc-defg-hij"),
    "https://meet.google.com/abc-defg-hij",
  );
});

test("rejects empty and unsafe schemes", () => {
  assert.equal(normalizeMeetLink(""), null);
  assert.equal(normalizeMeetLink("javascript:alert(1)"), null);
});
