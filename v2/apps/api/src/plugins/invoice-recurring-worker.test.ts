import assert from "node:assert/strict";
import test from "node:test";
import Fastify, { type FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import type { Pool } from "mysql2/promise";
import { invoiceRecurringWorkerRegistered } from "./invoice-recurring-worker.js";

test("worker catches up on startup, retries periodically after a failure, and stops on close", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  let runs = 0;
  let releases = 0;
  const periods: unknown[] = [];
  const db = { getConnection: async () => {
    runs++;
    if (runs === 1) throw new Error("temporary database failure");
    return {
      query: async (sql: string, params: unknown[]) => {
        if (sql.includes("GET_LOCK")) return [[{ acquired: 1 }], []];
        if (sql.includes("RELEASE_LOCK")) return [[], []];
        periods.push(params[0]); return [[], []];
      }, release: () => { releases++; },
    };
  } } as unknown as Pool;
  const app = Fastify();
  app.decorate("appEnv", { APP_TIMEZONE: "America/Sao_Paulo" } as FastifyInstance["appEnv"]);
  await app.register(fp(async (instance) => { instance.decorate("db", db); }, { name: "db-plugin" }));
  await app.register(invoiceRecurringWorkerRegistered);
  try {
    await app.ready(); assert.equal(runs, 1);
    t.mock.timers.tick(60 * 60 * 1000);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(runs, 2); assert.equal(releases, 1);
    assert.match(String(periods[0]), /^\d{4}-\d{2}-01$/);
    await app.close();
    t.mock.timers.tick(60 * 60 * 1000);
    assert.equal(runs, 2);
  } finally { await app.close(); t.mock.timers.reset(); }
});
