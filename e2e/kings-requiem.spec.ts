import { readFile } from 'node:fs/promises';
import { test, expect } from './fixtures';

test.use({ viewport: { width: 1000, height: 720 }, deviceScaleFactor: 0.75 });
test.setTimeout(180_000);

test(
  'renders moving enchantments on the epic sword in the WebGL gallery',
  { tag: '@real-drawing' },
  async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '' }));
    await page.goto('/?gallery=kings-requiem&renderer=webgl2&time=.42');
    await expect(page.locator('body')).toHaveAttribute('data-gallery-ready', 'true', {
      timeout: 120_000,
    });
    const canvas = page.locator('#scene');
    const first = await canvas.screenshot({ path: testInfo.outputPath('requiem-after.png') });
    const frame = Number(await page.locator('body').getAttribute('data-enchantment-frame'));
    await expect
      .poll(async () => Number(await page.locator('body').getAttribute('data-enchantment-frame')))
      .toBeGreaterThan(frame + 8);
    expect((await canvas.screenshot()).equals(first)).toBe(false);
    await page.goto('/?gallery=kings-requiem&before&renderer=webgl2&time=.42');
    await expect(page.locator('body')).toHaveAttribute('data-gallery-ready', 'true', {
      timeout: 120_000,
    });
    await canvas.screenshot({ path: testInfo.outputPath('requiem-before.png') });
    expect(errors).toEqual([]);
  },
);

test(
  'admin preview animates the epic weapon, shows its stats and can switch back to a static item',
  { tag: '@real-drawing' },
  async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const html = await readFile(new URL('../apps/client/dist/admin.html', import.meta.url), 'utf8');
    await page.route('**/admin/items', (r) => r.fulfill({ contentType: 'text/html', body: html }));
    await page.route('**/api/admin/items', (r) =>
      r.fulfill({
        json: {
          draft: { revision: 0, overrides: {} },
          published: { revision: 0, overrides: {} },
          history: [],
        },
      }),
    );
    await page.goto('/admin/items');
    await page.getByRole('searchbox', { name: 'Find an item' }).fill('kingsRequiem');
    await page.getByRole('navigation', { name: 'Items' }).getByRole('button').click();
    const canvas = page.locator('.model-viewport canvas');
    await expect(canvas).toHaveAttribute('data-item', 'kingsRequiem');
    await expect(page.locator('.model-viewport')).toHaveAttribute('data-state', 'ready');
    await expect(page.getByLabel('Item rarity', { exact: true })).toHaveValue('epic');
    await expect(page.getByLabel('Attack power (%)')).toHaveValue('85');
    const first = await canvas.screenshot();
    await expect.poll(async () => (await canvas.screenshot()).equals(first)).toBe(false);
    await page.getByRole('searchbox', { name: 'Find an item' }).fill('watchGreatsword');
    await page.getByRole('navigation', { name: 'Items' }).getByRole('button').click();
    await expect(canvas).toHaveAttribute('data-item', 'watchGreatsword');
    await expect(page.locator('.model-viewport')).toHaveAttribute('data-state', 'ready');
    await expect(page.getByLabel('Attack power (%)')).toHaveValue('55');
    expect(errors).toEqual([]);
  },
);
