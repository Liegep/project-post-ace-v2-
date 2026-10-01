import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { metaConnectionPresentation, type MetaConnectionStatusInput } from "../src/metaConnectionStatus";

const NOW = new Date("2026-10-01T12:00:00.000Z");
const status = (overrides: Partial<MetaConnectionStatusInput> = {}): MetaConnectionStatusInput => ({
  connected: true,
  expiresAt: "2026-10-20T12:00:00.000Z",
  accountName: "Conta Meta",
  metaUserId: "meta-user",
  ...overrides,
});

test("classifies a healthy Meta connection with more than seven days remaining", () => {
  assert.deepEqual(metaConnectionPresentation(status(), NOW), {
    state: "healthy",
    label: "Conectada",
    actionLabel: "Atualizar conexão",
    daysRemaining: 19,
    expiresAt: new Date("2026-10-20T12:00:00.000Z"),
  });
});

test("warns when a Meta connection expires in seven days or less", () => {
  const sevenDays = metaConnectionPresentation(status({ expiresAt: "2026-10-08T12:00:00.000Z" }), NOW);
  const oneDay = metaConnectionPresentation(status({ expiresAt: "2026-10-02T01:00:00.000Z" }), NOW);
  assert.equal(sevenDays.state, "warning");
  assert.equal(sevenDays.label, "Expira em 7 dias");
  assert.equal(oneDay.label, "Expira em 1 dia");
});

test("distinguishes expired and missing Meta connections", () => {
  const expired = metaConnectionPresentation(status({ connected: false, expiresAt: "2026-09-30T12:00:00.000Z" }), NOW);
  const disconnected = metaConnectionPresentation(status({ connected: false, expiresAt: null, accountName: null, metaUserId: null }), NOW);
  assert.equal(expired.state, "expired");
  assert.equal(expired.label, "Conexão expirada");
  assert.equal(expired.actionLabel, "Reconectar Meta");
  assert.equal(disconnected.state, "disconnected");
  assert.equal(disconnected.label, "Meta não conectada");
  assert.equal(disconnected.actionLabel, "Conectar Meta");
});

test("Central Meta reuses the existing status and OAuth flow with its own return route", () => {
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.match(app, /setStatus\(await loadMetaStatus\(\)\)/);
  assert.match(app, /beginMetaConnection\("#\/area\/publicacoes-meta"\)/);
  assert.match(app, /oauthResult === "connected"/);
  assert.match(app, /area === "publicacoes-meta" \? \[\]/);
});
