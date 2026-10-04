import { expect, test, type Page } from '@playwright/test';

/**
 * The seasons (decision 0089): which one it is shows on the Season line, and
 * looking at a season with `?season=` really does change how the world looks.
 *
 * Test sign-in is automatic here, so each test starts as a fresh test player
 * and only has to name a character and press play.
 */

async function enterWorld(page: Page, search: string): Promise<void> {
  await page.goto(`/?renderer=webgl2&world=seasons-${Date.now()}&${search}`);
  await page.locator('#home-name').fill('Hazel');
  await page.locator('.home-play').click();
  await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
}

async function seasonLine(page: Page): Promise<string> {
  const row = page.locator('.hud-row', { hasText: 'Season' }).first();
  return (await row.locator('span').nth(1).innerText()).trim();
}

test('shows which season it is, and which day of it', async ({ page }) => {
  await enterWorld(page, '');
  await expect
    .poll(() => seasonLine(page))
    .toMatch(/^(Spring|Summer|Autumn|Winter), day [1-6] of 6$/);
});

test('winter is snowy, and the first day of it', async ({ page }) => {
  await enterWorld(page, 'season=winter');
  await expect.poll(() => seasonLine(page)).toBe('Winter, day 1 of 6');
  await expect
    .poll(() => page.evaluate(() => window.acornDebug?.snowOnGround() ?? 0))
    .toBeGreaterThan(0.99);
});

test('the other seasons have no snow', async ({ page }) => {
  await enterWorld(page, 'season=summer');
  await expect.poll(() => seasonLine(page)).toBe('Summer, day 1 of 6');
  expect(await page.evaluate(() => window.acornDebug?.snowOnGround() ?? 1)).toBeLessThan(0.01);
});

test('ignores a season that does not exist', async ({ page }) => {
  await enterWorld(page, 'season=monsoon');
  await expect
    .poll(() => seasonLine(page))
    .toMatch(/^(Spring|Summer|Autumn|Winter), day [1-6] of 6$/);
});

function drifting(page: Page) {
  return page.evaluate(
    () => window.acornDebug?.seasonFall() ?? { petals: 0, pollen: 0, leaves: 0, snow: 0 },
  );
}

test('blossom petals drift in spring and nothing else does', async ({ page }) => {
  await enterWorld(page, 'season=spring');
  await expect.poll(async () => (await drifting(page)).petals).toBeGreaterThan(30);
  const air = await drifting(page);
  expect(air.leaves).toBe(0);
  expect(air.snow).toBe(0);
});

test('leaves fall in autumn and nothing else does', async ({ page }) => {
  await enterWorld(page, 'season=autumn');
  await expect.poll(async () => (await drifting(page)).leaves).toBeGreaterThan(30);
  const air = await drifting(page);
  expect(air.petals).toBe(0);
  expect(air.snow).toBe(0);
});

test('snow falls in winter and nothing else does', async ({ page }) => {
  await enterWorld(page, 'season=winter');
  await expect.poll(async () => (await drifting(page)).snow).toBeGreaterThan(60);
  const air = await drifting(page);
  expect(air.petals).toBe(0);
  expect(air.leaves).toBe(0);
});

test('summer has no petals, leaves or snow in the air', async ({ page }) => {
  await enterWorld(page, 'season=summer');
  await expect.poll(() => seasonLine(page)).toBe('Summer, day 1 of 6');
  const air = await drifting(page);
  expect(air.petals).toBe(0);
  expect(air.leaves).toBe(0);
  expect(air.snow).toBe(0);
});

test('nothing falls for someone who asked for less movement', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await enterWorld(page, 'season=winter');
  await expect.poll(() => seasonLine(page)).toBe('Winter, day 1 of 6');
  await expect
    .poll(() => page.evaluate(() => window.acornDebug?.snowOnGround() ?? 0))
    .toBeGreaterThan(0.99);
  expect(await drifting(page)).toEqual({ petals: 0, pollen: 0, leaves: 0, snow: 0 });
});
