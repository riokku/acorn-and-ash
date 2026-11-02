#!/usr/bin/env node
/**
 * Bake the current playable models into picker thumbnails with one gallery renderer.
 * Start the client first, then run:
 * BODY_ICON_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium node tools/render-body-icons.mjs
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { format } from 'prettier';

const root = new URL('../', import.meta.url);
const target = new URL('assets/ui/body-portraits/', root);
const report = new URL('docs/design/body-portrait-sources.json', root);
const base = process.env.BODY_ICON_BASE_URL ?? 'http://127.0.0.1:5173';
const url = (body) => {
  const result = new URL('/', base);
  result.search = new URLSearchParams({
    gallery: 'body-icons',
    renderer: 'webgl2',
    ...(body ? { body } : {}),
  }).toString();
  return result.href;
};
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
    : { channel: 'chromium' }),
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 192, height: 256 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ body: '' }));
const sources = {};
try {
  await mkdir(target, { recursive: true });
  await page.goto(url());
  await page.waitForSelector('body[data-gallery-ready="true"]');
  const bodies = await page.locator('body').getAttribute('data-body-icon-ids');
  if (!bodies) throw new Error('The body gallery did not publish its character IDs');
  for (const body of bodies.split(',')) {
    await page.goto(url(body));
    await page.waitForSelector(`body[data-gallery-ready="true"][data-body-icon="${body}"]`);
    const image = await page.evaluate(
      () =>
        new Promise((resolve) =>
          globalThis.requestAnimationFrame(() => {
            const source = globalThis.document.querySelector('#scene');
            const canvas = globalThis.document.createElement('canvas');
            canvas.width = 96;
            canvas.height = 128;
            const context = canvas.getContext('2d');
            context.imageSmoothingQuality = 'high';
            context.drawImage(source, 0, 0, 96, 128);
            const pixels = context.getImageData(0, 0, 96, 128).data;
            let left = 96,
              top = 128,
              right = -1,
              bottom = -1;
            for (let y = 0; y < 128; y++)
              for (let x = 0; x < 96; x++) {
                if (pixels[(y * 96 + x) * 4 + 3] <= 8) continue;
                left = Math.min(left, x);
                top = Math.min(top, y);
                right = Math.max(right, x);
                bottom = Math.max(bottom, y);
              }
            resolve({
              data: canvas.toDataURL('image/webp', 0.92),
              bounds: [left, top, right + 1, bottom + 1],
            });
          }),
        ),
    );
    const [left, top, right, bottom] = image.bounds;
    if (left < 2 || top < 2 || right > 94 || bottom > 126 || bottom - top < 64)
      throw new Error(`${body} is empty, too small or clipped: ${image.bounds}`);
    const bytes = Buffer.from(image.data.split(',')[1], 'base64');
    await writeFile(new URL(`${body}.webp`, target), bytes);
    const model = `assets/characters/${body}.glb`;
    const modelHash = createHash('sha256')
      .update(await readFile(new URL(model, root)))
      .digest('hex');
    sources[body] = {
      model,
      sha256: modelHash,
      portrait: `assets/ui/body-portraits/${body}.webp`,
      bounds: image.bounds,
    };
    console.log(`${body}: ${bytes.length} bytes, bounds ${image.bounds.join(', ')}`);
  }
  if (errors.length) throw new Error(errors.join('\n'));
  await writeFile(
    report,
    await format(JSON.stringify({ width: 96, height: 128, view: 'body-icons', sources }), {
      parser: 'json',
    }),
  );
  console.log(
    `Saved ${Object.keys(sources).length} current-model portraits and ${fileURLToPath(report)}`,
  );
} finally {
  await browser.close();
}
