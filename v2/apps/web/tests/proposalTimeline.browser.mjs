import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("..", import.meta.url));
const output = fileURLToPath(
  new URL("../../../../docs/proposal-timeline-stages/", import.meta.url),
);
const server = await createServer({
  root,
  server: { host: "127.0.0.1", port: 0 },
  plugins: [
    {
      name: "timeline-test-fixture",
      configureServer(vite) {
        vite.middlewares.use("/__timeline-test", async (_req, res, next) => {
          try {
            const html = await vite.transformIndexHtml(
              "/__timeline-test",
              '<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body><div id="root"></div><script type="module" src="/tests/fixtures/proposalTimeline.tsx"></script></body></html>',
            );
            res.setHeader("Content-Type", "text/html");
            res.end(html);
          } catch (error) {
            next(error);
          }
        });
      },
    },
  ],
});
let browser;
try {
  await mkdir(output, { recursive: true });
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const errors = [];
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1050 },
  });
  page.setDefaultTimeout(15000);
  page.on("pageerror", (error) => errors.push(error.message));
  const address = server.httpServer.address();
  await page.goto(`http://127.0.0.1:${address.port}/__timeline-test`);
  const timeline = page
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: "Cronograma" }) });
  await timeline.locator("summary").click();
  const stage = (i) => timeline.locator("fieldset").nth(i);
  assert.equal(await timeline.locator("fieldset").count(), 1);
  assert.equal(await stage(0).getByLabel("Prazo estimado").inputValue(), "10");
  assert.equal(
    await stage(0)
      .getByLabel("Mover etapa 1 para cima", { exact: true })
      .isDisabled(),
    true,
  );
  await stage(0).getByLabel("Título da etapa").fill("Imersão e estratégia");
  await stage(0)
    .getByLabel("Descrição da etapa")
    .fill("Pesquisa, briefing e definição da direção criativa.");
  await stage(0).getByLabel("Prazo estimado").fill("3");
  await timeline
    .getByRole("button", { name: "+ Adicionar etapa", exact: true })
    .click();
  await stage(1).getByLabel("Título da etapa").fill("Criação e refinamento");
  await stage(1)
    .getByLabel("Descrição da etapa")
    .fill(
      "Exploração visual e desenvolvimento da identidade.\nApresentação e ajustes.",
    );
  await stage(1).getByLabel("Unidade").selectOption("calendar");
  await stage(1).getByLabel("Prazo estimado").fill("7");
  await timeline
    .getByRole("button", { name: "+ Adicionar etapa", exact: true })
    .click();
  await stage(2).getByLabel("Título da etapa").fill("Entrega final");
  await stage(2)
    .getByLabel("Descrição da etapa")
    .fill("Arquivos finais e guia de aplicação da marca.");
  await stage(2).getByLabel("Unidade").selectOption("date");
  assert.equal(await stage(2).getByLabel("Prazo estimado").inputValue(), "");
  await stage(2).getByLabel("Prazo estimado").fill("2028-02-29");
  await stage(2)
    .getByRole("button", { name: "Mover etapa 3 para cima", exact: true })
    .click();
  assert.equal(
    await stage(1).getByLabel("Título da etapa").inputValue(),
    "Entrega final",
  );
  await stage(1)
    .getByRole("button", { name: "Mover etapa 2 para baixo", exact: true })
    .click();
  await timeline
    .getByRole("button", { name: "+ Adicionar etapa", exact: true })
    .click();
  await stage(3)
    .getByRole("button", { name: "Remover etapa 4", exact: true })
    .click();
  await page.getByRole("button", { name: "Salvar teste", exact: true }).click();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("timeline-fixture")),
  );
  assert.equal(saved.document.timelineStages.length, 3);
  assert.equal(saved.services[0].value, 5000);
  assert.equal(
    saved.document.approvalText,
    "Aprovo o escopo e as condições comerciais apresentados.",
  );
  assert.equal(saved.document.timelineValue, "10");
  await page.reload();
  await page.getByRole("button", { name: "Visualizar", exact: true }).click();
  await page.locator(".proposal-timeline-stages").waitFor();
  assert.deepEqual(
    await page.locator(".proposal-timeline-stage-content h3").allTextContents(),
    ["Imersão e estratégia", "Criação e refinamento", "Entrega final"],
  );
  assert.deepEqual(
    await page.locator(".proposal-timeline-value").allTextContents(),
    ["3 dias úteis", "7 dias corridos", "29/02/2028"],
  );
  const section = page
    .locator("section")
    .filter({ has: page.locator(".proposal-timeline-stages") });
  for (const [name, width] of [
    ["desktop", 1440],
    ["mobile", 390],
    ["small-mobile", 320],
  ]) {
    await page.setViewportSize({ width, height: 1050 });
    await section.scrollIntoViewIfNeeded();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await section.screenshot({
      path: path.join(output, `${name}.png`),
      animations: "disabled",
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `${name} page overflow`,
    );
    for (const element of await page
      .locator(".proposal-timeline-stage-content")
      .all())
      assert.ok(
        await element.evaluate((el) => el.scrollWidth <= el.clientWidth),
        `${name} stage overflow`,
      );
  }
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await timeline.locator("summary").click();
  await timeline.screenshot({ path: path.join(output, "editor-mobile.png") });
  for (let i = 3; i > 0; i--)
    await stage(i - 1)
      .getByRole("button", { name: `Remover etapa ${i}`, exact: true })
      .click();
  await page.getByRole("button", { name: "Salvar teste", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Visualizar", exact: true }).click();
  assert.equal(await page.locator(".proposal-timeline-stages").count(), 0);
  assert.ok(
    await page
      .getByText(
        "Início após o recebimento do briefing e confirmação da entrada.",
        { exact: true },
      )
      .isVisible(),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: browser create/edit/reorder/remove/reload/preview; legacy fallback; all units; 1440/390/320px; commercial fields preserved; no page errors.",
  );
} finally {
  await browser?.close();
  await server.close();
}
