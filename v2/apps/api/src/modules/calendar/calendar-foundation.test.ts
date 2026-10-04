import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import type { Pool } from "mysql2/promise";
import type { AppEnv } from "../../config/env.js";
import { httpErrorsPluginRegistered } from "../../plugins/http-errors.js";
import type { AppRole } from "../auth/auth.types.js";
import { calendarRoutes } from "./calendar.routes.js";
import { agendaRoutes } from "../agenda/agenda.routes.js";
async function harness(role: AppRole | null, timeZone = "America/Sao_Paulo") {
  const statements: Array<{
    sql: string;
    params: unknown[];
  }> = [];
  const app = Fastify();
  await app.register(httpErrorsPluginRegistered);
  app.decorate("appEnv", { APP_TIMEZONE: timeZone } as AppEnv);
  app.decorate("db", {
    query: async (sql: string, params: unknown[] = []) => {
      statements.push({ sql, params });
      if (sql.startsWith("SHOW COLUMNS"))
        return [[{ Field: "event_timezone" }], []];
      if (sql.includes("FROM card_calendar_events"))
        return [
          [
            {
              id: "event",
              client_account_id: "client-a",
              client_name: "Aurora",
              client_slug: "aurora",
              card_id: "card-1",
              title: "Interno",
              publish_date: "2026-10-04",
              publish_time: "09:00:00",
              scheduled_timezone: "Invalid/Zone",
              status: "published",
            },
          ],
          [],
        ];
      if (sql.includes("FROM agenda_events"))
        return [
          [
            {
              id: "start",
              title: "No início",
              startsAt: "2026-10-04 09:00:00",
              endsAt: null,
              eventTimeZone: "Europe/Stockholm",
              recurrenceType: "none",
            },
            {
              id: "end",
              title: "No fim",
              startsAt: "2026-10-04 10:00:00",
              endsAt: null,
              eventTimeZone: "Europe/Stockholm",
              recurrenceType: "none",
            },
            {
              id: "repeat",
              title: "Semanal",
              startsAt: "2025-10-04 09:00:00",
              endsAt: null,
              eventTimeZone: "Europe/Stockholm",
              recurrenceType: "weekly",
            },
          ],
          [],
        ];
      throw new Error("Unexpected SQL: " + sql);
    },
  } as unknown as Pool);
  app.addHook("preHandler", async (request) => {
    if (role)
      request.auth = {
        user: {
          id: "user-1",
          fullName: "Test",
          email: "test@example.invalid",
          globalRole: role,
          avatarUrl: null,
          locale: "pt",
          isActive: true,
        },
        memberships: [
          {
            clientAccountId: "client-a",
            clientName: "Aurora",
            clientSlug: "aurora",
            ownerUserId: "user-1",
            membershipRole: "colaborador",
            portalAccessLevel: "admin",
            isPrimary: true,
          },
        ],
      };
  });
  await app.register(calendarRoutes);
  await app.register(agendaRoutes);
  await app.ready();
  return { app, statements };
}
test("calendar context requires internal access and exposes operation timezone without writes", async () => {
  for (const role of [
    null,
    "cliente",
    "colaborador",
    "admin",
    "super_admin",
  ] as const) {
    const { app, statements } = await harness(role);
    try {
      const response = await app.inject("/calendar/context");
      assert.equal(
        response.statusCode,
        role === null ? 401 : role === "cliente" ? 403 : 200,
      );
      if (response.statusCode === 200) {
        assert.equal(response.json().timeZone, "America/Sao_Paulo");
        assert.match(response.json().today, /^\d{4}-\d{2}-\d{2}$/);
      }
      assert.ok(statements.every((s) => s.sql.startsWith("SHOW")));
    } finally {
      await app.close();
    }
  }
});
test("calendar API retains client identity and configured fallback timezone; scope stays unchanged", async () => {
  for (const role of ["super_admin", "admin", "colaborador"] as const) {
    const { app, statements } = await harness(role);
    try {
      const response = await app.inject(
        "/calendar/overview?from=2026-10-01&to=2026-10-31",
      );
      assert.equal(response.statusCode, 200);
      const event = response.json().events[0];
      assert.equal(event.clientAccountId, "client-a");
      assert.equal(event.scheduledAt, "2026-10-04T12:00:00.000Z");
      assert.equal(event.scheduledTimeZone, "America/Sao_Paulo");
      const query = statements.find((s) =>
        s.sql.includes("FROM card_calendar_events"),
      )!;
      assert.equal(
        query.sql.includes("e.client_account_id IN"),
        role !== "super_admin",
      );
      if (role !== "super_admin") assert.ok(query.params.includes("client-a"));
    } finally {
      await app.close();
    }
  }
});
test("Agenda endpoint filters canonical instants after serialization and retains recurrence seeds", async () => {
  const { app, statements } = await harness("colaborador");
  try {
    const response = await app.inject(
      "/agenda/events?from=2026-10-04T07%3A00%3A00Z&to=2026-10-04T08%3A00%3A00Z",
    );
    assert.equal(response.statusCode, 200);
    assert.deepEqual(
      response.json().items.map((i: { id: string }) => i.id),
      ["start", "repeat"],
    );
    assert.equal(response.json().items[0].timeZone, "Europe/Stockholm");
    const sql = statements.find(
      (s) => s.sql.startsWith("SELECT") && s.sql.includes("FROM agenda_events"),
    )!;
    assert.ok(sql.sql.includes("e.client_account_id IN"));
    assert.ok(
      statements.every((s) => !/^ALTER|^UPDATE|^INSERT|^DELETE/.test(s.sql)),
    );
  } finally {
    await app.close();
  }
});

test("invalid legacy timezone falls back to the configured operation, not a fixed country", async () => {
  const { app } = await harness("super_admin", "Europe/Stockholm");
  try {
    const response = await app.inject(
      "/calendar/overview?from=2026-10-01&to=2026-10-31",
    );
    assert.equal(
      response.json().events[0].scheduledAt,
      "2026-10-04T07:00:00.000Z",
    );
    assert.equal(
      response.json().events[0].scheduledTimeZone,
      "Europe/Stockholm",
    );
  } finally {
    await app.close();
  }
});
