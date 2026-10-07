import {
  expect,
  test as base,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test';

import {
  CLEARING_TREE_LINE_INNER,
  PLAYABLE_HALF_EXTENT,
  PROP_KINDS,
  type PropKindId,
} from '../packages/shared/src/index';
import { skipDrawing } from './skip-drawing';

declare global {
  interface Window {
    acornDebug?: {
      selfNetId(): number;
      selectedTargetId(): number | null;
      grassClumps(): number;
      combatMove(): { kind: number; age: number; grounded: boolean };
      buriedCaches(): Array<{ id: number; ownerNetId: number | null; x: number; z: number }>;
      weatherEffects(): { rainDrops: number; fireflies: number };
      snowOnGround(): number;
      seasonFall(): { petals: number; pollen: number; leaves: number; snow: number };
      buildBoundaryVisible(): boolean;
      screenPoint(x: number, y: number, z: number): { x: number; y: number } | null;
      localPosition(): { x: number; y: number; z: number };
      remotePlayers(): Array<{ netId: number; x: number; y: number; z: number }>;
      remoteEquippedItem(netId: number): string | null;
      animals(): Array<{ id: number; kind: string; x: number; y: number; z: number }>;
      carrying(): Array<{ item: string; count: number }>;
      equippedItem(): string | null;
      takenPickups(): number[];
      pickups(): Array<{ id: number; item: string; x: number; z: number }>;
      gatherSpots(): Array<{ id: number; x: number; z: number; item: string; remaining: number }>;
      droppedPiles(): Array<{ id: number; item: string; count: number; x: number; z: number }>;
      nearbyItem(): string | null;
      nearbyPile(): { item: string; count: number } | null;
      nearGatherSpot(): string | null;
      toasts(): Array<{ item: string; count: number }>;
      felledTrees(): number[];
      treeGenerations(): Array<{ id: number; generation: number }>;
      trees(): Array<{ id: number; kind: string; x: number; z: number; swingsToFell: number }>;
      aimedTree(): { name: string; swingsLeft: number } | null;
      aimedAnimal(): { name: string; hitsLeft?: number } | null;
      canBuild(): boolean;
      buildMenuOpen(): boolean;
      craftMenuOpen(): boolean;
      builtProps(): Array<{
        id: number;
        kind: string;
        x: number;
        z: number;
        yaw: number;
        lit: boolean;
        yours: boolean;
        occupied?: boolean;
      }>;
      boats(): {
        moored: number;
        rowed: Array<{ netId: number; x: number; z: number; yaw: number }>;
      };
      buildPreview(): {
        kind: string;
        spot: { x: number; z: number; yaw: number } | null;
        refusal: string | null;
      } | null;
      faceTowards(x: number, z: number): void;
      pond(): Array<{ x: number; z: number; radius: number }>;
      lake(): { basin: Array<{ x: number; z: number; radius: number }>; islands: string[] };
      lakeFrozen(): boolean;
      canCast(): boolean;
      fishing(): 'waiting' | 'biting' | 'reeling' | null;
      fishingNews(): string | null;
      hunger(): number;
      hungerNews(): string | null;
      health(): number;
      healthNews(): string | null;
      craftingNews(): string | null;
      huntingNews(): string | null;
      discardNews(): string | null;
      mapState(): { painted: boolean; open: boolean; explored: number };
    };
  }
}

/** Every test's own page, with the drawing skipped unless it is about the drawing. */
const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    if (!testInfo.tags.includes('@real-drawing')) await skipDrawing(page);
    await use(page);
  },
});

/** A second tab in its own window, the way the tests that open several want them. */
async function openTab(browser: Browser): Promise<Page> {
  const tab = await browser.newPage();
  await skipDrawing(tab);
  return tab;
}

/** A browser of its own, so a later visit is the same player coming back. */
async function openBrowserContext(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext();
  await skipDrawing(context);
  return context;
}

/** Read one labelled row out of the HUD panel. */
async function hudValue(page: Page, label: string): Promise<string> {
  const row = page.locator('.hud-row', { hasText: label }).first();
  return (await row.locator('span').nth(1).innerText()).trim();
}

/**
 * Get past the Home screen, if it is currently showing.
 *
 * A new player types a name and presses play. A player who already made their
 * character in this world (a second visit in the same browser) is welcomed back
 * to it instead, and just presses play. Every test that used to open straight
 * into the game lands here first, so this is the one place that change had to
 * be taught to the whole suite - see the dedicated tests further down for the
 * Home screen itself.
 */
async function passThroughHomeIfShown(page: Page): Promise<void> {
  const nameInput = page.locator('#home-name');
  const welcomeBack = page.getByTestId('saved-character');
  const shown = await Promise.race([
    nameInput.waitFor({ state: 'visible', timeout: 3000 }).then(() => 'new' as const),
    welcomeBack.waitFor({ state: 'visible', timeout: 3000 }).then(() => 'returning' as const),
  ]).catch(() => null);
  if (shown === null) return;

  if (shown === 'new') await nameInput.fill('Playtester');
  await page.locator('.home-play').click();
}

async function waitForConnected(page: Page): Promise<void> {
  await passThroughHomeIfShown(page);
  await expect(page.locator('.hud-row', { hasText: 'Server' }).first()).toContainText('Connected');
}

/** Hold a key for a while, the way a person would. */
async function hold(page: Page, key: string, ms: number): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

/**
 * Move Playwright's own mouse to the middle of the screen.
 *
 * The mouse is free now (decision 0050), and a left click turns the character
 * to face whatever is under it before it is read as a swing or a cast
 * (decision 0051) - exactly what a real player clicking their target would
 * do. Playwright's virtual mouse otherwise sits wherever it was last left, or
 * at (0, 0) if it was never moved at all, and a swing clicked from the corner
 * of the screen would turn the character that way instead of towards whatever
 * `faceTowards` just lined the camera up with.
 */
async function centerMouse(page: Page): Promise<void> {
  const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
  await page.mouse.move(viewport.width / 2, viewport.height / 2);
}

function positionOf(text: string): { x: number; z: number } {
  const [x, z] = text.split(',').map((part) => Number(part.trim()));
  return { x: x ?? 0, z: z ?? 0 };
}

test.describe('the Home screen', () => {
  test('shows a name field and a character picker, all six unlocked', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#home-name')).toBeVisible();

    const characters = page.locator('.home-character');
    await expect(characters).toHaveCount(6);
    for (const character of await characters.all()) {
      await expect(character).toBeEnabled();
    }
    await expect(page.locator('.home-character-soon')).toHaveCount(0);
  });

  test('will not let you in without typing a real name', async ({ page }) => {
    await page.goto('/');
    const playButton = page.locator('.home-play');

    await expect(playButton).toBeDisabled();
    await page.locator('#home-name').fill('A');
    await expect(playButton).toBeDisabled();

    await page.locator('#home-name').fill('Acorn');
    await expect(playButton).toBeEnabled();
  });

  test('carries the chosen name into the game', async ({ page }) => {
    await page.goto('/');
    await page.locator('#home-name').fill('Chestnut');
    await page.locator('.home-play').click();

    await expect(page.locator('.hud-row', { hasText: 'Server' }).first()).toContainText(
      'Connected',
    );
    await expect(page.locator('.hud-curtain')).toContainText('Welcome, Chestnut');
  });
});

test.describe('the Settings menu', () => {
  test('adjusts volume and sensitivity from the Home screen, and remembers the choice', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('#home-name')).toBeVisible();

    await page.locator('.settings-button').click();
    const card = page.locator('.settings-card');
    await expect(card).toContainText('Music volume');
    await expect(card).toContainText('Sound effects volume');
    await expect(card).toContainText('Mouse sensitivity');

    // The Home key jumps a range input straight to its minimum - a reliable
    // way to change one without depending on drag gestures.
    const musicRow = card.locator('.settings-row', { hasText: 'Music volume' });
    await musicRow.locator('input[type="range"]').press('Home');
    await expect(musicRow.locator('.settings-row-value')).toHaveText('0%');

    await page.locator('.settings-close').click();
    await expect(card).toBeHidden();

    // Reloading is a fresh page load - the choice only really persisted if it
    // reads back from storage rather than whatever the defaults would be.
    await page.reload();
    const stored = await page.evaluate(() => localStorage.getItem('acorn.preferences'));
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored ?? '{}').musicVolume).toBe(0);
  });

  test('is reachable once inside the world too, from the paused curtain', async ({ page }) => {
    await page.goto('/');
    await waitForConnected(page);
    await page.locator('.hud-curtain').click();
    await expect(page.locator('.hud-curtain')).toBeHidden();

    // Escape backs all the way out to the curtain, gear included, once no
    // craft, build or inventory panel is open to close first - see decision
    // 0050. The mouse is free throughout now, so there is no pointer lock
    // for this to release the way there used to be.
    await page.keyboard.press('Escape');
    await expect(page.locator('.hud-curtain')).toBeVisible();

    await page.locator('.settings-button').click();
    await expect(page.locator('.settings-card')).toContainText('Mouse sensitivity');
  });
});

test(
  'the game loads, connects and draws the clearing',
  { tag: '@real-drawing' },
  async ({ page }) => {
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
  },
);

test('the map fills in around you, and M opens it over the game', async ({ page }) => {
  await page.goto('/');
  await waitForConnected(page);
  await page.locator('.hud-curtain').click();
  await expect(page.locator('.hud-curtain')).toBeHidden();

  // The minimap is up, and the ground around the start is already marked seen.
  await expect(page.getByTestId('minimap')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.acornDebug?.mapState().explored ?? 0))
    .toBeGreaterThan(0);

  await page.keyboard.press('KeyM');
  await expect(page.getByTestId('world-map')).toBeVisible();
  await expect(page.getByTestId('minimap')).toBeHidden();

  // Escape puts the map away first, rather than pausing - see decision 0054.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('world-map')).toBeHidden();
  await expect(page.locator('.hud-curtain')).toBeHidden();
  await expect(page.getByTestId('minimap')).toBeVisible();
});

test(
  'the WebGL 2 fallback works when WebGPU is refused',
  { tag: '@real-drawing' },
  async ({ page }) => {
    await page.goto('/?renderer=webgl2');
    await waitForConnected(page);
    expect(await hudValue(page, 'Renderer')).toContain('WebGL 2');
  },
);

test('shows whether it is day or night', async ({ page }) => {
  await page.goto('/');
  await waitForConnected(page);
  // Not a test of the 20-minute cycle itself - just that the HUD is actually
  // showing a value the server's clock produced, one way or the other.
  expect(await hudValue(page, 'Time')).toMatch(/^(Day|Night)$/);
});

