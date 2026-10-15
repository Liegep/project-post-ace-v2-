import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const mutedKey = 'designhub-v2-notification-sound-muted:fixture-user';

test('one louder ding, new events only, visual notifications independent of sound', async t => {
  const server = await createServer({ root, server: { host: '127.0.0.1', port: 0, hmr: false } });
  let browser;
  try {
    await server.listen();
    const base = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ headless: true });
    const open = async ({ blocked = false } = {}) => {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      page.errors = [];
      page.on('pageerror', error => page.errors.push(error.message));
      await page.clock.install();
      await page.addInitScript(({ blocked }) => {
        window.soundStarts = [];
        window.soundContexts = 0;
        const NativeAudioContext = window.AudioContext;
        window.AudioContext = blocked ? class {
          state = 'suspended';
          constructor() { window.soundContexts++; }
          resume() { return Promise.reject(Error('Autoplay denied')); }
          close() { return Promise.resolve(); }
        } : class extends NativeAudioContext {
          constructor(...args) { super(...args); window.soundContexts++; }
          createOscillator() {
            const oscillator = super.createOscillator();
            const start = oscillator.start.bind(oscillator);
            oscillator.start = (...args) => { window.soundStarts.push(Date.now()); return start(...args); };
            return oscillator;
          }
        };
      }, { blocked });
      await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
      await page.goto(`${base}/tests/dashboard-internal-messages.fixture.html?count=1`);
      await page.locator('.dashboard-internal-row').waitFor();
      await page.waitForFunction(() => window.notificationFixture.overviewRequests > 0);
      return page;
    };
    const starts = page => page.evaluate(() => window.soundStarts.length);
    const tick = async (page, ms = 5000) => {
      const before = await page.evaluate(() => window.notificationFixture.inboxRequests);
      await page.clock.fastForward(ms);
      await page.waitForFunction(before => window.notificationFixture.inboxRequests > before, before);
      // Flush fetch/React work without advancing the polling clock again.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
    };
    const approval = (page, id) => page.evaluate(id => {
      const fixture = window.notificationFixture;
      fixture.items = [...fixture.items, { ...fixture.items[0], id, cardTitle: `Aprovação ${id}`, createdAt: new Date().toISOString() }];
    }, id);
    const comment = (page, id) => page.evaluate(id => {
      window.notificationFixture.comments.push({ id, title: `Comentário ${id}`, occurredAt: new Date().toISOString() });
    }, id);

    await t.test('actual rendered waveform is one short attack, over twice the old peak, without clipping', async () => {
      const page = await open();
      try {
        const rendered = await page.evaluate(async () => {
          const { scheduleNotificationDing } = await import('/src/notificationSound.ts');
          const render = async old => {
            const context = new OfflineAudioContext(1, 24000, 48000);
            if (old) {
              const oscillator = context.createOscillator(), gain = context.createGain();
              oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(880, 0);
              oscillator.frequency.exponentialRampToValueAtTime(660, .18);
              gain.gain.setValueAtTime(.0001, 0); gain.gain.exponentialRampToValueAtTime(.16, .015);
              gain.gain.exponentialRampToValueAtTime(.0001, .24);
              oscillator.connect(gain); gain.connect(context.destination); oscillator.start(0); oscillator.stop(.26);
            } else scheduleNotificationDing(context);
            return Array.from((await context.startRendering()).getChannelData(0));
          };
          const samples = await render(false), old = await render(true);
          const rms = x => Math.sqrt(x.reduce((sum, value) => sum + value * value, 0) / x.length);
          const bins = Array.from({ length: 34 }, (_, i) => rms(samples.slice((i + 4) * 480, (i + 5) * 480)));
          return { samples, peak: Math.max(...samples.map(Math.abs)), oldPeak: Math.max(...old.map(Math.abs)), rms: rms(samples), oldRms: rms(old), bins };
        });
        assert.ok(rendered.peak <= .361 && rendered.peak > .35);
        assert.ok(rendered.peak / rendered.oldPeak > 2);
        assert.ok(rendered.rms / rendered.oldRms > 2);
        assert.ok(rendered.bins.every((value, i, bins) => !i || value < bins[i - 1]), 'single fading attack, no second note');
        assert.ok(rendered.samples.slice(20500).every(value => value === 0), 'silent after 420 ms');
        const directory = process.env.NOTIFICATION_SOUND_ARTIFACT_DIR;
        if (directory) {
          await mkdir(directory, { recursive: true });
          const wav = Buffer.alloc(44 + rendered.samples.length * 2);
          wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
          wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
          wav.writeUInt32LE(48000, 24); wav.writeUInt32LE(96000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
          wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
          rendered.samples.forEach((value, index) => wav.writeInt16LE(Math.round(value * 32767), 44 + index * 2));
          await writeFile(path.join(directory, 'design-hub-ding.wav'), wav);
        }
        console.log(`Ding peak: ${rendered.peak.toFixed(3)}; old: ${rendered.oldPeak.toFixed(3)}; RMS ratio: ${(rendered.rms / rendered.oldRms).toFixed(2)}`);
      } finally { await page.close(); }
    });
    await t.test('new approvals/comments sound once; synchronization, reconnection and historical backfill stay quiet', async () => {
      const page = await open();
      try {
        assert.equal(await starts(page), 0);
        assert.equal(await page.evaluate(() => window.soundContexts), 0);
        await page.getByRole('button', { name: 'Notificações', exact: true }).click();
        await approval(page, 'new-approval'); await tick(page);
        assert.equal(await starts(page), 1);
        assert.equal(await page.locator('.dashboard-internal-messages header > span').textContent(), '2');
        await tick(page); assert.equal(await starts(page), 1);
        await page.evaluate(() => { window.notificationFixture.failInbox = true; });
        await tick(page);
        await page.evaluate(() => { window.notificationFixture.failInbox = false; });
        await tick(page); assert.equal(await starts(page), 1);
        await page.evaluate(() => {
          window.removedMessage = window.notificationFixture.items.pop();
          window.notificationFixture.items.push({ ...window.removedMessage, id: 'historical', createdAt: '2000-01-01T00:00:00Z' });
        });
        await tick(page);
        await page.evaluate(() => window.notificationFixture.items.push(window.removedMessage));
        await tick(page); assert.equal(await starts(page), 1);
        await comment(page, 'new-comment'); await tick(page, 600001);
        await page.getByText('Comentário new-comment', { exact: true }).waitFor();
        assert.equal(await starts(page), 2);
        await approval(page, 'simultaneous'); await comment(page, 'simultaneous'); await tick(page, 600001);
        assert.equal(await starts(page), 3, 'two feeds arriving together produce one ding');
        await tick(page, 600001); assert.equal(await starts(page), 3);
        assert.equal(await page.evaluate(() => window.soundContexts), 1, 'navbar and dashboard share the context');
        assert.deepEqual(await page.evaluate(() => window.smokeWrites), []);
        assert.deepEqual(page.errors, []);
      } finally { await page.close(); }
    });
    await t.test('mute persists across reload, preserves visual counts, and never queues old sounds for unmute', async () => {
      const page = await open();
      try {
        await page.getByRole('button', { name: 'Notificações', exact: true }).click();
        const checkbox = page.getByRole('checkbox', { name: 'Som das notificações' });
        await checkbox.uncheck();
        assert.equal(await page.evaluate(key => localStorage.getItem(key), mutedKey), '1');
        await approval(page, 'muted'); await comment(page, 'muted'); await tick(page, 600001);
        assert.equal(await starts(page), 0);
        assert.equal(await page.locator('.dashboard-internal-messages header > span').textContent(), '2');
        assert.equal(await page.getByRole('button', { name: 'Notificações', exact: true }).locator('span').textContent(), '2');
        await checkbox.check(); await tick(page, 600001); assert.equal(await starts(page), 0);
        await approval(page, 'audible'); await tick(page); assert.equal(await starts(page), 1);
        await checkbox.uncheck();
        await page.reload(); await page.locator('.dashboard-internal-row').waitFor();
        await page.getByRole('button', { name: 'Notificações', exact: true }).click();
        assert.equal(await checkbox.isChecked(), false);
        assert.equal(await starts(page), 0);
        await checkbox.check(); await tick(page); assert.equal(await starts(page), 0);
        assert.deepEqual(page.errors, []);
      } finally { await page.close(); }
    });
    await t.test('events before interaction never replay after unlock', async () => {
      const page = await open();
      try {
        await approval(page, 'before-gesture'); await tick(page);
        assert.equal(await starts(page), 0);
        assert.equal(await page.evaluate(() => window.soundContexts), 0);
        await page.getByRole('button', { name: 'Notificações', exact: true }).click();
        await tick(page); assert.equal(await starts(page), 0);
        await approval(page, 'after-gesture'); await tick(page); assert.equal(await starts(page), 1);
        assert.deepEqual(page.errors, []);
      } finally { await page.close(); }
    });
    await t.test('browser audio denial leaves notifications functional without unhandled errors', async () => {
      const page = await open({ blocked: true });
      try {
        await page.getByRole('button', { name: 'Notificações', exact: true }).click();
        await approval(page, 'blocked'); await tick(page);
        assert.equal(await starts(page), 0);
        assert.equal(await page.locator('.dashboard-internal-messages header > span').textContent(), '2');
        await page.getByRole('checkbox', { name: 'Som das notificações' }).uncheck();
        assert.deepEqual(page.errors, []);
      } finally { await page.close(); }
    });
  } finally { await browser?.close(); await server.close(); }
});
