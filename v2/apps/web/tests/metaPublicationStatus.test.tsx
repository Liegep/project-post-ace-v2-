import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { MetaPublicationPlatformChip, MetaPublicationPlatformDetail, metaCenterPeriodRange, metaPublicationStatusLabel } from "../src/metaPublicationStatus";

const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8").split("\n")
  .filter((line) => line.startsWith(".meta-center-platforms ") || line.startsWith(".meta-center-backdrop ")).join("\n");
const cases = [
  { status: "scheduled", lastError: null, label: "Agendado", color: "rgb(165, 85, 200)", visual: "scheduled" },
  { status: "publishing", lastError: null, label: "Publicando", color: "rgb(165, 85, 200)", visual: "publishing" },
  { status: "published", lastError: "stale error", label: "Publicado", color: "rgb(49, 155, 109)", visual: "published" },
  { status: "failed", lastError: "Original Meta error", label: "Falhou", color: "rgb(216, 79, 105)", visual: "failed" },
  { status: "cancelled", lastError: null, label: "Cancelado", color: "rgb(138, 137, 148)", visual: "cancelled" },
  { status: "cancelled", lastError: "", label: "Cancelado", color: "rgb(138, 137, 148)", visual: "cancelled" },
  { status: "cancelled", lastError: "Original Meta error", label: "Falhou · cancelado", color: "rgb(216, 79, 105)", visual: "failed" },
] as const;

for (const item of cases) {
  test(`Central chip and drawer: ${item.status}, error=${JSON.stringify(item.lastError)}`, () => {
    const publication = { status: item.status, lastError: item.lastError, platform: "instagram" as const, publishedPermalink: null };
    const markup = renderToStaticMarkup(<><div className="meta-center-platforms"><MetaPublicationPlatformChip publication={publication} /></div>
      <section className="meta-center-platform-detail"><MetaPublicationPlatformDetail publication={publication} actionPending={false} onCancel={() => {}} /></section></>);
    const dom = new JSDOM(`<style>${styles}</style>${markup}`);
    try {
      const chip = dom.window.document.querySelector(".meta-center-platforms span")!;
      assert.equal(dom.window.getComputedStyle(chip).backgroundColor, item.color);
      assert.equal(chip.getAttribute("title"), `Instagram: ${item.label}`);
      assert.equal(chip.getAttribute("aria-label"), `Instagram: ${item.label}`);
      assert.equal(metaPublicationStatusLabel(item.status, item.lastError), item.label);
      const detail = dom.window.document.querySelector("article")!;
      assert.equal(detail.className, item.visual);
      assert.equal(detail.querySelector("span")?.textContent, item.label);
      assert.equal(detail.querySelector("p")?.textContent ?? null, item.lastError || null);
      assert.equal(Boolean(detail.querySelector("button")), item.status === "failed" || item.status === "scheduled");
      assert.equal(publication.status, item.status);
    } finally { dom.window.close(); }
  });
}

test("Facebook cancelled failure uses the same red chip and explicit status", () => {
  const markup = renderToStaticMarkup(<MetaPublicationPlatformChip publication={{ platform: "facebook", status: "cancelled", lastError: "Meta refused" }} />);
  assert.match(markup, /class="facebook failed"/);
  assert.match(markup, /Facebook: Falhou · cancelado/);
});

test("selected period uses inclusive local dates and an exclusive next-day boundary", () => {
  const range = metaCenterPeriodRange("2026-10-01", "2026-10-31");
  assert.equal(range.from, new Date("2026-10-01T00:00:00").toISOString());
  assert.equal(range.to, new Date("2026-11-01T00:00:00").toISOString());
});
