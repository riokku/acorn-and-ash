import { expect, test, type Page } from '@playwright/test';
import * as shared from '../packages/shared/src/index';

/**
 * Every tree can be chopped (decision 0098), the forest's as well as the
 * clearing's: the swings land, the tree falls and leaves a stump, logs lie
 * where it came down, and it grows back.
 *
 * Like the reeds test, the server is played by an in-page copy of the
 * simulation, with the player already standing at the foot of a tree out in
 * the forest. That keeps the test to what is new - what the browser shows and
 * sends for a forest tree - instead of a long walk through the trees.
 */
test.use({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 0.5 });
test.setTimeout(240_000);

const SEED = shared.DEFAULT_WORLD_SEED;

/** A tree out in the forest that can be chopped, and somewhere open to stand beside it, facing it. */
function aForestTreeAndAPlaceToStand() {
  const terrain = shared.createWildernessTerrain(SEED);
  const forest = shared.buildWilderness(SEED, terrain);
  const probe = new shared.WorldSimulation({ seed: SEED, hungerEmptyAfterSeconds: Infinity });
  probe.addPlayer(1, undefined, 'probe');
  try {
    const candidates = forest.props
      .filter((prop) => shared.choppingRuleFor(shared.PROP_KINDS[prop.kind]) !== null)
      .filter((prop) => Math.hypot(prop.x, prop.z) > 45 && Math.hypot(prop.x, prop.z) < 100);
    for (const tree of candidates) {
      const radius = shared.PROP_KINDS[tree.kind].colliderRadius * tree.scale;
      for (let step = 0; step < 8; step++) {
        const angle = (step / 8) * Math.PI * 2;
        const x = tree.x + Math.cos(angle) * (radius + 0.9);
        const z = tree.z + Math.sin(angle) * (radius + 0.9);
        probe.placePlayer(1, { x, y: terrain.heightAt(x, z), z }, 0);
        probe.queueInput(1, shared.createInput(step + 1, 0, 0, 0, 0));
        probe.step(Date.now() + step * 50);
        const here = probe.outdoorPositionOf(1);
        if (here === null || Math.hypot(here.x - x, here.z - z) > 0.05) continue;
        const yaw = Math.atan2(-(tree.x - x), -(tree.z - z));
        return { tree, x, z, yaw };
      }
    }
  } finally {
    probe.dispose();
  }
  throw new Error('no forest tree has open ground beside it');
}

async function enterWorld(page: Page, world: string): Promise<void> {
  await page.goto(`/?renderer=webgl2&world=${world}`);
  await page.locator('#home-name').fill('Mira');
  await page.locator('.home-play').click();
  await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
}

test('a tree out in the forest can be chopped down and grows back', async ({ page }) => {
  const { tree, x, z, yaw } = aForestTreeAndAPlaceToStand();
  expect(tree.id).toBeGreaterThanOrEqual(shared.WILDERNESS_PROP_FIRST_ID);

  const sim = new shared.WorldSimulation({ seed: SEED, hungerEmptyAfterSeconds: Infinity });
  sim.addPlayer(
    1,
    {
      netId: 1,
      x,
      y: 0,
      z,
      facingYaw: yaw,
      items: [
        { item: 'bag', count: 1 },
        { item: 'axe', count: 1 },
      ],
      hunger: 100,
    },
    'woodcutter',
  );
  sim.useItem(1, 'axe');
  sim.placePlayer(1, { x, y: 0, z }, yaw);

  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ body: '', contentType: 'text/css' }),
  );
  let send: (data: ArrayBuffer) => void = () => {};
  /** What the real server announces after a step: swings, trees that changed, logs lying about. */
  const announce = (): void => {
    for (const event of sim.drainChopEvents()) {
      send(shared.encodeTreeHit(event.treeId, event.swingsLeft, event.netId));
    }
    const changed = sim.drainTreeChanges();
    if (changed.length > 0) {
      const looks = sim.changedTrees(changed);
      if (looks.length > 0) send(shared.encodeTreeStates(looks, false));
    }
    send(shared.encodeDroppedPiles(sim.droppedPilesList(1)));
    send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
  };
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    send = (data) => socket.send(Buffer.from(data));
    send(shared.encodeWelcome(1, SEED, 0, Date.now()));
    send(shared.encodeSpace(0, x, z, yaw));
    send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
    send(shared.encodeEquipped(sim.equippedList()));
    send(shared.encodeTreeStates(sim.changedTrees()));
    send(shared.encodeSnapshot(0, Date.now(), 0, sim.snapshotFor(1)));
    socket.onMessage((message) => {
      if (typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
      if (request?.type === 'input') {
        for (const input of request.inputs) {
          sim.queueInput(1, input);
          sim.step(Date.now());
        }
        send(
          shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
        );
        announce();
      }
    });
  });

  await enterWorld(page, 'forest-trees');
  await page.locator('.hud-curtain').click();

  // The browser knows about the forest's trees, and offers the swing at this one.
  const known = await page.evaluate(() => window.acornDebug?.trees() ?? []);
  expect(known.some((candidate) => candidate.id === tree.id)).toBe(true);
  await page.evaluate(
    ([tx, tz]) => window.acornDebug?.faceTowards(tx ?? 0, tz ?? 0),
    [tree.x, tree.z],
  );
  await expect
    .poll(async () => (await page.evaluate(() => window.acornDebug?.aimedTree())) !== null)
    .toBe(true);

  // Taps, not a hold, the same as the clearing's tree: swings are paced by the server.
  const viewport = page.viewportSize() ?? { width: 960, height: 640 };
  await page.mouse.move(viewport.width / 2, viewport.height / 2);
  for (let step = 0; step < 60; step++) {
    const felled = await page.evaluate(() => window.acornDebug?.felledTrees() ?? []);
    if (felled.includes(tree.id)) break;
    await page.evaluate(
      ([tx, tz]) => window.acornDebug?.faceTowards(tx ?? 0, tz ?? 0),
      [tree.x, tree.z],
    );
    await page.mouse.down();
    await page.waitForTimeout(200);
    await page.mouse.up();
    await page.waitForTimeout(150);
  }
  expect(await page.evaluate(() => window.acornDebug?.felledTrees())).toEqual([tree.id]);

  // The server has left the logs where it fell.
  await expect
    .poll(() => sim.droppedPilesList().some((pile) => pile.item === 'log'), { timeout: 30_000 })
    .toBe(true);

  // Later, with nobody standing on the spot, it comes back at a size of its own.
  sim.regrowTrees(Date.now() + 3 * 60 * 60 * 1000);
  announce();
  await expect
    .poll(() => page.evaluate(() => window.acornDebug?.felledTrees()))
    .not.toContain(tree.id);
  expect(
    (await page.evaluate(() => window.acornDebug?.treeGenerations() ?? [])).find(
      (entry) => entry.id === tree.id,
    )?.generation,
  ).toBe(1);

  expect(errors).toEqual([]);
});
