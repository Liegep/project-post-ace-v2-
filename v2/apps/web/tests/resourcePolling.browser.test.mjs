import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const inbox = 'GET /api/internal-approvals/inbox';
const clients = 'GET /api/clients';
const count = (page, request) => page.evaluate(request => window.resourceFixture.requests.filter(item => item === request).length, request);
const tick = (page, ms) => page.clock.runFor(ms);
const visibility = (page, visible) => page.evaluate(visible => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: visible ? 'visible' : 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
}, visible);

test('resource polling regressions in Chromium with React StrictMode and mocked HTTP', async t => {
  const server = await createServer({ root, server: { host: '127.0.0.1', port: 0, hmr: false } });
  let browser;
  try {
    await server.listen();
    const base = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ headless: true });
    const open = async (hash = '/dashboard', url = '/tests/resource-polling.fixture.html') => {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.clock.install();
      await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
      await page.goto(`${base}${url}#${hash}`);
      await page.waitForFunction(() => window.resourceFixture || window.notificationFixture);
      await page.waitForFunction(() => window.resourceFixture ? window.resourceFixture.requests.length > 0 : window.notificationFixture.inboxRequests > 0);
      t.after(async () => { assert.deepEqual(errors, []); await page.close(); });
      return page;
    };
    await t.test('real Dashboard navbar and widget share exactly one inbox request', async () => {
      const page = await open('/dashboard', '/tests/dashboard-internal-messages.fixture.html?count=1');
      await page.locator('.dashboard-internal-row').waitFor();
      assert.equal(await page.evaluate(() => window.notificationFixture.inboxRequests), 1);
      await tick(page, 30_000);
      assert.equal(await page.evaluate(() => window.notificationFixture.inboxRequests), 2);
      assert.equal(await page.locator('.dashboard-internal-messages header > span').textContent(), '1');
    });
    await t.test('two subscribers and StrictMode share one request per 30 seconds; removing one keeps the feed', async () => {
      const page = await open();
      await page.locator('output').first().filter({ hasText: 'approval-a' }).waitFor();
      assert.equal(await count(page, inbox), 1);
      await tick(page, 29_000); assert.equal(await count(page, inbox), 1);
      await tick(page, 1_000); assert.equal(await count(page, inbox), 2);
      await page.evaluate(() => window.resourceFixture.setConsumers(1));
      await page.locator('output').last().waitFor();
      await tick(page, 30_000); assert.equal(await count(page, inbox), 3);
      assert.equal(await count(page, clients), 0, 'cover persistence does not list clients on Dashboard');
    });
    await t.test('hidden and idle tabs pause; visibility/activity resume stale data; storage events do not fetch', async () => {
      const page = await open();
      await visibility(page, false);
      const before = await count(page, inbox);
      await tick(page, 600_000); assert.equal(await count(page, inbox), before);
      await visibility(page, true); await tick(page, 1);
      assert.equal(await count(page, inbox), before + 1);
      await page.evaluate(() => { window.dispatchEvent(new Event('focus')); window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated' })); });
      await tick(page, 1); assert.equal(await count(page, inbox), before + 1);
      await tick(page, 300_000);
      const idleCount = await count(page, inbox);
      await tick(page, 300_000); assert.equal(await count(page, inbox), idleCount);
      await page.evaluate(() => window.dispatchEvent(new Event('pointermove')));
      await tick(page, 1); assert.equal(await count(page, inbox), idleCount + 1);
    });
    await t.test('slow responses never overlap and errors back off without clearing approvals', async () => {
      const page = await open();
      await page.evaluate(() => { window.resourceFixture.holdInbox = true; });
      await tick(page, 30_000); assert.equal(await count(page, inbox), 2);
      await tick(page, 19_000); assert.equal(await count(page, inbox), 2);
      await page.evaluate(() => { window.resourceFixture.holdInbox = false; window.resourceFixture.failInbox = true; window.resourceFixture.release(); });
      await tick(page, 59_000); assert.equal(await count(page, inbox), 2);
      await tick(page, 1_000); assert.equal(await count(page, inbox), 3);
      assert.equal(await page.locator('output').first().textContent(), 'approval-a');
      await page.evaluate(() => { window.resourceFixture.failInbox = false; window.resourceFixture.items = [{ id: 'approval-b' }]; });
      await tick(page, 120_000);
      await page.locator('output').first().filter({ hasText: 'approval-b' }).waitFor();
      await tick(page, 30_000); assert.equal(await count(page, inbox), 5);
    });
    await t.test('unmount cleans timers/listeners and blocks late responses from starting another cycle', async () => {
      const page = await open();
      await page.evaluate(() => { window.resourceFixture.holdInbox = true; });
      await tick(page, 30_000);
      await page.evaluate(() => window.resourceFixture.setConsumers(0));
      await page.waitForFunction(() => !document.querySelector('output'));
      await page.evaluate(() => window.resourceFixture.release());
      const before = await count(page, inbox);
      await page.evaluate(() => { window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('pointermove')); document.dispatchEvent(new Event('visibilitychange')); });
      await tick(page, 600_000); assert.equal(await count(page, inbox), before);
    });
    await t.test('account changes isolate the feed and client role never polls', async () => {
      const page = await open();
      await page.evaluate(() => { window.resourceFixture.items = [{ id: 'user-b-only' }]; window.resourceFixture.setSession('b'); });
      await page.locator('output').first().filter({ hasText: 'user-b-only' }).waitFor();
      assert.equal(await count(page, inbox), 2);
      await page.evaluate(() => window.resourceFixture.setSession('c', 'client'));
      await page.locator('output').first().filter({ hasText: 'loading' }).waitFor();
      await tick(page, 120_000); assert.equal(await count(page, inbox), 2);
    });
    await t.test('a late response from the previous account cannot overwrite the new feed', async () => {
      const page = await open();
      await page.evaluate(() => { window.resourceFixture.holdInbox = true; });
      await tick(page, 30_000);
      await page.evaluate(() => {
        window.oldRelease = window.resourceFixture.release;
        window.resourceFixture.holdInbox = false;
        window.resourceFixture.items = [{ id: 'new-account-only' }];
        window.resourceFixture.setSession('b');
      });
      await page.locator('output').first().filter({ hasText: 'new-account-only' }).waitFor();
      await page.evaluate(() => window.oldRelease());
      await tick(page, 1_000);
      assert.equal(await page.locator('output').first().textContent(), 'new-account-only');
      assert.equal(await count(page, inbox), 3);
    });
    await t.test('cover persistence shares clients cache, pauses hidden/off-client, and still saves local covers', async () => {
      const page = await open('/admin/fixture-client');
      await page.waitForFunction(() => window.resourceFixture.requests.includes('GET /api/clients/client-a/texts'));
      assert.equal(await count(page, clients), 1);
      assert.equal(await page.evaluate(async () => {
        const { listAdminClients } = await import('/src/api.ts');
        await Promise.all([listAdminClients(), listAdminClients()]);
        return window.resourceFixture.requests.filter(item => item === 'GET /api/clients').length;
      }), 1);
      await page.evaluate(() => localStorage.setItem('designhub-text-cover:fixture-client:text-a', '/api/uploads/synthetic.webp'));
      await tick(page, 1_200);
      assert.equal(await count(page, 'PATCH /api/clients/client-a/texts/text-a'), 1);
      await visibility(page, false);
      const hiddenCount = await count(page, clients);
      await tick(page, 120_000); assert.equal(await count(page, clients), hiddenCount);
      await page.evaluate(() => { location.hash = '/dashboard'; });
      await visibility(page, true); await tick(page, 120_000);
      assert.equal(await count(page, clients), hiddenCount);
      await page.evaluate(() => { location.hash = '/admin/fixture-client'; });
      await page.waitForFunction(expected => window.resourceFixture.requests.filter(item => item === 'GET /api/clients').length === expected, hiddenCount + 1);
      await page.evaluate(async () => {
        localStorage.setItem('designhub-v2-access-token', 'different-account');
        const { listAdminClients } = await import('/src/api.ts');
        await Promise.all([listAdminClients(), listAdminClients()]);
      });
      assert.equal(await count(page, clients), hiddenCount + 2, 'new token bypasses prior account cache and still deduplicates');
    });
  } finally { await browser?.close(); await server.close(); }
});
