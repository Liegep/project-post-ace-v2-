import assert from "node:assert/strict";
import test from "node:test";
import { addCalendarDays, seasonalDaysLabel, countryName, formatSeasonalDate } from "./seasonalDates";
test("UI shows Hoje/Amanhã and crosses the year without local-time drift", () => {
  assert.equal(seasonalDaysLabel(0), "Hoje"); assert.equal(seasonalDaysLabel(1), "Amanhã");
  assert.equal(seasonalDaysLabel(4), "Em 4 dias"); assert.equal(seasonalDaysLabel(-1), "Ontem");
  assert.equal(addCalendarDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addCalendarDays("2026-03-28", 2), "2026-03-30");
  assert.equal(countryName("SE"), "Suécia"); assert.equal(countryName("AQ"), "Antártida");
  assert.match(formatSeasonalDate("2027-01-01"), /2027/);
});
