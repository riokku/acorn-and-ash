import { expect, test } from './fixtures';
test.setTimeout(180000);
test(
  'renders softer mountain ground transitions with the real world terrain',
  { tag: '@real-drawing' },
  async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '' }));
    for (const before of [true, false]) {
      await page.goto(
        `/?gallery=forest-distance&renderer=webgl2&view=mountain${before ? '&before' : ''}`,
      );
      await expect(page.locator('body')).toHaveAttribute('data-gallery-ready', 'true', {
        timeout: 120000,
      });
      await page.screenshot({ path: info.outputPath(before ? 'before.png' : 'after.png') });
    }
    expect(errors).toEqual([]);
  },
);
