import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const storageKey = 'designhub-v2-dismissed-internal-messages';

test('internal messages fit the real dashboard and preserve existing actions', async t => {
  const server = await createServer({ root, server: { host: '127.0.0.1', port: 0, hmr: false } });
  let browser;
  try {
    await server.listen();
    const base = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ headless: true });
    const artifacts = process.env.DASHBOARD_LAYOUT_ARTIFACT_DIR || await mkdtemp(path.join(tmpdir(), 'dashboard-messages-'));
    const open = async (width, query = '') => {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      page.errors = [];
      page.on('pageerror', error => page.errors.push(error.message));
      await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
      await page.goto(`${base}/tests/dashboard-internal-messages.fixture.html?${query}`);
      await page.locator('.dashboard-grid').waitFor({ state: 'attached' });
      await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
      return page;
    };
    for (const width of [320, 390, 768, 1024, 1280, 1499, 1500, 1536, 1920]) {
      await t.test(`real dashboard at ${width}px with long titles and eight messages`, async () => {
        const page = await open(width);
        try {
          await page.locator('.dashboard-internal-row').first().waitFor();
          await page.locator('.commemorative-dashboard-widget').waitFor();
          assert.equal(await page.locator('.dashboard-internal-row').count(), 5);
          assert.equal(await page.locator('.dashboard-internal-messages header > span').textContent(), '8');
          const geometry = await page.evaluate(() => {
            const grid = document.querySelector('.dashboard-grid');
            const widget = document.querySelector('.dashboard-internal-messages');
            const bounds = grid.getBoundingClientRect();
            const rect = widget.getBoundingClientRect();
            const fits = (el, parent) => {
              const a = el.getBoundingClientRect(), b = parent.getBoundingClientRect();
              return a.left >= b.left - 1 && a.right <= b.right + 1 && a.top >= b.top - 1 && a.bottom <= b.bottom + 1;
            };
            return {
              pageOverflow: document.documentElement.scrollWidth > innerWidth,
              gridWidth: bounds.width, widgetWidth: rect.width,
              allWidgetsFit: [...grid.children].every(child => fits(child, grid)),
              // Every widget must span at least two tracks on desktop; clock and notes intentionally span two.
              singleTrackWidgets: [...grid.children].filter(child => getComputedStyle(child).gridColumnStart === 'auto').map(child => child.className),
              rowsFit: [...widget.querySelectorAll('.dashboard-internal-row')].every(row => row.scrollWidth <= row.clientWidth && [...row.children].every(child => fits(child, row))),
              contentFits: [...widget.querySelectorAll('.dashboard-internal-open')].every(button => [...button.children].every(child => fits(child, button))),
              titles: [...widget.querySelectorAll('strong')].map(title => {
                const box = title.getBoundingClientRect();
                const date = title.parentElement.querySelector('time').getBoundingClientRect();
                return { height: box.height, lineHeight: parseFloat(getComputedStyle(title).lineHeight), dateBelow: date.top >= box.bottom, fullText: title.textContent === title.title };
              }),
            };
          });
          assert.equal(geometry.pageOverflow, false, JSON.stringify(geometry));
          assert.equal(geometry.allWidgetsFit, true, JSON.stringify(geometry));
          assert.deepEqual(geometry.singleTrackWidgets, []);
          assert.ok(geometry.widgetWidth >= Math.min(320, geometry.gridWidth) - 1, JSON.stringify(geometry));
          assert.ok(geometry.rowsFit && geometry.contentFits, JSON.stringify(geometry));
          for (const title of geometry.titles) {
            assert.ok(title.height <= title.lineHeight * 2 + 1);
            assert.ok(title.dateBelow && title.fullText);
          }
          await page.screenshot({ path: path.join(artifacts, `dashboard-${width}.png`), fullPage: true });
          assert.deepEqual(page.errors, []);
          assert.deepEqual(await page.evaluate(() => window.smokeWrites), []);
        } finally { await page.close(); }
      });
    }
    for (const count of [0, 1, 3, 8]) await t.test(`count ${count}, dismissal persistence and complete opening payload`, async () => {
      const page = await open(390, `isolated&count=${count}`);
      try {
        if (!count) {
          assert.equal(await page.locator('.dashboard-internal-messages').count(), 0);
          return;
        }
        await page.locator('.dashboard-internal-open').first().waitFor();
        const title = await page.locator('.dashboard-internal-copy strong').first().textContent();
        await page.locator('.dashboard-internal-open').first().focus();
        await page.keyboard.press('Enter');
        assert.equal(await page.getByRole('dialog').textContent(), title);
        assert.equal(await page.evaluate(() => window.openedMessage.cardTitle), title);
        assert.equal(await page.evaluate(() => window.openedMessage.cardId), 'card-0');
        assert.equal(await page.evaluate(() => window.openedMessage.clientSlug), 'fixture-client');
        assert.equal(await page.locator('.dashboard-internal-row').count(), Math.min(count, 5));
        await page.getByRole('button', { name: 'Fechar mensagem', exact: true }).first().click();
        assert.deepEqual(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey), ['message-0']);
        await page.reload();
        await page.locator('.dashboard-grid').waitFor({ state: 'attached' });
        assert.equal(await page.locator('.dashboard-internal-row').count(), Math.min(count - 1, 5));
        if (count > 1) assert.equal(await page.locator('.dashboard-internal-messages header > span').textContent(), String(count - 1));
        assert.deepEqual(await page.evaluate(() => window.smokeWrites), []);
        assert.deepEqual(page.errors, []);
      } finally { await page.close(); }
    });
    await t.test('narrow container on desktop uses its own full row', async () => {
      const page = await open(1920, 'isolated&containerWidth=360');
      try {
        const sizes = await page.locator('.dashboard-internal-messages').evaluate(el => ({ widget: el.getBoundingClientRect().width, grid: el.parentElement.getBoundingClientRect().width }));
        assert.ok(Math.abs(sizes.grid - sizes.widget) < 1);
      } finally { await page.close(); }
    });
    await t.test('dashboard keeps the existing client navigation link for internal messages', async () => {
      const page = await open(1280);
      try {
        await page.locator('.dashboard-internal-open').first().click();
        assert.equal(new URL(page.url()).hash, '#/admin/fixture-client');
      } finally { await page.close(); }
    });
    for (const role of ['admin', 'colaborador']) await t.test(`${role} retains messages, notifications and dismissal scope`, async () => {
      const page = await open(1280, `role=${role}`);
      try {
        await page.locator('.dashboard-internal-row').first().waitFor();
        const notification = page.getByRole('button', { name: 'Notificações', exact: true });
        assert.equal(await notification.locator('span').textContent(), '8');
        await page.getByRole('button', { name: 'Fechar mensagem', exact: true }).first().click();
        assert.equal(await page.locator('.dashboard-internal-messages header > span').textContent(), '7');
        assert.equal(await notification.locator('span').textContent(), '8');
        assert.equal(await page.evaluate(() => localStorage.getItem('designhub-v2-read-notifications:fixture-user')), null);
        await notification.click();
        assert.equal(await page.locator('.notification-popover header b').textContent(), '8');
        assert.equal(await page.locator('.notification-popover > button').count(), 5);
        assert.deepEqual(await page.evaluate(() => window.smokeWrites), []);
        assert.deepEqual(page.errors, []);
      } finally { await page.close(); }
    });
    console.log(`Dashboard screenshots: ${artifacts}`);
  } finally { await browser?.close(); await server.close(); }
});
