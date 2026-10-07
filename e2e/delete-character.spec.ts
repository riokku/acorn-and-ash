import { expect, test, type Page } from '@playwright/test';

import { skipDrawing } from './skip-drawing';

/**
 * Deleting a character and starting again (decision 0108).
 *
 * Test sign-in is automatic, so each test is a fresh test player in a world of
 * its own. The 30-minute fade of the cabin and the rest is covered by the world
 * server's own tests, which can run its clock; what a person can check in a
 * browser is the asking, the typing of the name, and landing back on a fresh
 * character screen.
 */

const newWorld = (): string => `delete-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

/** Make a character called `name` in `world` and stand in the clearing. */
async function makeCharacter(page: Page, world: string, name: string): Promise<void> {
  await page.goto(`/?renderer=webgl2&world=${world}`);
  await page.locator('#home-name').fill(name);
  await page.getByRole('button', { name: 'Enter World' }).click();
  await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
    timeout: 120_000,
  });
  await expect(page.locator('.hud-panel')).toHaveAttribute('data-player-name', `${name}`, {
    timeout: 120_000,
  });
  // The character exists on the server once it has answered.
  await expect(page.locator('.hud-row', { hasText: 'Server' }).first()).toContainText('Connected');
}

test.beforeEach(async ({ page }) => {
  await skipDrawing(page);
});

test.describe('from the Enter World screen', () => {
  test('needs the name typed, then starts again from a blank character screen', async ({
    page,
  }) => {
    const world = newWorld();
    await makeCharacter(page, world, 'Hazel');

    await page.goto(`/?renderer=webgl2&world=${world}`);
    await expect(page.getByTestId('saved-character')).toContainText('Hazel');
    await page.getByRole('button', { name: 'Delete this character' }).click();

    const dialog = page.getByRole('dialog', { name: 'Delete character' });
    await expect(dialog).toContainText('30 minutes');
    const confirm = dialog.getByRole('button', { name: 'Delete forever' });
    await expect(confirm).toBeDisabled();

    // The wrong name, and then Enter: nothing happens, and above all they do not walk into the world.
    const box = dialog.getByLabel(/Type Hazel to confirm/);
    await box.fill('Hazle');
    await expect(confirm).toBeDisabled();
    await box.press('Enter');
    await expect(dialog).toBeVisible();
    await expect(page.locator('.hud-curtain')).toHaveCount(0);

    // Backing out keeps the character.
    await dialog.getByRole('button', { name: 'Keep my character' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId('saved-character')).toContainText('Hazel');

    await page.getByRole('button', { name: 'Delete this character' }).click();
    await page.getByLabel(/Type Hazel to confirm/).fill('hazel');
    await page.getByRole('button', { name: 'Delete forever' }).click();

    // A blank card with a note, not the old name.
    await expect(page.locator('#home-name')).toBeVisible();
    await expect(page.locator('#home-name')).toHaveValue('');
    await expect(page.getByTestId('character-deleted-notice')).toContainText('30 minutes');
    await expect(page.getByTestId('saved-character')).toHaveCount(0);

    // The note is shown once, and the world really has forgotten them.
    await page.goto(`/?renderer=webgl2&world=${world}`);
    await expect(page.locator('#home-name')).toBeVisible();
    await expect(page.getByTestId('character-deleted-notice')).toHaveCount(0);
  });

  test('lets the same account make a different character straight away', async ({ page }) => {
    const world = newWorld();
    await makeCharacter(page, world, 'Hazel');
    await page.evaluate(() =>
      localStorage.setItem(
        'acorn.hotbarLayout',
        JSON.stringify([null, 'rod', 'axe', null, null, null]),
      ),
    );

    await page.goto(`/?renderer=webgl2&world=${world}`);
    await page.getByRole('button', { name: 'Delete this character' }).click();
    await page.getByLabel(/Type Hazel to confirm/).fill('Hazel');
    await page.getByRole('button', { name: 'Delete forever' }).click();
    await expect(page.locator('#home-name')).toBeVisible();

    await page.locator('#home-name').fill('Birch');
    await page.getByRole('button', { name: 'Enter World' }).click();
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
      timeout: 120_000,
    });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-player-name', 'Birch', {
      timeout: 120_000,
    });
    await expect(page.locator('.hud-curtain')).toHaveCount(0);
    await expect(page.locator('.hotbar-slot .hotbar-slot-icon')).toHaveCount(0);
    expect(
      await page.evaluate(() => JSON.parse(localStorage.getItem('acorn.hotbarLayout') ?? 'null')),
    ).toEqual([null, null, null, null, null, null]);
  });
});

test.describe('from Settings, in the world', () => {
  test('is under Account, and ends the game for that character', async ({ page }) => {
    const world = newWorld();
    await makeCharacter(page, world, 'Hazel');
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
      timeout: 120_000,
    });
    await expect(page.locator('.hud-curtain')).toHaveCount(0);

    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const settings = page.getByRole('dialog', { name: 'Settings', exact: true });
    await settings.getByRole('button', { name: 'Delete character…' }).click();

    const confirm = settings.getByRole('button', { name: 'Delete forever' });
    await expect(confirm).toBeDisabled();
    await settings.getByLabel(/Type Hazel to confirm/).fill('Hazel');
    await expect(confirm).toBeEnabled();
    await confirm.click();

    await expect(page.locator('#home-name')).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('#home-name')).toHaveValue('');
    await expect(page.getByTestId('character-deleted-notice')).toBeVisible();
  });
});
