import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import type { Pool } from "mysql2/promise";
import { scheduledCardArchiverPluginRegistered } from "./scheduled-card-archiver.js";

test("archives overdue scheduled cards as soon as the API becomes ready", async () => {
  const transactionStatements: string[] = [];
  const connection = {
    beginTransaction: async () => undefined,
    query: async (sql: string) => {
      transactionStatements.push(sql);
      return [[], []];
    },
    commit: async () => undefined,
    rollback: async () => undefined,
    release: () => undefined,
  };
  const db = {
    query: async () => [[{
      id: "overdue-card",
      scheduled_at: "2020-01-01 12:00:00",
      scheduled_timezone: "America/Sao_Paulo",
    }], []],
    getConnection: async () => connection,
  } as unknown as Pool;

  const app = Fastify({ logger: false });
  app.decorate("appEnv", { APP_TIMEZONE: "America/Sao_Paulo" } as FastifyInstance["appEnv"]);
  await app.register(fp(async (instance) => {
    instance.decorate("db", db);
  }, { name: "db-plugin" }));
  await app.register(scheduledCardArchiverPluginRegistered);

  await app.ready();

  assert.equal(transactionStatements.length, 2);
  assert.match(transactionStatements[0], /archived = 1/);
  assert.match(transactionStatements[0], /published_at = COALESCE\(published_at, scheduled_at\)/);
  assert.match(transactionStatements[1], /DELETE FROM card_calendar_events/);

  await app.close();
});