test('walking moves the player, and the server agrees', async ({ page }) => {
  await page.goto('/');
  await waitForConnected(page);
  // Connecting can precede model loading; the loading curtain has no play handler.
  await expect(page.locator('.hud-curtain')).toContainText('Click to play', { timeout: 120_000 });

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
  const walker = await openTab(browser);
  const watcher = await openTab(browser);

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

test('dodging moves you a decisive step, on command', async ({ page }) => {
  await page.goto('/');
  await waitForConnected(page);
  await page.locator('.hud-curtain').click();

  const before = positionOf(await hudValue(page, 'Position'));
  await hold(page, 'ControlLeft', 100);

  // A roll carries you 4 m in under half a second once the server sees the
  // button, so this only needs a tap - not the long hold a walk or a sprint would.
  await expect
    .poll(async () => {
      const after = positionOf(await hudValue(page, 'Position'));
      return Math.hypot(after.x - before.x, after.z - before.z);
    })
    .toBeGreaterThan(3);
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

test('walking away from the clearing leads into generated wilderness, not a wall', async ({
  page,
}) => {
  await page.goto('/');
  await waitForConnected(page);
  await page.locator('.hud-curtain').click();

  // Straight out from the clearing, away from its own ring of trees, which
  // stops around 40 m out.
  await page.evaluate(() => window.acornDebug?.faceTowards(0, -400));

  const positionNow = async (): Promise<{ x: number; y: number; z: number }> =>
    (await page.evaluate(() => window.acornDebug?.localPosition())) ?? { x: 0, y: 0, z: 0 };

  let sawHills = false;
  await page.keyboard.down('Shift');
  await page.keyboard.down('KeyW');
  let last = await positionNow();
  for (let step = 0; step < 40 && last.z > -70; step++) {
    await page.waitForTimeout(500);
    last = await positionNow();
    if (Math.abs(last.y) > 0.05) sawHills = true;
  }
  await page.keyboard.up('KeyW');
  await page.keyboard.up('Shift');

  // Well past the clearing's own tree line, not stopped at the old Phase 0
  // wall (38 m): the wilderness opened the world up rather than fencing it.
  expect(last.z).toBeLessThan(-70);
  // And the ground out there is not flat the way the clearing's is.
  expect(sawHills).toBe(true);
});

/**
 * Walk to a spot until the game says you can reach the pickup that is there.
 *
 * In short steps, stopping between each one. Holding the key down and watching
 * the distance does not work: on a slow machine the player keeps walking for as
 * long as it takes to let go, which is long enough to sail straight past.
 *
 * The condition is the game's own answer rather than a distance we work out
 * here, so the test ends up where the player would actually get the prompt -
 * and it names the item it came for, because it is not always the only thing in
 * reach: the bag lies a few steps from where everyone spawns, so "something is
 * in reach" is already true before the first step towards the axe.
 */
async function walkWithinReachOf(page: Page, x: number, z: number, item: string): Promise<void> {
  for (let step = 0; step < 80; step++) {
    const reachable = await page.evaluate(() => window.acornDebug?.nearbyItem() ?? null);
    if (reachable === item) return;

    const here = await page.evaluate(() => window.acornDebug?.localPosition());
    const gap = Math.hypot((here?.x ?? 0) - x, (here?.z ?? 0) - z);
    await page.evaluate(
      ([targetX, targetZ]) => window.acornDebug?.faceTowards(targetX ?? 0, targetZ ?? 0),
      [x, z],
    );

    // Long steps while there is ground to cover, short ones on the approach.
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(Math.min(250, Math.max(80, gap * 40)));
    await page.keyboard.up('KeyW');
    // Let them come to a stop before looking again.
    await page.waitForTimeout(200);
  }
  throw new Error(`Never got within reach of the ${item} at ${x}, ${z}`);
}

/**
 * Walk to an exact spot until close enough for the interact key, for
 * something with no debug flag of its own to say "this is nearby" - unlike
 * `walkWithinReachOf`, which watches `nearbyItem()` for a pickup.
 */
async function walkOntoSpot(page: Page, x: number, z: number): Promise<void> {
  for (let step = 0; step < 80; step++) {
    const here = await page.evaluate(() => window.acornDebug?.localPosition());
    const gap = Math.hypot((here?.x ?? 0) - x, (here?.z ?? 0) - z);
    if (gap < 1.5) return;
    await page.evaluate(
      ([targetX, targetZ]) => window.acornDebug?.faceTowards(targetX ?? 0, targetZ ?? 0),
      [x, z],
    );

    await page.keyboard.down('KeyW');
    await page.waitForTimeout(Math.min(250, Math.max(80, gap * 40)));
    await page.keyboard.up('KeyW');
    await page.waitForTimeout(200);
  }
  throw new Error(`Never got within reach of ${x}, ${z}`);
}

/** Walk to a gather spot until the game says something is in reach there. */
async function walkWithinReachOfGatherSpot(page: Page, x: number, z: number): Promise<void> {
  for (let step = 0; step < 80; step++) {
    if ((await page.evaluate(() => window.acornDebug?.nearGatherSpot() ?? null)) !== null) return;

    const here = await page.evaluate(() => window.acornDebug?.localPosition());
    const gap = Math.hypot((here?.x ?? 0) - x, (here?.z ?? 0) - z);
    await page.evaluate(
      ([targetX, targetZ]) => window.acornDebug?.faceTowards(targetX ?? 0, targetZ ?? 0),
      [x, z],
    );

    await page.keyboard.down('KeyW');
    await page.waitForTimeout(Math.min(250, Math.max(80, gap * 40)));
    await page.keyboard.up('KeyW');
    await page.waitForTimeout(200);
  }
  throw new Error(`Never got within reach of the gather spot at ${x}, ${z}`);
}

/** Wait until the server says this is in the pack - the bag in there already does not count. */
async function waitUntilCarrying(page: Page, item: string): Promise<void> {
  await expect
    .poll(async () =>
      (await page.evaluate(() => window.acornDebug?.carrying() ?? [])).some(
        (entry) => entry.item === item,
      ),
    )
    .toBe(true);
}

/** How many of something we carry right now, as the server says. */
async function countHeld(page: Page, item: string): Promise<number> {
  return page.evaluate(
    (id) => window.acornDebug?.carrying().find((entry) => entry.item === id)?.count ?? 0,
    item,
  );
}

/**
 * Gather at least `wanted` more sticks or flowers, walking from one patch to
 * the next as each runs out - a patch only holds two to six (see decision
 * 0061) - and waiting for one to grow back if every one is picked clean.
 */
async function gatherFromPatches(
  page: Page,
  item: 'stick' | 'flower',
  wanted: number,
): Promise<void> {
  const start = await countHeld(page, item);
  for (let visit = 0; visit < 12; visit++) {
    if ((await countHeld(page, item)) - start >= wanted) return;

    const here = await page.evaluate(() => window.acornDebug?.localPosition() ?? { x: 0, z: 0 });
    const patches = (await page.evaluate(() => window.acornDebug?.gatherSpots() ?? [])).filter(
      (patch) => patch.item === item && patch.remaining > 0,
    );
    patches.sort(
      (a, b) => Math.hypot(a.x - here.x, a.z - here.z) - Math.hypot(b.x - here.x, b.z - here.z),
    );
    const patch = patches[0];
    if (patch === undefined) {
      // Everything picked clean: one grows back within a minute locally.
      await page.waitForTimeout(5000);
      continue;
    }

    await walkWithinReachOfGatherSpot(page, patch.x, patch.z);
    // Taps, not a hold: the server paces gathering the same way it paces a
    // swing, and holding down the key does not gather any faster.
    for (let i = 0; i < patch.remaining; i++) {
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(600);
    }
  }
  throw new Error(`Never managed to gather ${wanted} ${item}s`);
}

/**
 * What the game calls a kind of tree. The first three kinds kept their old keys
 * (`oak` and friends) when they became real species, so the key and the name
 * the player sees no longer match: the landmark `oak` reads as a Sitka spruce.
 */
function treeName(kind: string): string {
  return PROP_KINDS[kind as PropKindId].displayName;
}

/**
 * Walk up to a tree until the game says a swing would reach it.
 *
 * Never assume standing where the axe was leaves you in range of the oak beside
 * it: where you stop depends on which way you came in, and the difference
 * between two and three metres is the difference between chopping and flailing.
 */
async function walkWithinReachOfTree(
  page: Page,
  tree: { x: number; z: number; kind: string },
): Promise<void> {
  // Every tree in the forest can be chopped now, so the first tree faced on the
  // way over is often a different one. Only the kind we came for counts.
  const wanted = treeName(tree.kind);
  for (let step = 0; step < 80; step++) {
    const aimed = await page.evaluate(() => window.acornDebug?.aimedTree() ?? null);
    if (aimed?.name === wanted) return;

    const here = await page.evaluate(() => window.acornDebug?.localPosition());
    const gap = Math.hypot((here?.x ?? 0) - tree.x, (here?.z ?? 0) - tree.z);
    await page.evaluate(
      ([x, z]) => window.acornDebug?.faceTowards(x ?? 0, z ?? 0),
      [tree.x, tree.z],
    );

    await page.keyboard.down('KeyW');
    await page.waitForTimeout(Math.min(250, Math.max(80, gap * 40)));
    await page.keyboard.up('KeyW');
    await page.waitForTimeout(200);
  }
  throw new Error(`Never got within swinging distance of the tree at ${tree.x}, ${tree.z}`);
}

test('you can find the axe, pick it up, and still have it next time', async ({ browser }) => {
  // Walking there in steps takes a while on a slow machine.
  test.setTimeout(180_000);
  // One browser context throughout, so the second visit is the same player
  // coming back rather than a stranger: the key that identifies them lives in
  // this browser's storage.
  const context = await openBrowserContext(browser);
  // A fresh world, so the axe is definitely still in its stump.
  const page = await context.newPage();
  await page.goto(`/?world=axe-${Date.now()}`);
  await waitForConnected(page);
  await page.locator('.hud-curtain').click();

  // Nothing to start with, and the axe is out there waiting.
  expect(await page.evaluate(() => window.acornDebug?.carrying())).toEqual([]);
  expect(await page.evaluate(() => window.acornDebug?.takenPickups())).toEqual([]);
  await expect(page.locator('.hotbar-slot .hotbar-slot-icon')).toHaveCount(0);

  const pickups = await page.evaluate(() => window.acornDebug?.pickups() ?? []);
  const axe = pickups.find((entry) => entry.item === 'axe');
  expect(axe).toBeDefined();
  if (axe === undefined) throw new Error('no axe in the clearing');

  await walkWithinReachOf(page, axe.x, axe.z, 'axe');

  // Standing next to it, the game offers it.
  await expect(page.locator('.hud-hint')).toContainText(
    'Right-click or press E to pick up the axe',
  );

  await page.keyboard.press('KeyE');
  await expect
    .poll(async () => (await page.evaluate(() => window.acornDebug?.carrying() ?? [])).length)
    .toBeGreaterThan(0);

  expect(await page.evaluate(() => window.acornDebug?.carrying())).toEqual([
    { item: 'axe', count: 1 },
  ]);
  expect(await page.evaluate(() => window.acornDebug?.takenPickups())).toEqual([axe.id]);
  await expect(page.locator('.hotbar-slot .hotbar-slot-icon')).toHaveCount(1);

  // Reload the page: the world server still knows it is ours.
  const url = page.url();
  await page.close();

  const again = await context.newPage();
  await again.goto(url);
  await waitForConnected(again);
  await expect
    .poll(async () => (await again.evaluate(() => window.acornDebug?.carrying() ?? [])).length)
    .toBeGreaterThan(0);
  expect(await again.evaluate(() => window.acornDebug?.carrying())).toEqual([
    { item: 'axe', count: 1 },
  ]);
  // And it is no longer standing in the stump for anybody else to find.
  expect(await again.evaluate(() => window.acornDebug?.takenPickups())).toEqual([axe.id]);
  await again.close();
  await context.close();
});

test('equipping the axe shows it in your hand, and a nearby player can tell', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const worldId = `equip-${Date.now()}`;
  const equipper = await openTab(browser);
  const watcher = await openTab(browser);

  await equipper.goto(`/?world=${worldId}`);
  await watcher.goto(`/?world=${worldId}`);
  await waitForConnected(equipper);
  await waitForConnected(watcher);

  await equipper.bringToFront();
  await equipper.locator('.hud-curtain').click();
  expect(await equipper.evaluate(() => window.acornDebug?.equippedItem() ?? null)).toBeNull();

  const pickups = await equipper.evaluate(() => window.acornDebug?.pickups() ?? []);
  const bag = pickups.find((entry) => entry.item === 'bag');
  const axe = pickups.find((entry) => entry.item === 'axe');
  expect(bag).toBeDefined();
  expect(axe).toBeDefined();
  if (bag === undefined || axe === undefined) throw new Error('no bag or axe in the clearing');

  // Find the bag first, the way a new player would - not that the axe needs it.
  await walkWithinReachOf(equipper, bag.x, bag.z, 'bag');
  await equipper.keyboard.press('KeyE');
  await expect
    .poll(async () =>
      (await equipper.evaluate(() => window.acornDebug?.carrying() ?? [])).some(
        (entry) => entry.item === 'bag',
      ),
    )
    .toBe(true);

  await walkWithinReachOf(equipper, axe.x, axe.z, 'axe');
  await equipper.keyboard.press('KeyE');
  await expect
    .poll(async () =>
      (await equipper.evaluate(() => window.acornDebug?.carrying() ?? [])).some(
        (entry) => entry.item === 'axe',
      ),
    )
    .toBe(true);

  // Found, but not equipped yet - just carrying it is not enough to show it in hand.
  expect(await equipper.evaluate(() => window.acornDebug?.equippedItem() ?? null)).toBeNull();

  // The axe is whatever pack slot 1 sorts to, whichever one that is.
  const slot =
    (await equipper.evaluate(() => window.acornDebug?.carrying() ?? [])).findIndex(
      (entry) => entry.item === 'axe',
    ) + 1;
  await equipper.keyboard.press(`Digit${slot}`);
  await expect
    .poll(async () => await equipper.evaluate(() => window.acornDebug?.equippedItem() ?? null))
    .toBe('axe');

  // A look at the equipper's own view, to check the held axe's grip by eye.
  await equipper.screenshot({ path: 'test-results/equip-axe-self.png' });

  // The watcher, elsewhere in the same world, is told the same thing.
  const equipperNetId = await equipper.evaluate(() => window.acornDebug?.selfNetId());
  await watcher.bringToFront();
  await expect
    .poll(async () =>
      equipperNetId === undefined
        ? null
        : await watcher.evaluate(
            (netId) => window.acornDebug?.remoteEquippedItem(netId) ?? null,
            equipperNetId,
          ),
    )
    .toBe('axe');
  await watcher.screenshot({ path: 'test-results/equip-axe-watched.png' });

  await equipper.close();
  await watcher.close();
});

test('you can gather sticks and craft your own axe, without ever finding one', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(`/?world=craft-${Date.now()}`);
  await waitForConnected(page);
  await page.locator('.hud-curtain').click();

  expect(await page.evaluate(() => window.acornDebug?.carrying())).toEqual([]);

  const spots = await page.evaluate(() => window.acornDebug?.gatherSpots() ?? []);
  const spot = spots[0];
  expect(spot).toBeDefined();
  if (spot === undefined) throw new Error('no gather spot in the clearing');

  await walkWithinReachOfGatherSpot(page, spot.x, spot.z);
  await expect(page.locator('.hud-hint')).toContainText('Right-click or press E to gather sticks');

  // One stick taken, one fewer left in the patch, and a toast to say so.
  const before = spot.remaining;
  await page.keyboard.press('KeyE');
  await expect
    .poll(async () => {
      const patches = await page.evaluate(() => window.acornDebug?.gatherSpots() ?? []);
      return patches.find((patch) => patch.id === spot.id)?.remaining;
    })
    .toBe(before - 1);
  await expect(page.locator('[data-testid="toast"]').first()).toContainText('+1 Stick');
  await page.waitForTimeout(600);

  await gatherFromPatches(page, 'stick', 2);
  expect(await countHeld(page, 'stick')).toBeGreaterThanOrEqual(3);

  // The first recipe, picked from the craft menu.
  await page.keyboard.press('KeyC');
  await expect(page.locator('.hud-journal')).toContainText('Axe');
  await page.keyboard.press('Digit1');
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => window.acornDebug?.carrying() ?? [])).find(
          (entry) => entry.item === 'axe',
        )?.count ?? 0,
    )
    .toBe(1);

  await expect
    .poll(async () => page.evaluate(() => window.acornDebug?.craftingNews() ?? null))
    .toBe('You made an axe.');
  await page.keyboard.press('KeyC');

  // Nothing thrown while gathering, crafting or drawing the stick patches.
  expect(errors).toEqual([]);
});

