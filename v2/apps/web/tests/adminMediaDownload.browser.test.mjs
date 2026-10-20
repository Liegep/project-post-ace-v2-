import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

test('administrative JPEG downloads preserve dimensions, colors, source bytes and other files', async t => {
  const server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), server: { host: '127.0.0.1', port: 0, hmr: false } });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const base = `http://127.0.0.1:${server.httpServer.address().port}`;
    await page.goto(base);
    for (const format of ['image/webp', 'image/png', 'image/jpeg']) {
      await t.test(format, async () => {
        const result = await page.evaluate(async format => {
          const { prepareAdminDownload } = await import('/src/adminMediaDownload.ts');
          const canvas = document.createElement('canvas');
          canvas.width = 128; canvas.height = 64;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ff0000'; ctx.fillRect(64, 0, 64, 64);
          const source = await new Promise(resolve => canvas.toBlob(resolve, format, 1));
          const before = Array.from(new Uint8Array(await source.arrayBuffer()));
          const prepared = await prepareAdminDownload(source, '/api/uploads/abc.webp?old=1', 'midia-1');
          const decoded = await createImageBitmap(prepared.blob);
          ctx.clearRect(0, 0, 128, 64); ctx.drawImage(decoded, 0, 0);
          const white = Array.from(ctx.getImageData(16, 32, 1, 1).data);
          const red = Array.from(ctx.getImageData(96, 32, 1, 1).data);
          const dimensions = [decoded.width, decoded.height];
          decoded.close();
          window.prepared = prepared;
          return { mime: prepared.blob.type, name: prepared.fileName, signature: Array.from(new Uint8Array(await prepared.blob.arrayBuffer())).slice(0, 3), dimensions, white, red, unchanged: JSON.stringify(before) === JSON.stringify(Array.from(new Uint8Array(await source.arrayBuffer()))) };
        }, format);
        assert.equal(result.mime, 'image/jpeg');
        assert.equal(result.name, 'midia-1.jpg');
        assert.deepEqual(result.signature, [255, 216, 255]);
        assert.ok(result.unchanged);
        assert.deepEqual(result.dimensions, [128, 64]);
        if (format !== 'image/jpeg') assert.ok(result.white.slice(0, 3).every(v => v >= 250));
        assert.ok(result.red[0] >= 250 && result.red[1] <= 5 && result.red[2] <= 5);
        const downloadEvent = page.waitForEvent('download');
        await page.evaluate(() => {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(window.prepared.blob);
          a.download = window.prepared.fileName; a.click();
        });
        const download = await downloadEvent;
        assert.equal(download.suggestedFilename(), 'midia-1.jpg');
        assert.equal(await download.failure(), null);
        const saved = await readFile(await download.path());
        assert.deepEqual([...saved.subarray(0, 3)], [255, 216, 255]);
        assert.deepEqual([...saved.subarray(-2)], [255, 217]);
      });
    }
    await t.test('legacy image URL with generic MIME and encoder failures', async () => {
      const result = await page.evaluate(async () => {
        const { prepareAdminDownload } = await import('/src/adminMediaDownload.ts');
        const canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 16;
        const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        const source = new Blob([await png.arrayBuffer()], { type: 'application/octet-stream' });
        const prepared = await prepareAdminDownload(source, '/old.png?token=example', 'old');
        const original = HTMLCanvasElement.prototype.toBlob;
        let rejected = false;
        try {
          HTMLCanvasElement.prototype.toBlob = function(callback) { callback(null); };
          await prepareAdminDownload(png, '/old.png', 'old');
        } catch { rejected = true; }
        finally { HTMLCanvasElement.prototype.toBlob = original; }
        return { mime: prepared.blob.type, rejected };
      });
      assert.equal(result.mime, 'image/jpeg'); assert.ok(result.rejected);
    });
    await t.test('non-images and corrupt images' , async () => {
      const result = await page.evaluate(async () => {
        const { prepareAdminDownload } = await import('/src/adminMediaDownload.ts');
        const results = [];
        for (const mime of ['video/mp4', 'video/webm', 'video/quicktime', 'application/pdf', 'application/octet-stream']) {
          const source = new Blob([new Uint8Array([0, 1, 2, 255])], { type: mime });
          const prepared = await prepareAdminDownload(source, '/file.bin', 'midia-2');
          results.push(prepared.blob === source && prepared.fileName === undefined);
        }
        let rejected = false;
        try { await prepareAdminDownload(new Blob(['broken'], { type: 'image/webp' }), '/abc.webp', 'midia-1'); } catch { rejected = true; }
        return { results, rejected };
      });
      assert.ok(result.results.every(Boolean)); assert.ok(result.rejected);
    });
  } finally { await browser?.close(); await server.close(); }
});
