import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';
test.setTimeout(240_000);
test.use({ viewport: { width: 640, height: 480 }, deviceScaleFactor: 0.75 });

// The helms were fitted to the soft bodies' heads (decision 0283). The faceted dwarves that
// replaced them (decision 0288) have a different head, so a helm is left off until it is refitted.
// When the helms are refitted, this goes back to expecting each one drawn (/^[1-9]/).
test('leaves every helm off both bodies until it is refitted', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const helms = shared.GEAR_ITEMS.filter((item) => shared.canWearIn(item, 'helm'));
  for (const body of Object.keys(shared.CHARACTER_KINDS)) {
    for (const helm of helms) {
      await page.goto(`/?gallery=winter-gear&body=${body}&wear=${helm}&renderer=webgl2&still`);
      await expect(page.locator('body')).toHaveAttribute('data-gallery-ready', 'true');
      await expect(page.locator('body')).toHaveAttribute('data-worn-pieces', '0');
      await page.screenshot({ path: testInfo.outputPath(`${helm}-${body}.png`) });
    }
  }
  expect(errors).toEqual([]);
});
