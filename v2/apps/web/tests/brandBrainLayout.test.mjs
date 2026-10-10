import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const viewports = [
  ['desktop', 1440, 900], ['notebook', 1280, 800],
  ['tablet', 768, 1024], ['mobile', 390, 844],
];
const labels = ['Visão geral', 'Essência', 'Público', 'Voz', 'Conteúdo', 'Visual', 'Histórico'];
const root = fileURLToPath(new URL('..', import.meta.url));

// Render the actual shared experience inside the admin's board containers.
// All API reads are fixtures; mutations and requests outside localhost fail.
test('admin Brand Brain has separate hero/nav/content rows at every viewport', async t => {
  const server = await createServer({ root, server: { host: '127.0.0.1', port: 0, hmr: false } });
  let browser;
  try {
    await server.listen();
    const base = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ headless: true });
    const artifacts = process.env.BRAND_BRAIN_LAYOUT_ARTIFACT_DIR || await mkdtemp(path.join(tmpdir(), 'brand-brain-layout-'));
    await mkdir(artifacts, { recursive: true });
    for (const [name, width, height] of viewports) await t.test(name, async () => {
      const page = await browser.newPage({ viewport: { width, height } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
      await page.goto(`${base}/tests/brand-brain-layout.fixture.html`);
      await page.locator('.brand-v2-nav').waitFor();
      await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
      await page.evaluate(() => document.fonts.ready);
      const geometry = async () => page.evaluate(() => {
        const hero = document.querySelector('.brand-v2-hero').getBoundingClientRect();
        const nav = document.querySelector('.brand-v2-nav');
        const bounds = nav.getBoundingClientRect();
        const content = nav.nextElementSibling.getBoundingClientRect();
        return {
          heroGap: bounds.top - hero.bottom, contentGap: content.top - bounds.bottom,
          navHeight: bounds.height, rowSizing: getComputedStyle(nav.parentElement).gridAutoRows,
          position: getComputedStyle(nav).position, radius: getComputedStyle(nav).borderRadius,
          navOverflow: getComputedStyle(nav).overflowX, pageOverflow: document.documentElement.scrollWidth > innerWidth,
          buttonsFit: [...nav.children].every(button => {
            const r = button.getBoundingClientRect(); return r.top >= bounds.top && r.bottom <= bounds.bottom;
          }),
        };
      });
      const initial = await geometry();
      assert.equal(initial.rowSizing, 'max-content');
      assert.ok(initial.heroGap >= 16 && initial.heroGap <= 20, JSON.stringify(initial));
      assert.ok(initial.contentGap >= 16 && initial.contentGap <= 20, JSON.stringify(initial));
      assert.ok(initial.buttonsFit, 'buttons must fit inside the nav');
      assert.equal(initial.position, 'static');
      assert.equal(initial.radius, '15px');
      assert.equal(initial.navOverflow, 'auto');
      assert.equal(initial.pageOverflow, false, 'only the tabs should scroll horizontally');
      await page.screenshot({ path: path.join(artifacts, `admin-${name}.png`), fullPage: true });
      for (const label of labels) {
        const tab = page.locator('.brand-v2-nav').getByRole('button', { name: label, exact: true });
        await tab.click();
        assert.ok(await tab.evaluate(el => el.classList.contains('active')), label);
        const result = await geometry();
        assert.ok(result.contentGap >= 16, `${label}: ${JSON.stringify(result)}`);
        assert.ok(result.buttonsFit, label);
        const navBounds = await tab.boundingBox();
        assert.ok(navBounds && navBounds.width > 0, 'selected tab remains visible');
      }
      // Exercise the actual scroll owner, not an artificial margin or fixed height.
      await page.locator('.brand-v2-nav').getByRole('button', { name: 'Visão geral', exact: true }).click();
      const scrolled = await page.evaluate(() => {
        const board = document.querySelector('.board-layout');
        board.scrollTop = board.scrollHeight;
        if (board.scrollTop > 0) return true;
        window.scrollTo(0, document.documentElement.scrollHeight);
        return window.scrollY > 0;
      });
      assert.ok(scrolled, 'content remains scrollable');
      if (name === 'mobile') {
        const overflow = await page.locator('.brand-v2-nav').evaluate(nav => {
          nav.scrollLeft = nav.scrollWidth;
          return nav.scrollWidth > nav.clientWidth && nav.scrollLeft > 0;
        });
        assert.ok(overflow, 'mobile tabs scroll horizontally');
      }
      assert.deepEqual(await page.evaluate(() => window.smokeWrites), []);
      assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).filter(k => k.includes('brand-brain-draft'))), []);
      assert.deepEqual(errors, []);
      // Portal keeps the original rules. Optional baseline images prove pixel parity.
      await page.goto(`${base}/tests/brand-brain-layout.fixture.html?portal`);
      await page.locator('.brand-v2-nav').waitFor();
      await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.locator('.brand-v2').evaluate(el => getComputedStyle(el).gridAutoRows), 'auto');
      const portal = await page.screenshot({ path: path.join(artifacts, `portal-${name}.png`), fullPage: true });
      if (process.env.BRAND_BRAIN_LAYOUT_BASELINE_DIR) {
        assert.deepEqual(portal, await readFile(path.join(process.env.BRAND_BRAIN_LAYOUT_BASELINE_DIR, `portal-${name}.png`)), 'portal pixels must be unchanged');
      }
      await page.close();
    });
  } finally { await browser?.close(); await server.close(); }
});
