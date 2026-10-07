import { expect, test, type Page } from '@playwright/test';

import { skipDrawing } from './skip-drawing';

/**
 * The season banner (decision 0110). On the front page and the character screen
 * it is the season's name with a line of advice, up in the corner. In the game it
 * is a ring round the minimap: six pieces, a badge, and words only on hover.
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
    await expect(banner).toContainText('Autumn');
    // No world is chosen here, so no year: the browser clock's "year" is a number like 62201.
    await expect(banner).not.toContainText('Year');
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

test.describe('the front page', () => {
  for (const height of [500, 720, 1000]) {
    test(`has its content in the middle of a ${height} px tall window`, async ({ page }) => {
      await pretendSignedOut(page);
      await page.setViewportSize({ width: 1280, height });
      await page.goto('/?season=summer');
      const copy = await page.locator('.front-copy').boundingBox();
      expect(copy).not.toBeNull();
      const above = copy!.y;
      const below = height - (copy!.y + copy!.height);
      // The same room above the title as below the Play button, give or take a pixel.
      expect(Math.abs(above - below)).toBeLessThanOrEqual(2);
    });
  }
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
    const ring = page.getByTestId('season-ring');
    await expect(ring).toBeVisible();

    const row = page.locator('.hud-row', { hasText: 'Season' }).first();
    const line = (await row.locator('span').nth(1).innerText()).trim();
    const [name, day] = /^(\w+), day (\d) of 6$/.exec(line)!.slice(1) as [string, string];
    await expect(ring).toHaveAttribute('data-season', name.toLowerCase());
    await expect(ring).toHaveAttribute('aria-label', `${name}, day ${day} of 6`);
    // One piece of the ring for each day, and today's is lit.
    await expect(ring.locator('.season-ring-day')).toHaveCount(6);
    await expect(ring.locator('.season-ring-day.is-today')).toHaveCount(1);
    await expect(ring.locator('.season-ring-day.is-past')).toHaveCount(Number(day) - 1);
    await expect(ring.locator('.season-ring-day.is-today')).toHaveAttribute('data-day', day);
  });

  test('follows ?season= and starts on the first day of it', async ({ page }) => {
    await enterWorld(page, '&season=winter');
    const ring = page.getByTestId('season-ring');
    await expect(ring).toHaveAttribute('data-season', 'winter');
    // First day of the season: nothing before today.
    await expect(ring.locator('.season-ring-day.is-past')).toHaveCount(0);
    await expect(ring.locator('.season-ring-day.is-today')).toHaveAttribute('data-day', '1');
  });

  test('goes round the minimap just outside its edge, clear of the zoom buttons', async ({
    page,
  }) => {
    await enterWorld(page, '&season=summer');
    const ring = await page.getByTestId('season-ring').boundingBox();
    const minimap = await page.getByTestId('minimap').boundingBox();
    const buttons = await page.locator('.minimap-buttons').boundingBox();
    const panel = await page.locator('.hud-panel').boundingBox();
    expect(ring).not.toBeNull();
    expect(minimap).not.toBeNull();
    expect(buttons).not.toBeNull();
    expect(panel).not.toBeNull();

    // Centred on the minimap, and only a few pixels bigger than it all round.
    expect(Math.abs(ring!.x + ring!.width / 2 - (minimap!.x + minimap!.width / 2))).toBeLessThan(1);
    expect(Math.abs(ring!.y + ring!.height / 2 - (minimap!.y + minimap!.height / 2))).toBeLessThan(
      1,
    );
    expect(ring!.width - minimap!.width).toBeLessThanOrEqual(16);
    // The zoom buttons sit under the ring rather than on it.
    expect(buttons!.y).toBeGreaterThanOrEqual(ring!.y + ring!.height - 4);
    // And the debug panel is down the left edge, far from it all.
    expect(ring!.x).toBeGreaterThan(panel!.x + panel!.width);
  });

  test('says the season and the day in words when you point at it', async ({ page }) => {
    await enterWorld(page, '&season=autumn');
    const tip = page.locator('.season-ring-tip');
    // No words until somebody asks.
    await expect(tip).toHaveCSS('opacity', '0');

    await page.locator('.season-ring-badge').hover();
    await expect(tip).toHaveCSS('opacity', '1');
    await expect(tip).toHaveText('Autumn · Day 1 of 6');

    // The ring itself works too, not only the badge: point at its right-hand side.
    await page.mouse.move(0, 0);
    await expect(tip).toHaveCSS('opacity', '0');
    const minimap = await page.getByTestId('minimap').boundingBox();
    await page.mouse.move(minimap!.x + minimap!.width / 2 + 96.5, minimap!.y + minimap!.height / 2);
    await expect(tip).toHaveCSS('opacity', '1');
  });

  test("makes today's piece pulse and no other", async ({ page }) => {
    await enterWorld(page, '&season=spring');
    const ring = page.getByTestId('season-ring');
    await expect(ring.locator('.season-ring-day.is-today')).toHaveCSS(
      'animation-name',
      'season-ring-pulse',
    );
    await expect(ring.locator('.season-ring-day.is-future').first()).toHaveCSS(
      'animation-name',
      'none',
    );
  });

  test('goes away with the minimap when the map opens', async ({ page }) => {
    await enterWorld(page, '&season=autumn');
    await expect(page.getByTestId('season-ring')).toBeVisible();
    await page.locator('.minimap-key').click();
    await expect(page.getByTestId('minimap')).toHaveCount(0);
    await expect(page.getByTestId('season-ring')).toHaveCount(0);
  });
});
