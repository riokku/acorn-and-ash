import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';
test.setTimeout(240_000);
test.use({ viewport: { width: 640, height: 480 }, deviceScaleFactor: 0.75 });

// Every top holds one fit for each soft body (decision 0284). The faceted dwarves that replaced
// them (decision 0288) are a different shape, so a top is left off until it is refitted. When the
// tops are refitted, this goes back to expecting each one drawn (/^[1-9]/), one fit per body.
test('leaves every top off both bodies until it is refitted', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const tops = shared.GEAR_ITEMS.filter((item) => shared.canWearIn(item, 'upperBody'));
  for (const top of tops) {
    const pieces: string[] = [];
    for (const body of Object.keys(shared.CHARACTER_KINDS)) {
      await page.goto(`/?gallery=winter-gear&body=${body}&wear=${top}&renderer=webgl2&still`);
      await expect(page.locator('body')).toHaveAttribute('data-gallery-ready', 'true');
      await expect(page.locator('body')).toHaveAttribute('data-worn-pieces', '0');
      pieces.push((await page.locator('body').getAttribute('data-worn-pieces')) ?? '');
      await page.screenshot({ path: testInfo.outputPath(`${top}-${body}.png`) });
    }
    // Both fits are cut the same way, so drawing both on one body would double the count.
    expect(new Set(pieces).size, top).toBe(1);
  }
  expect(errors).toEqual([]);
});
