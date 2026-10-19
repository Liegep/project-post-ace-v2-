import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const drive = 'https://drive.google.com/file/d/synthetic-review/view?usp=sharing';
const video = 'https://cdn.example.test/review.mp4?token=preserved#start';

test('portal and public material actions preserve the reader and decision flows', async t => {
  const artifacts = process.env.PORTAL_MATERIAL_ARTIFACT_DIR || await mkdtemp(path.join(tmpdir(), 'portal-material-'));
  await mkdir(artifacts, { recursive: true });
  const server = await createServer({ root, server: { host: '127.0.0.1', port: 0, hmr: false } });
  let browser;
  try {
    await server.listen();
    const base = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ headless: true });
    const open = async (params = {}, viewport = { width: 1440, height: 1000 }) => {
      const page = await browser.newPage({ viewport });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      // All media/API data are synthetic. No production requests are made.
      await page.route('https://**/*', route => route.fulfill({ contentType: 'text/html', body: '<title>Synthetic external material</title>' }));
      const query = new URLSearchParams({ shape: 'square', material: drive, hashtags: '1', ...params });
      await page.goto(`${base}/tests/editorial-pauta.fixture.html?${query}`);
      if (params.view === 'authenticated') await page.getByText('Uma pausa para observar o cotidiano', { exact: true }).first().click();
      await page.locator('.portal-material-action').waitFor();
      return { page, errors };
    };
    for (const approved of [false, true]) for (const width of [1440, 390, 320]) {
      await t.test(`${approved ? 'approved' : 'pending'} post at ${width}px`, async () => {
        const { page, errors } = await open(approved ? { approved: '1', readonly: '1' } : {}, { width, height: width > 500 ? 1000 : 844 });
        try {
          const link = page.getByRole('link', { name: /Abrir material/ });
          assert.equal(await link.getAttribute('href'), drive);
          assert.equal(await link.getAttribute('target'), '_blank');
          assert.equal(await link.getAttribute('rel'), 'noopener noreferrer');
          const geometry = await link.evaluate(el => {
            const box = el.getBoundingClientRect(), media = el.previousElementSibling.getBoundingClientRect();
            return { below: box.top >= media.bottom, gap: box.top - media.bottom, fits: box.right <= innerWidth && box.left >= 0, height: box.height, next: el.nextElementSibling.className, overflow: document.documentElement.scrollWidth > innerWidth };
          });
          assert.ok(geometry.below && geometry.gap <= 20 && geometry.fits && geometry.height >= 44);
          assert.match(geometry.next, /badge-row/);
          assert.equal(geometry.overflow, false);
          assert.equal(await page.locator('.artwork-carousel img').count(), 1);
          assert.ok(await page.getByText('#cotidiano', { exact: false }).count());
          assert.ok(await page.getByText('Podemos trazer um exemplo da rotina na primeira imagem?').count());
          const draft = page.getByPlaceholder('Escreva aqui seu comentário sobre este post');
          if (!approved) await draft.fill('Comentário preservado ao abrir o material.');
          await link.focus();
          assert.equal(await link.evaluate(el => el.matches(':focus-visible')), true);
          await link.evaluate(el => { el.blur(); el.closest('.modal-grid').scrollTop = 0; });
          await page.screenshot({ path: path.join(artifacts, `${approved ? 'approved' : 'pending'}-${width}.png`) });
          const before = await page.evaluate(() => JSON.stringify(window.fixtureDetail));
          await link.focus();
          const popupPromise = page.waitForEvent('popup');
          await page.keyboard.press('Enter');
          const popup = await popupPromise;
          await popup.waitForLoadState();
          assert.equal(popup.url(), drive);
          assert.equal(await popup.evaluate(() => window.opener === null), true);
          await popup.close();
          assert.equal(await page.evaluate(() => JSON.stringify(window.fixtureDetail)), before);
          assert.deepEqual(await page.evaluate(() => window.fixtureActions), []);
          if (!approved) {
            assert.equal(await draft.inputValue(), 'Comentário preservado ao abrir o material.');
            await page.getByRole('button', { name: 'Aprovar', exact: true }).last().click();
            await page.waitForFunction(() => window.fixtureActions.some(x => x.kind === 'approve'));
            assert.deepEqual(await page.evaluate(() => window.fixtureActions.find(x => x.kind === 'approve').args), ['synthetic-card', 'Comentário preservado ao abrir o material.']);
          }
          assert.deepEqual(errors, []);
        } finally { await page.close(); }
      });
    }
    await t.test('material without an image stays visible in the compact reader', async () => {
      const { page, errors } = await open({ shape: '' }, { width: 390, height: 844 });
      try {
        assert.equal(await page.locator('.portal-card-detail-modal.no-media').count(), 1);
        assert.equal(await page.locator('.modal-sidebar-copy > .portal-material-action').isVisible(), true);
        await page.screenshot({ path: path.join(artifacts, 'no-preview-mobile.png') });
        assert.deepEqual(errors, []);
      } finally { await page.close(); }
    });
    for (const [locale, url, label] of [['it', video, 'Guarda il video'], ['it', drive, 'Apri materiale'], ['pt', video, 'Assistir ao vídeo']]) {
      await t.test(`public ${locale}: ${label}`, async () => {
        const { page, errors } = await open({ view: 'public', locale, material: url }, { width: 390, height: 844 });
        try {
          assert.equal(await page.getByRole('link', { name: new RegExp(label) }).getAttribute('href'), url);
          assert.equal(await page.locator('.public-approval-card > .artwork-carousel + .portal-material-action').count(), 1);
          await page.getByLabel('Seu nome').fill('Marina');
          await page.getByLabel('Comentário', { exact: true }).fill('Revisar a abertura.');
          const popupPromise = page.waitForEvent('popup');
          await page.locator('.portal-material-action').click();
          const popup = await popupPromise; await popup.close();
          assert.deepEqual(await page.evaluate(() => window.fixtureCalls.filter(x => x.method !== 'GET')), []);
          await page.screenshot({ path: path.join(artifacts, `public-${locale}-${url === video ? 'video' : 'material'}-mobile.png`), fullPage: true });
          await page.getByRole('button', { name: 'Solicitar alteração' }).click();
          await page.getByRole('status').waitFor();
          assert.deepEqual(await page.evaluate(() => window.fixtureCalls.filter(x => x.method !== 'GET').map(x => x.body)), [{ approved: false, commentText: 'Revisar a abertura.', requesterName: 'Marina' }]);
          assert.deepEqual(errors, []);
        } finally { await page.close(); }
      });
    }
    for (const width of [1440, 390]) await t.test(`authenticated Italian portal at ${width}px uses account localization`, async () => {
      const { page, errors } = await open({ view: 'authenticated', locale: 'it', material: video }, { width, height: width > 500 ? 1000 : 844 });
      try {
        assert.equal(await page.getByText('Guarda il video', { exact: true }).count(), 1);
        await page.screenshot({ path: path.join(artifacts, `portal-it-video-${width}.png`) });
        assert.deepEqual(errors, []);
      } finally { await page.close(); }
    });
    console.log(`Screenshots: ${artifacts}`);
  } finally { await browser?.close(); await server.close(); }
});
