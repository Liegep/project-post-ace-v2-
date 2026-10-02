import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MetaPreflightSummary } from "../src/MetaPreflightPanel";
import type { MetaPreflightResult } from "../src/api";
const result = (overrides: Partial<MetaPreflightResult> = {}): MetaPreflightResult => ({
  clientAccountId: "a", destinationId: "dest-a", destinationName: "Detection", cardId: null, status: "safe",
  checks: { destinationBelongsToClient: true, cardBelongsToClient: null, facebookAssetMatches: true, instagramAssetMatches: true, facebookAccessOk: true, instagramAccessOk: true, instagramLinkedToFacebook: true, noCrossClientCollision: true },
  facebook: { savedId: "101", savedName: "Detection", liveId: "101", liveName: "Detection" },
  instagram: { savedId: "201", savedUsername: "detection", liveId: "201", liveUsername: "detection" }, issues: [], collisions: [], ...overrides,
});
test("summary shows real Meta identities and does not claim publication permissions were tested", () => {
  const html = renderToStaticMarkup(<MetaPreflightSummary result={result()} />);
  assert.match(html, /Roteamento confirmado/); assert.match(html, /Facebook: Detection/); assert.match(html, /@detection/);
  assert.match(html, /permissões de publicação não são testadas/); assert.doesNotMatch(html, /Card pertence/);
});
test("collision warnings show shared clients and a clear warning", () => {
  const html = renderToStaticMarkup(<MetaPreflightSummary result={result({ status: "warning", issues: [{ platform: "routing", code: "asset_linked_to_multiple_clients" }], collisions: [{ platform: "instagram", assetId: "201", clientAccountId: "b", clientName: "Cliente B", destinationId: "dest-b", destinationName: "Outra marca" }] })} />);
  assert.match(html, /Verificação com ressalvas/); assert.match(html, /compartilhamento é intencional/); assert.match(html, /Cliente B.*Outra marca/);
});
test("blocked summaries surface association failures and escape Meta labels", () => {
  const html = renderToStaticMarkup(<MetaPreflightSummary result={result({ status: "blocked", issues: [{ platform: "instagram", code: "instagram_page_link_mismatch" }], facebook: { savedId: "101", savedName: "x", liveId: "101", liveName: "<script>alert(1)</script>" } })} />);
  assert.match(html, /Não foi possível confirmar este destino/); assert.match(html, /vinculado à Página/);
  assert.doesNotMatch(html, /<script>/); assert.match(html, /&lt;script&gt;/);
});
