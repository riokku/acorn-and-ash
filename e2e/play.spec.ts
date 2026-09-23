import { expect, test, type Page } from '@playwright/test';

declare global {
  interface Window {
    acornDebug?: {
      selfNetId(): number;
      localPosition(): { x: number; y: number; z: number };
      remotePlayers(): Array<{ netId: number; x: number; y: number; z: number }>;
      animals(): Array<{ id: number; kind: string; x: number; y: number; z: number }>;
      carrying(): Array<{ item: string; count: number }>;
      takenPickups(): number[];
      pickups(): Array<{ id: number; item: string; x: number; z: number }>;
      gatherSpots(): Array<{ x: number; z: number; item: string }>;
      nearbyItem(): string | null;
      nearGatherSpot(): string | null;
      felledTrees(): number[];
      treeGenerations(): Array<{ id: number; generation: number }>;
      trees(): Array<{ id: number; kind: string; x: number; z: number; swingsToFell: number }>;
      aimedTree(): { name: string; swingsLeft: number } | null;
      aimedAnimal(): { name: string; hitsLeft?: number } | null;
      canBuild(): boolean;
      buildMenuOpen(): boolean;
      builtProps(): Array<{ id: number; kind: string; x: number; z: number }>;
      faceTowards(x: number, z: number): void;
      pond(): Array<{ x: number; z: number; radius: number }>;
      canCast(): boolean;
      fishing(): 'waiting' | 'biting' | null;
      fishingNews(): string | null;
      hunger(): number;
      hungerNews(): string | null;
      health(): number;
      healthNews(): string | null;
      craftingNews(): string | null;
      huntingNews(): string | null;
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
 * Walk to a spot until the game says you can reach what is there.
 *
 * In short steps, stopping between each one. Holding the key down and watching
 * the distance does not work: on a slow machine the player keeps walking for as
 * long as it takes to let go, which is long enough to sail straight past.
 *
 * The condition is the game's own answer rather than a distance we work out
 * here, so the test ends up where the player would actually get the prompt.
 */
async function walkWithinReachOf(page: Page, x: number, z: number): Promise<void> {
  for (let step = 0; step < 80; step++) {
    const reachable = await page.evaluate(() => window.acornDebug?.nearbyItem() ?? null);
    if (reachable !== null) return;

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

/**
 * Walk up to a tree until the game says a swing would reach it.
 *
 * Never assume standing where the axe was leaves you in range of the oak beside
 * it: where you stop depends on which way you came in, and the difference
 * between two and three metres is the difference between chopping and flailing.
 */
async function walkWithinReachOfTree(page: Page, tree: { x: number; z: number }): Promise<void> {
  for (let step = 0; step < 80; step++) {
    if ((await page.evaluate(() => window.acornDebug?.aimedTree() ?? null)) !== null) return;

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
  const context = await browser.newContext();
  // A fresh world, so the axe is definitely still in its stump.
  const page = await context.newPage();
  await page.goto(`/?world=axe-${Date.now()}`);
  await waitForConnected(page);
  await page.locator('.hud-curtain').click();

  // Nothing to start with, and the axe is out there waiting.
  expect(await page.evaluate(() => window.acornDebug?.carrying())).toEqual([]);
  expect(await page.evaluate(() => window.acornDebug?.takenPickups())).toEqual([]);
  await expect(page.locator('.hud-row', { hasText: 'Carrying' }).first()).toContainText(
    'nothing yet',
  );

  const pickups = await page.evaluate(() => window.acornDebug?.pickups() ?? []);
  const axe = pickups.find((entry) => entry.item === 'axe');
  expect(axe).toBeDefined();
  if (axe === undefined) throw new Error('no axe in the clearing');

  await walkWithinReachOf(page, axe.x, axe.z);

  // Standing next to it, the game offers it.
  await expect(page.locator('.hud-hint')).toContainText('Press E to pick up the axe');

  await page.keyboard.press('KeyE');
  await expect
    .poll(async () => (await page.evaluate(() => window.acornDebug?.carrying() ?? [])).length)
    .toBeGreaterThan(0);

  expect(await page.evaluate(() => window.acornDebug?.carrying())).toEqual([
    { item: 'axe', count: 1 },
  ]);
  expect(await page.evaluate(() => window.acornDebug?.takenPickups())).toEqual([axe.id]);
  await expect(page.locator('.hud-row', { hasText: 'Carrying' }).first()).toContainText('Axe');

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
  await expect(page.locator('.hud-hint')).toContainText('Press E to gather sticks');

  const craftRow = page.locator('.hud-row', { hasText: 'Craft' }).first();
  await expect(craftRow).toContainText('Axe');
  // Not enough sticks yet: the recipe is not lit up.
  await expect(craftRow.locator('.hud-status-good')).toHaveCount(0);

  // Taps, not a hold: the server paces gathering the same way it paces a
  // swing, and holding down the key does not gather any faster.
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(600);
  }

  const sticks = await page.evaluate(
    () => window.acornDebug?.carrying().find((entry) => entry.item === 'stick')?.count ?? 0,
  );
  expect(sticks).toBeGreaterThanOrEqual(3);
  await expect(craftRow.locator('.hud-status-good')).toContainText('Axe');

  await page.keyboard.press('Digit1');
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => window.acornDebug?.carrying() ?? [])).find(
          (entry) => entry.item === 'axe',
        )?.count ?? 0,
    )
    .toBe(1);

  await expect(page.locator('.hud-row', { hasText: 'Carrying' }).first()).toContainText('Axe');
  await expect
    .poll(async () => page.evaluate(() => window.acornDebug?.craftingNews() ?? null))
    .toBe('You made an axe.');

  // Nothing thrown while gathering, crafting or drawing the stick patches.
  expect(errors).toEqual([]);
});

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

test('you can chop a tree down, and the stump is still there next time', async ({ browser }) => {
  test.setTimeout(240_000);
  // One context throughout, so coming back is the same player returning.
  const context = await browser.newContext();
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
  await walkWithinReachOf(page, axe.x, axe.z);
  await page.keyboard.press('KeyE');
  await expect
    .poll(async () => (await page.evaluate(() => window.acornDebug?.carrying() ?? [])).length)
    .toBeGreaterThan(0);

  // The big oak stands right beside the axe's stump.
  const trees = await page.evaluate(() => window.acornDebug?.trees() ?? []);
  const oak = trees.find((tree) => tree.kind === 'oak');
  if (oak === undefined) throw new Error('no oak in the clearing');

  // Walk up to it: the axe's stump is beside the oak, not against it.
  await walkWithinReachOfTree(page, oak);

  // Facing it, the game offers the swing and says how much is left in it.
  await expect.poll(async () => page.evaluate(() => window.acornDebug?.aimedTree())).not.toBeNull();
  await expect(page.locator('.hud-hint')).toContainText('Left click to chop the oak');

  await chopUntilFelled(page, oak);

  // It is down, and the wood is ours.
  expect(await page.evaluate(() => window.acornDebug?.felledTrees())).toEqual([oak.id]);
  const carried = await page.evaluate(() => window.acornDebug?.carrying() ?? []);
  expect(carried.find((entry) => entry.item === 'log')?.count).toBeGreaterThan(0);
  await expect(page.locator('.hud-row', { hasText: 'Carrying' }).first()).toContainText('Logs');

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

test('a chopped tree grows back on its own', async ({ browser }) => {
  // Locally a tree takes two to four minutes to come back, and this waits it out.
  test.setTimeout(600_000);
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`/?world=regrow-${Date.now()}`);
  await waitForConnected(page);
  await page.locator('.hud-curtain').click();

  // Fetch the axe and fell the oak beside it.
  const pickups = await page.evaluate(() => window.acornDebug?.pickups() ?? []);
  const axe = pickups.find((entry) => entry.item === 'axe');
  if (axe === undefined) throw new Error('no axe in the clearing');
  await walkWithinReachOf(page, axe.x, axe.z);
  await page.keyboard.press('KeyE');
  await expect
    .poll(async () => (await page.evaluate(() => window.acornDebug?.carrying() ?? [])).length)
    .toBeGreaterThan(0);

  const trees = await page.evaluate(() => window.acornDebug?.trees() ?? []);
  const oak = trees.find((tree) => tree.kind === 'oak');
  if (oak === undefined) throw new Error('no oak in the clearing');
  await walkWithinReachOfTree(page, oak);
  await chopUntilFelled(page, oak);
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
  await page.mouse.down();
  await page.waitForTimeout(90);
  await page.mouse.up();
}

test('you can find the rod, cast into the pond and land a fish', async ({ browser }) => {
  test.setTimeout(180_000);
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`/?world=fish-${Date.now()}`);
  await waitForConnected(page);
  await page.locator('.hud-curtain').click();

  // The rod is lying on the bank.
  const pickups = await page.evaluate(() => window.acornDebug?.pickups() ?? []);
  const rod = pickups.find((entry) => entry.item === 'rod');
  if (rod === undefined) throw new Error('no rod in the clearing');
  await walkWithinReachOf(page, rod.x, rod.z);
  await expect(page.locator('.hud-hint')).toContainText('Press E to pick up the fishing rod');
  await page.keyboard.press('KeyE');
  await expect
    .poll(async () =>
      (await page.evaluate(() => window.acornDebug?.carrying() ?? [])).some(
        (entry) => entry.item === 'rod',
      ),
    )
    .toBe(true);

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
  await expect(page.locator('.hud-row', { hasText: 'Carrying' }).first()).toContainText(
    /Perch|Trout|Golden carp/,
  );
  expect(await page.evaluate(() => window.acornDebug?.fishing())).toBeNull();

  await context.close();
});

/**
 * Walk toward wherever an animal currently is - it wanders, so this re-reads
 * its position every attempt rather than aiming at a fixed spot - until the
 * game says a swing would land on it.
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

    // Close enough that it may already be bolting, curving fresh every tick
    // to run straight away from whoever is chasing it - aiming once and then
    // sprinting blind for seconds just walks to where it *was*. A sprinting
    // player only just outpaces a fleeing rabbit (7 m/s vs 6), so the chase
    // only gains ground by re-aiming often: a short hold, then look again.
    await page.keyboard.down('ShiftLeft');
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(400);
    await page.keyboard.up('KeyW');
    await page.keyboard.up('ShiftLeft');
    await page.waitForTimeout(80);
  }
  throw new Error(`Never got within swinging distance of animal ${animalId}`);
}

/**
 * Swing at the animal in taps, re-aiming each time since it can still drift
 * before the first one lands, until the server says it is caught.
 */
async function catchUntilCaught(page: Page, animalId: number): Promise<void> {
  for (let step = 0; step < 20; step++) {
    const animals = await page.evaluate(() => window.acornDebug?.animals() ?? []);
    const animal = animals.find((entry) => entry.id === animalId);
    if (animal === undefined) return;

    await page.evaluate(
      ([x, z]) => window.acornDebug?.faceTowards(x ?? 0, z ?? 0),
      [animal.x, animal.z],
    );
    await page.mouse.down();
    await page.waitForTimeout(200);
    await page.mouse.up();
    await page.waitForTimeout(150);
  }
  throw new Error(`animal ${animalId} was never caught`);
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
  await walkWithinReachOf(page, axe.x, axe.z);
  await page.keyboard.press('KeyE');
  await expect
    .poll(async () =>
      (await page.evaluate(() => window.acornDebug?.carrying() ?? [])).some(
        (entry) => entry.item === 'axe',
      ),
    )
    .toBe(true);

  const animals = await page.evaluate(() => window.acornDebug?.animals() ?? []);
  const rabbit = animals[0];
  if (rabbit === undefined) throw new Error('no wildlife nearby to hunt');

  await walkWithinReachOfAnimal(page, rabbit.id);
  // Usually the catch hint, but a walk this long can run the hunger meter
  // out first on a slow machine (it empties in three minutes here, not the
  // real twenty) - hungry beats everything else on purpose, so either is the
  // hint doing its job correctly.
  await expect(page.locator('.hud-hint')).toContainText(
    /Left click to catch the rabbit|You're hungry/,
  );

  await catchUntilCaught(page, rabbit.id);

  // It is gone, and the meat is ours.
  expect(
    (await page.evaluate(() => window.acornDebug?.animals() ?? [])).some(
      (entry) => entry.id === rabbit.id,
    ),
  ).toBe(false);
  const carried = await page.evaluate(() => window.acornDebug?.carrying() ?? []);
  expect(carried.find((entry) => entry.item === 'meat')?.count).toBeGreaterThan(0);
  await expect(page.locator('.hud-row', { hasText: 'Carrying' }).first()).toContainText('Meat');
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
  await walkWithinReachOf(page, axe.x, axe.z);
  await page.keyboard.press('KeyE');
  await expect
    .poll(async () =>
      (await page.evaluate(() => window.acornDebug?.carrying() ?? [])).some(
        (entry) => entry.item === 'axe',
      ),
    )
    .toBe(true);

  const animals = await page.evaluate(() => window.acornDebug?.animals() ?? []);
  const raccoon = animals.find((entry) => entry.kind === 'maskedRaccoon');
  if (raccoon === undefined) throw new Error('no masked raccoon in the wilderness');

  // The same helpers the rabbit hunt uses: neither cares which kind of
  // wildlife it is, only where it is and whether a swing would land.
  await walkWithinReachOfAnimal(page, raccoon.id);
  // Usually the fight hint, but a walk this long can run the hunger meter out
  // first on a slow machine (it empties in three minutes here, not the real
  // twenty) - hungry beats everything else on purpose, so either is the hint
  // doing its job correctly.
  await expect(page.locator('.hud-hint')).toContainText(
    /Left click to fight off the masked raccoon|You're hungry/,
  );

  // Noticing, chasing, the wind-up, multi-hit defeat and the knockout-and-
  // heal all already have thorough, fast, deterministic coverage in the
  // shared and game-server suites (decision 0024) - a raccoon fights back,
  // so fighting one all the way down live risks a real knockout, and a
  // knocked-out bot walking all the way back out for a second attempt could
  // take longer than this sandbox could reliably finish in. A live browser
  // only needs to prove what only it can: the raccoon renders, the hint
  // names it and its hit count, and one real swing reaches the real server
  // and comes back as a lower count.
  const before = await page.evaluate(() => window.acornDebug?.aimedAnimal()?.hitsLeft ?? null);
  expect(before).not.toBeNull();

  for (let attempt = 0; attempt < 10; attempt++) {
    const stillThere = (await page.evaluate(() => window.acornDebug?.animals() ?? [])).some(
      (entry) => entry.id === raccoon.id,
    );
    if (!stillThere) break; // landed enough to fell it outright - even better
    const hitsLeft = await page.evaluate(() => window.acornDebug?.aimedAnimal()?.hitsLeft ?? null);
    if (hitsLeft !== null && before !== null && hitsLeft < before) break;

    await page.mouse.down();
    await page.waitForTimeout(200);
    await page.mouse.up();
    await page.waitForTimeout(150);
  }

  const stillThere = (await page.evaluate(() => window.acornDebug?.animals() ?? [])).some(
    (entry) => entry.id === raccoon.id,
  );
  if (stillThere) {
    const after = await page.evaluate(() => window.acornDebug?.aimedAnimal()?.hitsLeft ?? null);
    expect(after).not.toBeNull();
    expect(after).toBeLessThan(before ?? Infinity);
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
 * Face the given spot, open the build menu with B, and pick the given menu
 * slot until something appears somewhere.
 */
async function buildFacing(
  page: Page,
  target: { x: number; z: number },
  digit: string,
): Promise<void> {
  for (let attempt = 0; attempt < 15; attempt++) {
    if ((await page.evaluate(() => window.acornDebug?.builtProps().length ?? 0)) > 0) return;
    await page.evaluate(
      ([x, z]) => window.acornDebug?.faceTowards(x ?? 0, z ?? 0),
      [target.x, target.z],
    );
    await page.keyboard.press('KeyB');
    await page.waitForTimeout(150);
    await page.keyboard.press(digit);
    await page.waitForTimeout(200);
  }
  throw new Error('never built anything');
}

test('you can chop enough logs to build a campfire, and it is still there next time', async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  const context = await browser.newContext();
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
  await walkWithinReachOf(page, axe.x, axe.z);
  await page.keyboard.press('KeyE');
  await expect
    .poll(async () =>
      (await page.evaluate(() => window.acornDebug?.carrying() ?? [])).some(
        (entry) => entry.item === 'axe',
      ),
    )
    .toBe(true);

  const trees = await page.evaluate(() => window.acornDebug?.trees() ?? []);
  const oak = trees.find((tree) => tree.kind === 'oak');
  if (oak === undefined) throw new Error('no oak in the clearing');
  await walkWithinReachOfTree(page, oak);
  await chopUntilFelled(page, oak);

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
  await expect(page.locator('.hud-hint')).toContainText('Press B to build');

  // Opening the menu with only four logs offers the campfire but not the
  // cabin (which costs ten) - picking the unaffordable one should do
  // nothing and leave the menu's own key free for a moment later.
  await page.keyboard.press('KeyB');
  await expect(page.locator('.hud-hint')).toContainText('Press 1 for a campfire, 2 for a cabin');
  await page.keyboard.press('Digit2');
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.acornDebug?.builtProps().length ?? 0)).toBe(0);
  expect(await page.evaluate(() => window.acornDebug?.buildMenuOpen() ?? true)).toBe(false);

  await buildFacing(page, spawnSpot, 'Digit1');

  const built = await page.evaluate(() => window.acornDebug?.builtProps() ?? []);
  expect(built).toHaveLength(1);
  expect(built[0]?.kind).toBe('campfire');
  expect(await page.evaluate(() => window.acornDebug?.carrying() ?? [])).toEqual([
    { item: 'axe', count: 1 },
  ]);
  await expect(page.locator('.hud-row', { hasText: 'Carrying' }).first()).not.toContainText('Log');

  // The Phase 1 promise, for a campfire this time: log out, come back, it is
  // still there.
  const url = page.url();
  await page.close();
  const again = await context.newPage();
  await again.goto(url);
  await waitForConnected(again);
  await expect
    .poll(async () => (await again.evaluate(() => window.acornDebug?.builtProps() ?? [])).length)
    .toBe(1);
  const rebuilt = await again.evaluate(() => window.acornDebug?.builtProps() ?? []);
  expect(rebuilt).toEqual(built);

  // Nothing thrown while chopping, walking back or placing the campfire.
  expect(errors).toEqual([]);

  await context.close();
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
  await expect(page.locator('.hud-hint')).toContainText('Press E to gather flowers');

  // A lantern is the cheaper of the two decorations, at four - gathered in
  // taps, the same pacing the stick patches already use.
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(600);
  }
  const gathered = await page.evaluate(
    () => window.acornDebug?.carrying().find((entry) => entry.item === 'flower')?.count ?? 0,
  );
  expect(gathered).toBeGreaterThanOrEqual(4);

  await walkToward(page, spawnSpot);
  await page.evaluate(
    ([x, z]) => window.acornDebug?.faceTowards(x ?? 0, z ?? 0),
    [spawnSpot.x, spawnSpot.z],
  );
  await expect.poll(async () => page.evaluate(() => window.acornDebug?.canBuild())).toBe(true);

  // All four buildables now show in the menu, in the same order every time.
  await page.keyboard.press('KeyB');
  await expect(page.locator('.hud-hint')).toContainText(
    'Press 1 for a campfire, 2 for a cabin, 3 for a flower bed, 4 for a lantern',
  );
  await page.keyboard.press('KeyB');
  await page.waitForTimeout(150);

  await buildFacing(page, spawnSpot, 'Digit4');

  const built = await page.evaluate(() => window.acornDebug?.builtProps() ?? []);
  expect(built).toHaveLength(1);
  expect(built[0]?.kind).toBe('lantern');

  const spent = await page.evaluate(
    () => window.acornDebug?.carrying().find((entry) => entry.item === 'flower')?.count ?? 0,
  );
  expect(spent).toBe(gathered - 4);

  // Nothing thrown while gathering, walking back or planting the lantern.
  expect(errors).toEqual([]);
});
