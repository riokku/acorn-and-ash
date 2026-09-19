import { expect, test, type Page } from '@playwright/test';

declare global {
  interface Window {
    acornDebug?: {
      selfNetId(): number;
      localPosition(): { x: number; y: number; z: number };
      remotePlayers(): Array<{ netId: number; x: number; y: number; z: number }>;
    };
  }
}

/** Read one labelled row out of the HUD panel. */
async function hudValue(page: Page, label: string): Promise<string> {
  const row = page.locator('.hud-row', { hasText: label }).first();
  return (await row.locator('span').nth(1).innerText()).trim();
}

async function waitForConnected(page: Page): Promise<void> {
  await expect(page.locator('.hud-row', { hasText: 'Server' }).first()).toContainText('Connected');
}

/** Hold a key for a while, the way a person would. */
async function hold(page: Page, key: string, ms: number): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

function positionOf(text: string): { x: number; z: number } {
  const [x, z] = text.split(',').map((part) => Number(part.trim()));
  return { x: x ?? 0, z: z ?? 0 };
}

test('the game loads, connects and draws the clearing', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  await waitForConnected(page);

  // The curtain only lifts once the world has been built.
  await expect(page.locator('.hud-curtain')).toContainText('Click to play');

  const backend = await hudValue(page, 'Renderer');
  expect(backend).toMatch(/WebGPU|WebGL 2/);
  console.log(`Renderer backend in this browser: ${backend}`);

  // Something is actually being drawn.
  await expect.poll(async () => Number(await hudValue(page, 'FPS'))).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('the WebGL 2 fallback works when WebGPU is refused', async ({ page }) => {
  await page.goto('/?renderer=webgl2');
  await waitForConnected(page);
  expect(await hudValue(page, 'Renderer')).toContain('WebGL 2');
});

test('walking moves the player, and the server agrees', async ({ page }) => {
  await page.goto('/');
  await waitForConnected(page);

  const before = positionOf(await hudValue(page, 'Position'));
  await page.locator('.hud-curtain').click();
  await hold(page, 'KeyW', 1200);
  await page.waitForTimeout(400);

  const after = positionOf(await hudValue(page, 'Position'));
  // Walking forward is walking down -Z.
  expect(after.z).toBeLessThan(before.z - 1);

  // The server is not fighting the client about where the player is.
  const correction = Number((await hudValue(page, 'Correction')).replace(' cm', ''));
  expect(correction).toBeLessThan(50);
});

test('two tabs see each other move', async ({ browser }) => {
  const walker = await browser.newPage();
  const watcher = await browser.newPage();

  await walker.goto('/');
  await watcher.goto('/');
  await waitForConnected(walker);
  await waitForConnected(watcher);

  // Each tab should be told there are two players in the world.
  await expect.poll(async () => Number(await hudValue(watcher, 'Players'))).toBe(2);
  await expect.poll(async () => Number(await hudValue(walker, 'Players'))).toBe(2);

  // A background tab stops animating, so bring each one to the front before
  // asking it to do anything, the way a person switching windows would.
  await walker.bringToFront();
  await walker.locator('.hud-curtain').click();
  const walkerStart = await walker.evaluate(() => window.acornDebug?.localPosition());
  await hold(walker, 'KeyW', 1500);
  await walker.waitForTimeout(400);
  const walkerEnd = await walker.evaluate(() => window.acornDebug?.localPosition());

  expect(walkerEnd?.z).toBeLessThan((walkerStart?.z ?? 0) - 1);

  // Now look at the same thing from the other tab.
  await watcher.bringToFront();
  await expect
    .poll(async () => {
      const others = await watcher.evaluate(() => window.acornDebug?.remotePlayers() ?? []);
      return others[0]?.z ?? 0;
    })
    .toBeLessThan((walkerStart?.z ?? 0) - 1);

  await walker.close();
  await watcher.close();
});

test('sprinting covers more ground than walking', async ({ page }) => {
  await page.goto('/');
  await waitForConnected(page);
  await page.locator('.hud-curtain').click();

  const beforeWalk = positionOf(await hudValue(page, 'Position'));
  await hold(page, 'KeyW', 1000);
  await page.waitForTimeout(500);
  const afterWalk = positionOf(await hudValue(page, 'Position'));

  await page.keyboard.down('Shift');
  await hold(page, 'KeyW', 1000);
  await page.keyboard.up('Shift');
  await page.waitForTimeout(500);
  const afterSprint = positionOf(await hudValue(page, 'Position'));

  const walked = beforeWalk.z - afterWalk.z;
  const sprinted = afterWalk.z - afterSprint.z;
  expect(walked).toBeGreaterThan(1);
  // Sprinting is 7 m/s against 4.5, so roughly half again as far in the same time.
  expect(sprinted).toBeGreaterThan(walked * 1.2);
});

test('jumping lifts the player off the ground and puts them back', async ({ page }) => {
  await page.goto('/');
  await waitForConnected(page);
  await page.locator('.hud-curtain').click();

  const heightNow = async (): Promise<number> =>
    (await page.evaluate(() => window.acornDebug?.localPosition()))?.y ?? 0;
  expect(await heightNow()).toBeLessThan(0.01);

  // Holding Space hops over and over, so there is plenty of air time to catch.
  await page.keyboard.down('Space');
  await expect.poll(heightNow).toBeGreaterThan(0.5);
  await page.keyboard.up('Space');

  // And the player comes down on their own, without being told to.
  await expect.poll(heightNow).toBeLessThan(0.01);
});