test('crafting a torch lets you equip it, lighting up in your hand', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(`/?world=torch-${Date.now()}`);
  await waitForConnected(page);
  await page.locator('.hud-curtain').click();

  const spots = await page.evaluate(() => window.acornDebug?.gatherSpots() ?? []);
  const spot = spots.find((entry) => entry.item === 'stick');
  expect(spot).toBeDefined();
  if (spot === undefined) throw new Error('no stick patch in the clearing');

  // Only two needed, half what a first axe costs.
  await gatherFromPatches(page, 'stick', 2);

  // The third recipe, after the axe and the fishing rod.
  await page.keyboard.press('KeyC');
  await expect(page.locator('.hud-journal')).toContainText('Torch');
  await page.keyboard.press('Digit3');
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => window.acornDebug?.carrying() ?? [])).find(
          (entry) => entry.item === 'torch',
        )?.count ?? 0,
    )
    .toBe(1);
  await expect
    .poll(async () => page.evaluate(() => window.acornDebug?.craftingNews() ?? null))
    .toBe('You made a torch.');
  await page.keyboard.press('KeyC');

  await equip(page, 'torch');
  // A look at the held torch and the light it casts, by eye - the same
  // reason the axe's own grip got a screenshot in the equip test above.
  await page.screenshot({ path: 'test-results/equip-torch.png' });

  expect(errors).toEqual([]);
});

test('you can drop sticks to pick up again, or destroy them for good', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(`/?world=drop-${Date.now()}`);
  await waitForConnected(page);
  await page.locator('.hud-curtain').click();

  await gatherFromPatches(page, 'stick', 2);
  const held = await countHeld(page, 'stick');

  // Right-click the sticks in the pack, and drop one.
  await page.keyboard.press('KeyI');
  await page.locator('[data-testid="pack-slot-stick"]').first().click({ button: 'right' });
  await expect(page.locator('[data-testid="slot-menu"]')).toBeVisible();
  await page.locator('[data-testid="slot-menu-drop-one"]').click();
  await expect.poll(async () => countHeld(page, 'stick')).toBe(held - 1);
  await expect
    .poll(async () => page.evaluate(() => window.acornDebug?.discardNews() ?? null))
    .toBe('Dropped 1 stick.');
  await expect
    .poll(async () => page.evaluate(() => window.acornDebug?.droppedPiles() ?? []))
    .toEqual([expect.objectContaining({ item: 'stick', count: 1 })]);
  await page.keyboard.press('KeyI');
  await page.screenshot({ path: 'test-results/dropped-stick.png' });

  // It lands at your feet, so E picks it straight back up - a pile before
  // any patch beside it, the same order the server reaches in.
  await expect
    .poll(async () => page.evaluate(() => window.acornDebug?.nearbyPile() ?? null))
    .toEqual({ item: 'stick', count: 1 });
  await expect(page.locator('.hud-hint')).toContainText(
    'Right-click or press E to pick up 1 stick',
  );
  await page.keyboard.press('KeyE');
  await expect.poll(async () => countHeld(page, 'stick')).toBe(held);
  await expect
    .poll(async () => page.evaluate(() => window.acornDebug?.droppedPiles() ?? []))
    .toEqual([]);

  // Destroying asks first, and only then are they gone.
  await page.keyboard.press('KeyI');
  await page.locator('[data-testid="pack-slot-stick"]').first().click({ button: 'right' });
  await page.locator('[data-testid="slot-menu-destroy"]').click();
  await expect(page.locator('[data-testid="slot-menu"]')).toContainText("can't get them back");
  expect(await countHeld(page, 'stick')).toBe(held);
  await page.locator('[data-testid="slot-menu-confirm-destroy"]').click();
  await expect.poll(async () => countHeld(page, 'stick')).toBe(0);
  await expect
    .poll(async () => page.evaluate(() => window.acornDebug?.discardNews() ?? null))
    .toBe(`Destroyed ${held} sticks.`);
  // Destroyed, not dropped: nothing left lying about.
  expect(await page.evaluate(() => window.acornDebug?.droppedPiles() ?? [])).toEqual([]);

  expect(errors).toEqual([]);
});

async function collectFallenLogs(page: Page): Promise<void> {
  await expect
    .poll(async () =>
      page.evaluate(
        () => window.acornDebug?.droppedPiles().filter((pile) => pile.item === 'log').length ?? 0,
      ),
    )
    .toBeGreaterThan(0);
  const logs = await page.evaluate(
    () => window.acornDebug?.droppedPiles().filter((pile) => pile.item === 'log') ?? [],
  );
  for (const log of logs) {
    if (
      !(await page.evaluate(
        (id) => window.acornDebug?.droppedPiles().some((pile) => pile.id === id),
        log.id,
      ))
    )
      continue;
    await walkOntoSpot(page, log.x, log.z);
    await page.keyboard.down('KeyE');
    await expect
      .poll(async () =>
        page.evaluate(
          (id) => window.acornDebug?.droppedPiles().some((pile) => pile.id === id),
          log.id,
        ),
      )
      .toBe(false);
    await page.keyboard.up('KeyE');
  }
}

