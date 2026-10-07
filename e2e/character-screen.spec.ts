import { expect, test as base, type Locator, type Page } from '@playwright/test';

import { skipDrawing } from './skip-drawing';

/**
 * The character screen (decision 0107): the player's own character standing in
 * front of the painting, turned by dragging, giving a flourish when clicked, and
 * an Enter World button to go in.
 *
 * Test sign-in is automatic here, so each test starts as a fresh test player
 * and lands straight on the screen. Most tests skip the real drawing, as every
 * game test does (decision 0100): what they check is what the character was
 * told to do, which the stage reports on its canvas. The one tagged
 * `@real-drawing` checks that the character really is drawn.
 */
const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    if (!testInfo.tags.includes('@real-drawing')) await skipDrawing(page);
    await use(page);
  },
});

const newWorld = (): string => `stage-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

async function openScreen(page: Page, world = newWorld(), search = ''): Promise<Locator> {
  await page.goto(`/?renderer=webgl2&world=${world}${search}`);
  const stage = page.getByTestId('character-stage');
  await expect(stage).toHaveAttribute('data-state', 'ready', { timeout: 60_000 });
  return stage;
}

/** Press on the middle of the character, move across by `dx` pixels, and let go. */
async function dragAcross(page: Page, stage: Locator, dx: number): Promise<void> {
  const box = await stage.boundingBox();
  if (box === null) throw new Error('The character stage is not on the page.');
  const x = box.x + box.width * 0.3;
  const y = box.y + box.height * 0.5;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y, { steps: 4 });
  await page.mouse.move(x + dx, y, { steps: 4 });
  await page.mouse.up();
}

async function clickCharacter(page: Page, stage: Locator): Promise<void> {
  const box = await stage.boundingBox();
  if (box === null) throw new Error('The character stage is not on the page.');
  await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.5);
}

test.describe('making a character', () => {
  test('shows the character you are choosing, and changes it as you choose', async ({ page }) => {
    const stage = await openScreen(page);
    await expect(stage).toHaveAttribute('data-character', 'knight');
    await expect(page.locator('.home-play')).toHaveText('Enter World');

    await page.getByRole('button', { name: 'Body 3' }).click();
    await expect(stage).toHaveAttribute('data-character', 'mage');

    await page.getByRole('button', { name: 'Body 4' }).click();
    await expect(stage).toHaveAttribute('data-character', 'ranger');
  });

  test('writes the name you are typing under the character', async ({ page }) => {
    await openScreen(page);
    const caption = page.locator('.stage-caption');
    await expect(caption).toContainText('Your name');

    await page.locator('#home-name').fill('Hazel');
    await expect(caption).toContainText('Hazel');
    await expect(caption).toContainText('Body 1');
  });

  test('goes into the world, by name, with Enter World', async ({ page }) => {
    await openScreen(page);
    await page.locator('#home-name').fill('Hazel');
    await page.getByRole('button', { name: 'Enter World' }).click();

    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
      timeout: 120_000,
    });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-player-name', 'Hazel', {
      timeout: 120_000,
    });
    await expect(page.getByTestId('character-stage')).toHaveCount(0);
  });
});

test.describe('showing the character off', () => {
  test('turns when dragged, to the right for a drag to the right', async ({ page }) => {
    const stage = await openScreen(page);
    await expect(stage).toHaveAttribute('data-turn', '0');

    await dragAcross(page, stage, 140);
    // 560 pixels is a whole turn, so 140 is a quarter of one.
    await expect(stage).toHaveAttribute('data-turn', '90');
    await expect(stage).toHaveAttribute('data-flourishes', '0');

    await dragAcross(page, stage, -140);
    await expect(stage).toHaveAttribute('data-turn', '0');
  });

  test('gives a flourish when clicked, and is not turned by the click', async ({ page }) => {
    const stage = await openScreen(page);
    await clickCharacter(page, stage);
    await expect(stage).toHaveAttribute('data-flourishes', '1');
    await expect(stage).toHaveAttribute('data-turn', '0');
  });

  test('can be turned and made to flourish from the keyboard', async ({ page }) => {
    const stage = await openScreen(page);
    await stage.focus();

    await page.keyboard.press('ArrowRight');
    await expect(stage).toHaveAttribute('data-turn', '15');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(stage).toHaveAttribute('data-turn', '-15');

    await page.keyboard.press('Space');
    await expect(stage).toHaveAttribute('data-flourishes', '1');
  });

  test('keeps the way it was turned when the tint is changed', async ({ page }) => {
    const stage = await openScreen(page);
    await dragAcross(page, stage, 70);
    await expect(stage).toHaveAttribute('data-turn', '45');

    const tint = await stage.getAttribute('data-tint');
    await page.locator('[aria-label^="Tint: "]').nth(1).click();
    await expect(stage).not.toHaveAttribute('data-tint', tint ?? '');
    await expect(stage).toHaveAttribute('data-turn', '45');
  });

  test.describe('for somebody who asked for less motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('still turns, and still gives a flourish when asked', async ({ page }) => {
      const stage = await openScreen(page);
      await dragAcross(page, stage, 70);
      await expect(stage).toHaveAttribute('data-turn', '45');
      await clickCharacter(page, stage);
      await expect(stage).toHaveAttribute('data-flourishes', '1');
    });
  });
});

test.describe('coming back', () => {
  test('welcomes you to your own character, shown off the same way', async ({ page }) => {
    const world = newWorld();
    await openScreen(page, world);
    await page.getByRole('button', { name: 'Body 2' }).click();
    await page.locator('#home-name').fill('Hazel');
    await page.getByRole('button', { name: 'Enter World' }).click();
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
      timeout: 120_000,
    });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-player-name', 'Hazel', {
      timeout: 120_000,
    });

    const stage = await openScreen(page, world);
    await expect(page.getByTestId('saved-character')).toContainText('Hazel');
    await expect(stage).toHaveAttribute('data-character', 'barbarian');
    await expect(page.locator('#home-name')).toHaveCount(0);

    await dragAcross(page, stage, 140);
    await expect(stage).toHaveAttribute('data-turn', '90');

    await page.getByRole('button', { name: 'Enter World' }).click();
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
      timeout: 120_000,
    });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-player-name', 'Hazel', {
      timeout: 120_000,
    });
  });
});

test.describe('on a screen that cannot draw it', () => {
  test('carries on without the character, and still lets you in', async ({ page }) => {
    // Only the stage's own canvas is refused a drawing surface; the game keeps its own.
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        ...args: Parameters<typeof original>
      ) {
        if (this.classList.contains('character-stage-canvas')) return null;
        return original.apply(this, args);
      } as typeof original;
    });
    await page.goto(`/?renderer=webgl2&world=${newWorld()}`);

    await expect(page.getByTestId('character-stage')).toHaveAttribute('data-state', 'unavailable', {
      timeout: 60_000,
    });
    await page.locator('#home-name').fill('Hazel');
    await page.getByRole('button', { name: 'Enter World' }).click();
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
      timeout: 120_000,
    });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-player-name', 'Hazel', {
      timeout: 120_000,
    });
  });
});

test.describe('drawing', () => {
  test(
    'puts the character on the screen, over the painting',
    { tag: '@real-drawing' },
    async ({ page }) => {
      const stage = await openScreen(page);
      await page.locator('#home-name').fill('Hazel');
      // Let the character settle and the painting finish fading in.
      await page.waitForTimeout(2000);

      const box = await stage.boundingBox();
      if (box === null) throw new Error('The character stage is not on the page.');
      const where = {
        x: box.x + box.width * 0.18,
        y: box.y + box.height * 0.2,
        width: box.width * 0.24,
        height: box.height * 0.65,
      };
      const withCharacter = await page.screenshot({ clip: where, animations: 'disabled' });
      await stage.evaluate((canvas) => (canvas.style.visibility = 'hidden'));
      const without = await page.screenshot({ clip: where, animations: 'disabled' });

      // Hiding the character's canvas must change the picture: it was really drawn there.
      expect(withCharacter.equals(without)).toBe(false);
    },
  );
});
