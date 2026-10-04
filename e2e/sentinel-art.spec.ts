import { expect, test } from '@playwright/test';
test.use({ viewport: { width: 1180, height: 740 }, deviceScaleFactor: 0.75 });
for (const demo of ['attack', 'strike'])
  test(`renders the sentinel's animated ${demo} with its crown and weapon`, async ({
    page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('https://fonts.googleapis.com/**', (r) =>
      r.fulfill({ body: '', contentType: 'text/css' }),
    );
    await page.goto(
      `/?gallery=raiders&kind=sentinel&demo=${demo}&strip=6&distance=11&renderer=webgl2`,
    );
    await expect(page.locator('body')).toHaveAttribute('data-gallery-ready', 'true', {
      timeout: 120_000,
    });
    await page.screenshot({
      path: process.env.CI
        ? testInfo.outputPath(`sentinel-${demo}.png`)
        : `/workspace/acorn-sentinel-${demo}.png`,
    });
    expect(errors).toEqual([]);
  });
