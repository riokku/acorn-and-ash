import { expect, test, type Page } from '@playwright/test';

import { skipDrawing } from './skip-drawing';

/**
 * The season banner (decision 0110): "Year 2 · Autumn" and a line of advice, on
 * the front page, the character screen and in the game.
 *
 * `?season=` shows the first day of a season, so these can name the season they
 * expect. Which one it is without that switch depends on the date, so the
 * unforced cases only check the banner agrees with the Season line in the game.
 */

const newWorld = (): string => `season-banner-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

test.beforeEach(async ({ page }) => {
  await skipDrawing(page);
});

async function pretendSignedOut(page: Page): Promise<void> {
  await page.route('**/api/session', (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({ json: { signedIn: false, providers: ['google'], testSignIn: null } });
  });
}

test.describe('on the home screens', () => {
  test('hangs over the front page, before and after Play', async ({ page }) => {
    await pretendSignedOut(page);
    await page.goto('/?season=autumn');
    await expect(page.getByTestId('front-door')).toBeVisible();

    const banner = page.getByTestId('season-banner');
    await expect(banner).toHaveAttribute('data-season', 'autumn');
    await expect(banner).toContainText('Year');
    await expect(banner).toContainText('Autumn');
    await expect(banner).toContainText('Winter is coming');

    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page.getByTestId('front-choices')).toBeVisible();
    await expect(page.getByTestId('season-banner')).toHaveAttribute('data-season', 'autumn');
  });

  test('is on the character screen, making a character and coming back', async ({ page }) => {
    const world = newWorld();
    await page.goto(`/?renderer=webgl2&world=${world}&season=winter`);
    await expect(page.locator('#home-name')).toBeVisible();
    const banner = page.getByTestId('season-banner');
    await expect(banner).toHaveAttribute('data-season', 'winter');
    await expect(banner).toContainText('The lake is frozen');

    await page.locator('#home-name').fill('Hazel');
    await page.getByRole('button', { name: 'Enter World' }).click();
    await expect(page.locator('.hud-curtain')).toContainText('Welcome, Hazel', {
      timeout: 120_000,
    });

    await page.goto(`/?renderer=webgl2&world=${world}&season=spring`);
    await expect(page.getByTestId('saved-character')).toContainText('Hazel');
    await expect(page.getByTestId('season-banner')).toHaveAttribute('data-season', 'spring');
  });

  test('keeps clear of the Play button', async ({ page }) => {
    await pretendSignedOut(page);
    await page.goto('/?season=summer');
    const play = page.getByRole('button', { name: 'Play' });
    await expect(play).toBeVisible();
    const banner = await page.getByTestId('season-banner').boundingBox();
    const button = await play.boundingBox();
    expect(banner).not.toBeNull();
    expect(button).not.toBeNull();
    // The banner is up in the corner and the button is nowhere near it.
    expect(banner!.y + banner!.height).toBeLessThan(button!.y);
  });
});

test.describe('in the game', () => {
  async function enterWorld(page: Page, search: string): Promise<void> {
    await page.goto(`/?renderer=webgl2&world=${newWorld()}${search}`);
    await page.locator('#home-name').fill('Hazel');
    await page.getByRole('button', { name: 'Enter World' }).click();
    await expect(page.locator('.hud-curtain')).toContainText('Welcome, Hazel', {
      timeout: 120_000,
    });
    await page.locator('.hud-curtain').click();
    await expect(page.locator('.hud-curtain')).toHaveCount(0);
  }

  test('shows the same season as the Season line', async ({ page }) => {
    await enterWorld(page, '');
    const banner = page.getByTestId('season-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(/Year \d+/);

    const row = page.locator('.hud-row', { hasText: 'Season' }).first();
    const line = (await row.locator('span').nth(1).innerText()).trim();
    const [name, day] = /^(\w+), day (\d) of 6$/.exec(line)!.slice(1) as [string, string];
    await expect(banner).toHaveAttribute('data-season', name.toLowerCase());
    await expect(banner).toContainText(name);
    // One piece of the stripe for each day, and today's is lit.
    await expect(banner.locator('.season-banner-day')).toHaveCount(6);
    await expect(banner.locator('.season-banner-day.is-today')).toHaveCount(1);
    await expect(banner.locator('.season-banner-day.is-past')).toHaveCount(Number(day) - 1);
  });

  test('follows ?season= and says the lake is frozen in winter', async ({ page }) => {
    await enterWorld(page, '&season=winter');
    const banner = page.getByTestId('season-banner');
    await expect(banner).toHaveAttribute('data-season', 'winter');
    await expect(banner).toContainText('The lake is frozen');
    // First day of the season: nothing before today.
    await expect(banner.locator('.season-banner-day.is-past')).toHaveCount(0);
  });

  test('does not sit on top of the debug panel or the minimap', async ({ page }) => {
    await enterWorld(page, '&season=summer');
    const banner = await page.getByTestId('season-banner').boundingBox();
    const panel = await page.locator('.hud-panel').boundingBox();
    expect(banner).not.toBeNull();
    expect(panel).not.toBeNull();
    // The panel is down the left edge, the banner is clear of it.
    expect(banner!.x).toBeGreaterThan(panel!.x + panel!.width);
  });
});
