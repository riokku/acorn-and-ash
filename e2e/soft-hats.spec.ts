import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';
test.setTimeout(240_000);
test.use({ viewport: { width: 640, height: 480 }, deviceScaleFactor: 0.75 });

// Every helm is fitted to the soft bodies' shared skeleton (decision 0282).
test('draws every helm on both bodies', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const helms = shared.GEAR_ITEMS.filter((item) => shared.canWearIn(item, 'helm'));
  for (const body of Object.keys(shared.CHARACTER_KINDS)) {
    for (const helm of helms) {
      await page.goto(`/?gallery=winter-gear&body=${body}&wear=${helm}&renderer=webgl2&still`);
      await expect(page.locator('body')).toHaveAttribute('data-gallery-ready', 'true');
      await expect(page.locator('body')).toHaveAttribute('data-worn-pieces', /^[1-9]/);
      await page.screenshot({ path: testInfo.outputPath(`${helm}-${body}.png`) });
    }
  }
  expect(errors).toEqual([]);
});
