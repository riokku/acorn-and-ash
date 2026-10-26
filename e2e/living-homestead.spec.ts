import { expect, test } from './fixtures';
test.use({ viewport: { width: 1180, height: 850 }, deviceScaleFactor: 1 });
test('renders an empty and stocked yard with the real tool assets and crop growth', async ({
  page,
}, testInfo) => {
  test.setTimeout(180000);
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ body: '' }));
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (entry) => {
    if (entry.type() === 'error') errors.push(entry.text());
  });
  for (const empty of [true, false]) {
    await page.goto(`/?gallery=homestead&renderer=webgl2&still${empty ? '&empty' : ''}`);
    await expect(page.locator('body')).toHaveAttribute('data-gallery-ready', 'true', {
      timeout: 120000,
    });
    await page.screenshot({ path: testInfo.outputPath(empty ? 'empty.png' : 'stocked.png') });
  }
  expect(errors).toEqual([]);
});
