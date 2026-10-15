import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
const mapping = [
  ["Dashboard", "layout-dashboard"], ["Relatórios", "chart-no-axes-combined"],
  ["Controle de tempo", "clock-3"], ["Faturamento", "wallet"],
  ["Propostas", "clipboard-list"], ["Contratos", "file-signature"],
  ["Datas comemorativas", "party-popper"], ["Briefs de design", "palette"],
  ["Calendário social", "calendar-days"], ["Publicações Meta", "calendar-clock"],
  ["Equipe", "users-round"],
];

test("floating rail uses the approved mapping in the existing order", () => {
  const app = readFileSync(`${root}src/App.tsx`, "utf8");
  const rail = app.slice(app.indexOf("function AdminRail("), app.indexOf("function AgendaTopNavigation("));
  assert.deepEqual([...rail.matchAll(/icon: "([^"]+)" as const, to: "[^"]+", label: "([^"]+)"/g)].map(([, icon, label]) => [label, icon]), mapping);
  assert.equal((rail.match(/<FloatingRailIcon name="user-round-plus"/g) || []).length, 2);
  assert.match(rail, /<FloatingRailIcon name="circle-help"/);
  assert.match(rail, /<UiIcon name="chevron-left"/);
  assert.equal((app.match(/<FloatingRailIcon /g) || []).length, 4, "only the floating rail consumes these glyphs");
});

test("all thirteen SVGs render distinct nonempty glyphs with consistent styling", async () => {
  const server = await createServer({ root, server: { middlewareMode: true, hmr: false } });
  try {
    const { FloatingRailIcon } = await server.ssrLoadModule("/src/FloatingRailIcon.tsx");
    const rendered = [...mapping.map(([, icon]) => icon), "user-round-plus", "circle-help"].map(name => {
      const svg = renderToStaticMarkup(<FloatingRailIcon name={name} className="admin-rail-glyph" />);
      for (const attribute of ['viewBox="0 0 24 24"', 'stroke-width="1.9"', 'stroke="currentColor"', 'stroke-linecap="round"', 'stroke-linejoin="round"', 'aria-hidden="true"', 'focusable="false"']) assert.ok(svg.includes(attribute), `${name}: ${attribute}`);
      assert.match(svg, /<(path|rect|circle|line|polyline|polygon) /);
      return svg;
    });
    assert.equal(new Set(rendered).size, 13);
  } finally { await server.close(); }
});
