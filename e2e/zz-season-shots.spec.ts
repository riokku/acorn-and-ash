import { expect, test, type Page } from '@playwright/test';

// A helper for taking the screenshots that go in a pull request, not a check. It
// only runs when SHOT_DIR names a folder: `SHOT_DIR=/some/folder pnpm test:e2e zz-season-shots`.
const OUT = process.env.SHOT_DIR ?? '';
test.skip(!OUT, 'Screenshot helper: set SHOT_DIR to run it');
const world = (): string => `shots-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

async function signedOut(page: Page): Promise<void> {
  await page.route('**/api/session', (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({ json: { signedIn: false, providers: ['google'], testSignIn: null } });
  });
}

test.use({ viewport: { width: 1280, height: 720 } });
test.setTimeout(240_000);

test('front page autumn', async ({ page }) => {
  await signedOut(page);
  await page.goto('/?season=autumn');
  await expect(page.getByTestId('season-banner')).toBeVisible();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/banner-front-autumn.png` });
});

test('making wide spring', async ({ page }) => {
  await page.goto(`/?renderer=webgl2&world=${world()}&season=spring`);
  await expect(page.getByTestId('character-stage')).toHaveAttribute('data-state', 'ready', {
    timeout: 90_000,
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/banner-making-spring.png` });
});

test('welcome winter and in game', async ({ page }) => {
  const w = world();
  await page.goto(`/?renderer=webgl2&world=${w}`);
  await page.locator('#home-name').fill('Hazel');
  await page.getByRole('button', { name: 'Enter World' }).click();
  await expect(page.locator('.hud-curtain')).toContainText('Welcome, Hazel', { timeout: 120_000 });
  await page.goto(`/?renderer=webgl2&world=${w}&season=winter`);
  await expect(page.getByTestId('saved-character')).toContainText('Hazel');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/banner-welcome-winter.png` });
  for (const season of ['autumn', 'winter', 'spring', 'summer']) {
    await page.goto(`/?renderer=webgl2&world=${w}&season=${season}`);
    await page.getByRole('button', { name: 'Enter World' }).click();
    await expect(page.locator('.hud-curtain')).toContainText('Welcome, Hazel', {
      timeout: 120_000,
    });
    await page.locator('.hud-curtain').click();
    await expect(page.locator('.hud-curtain')).toHaveCount(0);
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${OUT}/banner-game-${season}.png` });
  }
});