/**
 * Swing at a tree until it comes down, in taps rather than one long hold.
 *
 * It watches the count come down as it goes. A swing that never lands is a
 * different failure from a swing that lands slowly, and saying which is which
 * beats timing out in silence: that is exactly what this test did the first
 * time it ran on a browser whose mouse behaved differently.
 */
async function chopUntilFelled(
  page: Page,
  tree: { id: number; x: number; z: number },
): Promise<void> {
  let lastSeen: number | null = null;
  let tapsWithoutProgress = 0;
  await centerMouse(page);

  for (let step = 0; step < 40; step++) {
    const felled = await page.evaluate(() => window.acornDebug?.felledTrees() ?? []);
    if (felled.includes(tree.id)) return;

    await page.evaluate(
      ([x, z]) => window.acornDebug?.faceTowards(x ?? 0, z ?? 0),
      [tree.x, tree.z],
    );
    // Taps, not a hold: a slow machine must not lose the button press, and the
    // server paces the swings anyway.
    await page.mouse.down();
    await page.waitForTimeout(200);
    await page.mouse.up();
    await page.waitForTimeout(150);

    const swingsLeft =
      (await page.evaluate(() => window.acornDebug?.aimedTree()))?.swingsLeft ?? null;
    tapsWithoutProgress =
      swingsLeft !== null && swingsLeft === lastSeen ? tapsWithoutProgress + 1 : 0;
    lastSeen = swingsLeft;

    if (tapsWithoutProgress >= 8) {
      const state = await page.evaluate(() => ({
        pointerLocked: document.pointerLockElement !== null,
        position: window.acornDebug?.localPosition(),
        carrying: window.acornDebug?.carrying(),
        aimed: window.acornDebug?.aimedTree(),
      }));
      throw new Error(`swings are not landing after ${step + 1} taps: ${JSON.stringify(state)}`);
    }
  }
  throw new Error(`tree ${tree.id} never came down`);
}

/**
 * Press the hotbar key for whichever slot this item currently sorts to,
 * making it the active item. Finding a tool is no longer enough to swing,
 * cast or eat with it - it has to be made active first, the same as
 * `equip(page, 'axe')` proves it visually in the dedicated equip test above.
 * The bag has a button of its own rather than a numbered slot (see
 * decision 0060), so it is left out of the count.
 */
async function equip(page: Page, item: string): Promise<void> {
  const slot =
    (await page.evaluate(() => window.acornDebug?.carrying() ?? []))
      .filter((entry) => entry.item !== 'bag')
      .findIndex((entry) => entry.item === item) + 1;
  await page.keyboard.press(`Digit${slot}`);
  await expect
    .poll(async () => page.evaluate(() => window.acornDebug?.equippedItem() ?? null))
    .toBe(item);
}

test('you can chop a tree down, and the stump is still there next time', async ({ browser }) => {
  test.setTimeout(240_000);
  // One context throughout, so coming back is the same player returning.
  const context = await openBrowserContext(browser);
  const page = await context.newPage();
  await page.goto(`/?world=chop-${Date.now()}`);
  await waitForConnected(page);
  await page.locator('.hud-curtain').click();

  // Nothing is down to begin with.
  expect(await page.evaluate(() => window.acornDebug?.felledTrees())).toEqual([]);

  // Fetch the axe first: no axe, no chopping.
  const pickups = await page.evaluate(() => window.acornDebug?.pickups() ?? []);
  const axe = pickups.find((entry) => entry.item === 'axe');
  if (axe === undefined) throw new Error('no axe in the clearing');
  await walkWithinReachOf(page, axe.x, axe.z, 'axe');
  await page.keyboard.press('KeyE');
  await waitUntilCarrying(page, 'axe');
  await equip(page, 'axe');

  // The big oak stands right beside the axe's stump.
  const trees = await page.evaluate(() => window.acornDebug?.trees() ?? []);
  const oak = trees.find((tree) => tree.kind === 'oak');
  if (oak === undefined) throw new Error('no oak in the clearing');

  // Walk up to it: the axe's stump is beside the oak, not against it.
  await walkWithinReachOfTree(page, oak);

  // Facing it, the game offers the swing and says how much is left in it.
  await expect.poll(async () => page.evaluate(() => window.acornDebug?.aimedTree())).not.toBeNull();
  await expect(page.locator('.hud-hint')).toContainText(
    `Left click to chop the ${treeName(oak.kind).toLowerCase()}`,
  );

  await chopUntilFelled(page, oak);
  await collectFallenLogs(page);

  // It is down, and the gathered wood is ours.
  expect(await page.evaluate(() => window.acornDebug?.felledTrees())).toEqual([oak.id]);
  const carried = await page.evaluate(() => window.acornDebug?.carrying() ?? []);
  expect(carried.find((entry) => entry.item === 'log')?.count).toBeGreaterThan(0);

  // Nothing left to swing at where it stood.
  await page.evaluate(([x, z]) => window.acornDebug?.faceTowards(x ?? 0, z ?? 0), [oak.x, oak.z]);
  await expect.poll(async () => page.evaluate(() => window.acornDebug?.aimedTree())).toBeNull();

  // The Phase 1 promise: log out, come back, the stump is still there.
  const url = page.url();
  await page.close();
  const again = await context.newPage();
  await again.goto(url);
  await waitForConnected(again);
  await expect
    .poll(async () => (await again.evaluate(() => window.acornDebug?.felledTrees() ?? [])).length)
    .toBe(1);
  expect(await again.evaluate(() => window.acornDebug?.felledTrees())).toEqual([oak.id]);

  await again.close();
  await context.close();
});

test('a charged attack fells a tree in one go', async ({ page }) => {
  await page.goto(`/?world=charge-${Date.now()}`);
  await waitForConnected(page);
  await page.locator('.hud-curtain').click();

  const pickups = await page.evaluate(() => window.acornDebug?.pickups() ?? []);
  const axe = pickups.find((entry) => entry.item === 'axe');
  if (axe === undefined) throw new Error('no axe in the clearing');
  await walkWithinReachOf(page, axe.x, axe.z, 'axe');
  await page.keyboard.press('KeyE');
  await waitUntilCarrying(page, 'axe');
  await equip(page, 'axe');

  // The big oak takes several ordinary swings - one charged attack should
  // not need any of them.
  const trees = await page.evaluate(() => window.acornDebug?.trees() ?? []);
  const oak = trees.find((tree) => tree.kind === 'oak');
  if (oak === undefined) throw new Error('no oak in the clearing');
  await walkWithinReachOfTree(page, oak);
  await expect(page.locator('.hud-hint')).toContainText(
    `Left click to chop the ${treeName(oak.kind).toLowerCase()}`,
  );

  // Holding starts only the charge. Even once ready, the oak stays untouched
  // until release: no preliminary light swing and no automatic strong swing.
  await centerMouse(page);
  await page.mouse.down();
  await expect(page.locator('.hud-hint')).toContainText('Charging a heavy swing');
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.acornDebug?.felledTrees())).toEqual([]);
  await page.mouse.up();
  await expect
    .poll(async () => (await page.evaluate(() => window.acornDebug?.felledTrees() ?? [])).length, {
      timeout: 20_000,
    })
    .toBe(1);
  expect(await page.evaluate(() => window.acornDebug?.felledTrees())).toEqual([oak.id]);
  await collectFallenLogs(page);
  const carried = await page.evaluate(() => window.acornDebug?.carrying() ?? []);
  expect(carried.find((entry) => entry.item === 'log')?.count).toBeGreaterThan(0);
});

test('a chopped tree grows back on its own', async ({ browser }) => {
  // Locally a tree takes two to four minutes to come back, and this waits it out.
  test.setTimeout(600_000);
  const context = await openBrowserContext(browser);
  const page = await context.newPage();
  await page.goto(`/?world=regrow-${Date.now()}`);
  await waitForConnected(page);
  await page.locator('.hud-curtain').click();

  // Fetch the axe and fell the oak beside it.
  const pickups = await page.evaluate(() => window.acornDebug?.pickups() ?? []);
  const axe = pickups.find((entry) => entry.item === 'axe');
  if (axe === undefined) throw new Error('no axe in the clearing');
  await walkWithinReachOf(page, axe.x, axe.z, 'axe');
  await page.keyboard.press('KeyE');
  await waitUntilCarrying(page, 'axe');
  await equip(page, 'axe');

  const trees = await page.evaluate(() => window.acornDebug?.trees() ?? []);
  const oak = trees.find((tree) => tree.kind === 'oak');
  if (oak === undefined) throw new Error('no oak in the clearing');
  await walkWithinReachOfTree(page, oak);
  await chopUntilFelled(page, oak);
  await collectFallenLogs(page);
  expect(await page.evaluate(() => window.acornDebug?.felledTrees())).toEqual([oak.id]);

  // Walk well away: a tree will not grow through somebody standing on it.
  await page.evaluate(() => window.acornDebug?.faceTowards(0, 30));
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(2500);
  await page.keyboard.up('KeyW');

  // Locally and on a preview the shortest wait is two minutes rather than half
  // an hour, and a tree takes between that and twice it, so this has to be
  // willing to sit through four. Staging and production use the real wait.
  await expect
    .poll(async () => (await page.evaluate(() => window.acornDebug?.felledTrees() ?? [])).length, {
      timeout: 260_000,
      intervals: [2_000],
    })
    .toBe(0);

  // It came back as a new tree in the same spot, and the game knows it is the
  // second one to stand there.
  const generations = await page.evaluate(() => window.acornDebug?.treeGenerations() ?? []);
  expect(generations.find((tree) => tree.id === oak.id)?.generation).toBe(1);

  // And it is a tree again: something to swing at, not a stump.
  await walkWithinReachOfTree(page, oak);
  await expect.poll(async () => page.evaluate(() => window.acornDebug?.aimedTree())).not.toBeNull();

  await context.close();
});

/** A quick press of the left mouse button, the way a person clicks. */
async function click(page: Page): Promise<void> {
  await centerMouse(page);
  await page.mouse.down();
  await page.waitForTimeout(90);
  await page.mouse.up();
}

