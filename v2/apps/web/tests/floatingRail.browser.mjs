import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

// Run against local Vite only; all API calls are intercepted with synthetic data.
const base = process.env.RAIL_TEST_URL || 'http://127.0.0.1:4190';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const output = process.env.RAIL_SCREENSHOTS;
if (output) await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const labels = ['Dashboard', 'Relatórios', 'Controle de tempo', 'Faturamento', 'Propostas', 'Contratos', 'Datas comemorativas', 'Briefs de design', 'Calendário social', 'Publicações Meta', 'Equipe', 'Adicionar novo cliente', 'Sobre'];
const privateLabels = ['Relatórios', 'Faturamento', 'Propostas', 'Contratos', 'Briefs de design', 'Equipe'];
let cases = 0;
try {
  for (const role of ['super_admin', 'admin', 'collaborator', 'client']) {
    for (const mobile of [false, true]) {
      for (const collapsed of [false, true]) {
        const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1080 }, deviceScaleFactor: 1 });
        const page = await context.newPage();
        await page.clock.setFixedTime(new Date('2026-10-15T12:00:00Z'));
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/api/**', route => route.fulfill({ json: { items: [], entry: null, statistics: { postsThisMonth: 0, postsPreviousMonth: 0, pending: 0, scheduled: 0, published: 0, publishedPreviousMonth: 0 }, dueTasks: [], upcomingPosts: [], postsToday: [], agendaToday: [], clientSubmissions: [], clientActivities: [], approvedPautas: [] } }));
        await page.addInitScript(({ role, collapsed }) => {
          localStorage.setItem('designhub-v2-session', JSON.stringify({ id: 'rail-test', name: 'Teste local', email: 'rail@example.test', password: '', role, assignedAdminSlugs: [], assignedPortalSlugs: [], locale: 'pt-BR', source: 'demo' }));
          localStorage.setItem('designhub-v2-admin-rail-collapsed', collapsed ? '1' : '0');
        }, { role, collapsed });
        await page.goto(`${base}/#/dashboard`);
        if (role === 'client') {
          await page.waitForURL('**/#/contas');
          assert.equal(await page.locator('.admin-rail').count(), 0);
        } else {
          const rail = page.locator('.admin-rail');
          await rail.waitFor();
          await page.locator('.initial-data-shield').waitFor({ state: 'detached' });
          await page.waitForTimeout(350); // existing entry/collapse transitions
          const expected = labels.filter(label => role === 'super_admin' || (label !== 'Publicações Meta' && (role === 'admin' || !['Faturamento', 'Propostas', 'Contratos', 'Adicionar novo cliente'].includes(label))));
          const controls = rail.locator('.admin-rail-stack > *');
          assert.deepEqual(await controls.evaluateAll(nodes => nodes.map(node => node.title)), expected);
          const visibleLabels = await controls.evaluateAll(nodes => nodes.filter(node => getComputedStyle(node).display !== 'none').map(node => node.title));
          assert.deepEqual(visibleLabels, expected.filter(label => role === 'super_admin' || !privateLabels.includes(label)));
          for (const control of await controls.all()) {
            assert.ok(await control.getAttribute('aria-label'));
            assert.equal(await control.locator('svg').getAttribute('aria-hidden'), 'true');
          }
          assert.equal(await rail.locator('a[title="Dashboard"]').getAttribute('aria-current'), 'page');
          assert.equal(await rail.locator('a[title="Calendário social"]').getAttribute('href'), '#/area/calendario-social');
          assert.deepEqual(await rail.locator('svg').first().evaluate(svg => ({ width: getComputedStyle(svg).width, height: getComputedStyle(svg).height, stroke: svg.getAttribute('stroke'), weight: svg.getAttribute('stroke-width') })), { width: '20px', height: '20px', stroke: 'currentColor', weight: '1.9' });
          const stack = rail.locator('.admin-rail-stack');
          assert.equal(await stack.evaluate(el => getComputedStyle(el).visibility), collapsed && !mobile ? 'hidden' : 'visible');
          if (mobile) await rail.evaluate(el => { el.scrollLeft = 0; });
          if (output && role === 'super_admin') {
            const name = `${mobile ? 'mobile' : 'desktop'}-${collapsed ? 'collapsed' : 'expanded'}`;
            await page.screenshot({ path: path.join(output, `${name}.png`) });
            if (!mobile) await rail.screenshot({ path: path.join(output, `${name}-rail.png`) });
            if (mobile) {
              await rail.evaluate(el => { el.scrollLeft = el.scrollWidth; });
              await rail.screenshot({ path: path.join(output, `${name}-end.png`) });
              await rail.evaluate(el => { el.scrollLeft = 0; });
            }
          }
          if (!mobile) {
            await rail.locator('.admin-rail-toggle').click();
            assert.equal(await rail.locator('.admin-rail-toggle').getAttribute('aria-expanded'), String(collapsed));
            assert.equal(await page.evaluate(() => localStorage.getItem('designhub-v2-admin-rail-collapsed')), collapsed ? '0' : '1');
            if (!collapsed) await rail.locator('.admin-rail-toggle').click();
          }
          if (!collapsed || mobile) {
            await rail.locator('[title="Sobre"]').click();
            await page.locator('[role="dialog"]').waitFor();
            await page.keyboard.press('Escape');
            await page.locator('[role="dialog"]').waitFor({ state: 'detached' });
            if (role !== 'collaborator') {
              await rail.locator('[title="Adicionar novo cliente"]').click();
              await page.locator('.client-modal-backdrop').waitFor();
              await page.keyboard.press('Escape');
            }
          }
        }
        assert.deepEqual(errors, [], `${role}: browser errors`);
        console.log(`PASS ${role} ${mobile ? 'mobile' : 'desktop'} ${collapsed ? 'collapsed' : 'expanded'}`);
        cases++;
        await context.close();
      }
    }
  }
  console.log(`${cases} browser scenarios passed; API fully mocked.`);
} finally { await browser.close(); }
