import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql, { type RowDataPacket } from "mysql2/promise";
import Fastify from "fastify";
import { createServer } from "vite";
import { chromium } from "playwright";
import { BriefRepository } from "../../apps/api/src/modules/brief-foundation/brief.repository.js";
import { briefFoundationRoutes } from "../../apps/api/src/modules/brief-foundation/brief.routes.js";
import { designBriefRoutes } from "../../apps/api/src/modules/design-briefs/design-briefs.routes.js";
import { httpErrorsPluginRegistered } from "../../apps/api/src/plugins/http-errors.js";
import { formSchema, templateSchema, instanceSchema } from "../../apps/api/src/modules/brief-foundation/brief.schemas.js";

// Never accept a URL, host, password, .env or externally selected database.
assert.equal(process.env.GITHUB_ACTIONS, "true", "This harness only runs on the disposable Actions runner");
const socketPath = "/tmp/briefs-mariadb-foundation/server.sock";
assert.equal(process.env.BRIEF_TEST_SOCKET, socketPath);
const root = fileURLToPath(new URL("../../", import.meta.url));
const output = path.join(root, "artifacts/pr66");
await mkdir(output, { recursive: true });
const evidence: any = { head: process.env.PR66_HEAD_SHA, node: process.version, mockApi: false, production: false, viewports: [], startedAt: new Date().toISOString() };
const server = await mysql.createConnection({ socketPath, user: "root", multipleStatements: true });
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let failed = false;
try {
  const [version] = await server.query<RowDataPacket[]>("SELECT VERSION() AS version, @@skip_networking AS isolated");
  assert.match(version[0].version, /^11\.8\.9-MariaDB/);
  assert.equal(Number(version[0].isolated), 1);
  evidence.database = version[0];
  browser = await chromium.launch({ headless: true });
  evidence.chromium = browser.version();
  for (const width of [1440, 390]) {
    const result: any = { width, height: width === 390 ? 844 : 1000, checks: [], screenshots: [], apiErrors: [], pageErrors: [], externalRequests: [] };
    evidence.viewports.push(result);
    const database = `pr66_visual_${randomUUID().replaceAll("-", "")}`;
    await server.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    const pool = mysql.createPool({ socketPath, user: "root", database, multipleStatements: true, connectionLimit: 8, timezone: "Z", charset: "utf8mb4" });
    const app = Fastify();
    let vite: Awaited<ReturnType<typeof createServer>> | undefined;
    let page: Awaited<ReturnType<typeof browser.newPage>> | undefined;
    try {
      // Existing schema files initialize a brand-new synthetic database only.
      await pool.query(await readFile(path.join(root, "apps/api/db/schema.sql"), "utf8"));
      await pool.query(await readFile(path.join(root, "database/migrations/20261005_design_briefs_foundation.sql"), "utf8"));
      const actor = randomUUID(), client = randomUUID();
      await pool.query("INSERT INTO users(id,full_name,email,password_hash,global_role,locale) VALUES(?,'Synthetic PR66','pr66@invalid.test','unused','super_admin','pt')", [actor]);
      await pool.query("INSERT INTO client_accounts(id,name,slug,portal_title,locale) VALUES(?,'Cliente sintético','pr66-synthetic','Portal sintético','pt')", [client]);
      const repo = new BriefRepository(pool);
      const form = formSchema.parse({ title: "Modelo", introduction: "Informações para conhecer seu projeto.", category: "branding", locale: "pt", fields: [{ id: "brand", type: "short", label: "Qual é o nome da sua marca?", help: "Nome usado no projeto.", required: true, validation: { maxLength: 100 } }] });
      const makeTemplate = (name: string) => repo.saveTemplate(actor, templateSchema.parse({ id: randomUUID(), name, description: "Modelo preparado com dados sintéticos para homologação.", form: { ...form, title: name } }));
      const unused = await makeTemplate("Modelo ativo");
      const used = await makeTemplate("Modelo vinculado");
      let archived = await makeTemplate("Modelo arquivado");
      archived = await repo.archiveTemplate(archived.id, actor, archived.version);
      let brief = await repo.createInstance(actor, instanceSchema.parse({ id: randomUUID(), clientAccountId: client, templateId: used.id, templateVersion: used.version, form: used.form }));
      brief = await repo.transition(brief.brief.id, actor, "send", brief.brief.version);
      brief = await repo.saveResponse(brief.brief.id, client, actor, { expectedVersion: brief.response!.version, answers: { brand: "Resposta sintética preservada" }, idempotencyKey: randomUUID() }, true);
      const history = await repo.getDetail(brief.brief.id);
      app.decorate("db", pool);
      app.decorate("appEnv", { UPLOAD_DIR: path.join(output, "private-unused") } as any);
      await app.register(httpErrorsPluginRegistered);
      // Explicit test principal: real module authorization checks still execute.
      // No login bypass is added to production code; API binds only loopback.
      app.addHook("onRequest", async request => { request.auth = { user: { id: actor, globalRole: "super_admin" }, memberships: [] } as any; });
      await app.register(briefFoundationRoutes, { prefix: "/api" });
      await app.register(designBriefRoutes, { prefix: "/api" });
      app.get("/api/clients", async () => {
        const [items] = await pool.query<RowDataPacket[]>("SELECT id,name,slug FROM client_accounts");
        return { items };
      });
      const apiOrigin = await app.listen({ host: "127.0.0.1", port: 0 });
      vite = await createServer({ root: path.join(root, "apps/web"), configFile: false, envDir: path.join(output, "empty-env"), define: { "import.meta.env.VITE_V2_API_URL": JSON.stringify("") }, server: { host: "127.0.0.1", port: 0, hmr: false, proxy: { "/api": apiOrigin } } });
      await vite.listen();
      const address = vite.httpServer!.address();
      assert.ok(address && typeof address !== "string");
      const origin = `http://127.0.0.1:${address.port}`;
      page = await browser.newPage({ viewport: { width, height: result.height } });
      page.on("pageerror", error => result.pageErrors.push(error.message));
      page.on("response", response => { if (response.url().includes("/api/") && response.status() >= 400) result.apiErrors.push({ url: new URL(response.url()).pathname, status: response.status() }); });
      page.on("dialog", dialog => dialog.accept());
      await page.route("**/*", route => {
        if (new URL(route.request().url()).origin === origin) return route.continue();
        result.externalRequests.push(route.request().url());
        return route.abort();
      });
      const capture = async (name: string) => {
        const filename = `${width}-${name}.png`;
        await page!.screenshot({ path: path.join(output, filename), fullPage: true });
        result.screenshots.push(filename);
      };
      const check = (name: string) => { result.checks.push(name); console.log(`PASS ${width}px ${name}`); };
      const tab = (name: string) => page!.getByRole("tab", { name: new RegExp(`^${name}`) });
      const counts = async (active: number, archivedCount: number) => {
        await page!.waitForFunction(({ active, archivedCount }) => {
          const items = [...document.querySelectorAll('[role="tab"]')];
          const activeTab = items.find(item => item.textContent?.startsWith("Templates"));
          const archivedTab = items.find(item => item.textContent?.startsWith("Arquivados"));
          return activeTab?.querySelector("span")?.textContent === String(active) && archivedTab?.querySelector("span")?.textContent === String(archivedCount);
        }, { active, archivedCount });
      };
      const card = (name: string) => page!.locator(".brief-template-card").filter({ has: page!.getByRole("heading", { name, exact: true }) });
      const openDelete = async (name: string) => {
        await page!.getByRole("button", { name: `Excluir permanentemente template ${name}`, exact: true }).click();
        await page!.getByRole("dialog", { name: "Excluir template permanentemente?", exact: true }).waitFor();
      };
      const confirmDelete = async () => {
        const dialog = page!.getByRole("dialog");
        await dialog.getByRole("checkbox").check();
        await dialog.getByRole("button", { name: "Excluir permanentemente", exact: true }).click();
      };
      const withinViewport = async (selector: string) => {
        const dimensions = await page!.locator(selector).evaluate(element => { const r = element.getBoundingClientRect(); return { x: r.left, right: r.right, width: innerWidth }; });
        assert.ok(dimensions.x >= -1 && dimensions.right <= dimensions.width + 1, JSON.stringify(dimensions));
      };
      await page.goto(`${origin}/tests/pr66.fixture.html`);
      await counts(2, 1);
      await card("Modelo ativo").waitFor();
      assert.equal(await card("Modelo arquivado").count(), 0);
      check("active-only cards and initial counters");
      await capture("01-active");
      await page.getByRole("button", { name: "Arquivar template Modelo ativo", exact: true }).click();
      await counts(1, 2);
      await card("Modelo ativo").waitFor({ state: "detached" });
      assert.match(await page.getByRole("status").innerText(), /Template arquivado/);
      check("archive persisted and counters updated");
      await tab("Arquivados").click();
      await card("Modelo arquivado").waitFor();
      assert.equal(await page.getByRole("button", { name: /^Duplicar template/ }).count(), 0);
      await capture("02-archived");
      await card("Modelo arquivado").getByRole("button", { name: "Visualizar", exact: true }).click();
      await page.getByRole("dialog", { name: "Modelo arquivado", exact: true }).waitFor();
      assert.match(await page.getByRole("dialog").innerText(), /Qual é o nome da sua marca/);
      await withinViewport(".brief-dialog");
      await capture("03-preview");
      await page.getByRole("dialog").getByRole("button", { name: "Fechar", exact: true }).click();
      await page.getByRole("button", { name: "Restaurar template Modelo arquivado", exact: true }).click();
      await counts(2, 1);
      const restored = (await repo.listTemplates()).find(t => t.id === archived.id)!;
      assert.equal(restored.status, "active");
      assert.deepEqual(restored.form, archived.form);
      assert.equal(restored.description, archived.description);
      await tab("Templates").click();
      await card("Modelo arquivado").waitFor();
      check("restore persisted and preserved every form setting");
      await capture("04-restored");
      await openDelete("Modelo arquivado");
      const dialog = page.getByRole("dialog");
      assert.match(await dialog.innerText(), /irreversível/);
      assert.match(await dialog.innerText(), /Modelo arquivado/);
      assert.equal(await dialog.getByRole("button", { name: "Excluir permanentemente", exact: true }).isEnabled(), false);
      await withinViewport(".brief-dialog");
      await capture("05-delete-unconfirmed");
      await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
      assert.ok((await repo.listTemplates()).some(t => t.id === archived.id));
      await openDelete("Modelo arquivado");
      await page.getByRole("dialog").getByRole("checkbox").check();
      assert.equal(await page.getByRole("dialog").getByRole("button", { name: "Excluir permanentemente", exact: true }).isEnabled(), true);
      await capture("06-delete-confirmed");
      await page.getByRole("dialog").getByRole("button", { name: "Excluir permanentemente", exact: true }).click();
      await page.getByRole("dialog").waitFor({ state: "detached" });
      await counts(1, 1);
      for (const [table, column] of [["design_brief_templates", "id"], ["design_brief_template_metadata", "template_id"], ["design_brief_template_versions", "template_id"]]) {
        const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM ${table} WHERE ${column}=?`, [archived.id]);
        assert.equal(rows.length, 0);
      }
      check("cancel is safe; explicit confirmation deletes real unused rows");
      await capture("07-deleted");
      await openDelete("Modelo vinculado");
      await confirmDelete();
      await page.getByRole("alert").waitFor();
      assert.match(await page.getByRole("alert").innerText(), /briefs vinculados/);
      assert.deepEqual(await repo.getDetail(brief.brief.id), history);
      await withinViewport(".brief-dialog");
      check("dependency error visible; sent brief and response history unchanged");
      await capture("08-dependency-blocked");
      await page.getByRole("dialog").getByRole("button", { name: "Cancelar", exact: true }).click();
      await tab("Arquivados").click();
      await openDelete("Modelo ativo");
      await confirmDelete();
      await counts(1, 0);
      await page.getByRole("dialog").waitFor({ state: "detached" });
      await page.getByRole("heading", { name: "Nenhum template arquivado", exact: true }).waitFor();
      assert.match(await page.getByRole("status").innerText(), /excluído permanentemente/);
      const overflow = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
      assert.ok(overflow.document <= overflow.viewport + 1, JSON.stringify(overflow));
      await withinViewport(".brief-library-panel");
      check("archived deletion, empty state, messages and no horizontal page overflow");
      await capture("09-empty");
      assert.deepEqual(result.pageErrors, []);
      assert.deepEqual(result.externalRequests, []);
      assert.equal(result.apiErrors.filter((e: any) => e.status !== 409).length, 0);
      assert.equal(result.apiErrors.filter((e: any) => e.status === 409).length, 1);
      result.status = "passed";
    } catch (error) {
      failed = true;
      result.status = "failed";
      result.error = error instanceof Error ? error.stack : String(error);
      if (page) await page.screenshot({ path: path.join(output, `${width}-failure.png`), fullPage: true }).catch(() => {});
      console.error(result.error);
    } finally {
      await page?.close();
      await vite?.close();
      await app.close();
      await pool.end();
      await server.query(`DROP DATABASE \`${database}\``);
    }
  }
} catch (error) {
  failed = true;
  evidence.setupError = error instanceof Error ? error.stack : String(error);
  console.error(evidence.setupError);
} finally {
  await browser?.close();
  await server.end();
  evidence.finishedAt = new Date().toISOString();
  evidence.status = failed ? "failed" : "passed";
  await writeFile(path.join(output, "visual-results.json"), JSON.stringify(evidence, null, 2));
}
if (failed) process.exitCode = 1;