test('you can find the rod, cast into the pond and land a fish', async ({ browser }) => {
  test.setTimeout(180_000);
  const context = await openBrowserContext(browser);
  const page = await context.newPage();
  await page.goto(`/?world=fish-${Date.now()}`);
  await waitForConnected(page);
  await page.locator('.hud-curtain').click();

  // The rod is lying on the bank.
  const pickups = await page.evaluate(() => window.acornDebug?.pickups() ?? []);
  const rod = pickups.find((entry) => entry.item === 'rod');
  if (rod === undefined) throw new Error('no rod in the clearing');
  await walkWithinReachOf(page, rod.x, rod.z, 'rod');
  await expect(page.locator('.hud-hint')).toContainText(
    'Right-click or press E to pick up the fishing rod',
  );
  await page.keyboard.press('KeyE');
  await expect
    .poll(async () =>
      (await page.evaluate(() => window.acornDebug?.carrying() ?? [])).some(
        (entry) => entry.item === 'rod',
      ),
    )
    .toBe(true);
  await equip(page, 'rod');

  // Turn to the water, and the game offers a cast.
  const pond = await page.evaluate(() => window.acornDebug?.pond() ?? []);
  const middle = pond[0];
  if (middle === undefined) throw new Error('no pond in the clearing');
  await page.evaluate(
    ([x, z]) => window.acornDebug?.faceTowards(x ?? 0, z ?? 0),
    [middle.x, middle.z],
  );
  await expect.poll(async () => page.evaluate(() => window.acornDebug?.canCast())).toBe(true);
  await expect(page.locator('.hud-hint')).toContainText('Left click to cast');

  const fishing = async (): Promise<string | null | undefined> =>
    page.evaluate(() => window.acornDebug?.fishing());

  // A few goes, the way a person would have. The window is a second of the
  // player's own time, and a test that has to notice the dip and then send a
  // click through the browser can take most of that on a slow machine.
  let news: string | null | undefined = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    await expect.poll(async () => page.evaluate(() => window.acornDebug?.canCast())).toBe(true);
    await click(page);
    await expect.poll(fishing).toBe('waiting');
    await expect(page.locator('.hud-hint')).toContainText('Watch the float');

    // Somewhere between three and ten seconds later, the float goes under.
    await expect.poll(fishing, { timeout: 20_000, intervals: [25] }).toBe('biting');
    await click(page);
    await expect.poll(async () => (await fishing()) !== 'biting').toBe(true);
    if ((await fishing()) === 'reeling') {
      for (let pull = 0; pull < 2; pull++) {
        await expect(page.locator('.rare-reel-steady')).toBeVisible();
        await click(page);
        if (pull === 0) await expect(page.locator('.rare-reel')).toContainText('1 / 2');
        await expect(page.locator('.rare-reel-steady')).toHaveCount(0);
      }
    }
    await expect.poll(fishing).toBeNull();
    news = await page.evaluate(() => window.acornDebug?.fishingNews());
    console.log(`Cast ${attempt + 1}: ${news}`);
    if (news !== null && news !== undefined && /caught|rare one/.test(news)) {
      // And the HUD says so, above the hint.
      await expect(page.locator('.hud-news')).toContainText(/caught|rare one/);
      break;
    }
  }
  expect(news).toMatch(/caught|rare one/);

  // In the pack, and the pack says so.
  const fish = ['perch', 'trout', 'goldenCarp'];
  await expect
    .poll(async () =>
      (await page.evaluate(() => window.acornDebug?.carrying() ?? [])).some((entry) =>
        fish.includes(entry.item),
      ),
    )
    .toBe(true);
  expect(await page.evaluate(() => window.acornDebug?.fishing())).toBeNull();

  await context.close();
});

/**
 * Walk toward wherever an animal currently is - it wanders, so this re-reads
 * its position every attempt rather than aiming at a fixed spot - until a
 * swing would land on it, or it is close enough that it may start bolting and
 * the chase proper (`huntAnimal`) should take over.
 *
 * A den can be fifty metres past the tree line, and every check here is a
 * round trip through the browser. On a slow enough machine that round trip
 * competes with the game's own render loop for the same thread, so the fewer
 * of them sat in the middle of the walk, the better: this holds sprint in one
 * long, unbroken stretch and only looks up again once it is done, rather than
 * chopping the walk into many short polls that would each add their own
 * share of that overhead on top of the last.
 */
async function walkWithinReachOfAnimal(page: Page, animalId: number): Promise<void> {
  let lastPosition: { x: number; z: number } | null = null;

  // A rabbit only startles once a player is within its alertRadius (7m), and
  // calms down only past its safeRadius (11m) - comfortably above either, an
  // animal this far off is still just ambling near its den, not fleeing.
  const POSSIBLY_FLEEING_RANGE = 12;

  for (let attempt = 0; attempt < 90; attempt++) {
    if ((await page.evaluate(() => window.acornDebug?.aimedAnimal() ?? null)) !== null) return;

    const animal = (await page.evaluate(() => window.acornDebug?.animals() ?? [])).find(
      (entry) => entry.id === animalId,
    );
    if (animal === undefined) throw new Error(`animal ${animalId} is no longer around`);
    const here = await page.evaluate(() => window.acornDebug?.localPosition());
    const gap = Math.hypot((here?.x ?? 0) - animal.x, (here?.z ?? 0) - animal.z);
    await page.evaluate(
      ([x, z]) => window.acornDebug?.faceTowards(x ?? 0, z ?? 0),
      [animal.x, animal.z],
    );

    if (gap > POSSIBLY_FLEEING_RANGE) {
      // Wildlife is out in generated wilderness, not the hand-built clearing,
      // so a straight line at it can walk the player straight into a rock or
      // a trunk. A sprint covers many metres in eight seconds when the ground
      // is clear, so barely having moved means whatever is in the way is not
      // going to move for us: sidestep it before pushing forward again, the
      // way a person would.
      const stuck =
        lastPosition !== null &&
        Math.hypot((here?.x ?? 0) - lastPosition.x, (here?.z ?? 0) - lastPosition.z) < 3;
      lastPosition = here === undefined ? null : { x: here.x, z: here.z };

      if (stuck) {
        const sidestep = attempt % 2 === 0 ? 'KeyA' : 'KeyD';
        await page.keyboard.down('ShiftLeft');
        await page.keyboard.down(sidestep);
        await page.waitForTimeout(2_000);
        await page.keyboard.up(sidestep);
        await page.keyboard.up('ShiftLeft');
      }

      // One long, unbroken sprint rather than many short polls - each poll is
      // a round trip through the browser, and under a slow enough render loop
      // those add up to more than the walk itself does - but capped to
      // roughly how long the remaining gap actually needs at a sprint, so
      // closing in from nearby does not sail straight past a den that is only
      // a few metres off. Only safe while too far off to startle it yet:
      // fifty-odd metres of wilderness is the common case, not the exception.
      const SPRINT_METRES_PER_SECOND = 7;
      const holdMs = Math.min(8_000, Math.max(300, (gap / SPRINT_METRES_PER_SECOND) * 1_300));
      await page.keyboard.down('ShiftLeft');
      await page.keyboard.down('KeyW');
      await page.waitForTimeout(holdMs);
      await page.keyboard.up('KeyW');
      await page.keyboard.up('ShiftLeft');
      await page.waitForTimeout(300);
      continue;
    }

    // Close enough that it may already be bolting: from here the chase is
    // `huntAnimal`'s job, which keeps the sprint held down while it re-aims.
    return;
  }
  throw new Error(`Never got within swinging distance of animal ${animalId}`);
}

/**
 * The animal of one kind that stands nearest the player out past the clearing,
 * for a hunt that does not have to cross the whole of it. Two kinds of spot are
 * left out: the open ground inside the tree line, where a pond or a build can
 * stand between hunter and hunted, and the very edge of the world, where a
 * fleeing animal can run out past the line the player may not cross.
 *
 * Wildlife wanders, and the one fox in the world can be out of range for a
 * while, so this waits (up to a minute) for one to come into range.
 */
async function nearestAnimalOfKind(
  page: Page,
  kind: string,
): Promise<{ id: number; kind: string; x: number; z: number }> {
  const edge = PLAYABLE_HALF_EXTENT - 30;
  const deadline = Date.now() + 60_000;
  for (;;) {
    const here = await page.evaluate(() => window.acornDebug?.localPosition() ?? { x: 0, z: 0 });
    const animals = await page.evaluate(() => window.acornDebug?.animals() ?? []);
    const nearest = animals
      .filter(
        (entry) =>
          entry.kind === kind &&
          Math.hypot(entry.x, entry.z) > CLEARING_TREE_LINE_INNER &&
          Math.abs(entry.x) < edge &&
          Math.abs(entry.z) < edge,
      )
      .sort(
        (a, b) => Math.hypot(a.x - here.x, a.z - here.z) - Math.hypot(b.x - here.x, b.z - here.z),
      )[0];
    if (nearest !== undefined) return nearest;
    if (Date.now() > deadline) throw new Error(`no ${kind} out past the clearing to hunt`);
    await page.waitForTimeout(1_000);
  }
}

/**
 * Close in on an animal and swing whenever a swing would land, all in one loop.
 *
 * Reaching it and then looking at the hint, or reaching it and then swinging,
 * are separate round trips through the browser, and a rabbit that bolts in
 * between is out of reach again by the second one. Doing it in one pass means
 * a swing goes out the moment one could land, and the hint is read at the same
 * moment the animal is in reach. Each swing re-aims first, since the animal can
 * still drift before it lands.
 *
 * Gives back what the hint said each time the animal was in reach, and how many
 * hits it had left each time. With `stopWhenHurt` it stops as soon as that
 * number has dropped, for a fight that should not be taken all the way down.
 *
 * The hint on screen is drawn a moment after the game notices what is in front
 * of the player, so a first look often catches the hint from before. When the
 * caller says which hint it is after (`hint`), the chase keeps closing in for a
 * few looks to let it appear (standing still to wait would hand a fleeing
 * animal the lead), then swings regardless.
 *
 * A chase is not guaranteed to end in a catch: prey runs straight through trees
 * a player has to go round, and can run out past the edge of the world, where
 * the player cannot follow. So it gives up (`gaveUp`) after `maxSteps` looks, or
 * once the animal is off the playable ground, and leaves it to the caller to try
 * another animal.
 */
