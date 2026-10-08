import assert from "node:assert/strict";
import test from "node:test";
import type { AgendaEvent } from "../src/api";
import {
  calendarRange,
  moveAnchor,
  dayKey,
  expandAgendaOccurrences,
  agendaItemsByDay,
  agendaPeriodCount,
  filterAgenda,
  emptyAgendaFilters,
  agendaVisualState,
  agendaEditDate,
  agendaWallInput,
  chooseAgendaColor,
  chooseAgendaLabel,
} from "../src/agendaFoundation";
const zone = "America/Sao_Paulo";
const event = (
  id: string,
  startsAt: string,
  extra: Partial<AgendaEvent> = {},
): AgendaEvent => ({
  id,
  title: id,
  startsAt,
  color: "#c9f7df",
  isCompleted: false,
  recurrenceType: "none",
  ...extra,
});
test("Agenda navigation uses month/year including leap years and December rollover", () => {
  for (const [from, to] of [
    ["2026-01-31", "2026-02-01"],
    ["2026-02-28", "2026-03-01"],
    ["2024-01-31", "2024-02-01"],
    ["2024-02-29", "2024-03-01"],
    ["2026-12-31", "2027-01-01"],
  ])
    assert.equal(moveAnchor(from, "month", 1), to);
  assert.equal(moveAnchor("2027-01-31", "month", -1), "2026-12-01");
});
test("Agenda operational dates, grouping and creation/editing are device independent", () => {
  const original = process.env.TZ;
  try {
    for (const device of ["UTC", "Europe/Stockholm", "Pacific/Honolulu"]) {
      process.env.TZ = device;
      const item = event("midnight", "2026-10-05T01:00:00Z", {
        timeZone: "Europe/Stockholm",
      });
      assert.equal(dayKey(item.startsAt, zone), "2026-10-04");
      assert.equal(agendaWallInput(item.startsAt, zone), "2026-10-04T22:00");
      assert.equal(agendaItemsByDay([item], zone).get("2026-10-04")?.length, 1);
      assert.deepEqual(
        agendaEditDate("2026-10-04T22:00", zone, "Europe/Stockholm"),
        { startsAt: "2026-10-05T03:00:00", timeZone: "Europe/Stockholm" },
      );
    }
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
  assert.throws(() => agendaEditDate("2026-02-30T09:00", zone, zone));
});
test("Open recurring series have no artificial expiry and only return the requested interval", () => {
  const source = event("open", "2020-10-05T12:00:00Z", {
    recurrenceType: "weekly",
    timeZone: zone,
  });
  const r = calendarRange("2026-10-05", "week", zone);
  const list = expandAgendaOccurrences([source], r.from, r.to, zone);
  assert.equal(list.length, 1);
  assert.equal(dayKey(list[0].startsAt, zone), "2026-10-05");
  assert.equal(list[0].sourceEventId, "open");
  assert.equal(source.startsAt, "2020-10-05T12:00:00Z");
  assert.equal(
    expandAgendaOccurrences(
      [{ ...source, repeatUntil: "2025-10-31" }],
      r.from,
      r.to,
      zone,
    ).length,
    0,
  );
});
test("Weekdays and monthly nth weekday preserve existing rules; explicit end is inclusive", () => {
  const r = calendarRange("2026-10-05", "week", zone);
  assert.equal(
    expandAgendaOccurrences(
      [
        event("daily", "2026-10-05T12:00:00Z", {
          recurrenceType: "weekdays",
          timeZone: zone,
          repeatUntil: "2026-10-07",
        }),
      ],
      r.from,
      r.to,
      zone,
    ).length,
    3,
  );
  const month = calendarRange("2026-11-01", "month", zone);
  const list = expandAgendaOccurrences(
    [
      event("secondTue", "2026-10-13T12:00:00Z", {
        recurrenceType: "monthly_nth_weekday",
        timeZone: zone,
      }),
    ],
    month.from,
    month.to,
    zone,
  );
  assert.ok(list.some((e) => dayKey(e.startsAt, zone) === "2026-11-10"));
  assert.ok(!list.some((e) => dayKey(e.startsAt, zone) === "2026-11-03"));
});
test("Recurrence respects original timezone across DST while rendering in operation timezone", () => {
  const r = calendarRange("2026-10-25", "week", zone);
  const list = expandAgendaOccurrences(
    [
      event("stockholm", "2026-10-18T07:00:00Z", {
        recurrenceType: "weekly",
        timeZone: "Europe/Stockholm",
      }),
    ],
    r.from,
    r.to,
    zone,
  );
  assert.ok(list.some((e) => e.startsAt === "2026-10-25T08:00:00.000Z"));
  const dst = calendarRange("2026-10-25", "day", "Europe/Stockholm");
  assert.equal(Date.parse(dst.to) - Date.parse(dst.from), 25 * 3600000);
});
test("Occurrences of all series are globally chronological with stable ties and duration", () => {
  const r = calendarRange("2026-10-12", "week", zone);
  const list = expandAgendaOccurrences(
    [
      event("ten", "2026-10-05T13:00:00Z", {
        recurrenceType: "weekly",
        timeZone: zone,
      }),
      event("nine", "2026-10-12T12:00:00Z", {
        recurrenceType: "weekly",
        timeZone: zone,
        endsAt: "2026-10-12T13:00:00Z",
      }),
    ],
    r.from,
    r.to,
    zone,
  );
  assert.deepEqual(
    list.map((e) => e.sourceEventId),
    ["nine", "ten"],
  );
  assert.equal(
    Date.parse(list[0].endsAt!) - Date.parse(list[0].startsAt),
    3600000,
  );
});
test("Month count excludes neighboring grid days and filters operate on actual occurrences", () => {
  const r = calendarRange("2026-10-01", "month", zone);
  const list = [
    event("before", "2026-09-30T12:00:00Z"),
    event("inside", "2026-10-01T12:00:00Z", {
      clientAccountId: "a",
      labelId: "l",
    }),
    event("after", "2026-11-01T12:00:00Z", { isCompleted: true }),
  ];
  assert.equal(r.days.length, 42);
  assert.equal(agendaPeriodCount(list, r, zone), 1);
  assert.deepEqual(
    filterAgenda(list, {
      ...emptyAgendaFilters,
      client: "a",
      label: "l",
      completion: "pending",
    }).map((e) => e.id),
    ["inside"],
  );
  assert.equal(
    filterAgenda(list, { ...emptyAgendaFilters, completion: "completed" })
      .length,
    1,
  );
});
test("Manual color keeps label, label only suggests color without mutating previous events", () => {
  const form = { color: "#ffffff", labelId: "l" };
  assert.deepEqual(chooseAgendaColor(form, "#123456"), {
    color: "#123456",
    labelId: "l",
  });
  assert.equal(
    chooseAgendaLabel(form, "new", [
      { id: "new", name: "Prazo", color: "#ffeedd" },
    ]).color,
    "#ffeedd",
  );
  assert.equal(form.color, "#ffffff");
});
test("Past appointments and completed appointments have distinct labels and visual classes", () => {
  const past = event("past", "2026-10-01T12:00:00Z");
  assert.equal(
    agendaVisualState(past, Date.parse("2026-10-05")).label,
    "Passado · Pendente",
  );
  assert.equal(
    agendaVisualState(past, Date.parse("2026-10-05")).completed,
    false,
  );
  assert.equal(
    agendaVisualState({ ...past, isCompleted: true }, Date.parse("2026-10-05"))
      .label,
    "Concluído",
  );
  assert.notEqual(
    agendaVisualState(past).className,
    agendaVisualState({ ...past, isCompleted: true }).className,
  );
});
