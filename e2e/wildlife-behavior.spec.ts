import { expect, test } from './fixtures';
test.use({ viewport: { width: 1000, height: 760 }, deviceScaleFactor: 1 });
test.setTimeout(180000);

test('renders listening, bracing and escape poses on the existing elk rig', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '' }));
  for (const motion of ['graze', 'listen', 'tense', 'flee']) {
    await page.goto(`/?gallery=elk&motion=${motion}&at=2&still&renderer=webgl2`);
    await expect(page.locator('body')).toHaveAttribute('data-gallery-ready', 'true', {
      timeout: 120000,
    });
    await page.screenshot({ path: testInfo.outputPath(`${motion}.png`) });
  }
  expect(errors).toEqual([]);
});
