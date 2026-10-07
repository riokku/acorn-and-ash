import { expect, test, type Page } from '@playwright/test';

import { skipDrawing } from './skip-drawing';

/**
 * The season banner (decision 0110). On the front page and the character screen
 * it is the season's name with a line of advice, up in the corner. In the game it
 * is a ring round the minimap: the whole year in 24 pieces, coloured by season,
 * a badge for the current season, and words only on hover.
 *
 * `?season=` shows the first day of a season, so these can name the season they
 * expect. Which one it is without that switch depends on the date, so the
 * unforced cases only check the banner agrees with the Season line in the game.
 */

const newWorld = (): string => `season-banner-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

/** The seasons in the order they go round the ring, which is where each one's quarter starts. */
const SEASON_ORDER = ['spring', 'summer', 'autumn', 'winter'];
/** What each season's colour comes to once the browser has worked it out. */
const SEASON_COLOURS: Record<string, string> = {
  spring: 'rgb(140, 198, 107)',
  summer: 'rgb(240, 194, 75)',
  autumn: 'rgb(224, 129, 58)',
  winter: 'rgb(140, 199, 236)',
};

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
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
      timeout: 120_000,
    });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-player-name', 'Hazel', {
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
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
      timeout: 120_000,
    });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-player-name', 'Hazel', {
      timeout: 120_000,
    });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
      timeout: 120_000,
    });
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
    // One piece of the ring for each day of the whole year, and today's is lit.
    const today = SEASON_ORDER.indexOf(name.toLowerCase()) * 6 + Number(day);
    await expect(ring.locator('.season-ring-day')).toHaveCount(24);
    await expect(ring.locator('.season-ring-day.is-today')).toHaveCount(1);
    await expect(ring.locator('.season-ring-day.is-past')).toHaveCount(today - 1);
    await expect(ring.locator('.season-ring-day.is-future')).toHaveCount(24 - today);
    await expect(ring.locator('.season-ring-day.is-today')).toHaveAttribute(
      'data-day',
      String(today),
    );
  });

  test('follows ?season= and starts on the first day of it', async ({ page }) => {
    await enterWorld(page, '&season=winter');
    const ring = page.getByTestId('season-ring');
    await expect(ring).toHaveAttribute('data-season', 'winter');
    // First day of winter is day 19 of the year: spring, summer and autumn have all gone.
    await expect(ring.locator('.season-ring-day.is-past')).toHaveCount(18);
    await expect(ring.locator('.season-ring-day.is-today')).toHaveAttribute('data-day', '19');
    await expect(ring.locator('.season-ring-day.is-future')).toHaveCount(5);
  });

  test('colours each quarter of the year for its season', async ({ page }) => {
    await enterWorld(page, '&season=autumn');
    const ring = page.getByTestId('season-ring');
    for (const season of SEASON_ORDER) {
      const pieces = ring.locator(`.season-ring-day[data-season="${season}"]`);
      await expect(pieces).toHaveCount(6);
      // Every piece of a season has that season's colour, whether it has gone, is today or is to come.
      for (let piece = 0; piece < 6; piece += 1) {
        await expect(pieces.nth(piece)).toHaveCSS('stroke', SEASON_COLOURS[season]!);
      }
    }
    // Spring runs first, from the top of the ring, and winter is last.
    await expect(ring.locator('.season-ring-day').first()).toHaveAttribute('data-season', 'spring');
    await expect(ring.locator('.season-ring-day').last()).toHaveAttribute('data-season', 'winter');
  });

  for (const [index, season] of SEASON_ORDER.entries()) {
    test(`puts the ${season} badge in the middle of ${season}'s quarter of the ring`, async ({
      page,
    }) => {
      await enterWorld(page, `&season=${season}`);
      const ring = await page.getByTestId('season-ring').boundingBox();
      const badge = await page.locator('.season-ring-badge').boundingBox();
      expect(ring).not.toBeNull();
      expect(badge).not.toBeNull();
      const dx = badge!.x + badge!.width / 2 - (ring!.x + ring!.width / 2);
      const dy = badge!.y + badge!.height / 2 - (ring!.y + ring!.height / 2);
      // Degrees clockwise from straight up, the way the ring is laid out.
      const degrees = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
      expect(Math.abs(degrees - (index * 90 + 45))).toBeLessThan(2);
      // Outside the ring, not on top of it or the map.
      expect(Math.hypot(dx, dy)).toBeGreaterThan(105);
      // And it shows the icon for the season, which the ring's own class names.
      await expect(page.getByTestId('season-ring')).toHaveClass(
        new RegExp(`season-ring-${season}`),
      );
      await expect(page.locator('.season-ring-badge svg')).toBeVisible();
    });
  }

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
