import assert from "node:assert/strict";
import test from "node:test";
import { agendaInterval, agendaInInterval } from "./agenda.interval.js";
import { calendarToday } from "../calendar/calendar.service.js";
test("date-only inclusive queries become local midnight half-open UTC intervals", () => {
  const interval = agendaInterval(
    "2026-10-04",
    "2026-10-04",
    "America/Sao_Paulo",
  );
  assert.deepEqual(interval, {
    from: "2026-10-04T03:00:00.000Z",
    to: "2026-10-05T03:00:00.000Z",
  });
  assert.equal(agendaInInterval(interval.from, interval), true);
  assert.equal(agendaInInterval(interval.to, interval), false);
  assert.equal(agendaInInterval("2026-10-05T02:59:59Z", interval), true);
});
test("explicit UTC queries stay half-open and DST uses actual day length", () => {
  assert.deepEqual(
    agendaInterval(
      "2026-10-04T00:00:00Z",
      "2026-10-05T00:00:00Z",
      "America/Sao_Paulo",
    ),
    { from: "2026-10-04T00:00:00.000Z", to: "2026-10-05T00:00:00.000Z" },
  );
  assert.throws(
    () => agendaInterval("2026-02-30", "2026-03-01", "UTC"),
    /inválido/,
  );
  const interval = agendaInterval(
    "2026-10-25",
    "2026-10-25",
    "Europe/Stockholm",
  );
  assert.equal(
    Date.parse(interval.to) - Date.parse(interval.from),
    25 * 3600000,
  );
  assert.throws(
    () => agendaInterval("2026-10-05", "2026-10-04", "UTC"),
    /inválido/,
  );
});
test("today comes from the current instant in the configured operation timezone", () => {
  const now = new Date("2027-01-01T01:00:00Z");
  assert.equal(calendarToday("America/Sao_Paulo", now), "2026-12-31");
  assert.equal(calendarToday("Europe/Stockholm", now), "2027-01-01");
});