async function huntAnimal(
  page: Page,
  animalId: number,
  options: { stopWhenHurt?: boolean; hint?: RegExp; maxSteps?: number } = {},
): Promise<{ caught: boolean; gaveUp: boolean; hints: string[]; hitsLeft: number[] }> {
  const hints: string[] = [];
  const hitsLeft: number[] = [];
  const maxSteps = options.maxSteps ?? 150;
  const wantedHint = options.hint;
  let hintLooks = 0;
  await centerMouse(page);

  // A sprinting player only just outpaces a fleeing rabbit (7 m/s against 6),
  // so letting go of the keys between looks hands the whole lead back. The
  // sprint stays held while closing in and is released only to swing.
  let sprinting = false;
  const sprint = async (on: boolean): Promise<void> => {
    if (on === sprinting) return;
    sprinting = on;
    if (on) {
      await page.keyboard.down('ShiftLeft');
      await page.keyboard.down('KeyW');
    } else {
      await page.keyboard.up('KeyW');
      await page.keyboard.up('ShiftLeft');
    }
  };

  const playableEdge = PLAYABLE_HALF_EXTENT - 1;
  try {
    for (let step = 0; step < maxSteps; step++) {
      const look = await page.evaluate((id) => {
        const animal = window.acornDebug?.animals().find((entry) => entry.id === id) ?? null;
        return {
          animal: animal === null ? null : { x: animal.x, z: animal.z },
          here: window.acornDebug?.localPosition() ?? { x: 0, z: 0 },
          aimed: window.acornDebug?.aimedAnimal() ?? null,
          hint: document.querySelector('.hud-hint')?.textContent ?? '',
        };
      }, animalId);
      if (look.animal === null) return { caught: true, gaveUp: false, hints, hitsLeft };
      if (Math.abs(look.animal.x) > playableEdge || Math.abs(look.animal.z) > playableEdge) {
        return { caught: false, gaveUp: true, hints, hitsLeft };
      }

      // Curving fresh every tick, it runs straight away from whoever is
      // chasing it, so aim again each time rather than at where it was.
      await page.evaluate(
        ([x, z]) => window.acornDebug?.faceTowards(x ?? 0, z ?? 0),
        [look.animal.x, look.animal.z],
      );

      if (look.aimed === null) {
        await sprint(true);
        await page.waitForTimeout(60);
        continue;
      }

      hints.push(look.hint);
      if (look.aimed.hitsLeft !== undefined) hitsLeft.push(look.aimed.hitsLeft);
      const first = hitsLeft[0];
      if (options.stopWhenHurt && first !== undefined && Math.min(...hitsLeft) < first) {
        return { caught: false, gaveUp: false, hints, hitsLeft };
      }

      if (
        wantedHint !== undefined &&
        !hints.some((hint) => wantedHint.test(hint)) &&
        hintLooks < 3
      ) {
        hintLooks++;
        await page.waitForTimeout(60);
        continue;
      }

      await sprint(false);
      await page.mouse.down();
      await page.waitForTimeout(200);
      await page.mouse.up();
      await page.waitForTimeout(150);
    }
    return { caught: false, gaveUp: true, hints, hitsLeft };
  } finally {
    await sprint(false);
  }
}

/**
 * Pick the nearest animal of a kind, walk up to it and hunt it - and if that
 * chase comes to nothing (see `huntAnimal`), pick again and have another go.
 * Nothing about a chase through a forest is certain, so a handful of tries is
 * what makes the test a fair check of the game rather than of luck.
 */
