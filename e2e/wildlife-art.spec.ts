import { expect, test } from '@playwright/test';
test.use({ viewport: { width: 1000, height: 800 }, deviceScaleFactor: 0.8 });
for (const [kind, motion] of [
  ['elk', 'idle'],
  ['curiousRaccoon', 'walk'],
  ['woodlandGuardian', 'idle'],
  ['woodlandGuardian', 'windup'],
  ['elk', 'run'],
  ['guardian-trophy', 'idle'],
  ['discovery-raccoonHollow', 'idle'],
] as const) {
  test(`renders the full ${kind} model in ${motion}`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('https://fonts.googleapis.com/**', (route) =>
      route.fulfill({ body: '', contentType: 'text/css' }),
    );
    await page.goto(`/?gallery=${kind}&motion=${motion}&renderer=webgl2`);
    await expect(page.locator('body')).toHaveAttribute('data-gallery-ready', 'true');
    await page.screenshot({
      path: process.env.CI
        ? testInfo.outputPath(`${kind}-${motion}.png`)
        : `/workspace/acorn-${kind}-${motion}.png`,
    });
    expect(errors).toEqual([]);
  });
}
