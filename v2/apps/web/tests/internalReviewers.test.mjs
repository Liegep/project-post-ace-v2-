import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
test('real editor renders every reviewer returned by the API', async t => {
  const server = await createServer({ root, server: { host: '127.0.0.1', port: 0, hmr: false } });
  let browser;
  try {
    await server.listen();
    const base = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ headless: true });
    const open = async scenario => {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
      page.setDefaultTimeout(10000);
      page.errors = [];
      page.on('pageerror', e => page.errors.push(e.message));
      await page.route('**/*', r => new URL(r.request().url()).origin === base ? r.continue() : r.abort());
      await page.goto(`${base}/tests/internal-reviewers.fixture.html?scenario=${scenario}`);
      await page.getByRole('button', { name: '♙ Aprovação interna', exact: true }).click();
      return page;
    };
    const checkAll = async page => {
      const expected = await page.evaluate(() => window.reviewerFixture.items);
      await page.waitForFunction(n => document.querySelectorAll('.internal-recipient-list input').length === n, expected.length);
      assert.deepEqual(await page.locator('.internal-recipient-list label').allTextContents(), expected.map(u => `${u.fullName}${u.globalRole} · ${u.email}`));
      assert.deepEqual(page.errors, []);
    };
    for (const role of ['admin', 'colaborador', 'super_admin', 'one']) await t.test(`API/UI parity for ${role}`, async () => {
      const page = await open(role);
      try {
        await checkAll(page);
        for (const checkbox of await page.locator('.internal-recipient-list input').all()) await checkbox.check();
        await page.getByPlaceholder('Escreva uma mensagem para quem vai revisar...').fill('Review this card');
        await page.getByRole('button', { name: 'Enviar para revisão', exact: true }).click();
        await page.locator('.internal-approval-popover').waitFor({ state: 'detached' });
        const { calls, items } = await page.evaluate(() => window.reviewerFixture);
        assert.deepEqual(calls.filter(c => c.method !== 'GET'), [{ url: '/api/clients/client/cards/card/internal-approvals', method: 'POST', body: { recipientIds: items.map(u => u.id), message: 'Review this card' } }]);
        assert.equal(await page.getByPlaceholder('Escreva a legenda do post').inputValue(), 'Preserved caption');
        assert.ok(await page.getByText('Preserved comment', { exact: true }).isVisible());
        assert.deepEqual(page.errors, []);
      } finally { await page.close(); }
    });
    await t.test('empty list explains no eligible reviewers and disables sending', async () => {
      const page = await open('empty');
      try {
        await page.getByText('Nenhum membro interno disponível.', { exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Enviar para revisão', exact: true }).isDisabled(), true);
        assert.deepEqual(await page.evaluate(() => window.reviewerFixture.calls.filter(c => c.method !== 'GET')), []);
      } finally { await page.close(); }
    });
    await t.test('API error does not fall back to management users; reopening retries', async () => {
      const page = await open('retry');
      try {
        await page.locator('.internal-approval-popover [role=alert]').waitFor();
        assert.equal(await page.getByRole('button', { name: 'Enviar para revisão', exact: true }).isDisabled(), true);
        assert.equal(await page.locator('.internal-recipient-list input').count(), 0);
        await page.locator('.internal-approval-popover').getByRole('button', { name: 'Cancelar', exact: true }).click();
        await page.getByRole('button', { name: '♙ Aprovação interna', exact: true }).click();
        await checkAll(page);
        assert.ok((await page.evaluate(() => window.reviewerFixture.calls)).every(c => !c.url.includes('/auth/users') && c.method === 'GET'));
      } finally { await page.close(); }
    });
    await t.test('late response cannot replace the reopened list', async () => {
      const page = await open('late');
      try {
        await page.getByText('Carregando revisores...', { exact: true }).waitFor();
        await page.locator('.internal-approval-popover').getByRole('button', { name: 'Cancelar', exact: true }).click();
        await page.getByRole('button', { name: '♙ Aprovação interna', exact: true }).click();
        await checkAll(page);
        await page.evaluate(async () => { window.reviewerFixture.release(); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
        await checkAll(page);
      } finally { await page.close(); }
    });
  } finally { await browser?.close(); await server.close(); }
});
