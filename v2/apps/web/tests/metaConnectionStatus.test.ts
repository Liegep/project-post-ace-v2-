import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { metaConnectionPresentation, type MetaConnectionStatusInput } from "../src/metaConnectionStatus";

const NOW = new Date("2026-10-01T12:00:00.000Z");
const status = (overrides: Partial<MetaConnectionStatusInput> = {}): MetaConnectionStatusInput => ({
  connected: true,
  expiresAt: "2026-10-20T12:00:00.000Z",
  dataAccessExpiresAt: null,
  accountName: "Conta Meta",
  metaUserId: "meta-user",
  ...overrides,
});

test("classifies a healthy Meta connection with more than fourteen days remaining", () => {
  assert.deepEqual(metaConnectionPresentation(status(), NOW), {
    state: "healthy",
    label: "Conectada",
    actionLabel: "Atualizar conexão",
    daysRemaining: 19,
    expiresAt: new Date("2026-10-20T12:00:00.000Z"),
    expiryKind: "token",
  });
});

test("prefers token expiry and falls back to data-access expiry", () => {
  const token = metaConnectionPresentation(status({ dataAccessExpiresAt: "2026-10-05T12:00:00.000Z" }), NOW);
  const dataAccess = metaConnectionPresentation(status({ expiresAt: null, dataAccessExpiresAt: "2026-10-08T12:00:00.000Z" }), NOW);
  assert.equal(token.expiryKind, "token");
  assert.equal(token.expiresAt?.toISOString(), "2026-10-20T12:00:00.000Z");
  assert.equal(dataAccess.expiryKind, "data_access");
  assert.equal(dataAccess.expiresAt?.toISOString(), "2026-10-08T12:00:00.000Z");
  assert.equal(dataAccess.state, "warning");
});

test("an active connection without either expiry stays healthy", () => {
  const presentation = metaConnectionPresentation(status({ expiresAt: null, dataAccessExpiresAt: null }), NOW);
  assert.equal(presentation.state, "healthy");
  assert.equal(presentation.expiresAt, null);
  assert.equal(presentation.expiryKind, null);
});

test("warns when a Meta connection expires in fourteen days or less", () => {
  const fourteenDays = metaConnectionPresentation(status({ expiresAt: "2026-10-15T12:00:00.000Z" }), NOW);
  const oneDay = metaConnectionPresentation(status({ expiresAt: "2026-10-02T01:00:00.000Z" }), NOW);
  assert.equal(fourteenDays.state, "warning");
  assert.equal(fourteenDays.label, "Expira em 14 dias");
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

test("data-access expiry drives expired, warning and healthy operational states", () => {
  const expired = metaConnectionPresentation(status({ connected: false, expiresAt: null, dataAccessExpiresAt: "2026-09-30T12:00:00.000Z" }), NOW);
  const warning = metaConnectionPresentation(status({ expiresAt: null, dataAccessExpiresAt: "2026-10-05T12:00:00.000Z" }), NOW);
  const healthy = metaConnectionPresentation(status({ expiresAt: null, dataAccessExpiresAt: "2026-10-20T12:00:00.000Z" }), NOW);
  assert.equal(expired.state, "expired");
  assert.equal(warning.state, "warning");
  assert.equal(warning.daysRemaining, 4);
  assert.equal(healthy.state, "healthy");
});

test("Central Meta reuses the existing status and OAuth flow with its own return route", () => {
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.match(app, /setStatus\(await loadMetaStatus\(\)\)/);
  assert.match(app, /beginMetaConnection\("#\/area\/publicacoes-meta"\)/);
  assert.match(app, /oauthResult === "connected"/);
  assert.match(app, /area === "publicacoes-meta" \? \[\]/);
});

test("temporary Meta diagnostics panel and frontend-only API call are removed", () => {
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const api = readFileSync(new URL("../src/api.ts", import.meta.url), "utf8");
  assert.doesNotMatch(api, /loadMetaExpiryDiagnostics|\/api\/meta\/status\/debug/);
  assert.doesNotMatch(app, /Diagnóstico Meta|refreshDiagnostics|meta-expiry-diagnostics/);
  assert.match(app, /Acesso aos dados válido até/);
  assert.match(app, /Conexão ativa/);
  assert.match(app, /dashboardMetaExpiry[\s\S]*metaConnectionPresentation\(dashboardMetaStatus, currentTime\)/);
});
