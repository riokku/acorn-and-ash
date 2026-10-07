import { expect, test, type Page } from '@playwright/test';
import * as shared from '../packages/shared/src/index';

/**
 * A boat left at an island falls apart when its owner is knocked out
 * (decision 0094).
 *
 * The server is played by an in-page copy of the simulation: the player
 * stands on the beach of the big island with their own boat moored beside
 * them. The test knocks them out and watches the boat vanish from the water
 * and a pile of logs and rope turn up on the island.
 */
test.use({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 0.5 });
test.setTimeout(240_000);

const SHOTS = process.env.SHOT_DIR;
const BOAT_ID = 7;

async function enterWorld(page: Page, world: string): Promise<void> {
  await page.goto(`/?renderer=webgl2&world=${world}`);
  await page.locator('#home-name').fill('Mira');
  await page.locator('.home-play').click();
  await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
}

/** Open water just off the first lobe of the biggest island, and its beach beside it. */
function islandBerth() {
  const island = shared.LAKE.islands.find((each) => each.id === 'heart')!;
  const lobe = island.lobes[0]!;
  for (let step = 0; step < 72; step++) {
    const angle = (step / 72) * Math.PI * 2;
    const x = lobe.x + Math.cos(angle) * (lobe.radius + 2.5);
    const z = lobe.z + Math.sin(angle) * (lobe.radius + 2.5);
    if (!shared.nearestShoreIsIsland(shared.LAKE, x, z)) continue;
    const yaw = -angle - Math.PI / 2;
    if (shared.keepBoatAfloat({ x, y: 0, z }, yaw) !== null) continue;
    return { x, z, yaw, bank: shared.landingBeside(x, z) };
  }
  throw new Error('no open water beside the island');
}

test('a boat cut off on an island turns into a pile when its owner is knocked out', async ({
  page,
}) => {
  const berth = islandBerth();
  const terrain = shared.createWildernessTerrain(shared.DEFAULT_WORLD_SEED);
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    hungerEmptyAfterSeconds: Infinity,
  });
  sim.restoreBuiltProps([
    {
      id: BOAT_ID,
      kind: 'rowboat',
      x: berth.x,
      z: berth.z,
      yaw: berth.yaw,
      lit: false,
      ownerKey: 'rower',
      litUntilMs: null,
    },
  ]);
  sim.addPlayer(1, undefined, 'rower');
  sim.placePlayer(
    1,
    { x: berth.bank.x, y: terrain.heightAt(berth.bank.x, berth.bank.z), z: berth.bank.z },
    0,
  );

  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ body: '', contentType: 'text/css' }),
  );
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    send(shared.encodeWelcome(1, shared.DEFAULT_WORLD_SEED, 0, Date.now()));
    send(shared.encodeSpace(0, berth.bank.x, berth.bank.z, 0));
    send(shared.encodeBuiltProps(sim.builtPropsList(), (id) => sim.builtPropOwner(id) === 'rower'));
    send(shared.encodeDroppedPiles(sim.droppedPilesList(1)));
    send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
    send(shared.encodeSnapshot(0, Date.now(), 0, sim.snapshotFor(1)));
    socket.onMessage((message) => {
      if (typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
      if (request?.type !== 'input') return;
      sim.queueInputs(1, request.inputs);
      for (let each = 0; each < Math.max(1, request.inputs.length); each++) sim.step(Date.now());
      // What the real server tells everybody when a boat comes apart.
      if (sim.drainBrokenBoats().length > 0) {
        send(shared.encodeBuiltProps(sim.builtPropsList(), () => false));
        sim.drainPileChanges();
        send(shared.encodeDroppedPiles(sim.droppedPilesList(1)));
      }
      send(
        shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
      );
    });
  });

  await enterWorld(page, 'stranded-boat');
  await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
    timeout: 120_000,
  });

  const boats = () => page.evaluate(() => window.acornDebug!.boats());
  const piles = () => page.evaluate(() => window.acornDebug!.droppedPiles());

  // Moored beside the island, nothing lying about.
  await expect.poll(async () => (await boats()).moored).toBe(1);
  expect(await piles()).toEqual([]);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/stranded-boat-before.png` });

  // A creature gets them. They wake in bed, and the boat they cannot get back to has fallen apart.
  const hits = sim as unknown as {
    raiderStrikesPlayer(id: number, damage: number, impactTick: number): void;
  };
  hits.raiderStrikesPlayer(1, 1000, sim.tick);

  await expect.poll(async () => (await boats()).moored).toBe(0);
  await expect
    .poll(async () => (await piles()).map((pile) => `${pile.count} ${pile.item}`).sort())
    .toEqual(['1 rope', '3 log']);
  for (const pile of await piles()) {
    expect(shared.lakeDepthAt(shared.LAKE, pile.x, pile.z)).toBeLessThan(0);
  }
  expect(
    (await page.evaluate(() => window.acornDebug!.builtProps())).some(
      (prop) => prop.id === BOAT_ID,
    ),
  ).toBe(false);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/stranded-boat-after.png` });

  expect(errors).toEqual([]);
});
