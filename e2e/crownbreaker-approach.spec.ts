import { expect, test } from './fixtures';

test.use({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 0.5 });
test.setTimeout(180000);
test('renders the staged stronghold approach and its muster viewpoint', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ body: '' }));
  for (const before of [true, false]) {
    await page.goto(`/?gallery=crownbreaker&renderer=webgl2${before ? '&before' : ''}`);
    await expect(page.locator('body')).toHaveAttribute('data-gallery-ready', 'true', {
      timeout: 120000,
    });
    await page
      .locator('canvas')
      .first()
      .screenshot({ path: testInfo.outputPath(before ? 'before.png' : 'after.png') });
  }
  await page.getByRole('button', { name: 'The Last Muster', exact: true }).click();
  await expect(page.locator('body')).toHaveAttribute('data-gallery-ready', 'true');
  await page
    .locator('canvas')
    .first()
    .screenshot({ path: testInfo.outputPath('muster.png') });
  expect(errors).toEqual([]);
});
