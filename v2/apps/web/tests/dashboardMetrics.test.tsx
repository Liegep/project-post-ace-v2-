import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardMetrics } from "../src/DashboardMetrics";
import type { DashboardStatistics } from "../src/api";
const statistics: DashboardStatistics = { timeZone: "Europe/Stockholm", month: "2026-10", postsThisMonth: 20, postsPreviousMonth: 0, pending: 8, scheduled: 7, published: 5, publishedPreviousMonth: 0 };
test("renders five workflow cards in order with operational counts and subtexts", () => {
  const html = renderToStaticMarkup(<DashboardMetrics activeClients={12} statistics={statistics} loading={false} renderIcon={() => <svg aria-hidden="true" />} />);
  assert.equal((html.match(/<article /g) ?? []).length, 5);
  const labels = [...html.matchAll(/<span>(.*?)<\/span>/g)].map((match) => match[1]);
  assert.deepEqual(labels, ["Clientes ativos", "Posts do mês", "Pendentes", "Agendados", "Publicados"]);
  assert.deepEqual([...html.matchAll(/<strong>(.*?)<\/strong>/g)].map((match) => match[1]), ["12", "20", "8", "7", "5"]);
  for (const detail of ["Total planejado", "Ainda precisam de ação", "Prontos para publicar", "Já concluídos"]) assert.ok(html.includes(detail));
  assert.doesNotMatch(html, /Aprovados|Contagem inicia|vence hoje/);
});
test("loading keeps five independent placeholders", () => {
  const html = renderToStaticMarkup(<DashboardMetrics activeClients={12} statistics={statistics} loading renderIcon={() => <svg />} />);
  assert.equal((html.match(/<strong>-<\/strong>/g) ?? []).length, 5);
});
