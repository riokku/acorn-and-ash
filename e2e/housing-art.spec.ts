import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 0.75 });
for (const kind of ['tent', 'teepee', 'cabin', 'largeCabin']) {
  test(`renders the ${kind} exterior and matching interior`, async ({ page }, testInfo) => {
    // The gallery's optional Google font is unavailable in the restricted test workspace.
    await page.route('https://fonts.googleapis.com/**', (route) =>
      route.fulfill({ contentType: 'text/css', body: '' }),
    );
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto(`/?gallery=${kind}&renderer=webgl2&time=0.42`);
    await expect(page.locator('body')).toHaveAttribute('data-gallery-ready', 'true', {
      timeout: 120_000,
    });
    await page.screenshot({
      path: process.env.CI
        ? testInfo.outputPath(`${kind}-exterior.png`)
        : `/workspace/acorn-${kind}-exterior.png`,
    });
    await page.goto(`/?gallery=home&tier=${kind}&renderer=webgl2&time=0.42`);
    await expect(page.locator('body')).toHaveAttribute('data-gallery-ready', 'true', {
      timeout: 120_000,
    });
    await page.screenshot({
      path: process.env.CI
        ? testInfo.outputPath(`${kind}-interior.png`)
        : `/workspace/acorn-${kind}-interior.png`,
    });
    expect(errors).toEqual([]);
  });
}

test('renders warm cabin windows at night', async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ contentType: 'text/css', body: '' }),
  );
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?gallery=cabin&renderer=webgl2&time=0.02&angle=0.2');
  await expect(page.locator('body')).toHaveAttribute('data-gallery-ready', 'true', {
    timeout: 120_000,
  });
  await page.screenshot({ path: '/workspace/acorn-homecoming-night.png' });
  expect(errors).toEqual([]);
});
