import { test, expect } from './fixtures';

test.use({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 0.75 });
test.setTimeout(180000);
test(
  'renders the soul release, real enchanted sword and layered victory reveal',
  { tag: '@real-drawing' },
  async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '' }));
    for (const before of [true, false]) {
      await page.goto(
        `/?gallery=king-victory&renderer=webgl2&time=.22&at=4.8${before ? '&before' : ''}`,
      );
      await expect(page.locator('body')).toHaveAttribute('data-gallery-ready', 'true', {
        timeout: 120000,
      });
      if (!before) {
        await expect(page.getByTestId('king-victory')).toContainText('Requiem');
        await expect(page.locator('.king-victory-reward')).toHaveCSS('opacity', '1');
      }
      await page.screenshot({ path: testInfo.outputPath(before ? 'before.png' : 'after.png') });
    }
    expect(errors).toEqual([]);
  },
);
test('offers a static reduced-motion presentation and a replay control', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?gallery=king-victory&renderer=webgl2&at=4.8');
  await expect(page.locator('body')).toHaveAttribute('data-gallery-ready', 'true', {
    timeout: 120000,
  });
  await expect(page.locator('.king-victory-heading')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.king-victory-sigil svg')).toHaveCSS('animation-name', 'none');
  await page.getByRole('button', { name: 'Replay the King’s fall' }).click();
  await expect(page.getByTestId('king-victory')).toContainText('The watch is free');
  expect(errors).toEqual([]);
});