async function huntNearest(
  page: Page,
  kind: string,
  options: { stopWhenHurt?: boolean; hint?: RegExp } = {},
): Promise<{
  animalId: number;
  hunt: { caught: boolean; hints: string[]; hitsLeft: number[] };
}> {
  const hints: string[] = [];
  const hitsLeft: number[] = [];
  const problems: string[] = [];
  for (let attempt = 1; attempt <= 5; attempt++) {
    const animal = await nearestAnimalOfKind(page, kind);
    try {
      await walkWithinReachOfAnimal(page, animal.id);
    } catch (error) {
      problems.push(`try ${attempt}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    const hunt = await huntAnimal(page, animal.id, options);
    hints.push(...hunt.hints);
    hitsLeft.push(...hunt.hitsLeft);
    if (!hunt.gaveUp) {
      return { animalId: animal.id, hunt: { caught: hunt.caught, hints, hitsLeft } };
    }
    problems.push(`try ${attempt}: ${kind} ${animal.id} got away`);
  }
  throw new Error(`Never got hold of a ${kind}: ${problems.join('; ')}`);
}

test('you can find a rabbit, catch it with your axe, and it pays out meat', async ({ page }) => {
  // Wildlife lives well past the tree line, so this walks a lot further than
  // the axe or the pond do.
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(`/?world=hunt-${Date.now()}`);
  await waitForConnected(page);
  await page.locator('.hud-curtain').click();

  // Fetch the axe first: no axe, no catching, the same rule as chopping.
  const pickups = await page.evaluate(() => window.acornDebug?.pickups() ?? []);
  const axe = pickups.find((entry) => entry.item === 'axe');
  if (axe === undefined) throw new Error('no axe in the clearing');
  await walkWithinReachOf(page, axe.x, axe.z, 'axe');
  await page.keyboard.press('KeyE');
  await expect
    .poll(async () =>
      (await page.evaluate(() => window.acornDebug?.carrying() ?? [])).some(
        (entry) => entry.item === 'axe',
      ),
    )
    .toBe(true);
  await equip(page, 'axe');

  // Closing in and swinging happen in one loop (see `huntAnimal`). The hint is
  // usually the catch hint, but a walk this long can run the hunger meter out
  // first on a slow machine (it empties in three minutes here, not the real
  // twenty) - hungry beats everything else on purpose, so either is the hint
  // doing its job correctly.
  const catchHint = /Left click to catch the rabbit|You're hungry/;
  const { animalId: rabbitId, hunt } = await huntNearest(page, 'rabbit', { hint: catchHint });
  expect(hunt.hints.some((hint) => catchHint.test(hint))).toBe(true);

  // It is gone, and the meat is ours.
  expect(
    (await page.evaluate(() => window.acornDebug?.animals() ?? [])).some(
      (entry) => entry.id === rabbitId,
    ),
  ).toBe(false);
  const carried = await page.evaluate(() => window.acornDebug?.carrying() ?? []);
  expect(carried.find((entry) => entry.item === 'meat')?.count).toBeGreaterThan(0);
  await expect
    .poll(async () => page.evaluate(() => window.acornDebug?.huntingNews() ?? null))
    .toBe('You caught some meat!');

  // Nothing thrown while walking out, swinging or drawing the wildlife.
  expect(errors).toEqual([]);
});

test('you can find a fox and catch it, the same way you catch a rabbit', async ({ page }) => {
  // Wildlife lives well past the tree line, so this walks a lot further than
  // the axe or the pond do.
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(`/?world=fox-${Date.now()}`);
  await waitForConnected(page);
  await page.locator('.hud-curtain').click();

  // Fetch the axe first: no axe, no catching, the same rule as chopping.
  const pickups = await page.evaluate(() => window.acornDebug?.pickups() ?? []);
  const axe = pickups.find((entry) => entry.item === 'axe');
  if (axe === undefined) throw new Error('no axe in the clearing');
  await walkWithinReachOf(page, axe.x, axe.z, 'axe');
  await page.keyboard.press('KeyE');
  await expect
    .poll(async () =>
      (await page.evaluate(() => window.acornDebug?.carrying() ?? [])).some(
        (entry) => entry.item === 'axe',
      ),
    )
    .toBe(true);
  await equip(page, 'axe');

  // The same helpers the rabbit hunt uses: neither cares which kind of
  // wildlife it is, only where it is and whether a swing would land. A fox
  // is prey to the player exactly like a rabbit - it is only a predator to
  // a rabbit (decision 0035), which this test does not touch.
  //
  // Closing in and swinging happen in one loop (see `huntAnimal`). The hint is
  // usually the catch hint, but a walk this long can run the hunger meter out
  // first on a slow machine (it empties in three minutes here, not the real
  // twenty) - hungry beats everything else on purpose, so either is the hint
  // doing its job correctly.
  const catchHint = /Left click to catch the fox|You're hungry/;
  const { animalId: foxId, hunt } = await huntNearest(page, 'fox', { hint: catchHint });
  expect(hunt.hints.some((hint) => catchHint.test(hint))).toBe(true);

  // It is gone, and the meat is ours - a fox pays out exactly like a rabbit.
  expect(
    (await page.evaluate(() => window.acornDebug?.animals() ?? [])).some(
      (entry) => entry.id === foxId,
    ),
  ).toBe(false);
  const carried = await page.evaluate(() => window.acornDebug?.carrying() ?? []);
  expect(carried.find((entry) => entry.item === 'meat')?.count).toBeGreaterThan(0);
  await expect
    .poll(async () => page.evaluate(() => window.acornDebug?.huntingNews() ?? null))
    .toBe('You caught some meat!');

  // Nothing thrown while walking out, swinging or drawing the wildlife.
  expect(errors).toEqual([]);
});

test('you can find a masked raccoon and land a hit on it', async ({ page }) => {
  // Wildlife lives well past the tree line, the same reason the rabbit hunt does.
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(`/?world=raccoon-${Date.now()}`);
  await waitForConnected(page);
  await page.locator('.hud-curtain').click();

  // Fetch the axe first: no axe, no fighting back, the same rule as chopping.
  const pickups = await page.evaluate(() => window.acornDebug?.pickups() ?? []);
  const axe = pickups.find((entry) => entry.item === 'axe');
  if (axe === undefined) throw new Error('no axe in the clearing');
  await walkWithinReachOf(page, axe.x, axe.z, 'axe');
  await page.keyboard.press('KeyE');
  await expect
    .poll(async () =>
      (await page.evaluate(() => window.acornDebug?.carrying() ?? [])).some(
        (entry) => entry.item === 'axe',
      ),
    )
    .toBe(true);
  await equip(page, 'axe');

  // The same helpers the rabbit hunt uses: neither cares which kind of
  // wildlife it is, only where it is and whether a swing would land.
  //
  // Noticing, chasing, the wind-up, multi-hit defeat and the knockout-and-
  // heal all already have thorough, fast, deterministic coverage in the
  // shared and game-server suites (decision 0024) - a raccoon fights back,
  // so fighting one all the way down live risks a real knockout, and a
  // knocked-out bot walking all the way back out for a second attempt could
  // take longer than this sandbox could reliably finish in. A live browser
  // only needs to prove what only it can: the raccoon renders, the hint
  // names it and its hit count, and one real swing reaches the real server
  // and comes back as a lower count.
  //
  // The hint is usually the fight hint, but a walk this long can run the
  // hunger meter out first on a slow machine (it empties in three minutes
  // here, not the real twenty) - hungry beats everything else on purpose, so
  // either is the hint doing its job correctly.
  const fightHint = /Left click to fight off the masked raccoon|You're hungry/;
  const { hunt: fight } = await huntNearest(page, 'maskedRaccoon', {
    stopWhenHurt: true,
    hint: fightHint,
  });
  expect(fight.hints.some((hint) => fightHint.test(hint))).toBe(true);

  // Landed enough to fell it outright (even better), or its count came down.
  if (!fight.caught) {
    expect(fight.hitsLeft.length).toBeGreaterThan(1);
    expect(Math.min(...fight.hitsLeft)).toBeLessThan(fight.hitsLeft[0] ?? Infinity);
  }

  // Nothing thrown while walking out, aiming or landing a swing.
  expect(errors).toEqual([]);
});

/**
 * Walk back toward a remembered spot, in long sprint holds rather than many
 * short polls - the same lesson the trip out to a rabbit's den already
 * taught this file: each poll is a round trip through the browser, and
 * those add up to more than the walk itself does under a slow render loop.
 *
 * Stops the moment a build is actually possible, not only once close to the
 * remembered spot: that spot is just a landmark guaranteed clear of
 * everything, and plenty of ground closer than a straight line back to it
 * is just as buildable.
 */
async function walkToward(page: Page, target: { x: number; z: number }): Promise<void> {
  for (let attempt = 0; attempt < 15; attempt++) {
    if (await page.evaluate(() => window.acornDebug?.canBuild() ?? false)) return;
    const here = await page.evaluate(() => window.acornDebug?.localPosition());
    const gap = Math.hypot((here?.x ?? 0) - target.x, (here?.z ?? 0) - target.z);
    if (gap < 3) return;
    await page.evaluate(
      ([x, z]) => window.acornDebug?.faceTowards(x ?? 0, z ?? 0),
      [target.x, target.z],
    );

    const holdMs = Math.min(6_000, Math.max(300, (gap / 7) * 1_300));
    await page.keyboard.down('ShiftLeft');
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(holdMs);
    await page.keyboard.up('KeyW');
    await page.keyboard.up('ShiftLeft');
    await page.waitForTimeout(200);
  }
  throw new Error(`Never made it back to ${target.x}, ${target.z}`);
}

/**
 * Face the given spot, open the Craft menu with B, turn to the given page of
 * it (Camp, Yard...), press the given number on that page, then point the mouse at open ground ahead and click until something
 * appears - the way a player places a piece once its preview follows the
 * mouse (decision 0052). Tries a few spots up and down the screen from the
 * middle, nearer and farther from the player, in case the first is not clear. Stops once
 * `piecesWanted` pieces stand in the world, counting any built already.
 */
async function buildFacing(
  page: Page,
  target: { x: number; z: number },
  tab: string,
  digit: string,
  piecesWanted = 1,
): Promise<void> {
  const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
  for (let attempt = 0; attempt < 15; attempt++) {
    if ((await page.evaluate(() => window.acornDebug?.builtProps().length ?? 0)) >= piecesWanted) {
      break;
    }
    await page.evaluate(
      ([x, z]) => window.acornDebug?.faceTowards(x ?? 0, z ?? 0),
      [target.x, target.z],
    );
    if ((await page.evaluate(() => window.acornDebug?.buildPreview() ?? null)) === null) {
      // Wait for the menu itself rather than a fixed moment: at a few frames a
      // second a key pressed just after another can be taken for the same press.
      const menuOpen = async () => page.evaluate(() => window.acornDebug?.craftMenuOpen() ?? false);
      if (!(await menuOpen())) await page.keyboard.press('KeyB');
      await expect.poll(menuOpen).toBe(true);
      await page.locator('.craft-tabs').getByRole('button', { name: tab, exact: true }).click();
      await page.keyboard.press(digit);
    }
    // Up the screen is farther from the player and down is nearer: a big piece
    // like the tent needs room round it, so it is not clear at the first spot.
    const lowerBy = [0, -60, -120, 60, 120, -180];
    const lower = lowerBy[attempt % lowerBy.length] ?? 0;
    await page.mouse.move(viewport.width / 2, viewport.height / 2 + lower);
    await expect
      .poll(
        async () => (await page.evaluate(() => window.acornDebug?.buildPreview()))?.spot ?? null,
      )
      .not.toBeNull();
    const preview = await page.evaluate(() => window.acornDebug?.buildPreview() ?? null);
    if (preview?.refusal === null) {
      await page.mouse.click(viewport.width / 2, viewport.height / 2 + lower);
    }
    await page.waitForTimeout(300);
  }
  if ((await page.evaluate(() => window.acornDebug?.builtProps().length ?? 0)) < piecesWanted) {
    throw new Error('never built anything');
  }
  // Whatever was left out to place another goes away again - on its own
  // once the materials run out, a moment after the server says so, or
  // with Escape otherwise.
  await page.waitForTimeout(800);
  if ((await page.evaluate(() => window.acornDebug?.buildPreview() ?? null)) !== null) {
    await page.keyboard.press('Escape');
  }
}

/**
 * `buildFacing`, trying other ways round if the first is blocked: a rock or a
 * tree close by can refuse every spot in one direction while the next is clear,
 * and which side of the spawn spot the player ends up on depends on where they
 * walked in from.
 */
async function buildFacingAnyWay(
  page: Page,
  firstChoice: { x: number; z: number },
  tab: string,
  digit: string,
  piecesWanted = 1,
): Promise<void> {
  const here = await page.evaluate(() => window.acornDebug?.localPosition() ?? { x: 0, z: 0 });
  const around = [0, 90, 180, 270].map((degrees) => ({
    x: here.x + 10 * Math.cos((degrees * Math.PI) / 180),
    z: here.z + 10 * Math.sin((degrees * Math.PI) / 180),
  }));
  const choices = [firstChoice, ...around];
  for (const [index, target] of choices.entries()) {
    try {
      await buildFacing(page, target, tab, digit, piecesWanted);
      return;
    } catch (error) {
      if (index === choices.length - 1) throw error;
    }
  }
}

/**
 * A point on the far side of the player from a placed piece, to face when the
 * next piece should go up on the other side of them rather than on top of it.
 */
async function pointAwayFrom(
  page: Page,
  piece: { x: number; z: number },
): Promise<{ x: number; z: number }> {
  const here = await page.evaluate(() => window.acornDebug?.localPosition() ?? { x: 0, z: 0 });
  return { x: here.x + (here.x - piece.x), z: here.z + (here.z - piece.z) };
}

/**
 * Everything but a tent needs a building area, and a first tent is what makes
 * one: six sticks, then it goes up on the open ground by the spawn spot.
 * Leaves the player standing beside it and gives back where it stands, ready
 * to build the next piece on the other side.
 */
async function buildFirstTent(
  page: Page,
  spawnSpot: { x: number; z: number },
): Promise<{ x: number; z: number }> {
  await gatherFromPatches(page, 'stick', 6);
  await walkToward(page, spawnSpot);
  await page.evaluate(
    ([x, z]) => window.acornDebug?.faceTowards(x ?? 0, z ?? 0),
    [spawnSpot.x, spawnSpot.z],
  );
  await buildFacingAnyWay(page, spawnSpot, 'Home', 'Digit1');
  const tent = (await page.evaluate(() => window.acornDebug?.builtProps() ?? [])).find(
    (piece) => piece.kind === 'tent',
  );
  if (tent === undefined) throw new Error('the first piece built was not a tent');
  return { x: tent.x, z: tent.z };
}

test('you can chop enough logs to build a campfire, and it is still there next time', async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  const context = await openBrowserContext(browser);
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(`/?world=build-${Date.now()}`);
  await waitForConnected(page);
  await page.locator('.hud-curtain').click();

  // Remembered before walking anywhere: wherever a fresh player spawns is
  // guaranteed clear of every landmark, so it is always somewhere to build.
  const spawnSpot = await page.evaluate(() => window.acornDebug?.localPosition() ?? { x: 0, z: 0 });

  // Fetch the axe and fell the landmark oak beside it, the same as the
  // chopping test does - the oak pays out exactly what a campfire costs.
  const pickups = await page.evaluate(() => window.acornDebug?.pickups() ?? []);
  const axe = pickups.find((entry) => entry.item === 'axe');
  if (axe === undefined) throw new Error('no axe in the clearing');
  await walkWithinReachOf(page, axe.x, axe.z, 'axe');
  await page.keyboard.press('KeyE');
  await expect
    .poll(async () =>
      (await page.evaluate(() => window.acornDebug?.carrying() ?? [])).some(
        (entry) => entry.item === 'axe',
      ),
    )
    .toBe(true);
  await equip(page, 'axe');

  const trees = await page.evaluate(() => window.acornDebug?.trees() ?? []);
  const oak = trees.find((tree) => tree.kind === 'oak');
  if (oak === undefined) throw new Error('no oak in the clearing');
  await walkWithinReachOfTree(page, oak);
  await chopUntilFelled(page, oak);
  await collectFallenLogs(page);

  const carriedLogs = await page.evaluate(() => window.acornDebug?.carrying() ?? []);
  expect(carriedLogs.find((entry) => entry.item === 'log')?.count).toBe(4);

  // Back to open ground to build on - the axe stump and the felled oak are
  // both still standing right where the logs came from.
  await walkToward(page, spawnSpot);
  await page.evaluate(
    ([x, z]) => window.acornDebug?.faceTowards(x ?? 0, z ?? 0),
    [spawnSpot.x, spawnSpot.z],
  );
  await expect.poll(async () => page.evaluate(() => window.acornDebug?.canBuild())).toBe(true);
  // No hint at all counts too, so read whatever is showing rather than wait
  // for an element that is not there.
  await expect
    .poll(async () => (await page.locator('.hud-hint').allTextContents()).join(' '))
    .not.toContain('Press B to build');

  // Opening the menu with only four logs offers the campfire but not the
  // starter tent (which costs six sticks). Picking the unaffordable one still shows its
  // preview, red, saying what is missing (decision 0052) - and a click
  // then places nothing. The one Craft menu lists every option (decisions 0043
  // and 0096); the hint line beneath it just says how to close it.
  await page.keyboard.press('KeyB');
  await expect(page.locator('.hud-hint')).toContainText('Pick one below, or C to close');
  await page
    .locator('.hud-journal-entry')
    .filter({ hasText: /^\d?Tent/ })
    .click();
  expect(await page.evaluate(() => window.acornDebug?.craftMenuOpen() ?? true)).toBe(false);
  await centerMouse(page);
  await expect(page.locator('.hud-hint')).toContainText('Need 6 more sticks');
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.acornDebug?.builtProps().length ?? 0)).toBe(0);
  // Escape puts it away again, before anything else it would do.
  await page.keyboard.press('Escape');
  await expect
    .poll(async () => page.evaluate(() => window.acornDebug?.buildPreview() ?? null))
    .toBeNull();
  await expect(page.locator('.hud-curtain')).toBeHidden();

  // A campfire needs a building area, and the first tent is what makes one. Then
  // the campfire goes up on the other side of the player from the tent.
  const tent = await buildFirstTent(page, spawnSpot);
  await buildFacingAnyWay(page, await pointAwayFrom(page, tent), 'Camp', 'Digit1', 2);

  const built = await page.evaluate(() => window.acornDebug?.builtProps() ?? []);
  expect(built.map((piece) => piece.kind).sort()).toEqual(['campfire', 'tent']);
  const carriedAfter = await page.evaluate(() => window.acornDebug?.carrying() ?? []);
  expect(carriedAfter.find((entry) => entry.item === 'log')).toBeUndefined();
  expect(carriedAfter.find((entry) => entry.item === 'axe')?.count).toBe(1);

  // The Phase 1 promise, for a campfire this time: log out, come back, it is
  // still there.
  const url = page.url();
  await page.close();
  const again = await context.newPage();
  await again.goto(url);
  await waitForConnected(again);
  await expect
    .poll(async () => (await again.evaluate(() => window.acornDebug?.builtProps() ?? [])).length)
    .toBe(2);
  const rebuilt = await again.evaluate(() => window.acornDebug?.builtProps() ?? []);
  expect(rebuilt).toEqual(built);

  // Nothing thrown while chopping, walking back or placing the campfire.
  expect(errors).toEqual([]);

  await context.close();
});

test('you can light a campfire and put it out again', async ({ page }) => {
  // Fetching the axe and felling the oak is the same real cost the building
  // test pays, since a campfire needs it either way.
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(`/?world=light-${Date.now()}`);
  await waitForConnected(page);
  await page.locator('.hud-curtain').click();

  const spawnSpot = await page.evaluate(() => window.acornDebug?.localPosition() ?? { x: 0, z: 0 });

  const pickups = await page.evaluate(() => window.acornDebug?.pickups() ?? []);
  const axe = pickups.find((entry) => entry.item === 'axe');
  if (axe === undefined) throw new Error('no axe in the clearing');
  await walkWithinReachOf(page, axe.x, axe.z, 'axe');
  await page.keyboard.press('KeyE');
  await expect
    .poll(async () =>
      (await page.evaluate(() => window.acornDebug?.carrying() ?? [])).some(
        (entry) => entry.item === 'axe',
      ),
    )
    .toBe(true);
  await equip(page, 'axe');

  const trees = await page.evaluate(() => window.acornDebug?.trees() ?? []);
  const oak = trees.find((tree) => tree.kind === 'oak');
  if (oak === undefined) throw new Error('no oak in the clearing');
  await walkWithinReachOfTree(page, oak);
  await chopUntilFelled(page, oak);
  await collectFallenLogs(page);

  // The first tent makes the building area the campfire goes into.
  const tent = await buildFirstTent(page, spawnSpot);
  await buildFacingAnyWay(page, await pointAwayFrom(page, tent), 'Camp', 'Digit1', 2);

  const campfireNow = async () =>
    (await page.evaluate(() => window.acornDebug?.builtProps() ?? [])).find(
      (piece) => piece.kind === 'campfire',
    );
  const campfire = await campfireNow();
  if (campfire === undefined) throw new Error('no campfire was built');
  expect(campfire.lit).toBe(false);

  // Built BUILD_DISTANCE away, past interact reach - one more short walk.
  await walkOntoSpot(page, campfire.x, campfire.z);
  await expect(page.locator('.hud-hint')).toContainText('Press E to light the campfire');

  await page.keyboard.press('KeyE');
  await expect.poll(async () => (await campfireNow())?.lit).toBe(true);
  await expect(page.locator('.hud-hint')).toContainText('Press E to put out the campfire');
  // A look at the fire's own light on the ground around it, by eye - the
  // same reason the axe's grip got a screenshot in the equip test above.
  await page.screenshot({ path: 'test-results/campfire-lit.png' });

  // Put out by hand, well before the ten minutes it would otherwise take -
  // that timing lives in a fast, non-browser test instead of a real wait here.
  await page.keyboard.press('KeyE');
  await expect.poll(async () => (await campfireNow())?.lit).toBe(false);
  await expect(page.locator('.hud-hint')).toContainText('Press E to light the campfire');

  expect(errors).toEqual([]);
});

test('you can gather flowers and plant something pretty for the garden', async ({ page }) => {
  // Two real walks (out to a patch and back to open ground) on top of the
  // gathering itself, the same reason the campfire test budgets generously.
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(`/?world=flowers-${Date.now()}`);
  await waitForConnected(page);
  await page.locator('.hud-curtain').click();

  // Remembered before wandering off to a flower patch, the same reason the
  // campfire test remembers it: guaranteed clear of every landmark to build on.
  const spawnSpot = await page.evaluate(() => window.acornDebug?.localPosition() ?? { x: 0, z: 0 });

  const spots = await page.evaluate(() => window.acornDebug?.gatherSpots() ?? []);
  const spot = spots.find((entry) => entry.item === 'flower');
  expect(spot).toBeDefined();
  if (spot === undefined) throw new Error('no flower patch in the clearing');

  await walkWithinReachOfGatherSpot(page, spot.x, spot.z);
  await expect(page.locator('.hud-hint')).toContainText('Right-click or press E to gather flowers');

  // A lantern is the cheaper of the two decorations, at four - more than
  // one patch may hold, so this walks on to the next once one runs out.
  await gatherFromPatches(page, 'flower', 4);
  const gathered = await countHeld(page, 'flower');
  expect(gathered).toBeGreaterThanOrEqual(4);

  await walkToward(page, spawnSpot);
  await page.evaluate(
    ([x, z]) => window.acornDebug?.faceTowards(x ?? 0, z ?? 0),
    [spawnSpot.x, spawnSpot.z],
  );
  await expect.poll(async () => page.evaluate(() => window.acornDebug?.canBuild())).toBe(true);

  // One Craft menu lists everything. Its Yard page holds the flower bed, the
  // fence, the garden path stone (decision 0048) and the planter, and the
  // lantern sits on the Camp page that is built from below.
  await page.keyboard.press('KeyB');
  await page.locator('.craft-tabs').getByRole('button', { name: 'Yard', exact: true }).click();
  await expect(page.locator('.hud-journal-entry')).toHaveCount(4);
  await expect(page.locator('.hud-journal')).toContainText('Fence');
  await expect(page.locator('.hud-journal')).toContainText('Garden path');
  await page.keyboard.press('KeyB');
  await expect
    .poll(async () => page.evaluate(() => window.acornDebug?.craftMenuOpen() ?? true))
    .toBe(false);

  // The lantern needs a building area, so the first tent goes up before it.
  const tent = await buildFirstTent(page, spawnSpot);
  await buildFacingAnyWay(page, await pointAwayFrom(page, tent), 'Camp', 'Digit2', 2);

  const built = await page.evaluate(() => window.acornDebug?.builtProps() ?? []);
  expect(built.map((piece) => piece.kind).sort()).toEqual(['lantern', 'tent']);
  // A look at the lantern's own light, by eye - the same reason the lit
  // campfire got a screenshot in the build test above.
  await page.screenshot({ path: 'test-results/lantern-lit.png' });

  const spent = await page.evaluate(
    () => window.acornDebug?.carrying().find((entry) => entry.item === 'flower')?.count ?? 0,
  );
  expect(spent).toBe(gathered - 4);

  // Nothing thrown while gathering, walking back, pitching the tent or planting the lantern.
  expect(errors).toEqual([]);
});

test.describe('woods interaction polish', () => {
  // A small drawing buffer keeps interaction checks useful on software-rendered CI.
  test.use({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 0.5 });
  test.setTimeout(180_000);
  test('keeps the controls guide under Settings > Keybindings', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('tab', { name: 'Keybindings' }).click();
    await expect(page.getByRole('tabpanel')).toContainText('Loot the item under your cursor');
    await expect(page.getByRole('tabpanel')).toContainText('Dodge roll');
    await expect(page.getByRole('tabpanel')).toContainText('Cancel placement');
    await page.getByRole('tab', { name: 'General' }).click();
    await expect(page.getByRole('tabpanel')).toContainText('Music volume');
  });

  test('shows a landscape and honest progress before the world is ready', async ({ page }) => {
    await page.route('**/*.glb', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.continue();
    });
    await page.goto(`/?renderer=webgl2&world=polish-${Date.now()}`);
    await page.locator('#home-name').fill('Woodland Wanderer');
    await page.locator('.home-play').click();
    const loading = page.getByTestId('loading-screen');
    await expect(loading).toBeVisible();
    await expect(loading).toContainText('Entering the woods…');
    await expect(loading.locator('img')).toBeVisible();
    const bar = loading.getByRole('progressbar');
    const progress = Number(await bar.getAttribute('aria-valuenow'));
    expect(progress).toBeGreaterThanOrEqual(0);
    expect(progress).toBeLessThan(100);
    await expect(loading).toBeHidden({ timeout: 120_000 });
    await expect(page.locator('.hud-curtain')).toContainText('Welcome, Woodland Wanderer');
    await expect(page.locator('.hud-curtain')).not.toContainText('WASD');
  });

  test('right-clicks world loot and keeps camera drags from looting', async ({ page }) => {
    await page.goto(`/?renderer=webgl2&world=polish-${Date.now()}`);
    await waitForConnected(page);
    await page.locator('.hud-curtain').click();
    const bag = await page.evaluate(() =>
      window.acornDebug?.pickups().find((pickup) => pickup.item === 'bag'),
    );
    if (bag === undefined) throw new Error('No bag in the clearing');
    await page.evaluate(([x, z]) => window.acornDebug?.faceTowards(x!, z!), [bag.x, bag.z]);
    await walkWithinReachOf(page, bag.x, bag.z, 'bag');
    const point = await page.evaluate(
      ([x, z]) => window.acornDebug?.screenPoint(x!, 0.12, z!),
      [bag.x, bag.z],
    );
    if (point == null) throw new Error('Bag is off screen');
    await page.mouse.move(point.x, point.y);
    await expect(page.locator('.loot-hover')).toContainText('Right-click to loot');
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(point.x + 30, point.y, { steps: 3 });
    await page.mouse.up({ button: 'right' });
    expect(await countHeld(page, 'bag')).toBe(0);
    await page.evaluate(([x, z]) => window.acornDebug?.faceTowards(x!, z!), [bag.x, bag.z]);
    await page.waitForTimeout(250);
    const restoredPoint = await page.evaluate(
      ([x, z]) => window.acornDebug?.screenPoint(x!, 0.12, z!),
      [bag.x, bag.z],
    );
    if (restoredPoint == null) throw new Error('Bag is off screen after turning the camera');
    await page.mouse.move(restoredPoint.x, restoredPoint.y);
    await expect(page.locator('.loot-hover')).toContainText('Right-click to loot');
    await page.mouse.click(restoredPoint.x, restoredPoint.y, { button: 'right' });
    await expect.poll(() => countHeld(page, 'bag')).toBe(1);
    await expect(page.locator('.loot-hover')).toBeHidden();
  });

  test('preserves inventory right-click menus', async ({ page }) => {
    await page.goto(`/?renderer=webgl2&world=inventory-polish-${Date.now()}`);
    await waitForConnected(page);
    await page.locator('.hud-curtain').click();
    const patch = await page.evaluate(() =>
      window.acornDebug?.gatherSpots().find((spot) => spot.item === 'stick' && spot.remaining > 0),
    );
    if (patch === undefined) throw new Error('No stick patch in the clearing');
    await page.evaluate(([x, z]) => window.acornDebug?.faceTowards(x!, z!), [patch.x, patch.z]);
    // Hold through rendered frames on slow software GPUs, rather than sending
    // movement taps that can both arrive between two animation frames.
    await page.keyboard.down('KeyW');
    await page.keyboard.down('KeyE');
    try {
      await expect
        .poll(() => countHeld(page, 'stick'), { timeout: 60_000, intervals: [1000] })
        .toBeGreaterThan(1);
    } finally {
      await page.keyboard.up('KeyW');
      await page.keyboard.up('KeyE');
    }
    // "Drop one" is only offered when there is more than one to drop.
    await page.keyboard.press('KeyI');
    await page.getByTestId('pack-slot-stick').click({ button: 'right' });
    await expect(page.locator('.slot-menu')).toBeVisible();
    await expect(page.getByTestId('slot-menu-drop-one')).toBeVisible();
    await expect(page.getByTestId('slot-menu-destroy')).toBeVisible();
  });
});
