import { expect, test } from '@playwright/test';
import { skipDrawing } from './skip-drawing';

/**
 * The one Craft menu (decision 0096). Rope could not be made because the list
 * ran off the bottom of a laptop screen and the Build menu, which Chris opened
 * instead, never listed it. These check the menu on a laptop-sized screen:
 * everything on screen and reachable, rope and the boat on their Lake page,
 * and C and the number keys picking pieces to place.
 *
 * It needs no walking, so it runs the same however slowly the browser draws.
 */
test.use({ viewport: { width: 1366, height: 768 } });
test.setTimeout(240_000);

test('one Craft menu fits a laptop screen and lists rope with the other things to make', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await skipDrawing(page);
  await page.addInitScript(() => {
    // Count frames actually painted to the game canvas, rather than animation
    // callbacks: the loop kept running even when journal drawing fell to 1 Hz.
    const countClear = (context: WebGL2RenderingContext): void => {
      if (context.canvas instanceof HTMLCanvasElement && context.canvas.id === 'scene') {
        context.canvas.dataset.renderedFrames = String(
          Number(context.canvas.dataset.renderedFrames ?? 0) + 1,
        );
      }
    };
    const clear = WebGL2RenderingContext.prototype.clear;
    WebGL2RenderingContext.prototype.clear = function (mask: number): void {
      countClear(this);
      clear.call(this, mask);
    };
    // Three.js also clears intermediate render targets before presenting them.
    const clearBuffer = WebGL2RenderingContext.prototype.clearBufferfv;
    WebGL2RenderingContext.prototype.clearBufferfv = function (
      ...args: Parameters<typeof clearBuffer>
    ): void {
      countClear(this);
      clearBuffer.apply(this, args);
    };
  });
  await page.goto(`/?renderer=webgl2&world=craft-menu-${Date.now()}`);
  await page.locator('#home-name').fill('Menu Tester');
  await page.locator('.home-play').click();
  await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
  await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
    timeout: 120_000,
  });

  // C opens it, every page of it is on screen, and only the list scrolls.
  await page.keyboard.press('KeyC');
  const panel = page.locator('.craft-panel');
  await expect(panel).toBeVisible();
  const paintedFrames = await page.evaluate(async () => {
    const canvas = document.getElementById('scene')!;
    let previous = canvas.dataset.renderedFrames;
    let painted = 0;
    for (let frame = 0; frame < 30; frame++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const current = canvas.dataset.renderedFrames;
      if (current !== previous) painted++;
      previous = current;
    }
    return painted;
  });
  expect(paintedFrames).toBeGreaterThanOrEqual(25);
  const box = await panel.boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(768);
  const pills = page.locator('.craft-tabs button');
  await expect(pills).toHaveText([
    'All',
    'Tools',
    'Food',
    'Home',
    'Camp',
    'Yard',
    'Lake',
    'Trophies',
  ]);
  const scrolls = await page
    .locator('.craft-list')
    .evaluate((list) => list.scrollHeight > list.clientHeight);
  expect(scrolls).toBe(true);

  // Things you make and things you place are in the same list.
  await expect(page.locator('.hud-journal')).toContainText('Axe');
  await expect(page.locator('.hud-journal')).toContainText('Campfire');
  await expect(page.locator('.hud-journal')).toContainText('Rope');

  // Rope is first on the Lake page, so it is key 1, with the boat beside it.
  await page.locator('.craft-tabs').getByRole('button', { name: 'Lake', exact: true }).click();
  const entries = page.locator('.hud-journal-entry');
  await expect(entries).toHaveCount(2);
  await expect(entries.nth(0)).toContainText('Rope');
  await expect(entries.nth(0)).toContainText('3 reeds');
  await expect(entries.nth(0).locator('.craft-key')).toHaveText('1');
  await expect(entries.nth(1)).toContainText('Rowboat');

  // C closes it again.
  await page.keyboard.press('KeyC');
  await expect(page.locator('.hud-journal')).toHaveCount(0);

  // B toggles the pack and closes the journal; C switches back to the journal.
  await page.keyboard.press('KeyC');
  await expect(panel).toBeVisible();
  await page.keyboard.press('KeyB');
  await expect(panel).toHaveCount(0);
  await expect(page.locator('.inventory-panel')).toBeVisible();
  await page.keyboard.press('KeyB');
  await expect(page.locator('.inventory-panel')).toHaveCount(0);
  await page.keyboard.press('KeyB');
  await expect(page.locator('.inventory-panel')).toBeVisible();
  await page.keyboard.press('KeyC');
  await expect(page.locator('.inventory-panel')).toHaveCount(0);
  await expect(panel).toBeVisible();
  await page.keyboard.press('KeyC');
  await expect(panel).toHaveCount(0);

  // C opens the journal again. A page, then a number,
  // starts placing a piece - even one you cannot afford yet, which shows red.
  await page.keyboard.press('KeyC');
  await expect(panel).toBeVisible();
  await page.locator('.craft-tabs').getByRole('button', { name: 'Camp', exact: true }).click();
  await page.keyboard.press('Digit1');
  await expect(panel).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => window.acornDebug?.buildPreview()?.kind))
    .toBe('campfire');
  // With a piece in hand, another number swaps it for the next one on that page.
  await page.keyboard.press('Digit2');
  await expect
    .poll(() => page.evaluate(() => window.acornDebug?.buildPreview()?.kind))
    .toBe('lantern');
  await page.keyboard.press('Escape');
  await expect
    .poll(() => page.evaluate(() => window.acornDebug?.buildPreview() ?? null))
    .toBeNull();
  expect(errors).toEqual([]);
});
