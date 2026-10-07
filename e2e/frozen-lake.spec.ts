import { expect, test, type Page } from '@playwright/test';
import * as shared from '../packages/shared/src/index';

/**
 * The lake freezes in winter (decision 0095).
 *
 * The server is played by an in-page copy of the simulation, with a boat moored
 * beside the first clump of reeds. The player climbs in and rows out onto the
 * lake; then the test turns the world's calendar to winter. The boat must
 * freeze where it is, the rower must step out onto the ice and be able to walk
 * across it; and when the calendar turns to spring they must be put ashore.
 */
test.use({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 0.5 });
test.setTimeout(300_000);

/** Where to keep screenshots when somebody wants to look at them (not in CI). */
const SHOTS = process.env.SHOT_DIR;

const BOAT_ID = 7;
const SEED = shared.DEFAULT_WORLD_SEED;

async function enterWorld(page: Page, world: string): Promise<void> {
  await page.goto(`/?renderer=webgl2&world=${world}`);
  await page.locator('#home-name').fill('Mira');
  await page.locator('.home-play').click();
  await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
}

/** The boat's berth beside the first reed patch, which way is out, and the bank a few steps along. */
function berth() {
  const spot = shared.REED_PATCHES[0]!;
  const circle = shared.LAKE.basin.reduce((best, c) => {
    const gap = (c: { x: number; z: number; radius: number }) =>
      Math.abs(Math.hypot(spot.x - c.x, spot.z - c.z) - c.radius);
    return gap(c) < gap(best) ? c : best;
  });
  const away = Math.hypot(circle.x - spot.x, circle.z - spot.z);
  const inward = { x: (circle.x - spot.x) / away, z: (circle.z - spot.z) / away };
  const along = { x: -inward.z, z: inward.x };
  const x = spot.x + inward.x * 2.05;
  const z = spot.z + inward.z * 2.05;
  return {
    x,
    z,
    inward,
    yaw: Math.atan2(-along.z, along.x),
    bank: { x: x - inward.x * 2.9 + along.x * 3.5, z: z - inward.z * 2.9 + along.z * 3.5 },
  };
}

test('the lake freezes under a rower, who walks off across the ice, and thaws in spring', async ({
  page,
}) => {
  const water = berth();
  const terrain = shared.createWildernessTerrain(SEED);
  const sim = new shared.WorldSimulation({ seed: SEED, hungerEmptyAfterSeconds: Infinity });
  const turnTo = (season: shared.SeasonId) =>
    sim.setCalendarShift(
      shared.clockShiftForSeason(SEED, sim.tick * shared.TICK_MILLISECONDS, season),
    );
  turnTo('autumn');
  sim.restoreBuiltProps([
    {
      id: BOAT_ID,
      kind: 'rowboat',
      x: water.x,
      z: water.z,
      yaw: water.yaw,
      lit: false,
      ownerKey: 'a-boatwright',
      litUntilMs: null,
    },
  ]);
  sim.addPlayer(1, undefined, 'skater');
  sim.placePlayer(
    1,
    { x: water.bank.x, y: terrain.heightAt(water.bank.x, water.bank.z), z: water.bank.z },
    0,
  );

  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ body: '', contentType: 'text/css' }),
  );
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    send(shared.encodeWelcome(1, SEED, 0, Date.now()));
    send(shared.encodeLakeIce(sim.lakeFrozenByCalendar()));
    send(shared.encodeSpace(0, water.bank.x, water.bank.z, 0));
    send(shared.encodeBuiltProps(sim.builtPropsList(), () => true));
    send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
    send(shared.encodeSnapshot(0, Date.now(), 0, sim.snapshotFor(1)));
    socket.onMessage((message) => {
      if (typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
      if (request?.type !== 'input') return;
      sim.queueInputs(1, request.inputs);
      for (let each = 0; each < Math.max(1, request.inputs.length); each++) sim.step(Date.now());
      // What the real server says when the lake changes, and about the boats it affects.
      const frozen = sim.drainLakeFreezeChange();
      if (frozen !== null) send(shared.encodeLakeIce(frozen));
      if (sim.drainBoatChanges().length > 0)
        send(shared.encodeBuiltProps(sim.builtPropsList(), () => true));
      send(
        shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
      );
    });
  });

  await enterWorld(page, 'frozen-lake');
  await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
    timeout: 120_000,
  });

  const here = () => page.evaluate(() => window.acornDebug!.localPosition());
  const move = () => page.evaluate(() => window.acornDebug!.combatMove().kind);
  const boats = () => page.evaluate(() => window.acornDebug!.boats());
  const frozen = () => page.evaluate(() => window.acornDebug!.lakeFrozen());
  const hint = page.locator('.hud-hint');
  const faceFrom = async (dx: number, dz: number) => {
    const spot = await here();
    await page.evaluate(
      ([x, z]) => window.acornDebug?.faceTowards(x!, z!),
      [spot.x + dx * 20, spot.z + dz * 20],
    );
  };
  const pressE = async () => {
    await page.keyboard.down('KeyE');
    await page.waitForTimeout(150);
    await page.keyboard.up('KeyE');
  };
  const depthHere = async () => {
    const spot = await here();
    return shared.lakeDepthAt(shared.LAKE, spot.x, spot.z);
  };

  // Autumn: open water, and the boat can be climbed into and rowed out.
  expect(await frozen()).toBe(false);
  await expect(hint).toContainText('Press E to climb into the rowboat');
  await pressE();
  await expect.poll(move).toBe(shared.ActionKind.Row);
  await faceFrom(water.inward.x, water.inward.z);
  await page.keyboard.down('KeyW');
  await expect.poll(depthHere).toBeGreaterThan(5);
  await page.keyboard.up('KeyW');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/frozen-lake-before.png` });

  // Winter comes. The boat stays where it is, and the rower is out on the ice beside it.
  turnTo('winter');
  await expect.poll(frozen).toBe(true);
  await expect.poll(move).toBe(shared.ActionKind.Idle);
  await expect.poll(async () => (await boats()).moored).toBe(1);
  await expect.poll(async () => (await boats()).rowed).toEqual([]);
  const stood = await here();
  expect(stood.y).toBeCloseTo(shared.lakeIceHeight(shared.LAKE), 1);
  expect(await depthHere()).toBeGreaterThan(3);
  const boat = sim.builtPropsList().find((prop) => prop.id === BOAT_ID)!;
  expect(Math.hypot(boat.x - stood.x, boat.z - stood.z)).toBeLessThan(2.5);
  expect(boat.rower).toBeUndefined();
  await expect(hint).toContainText('The rowboat is frozen in the ice');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/frozen-lake-stepped-out.png` });

  // E does not climb back in: it is frozen there until spring.
  await pressE();
  await page.waitForTimeout(600);
  expect(await move()).toBe(shared.ActionKind.Idle);

  // The ice holds a walker, and the server agrees about where they are.
  await faceFrom(-water.inward.x, -water.inward.z);
  await page.keyboard.down('KeyW');
  await expect
    .poll(async () => {
      const spot = await here();
      return Math.hypot(spot.x - stood.x, spot.z - stood.z);
    })
    .toBeGreaterThan(3);
  await page.keyboard.up('KeyW');
  const walked = await here();
  expect(walked.y).toBeCloseTo(shared.lakeIceHeight(shared.LAKE), 1);
  await expect
    .poll(async () => {
      const server = sim.snapshotFor(1).find((entity) => entity.netId === 1)!;
      const spot = await here();
      return Math.hypot(server.x - spot.x, server.z - spot.z);
    })
    .toBeLessThan(1);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/frozen-lake-walking.png` });

  // Spring: the ice goes, the lake is water again, and nobody is left standing on it.
  const farOut = shared.LAKE.basin.reduce((best, each) =>
    shared.lakeDepthAt(shared.LAKE, each.x, each.z) >
    shared.lakeDepthAt(shared.LAKE, best.x, best.z)
      ? each
      : best,
  );
  sim.placePlayer(1, { x: farOut.x, y: shared.lakeIceHeight(shared.LAKE), z: farOut.z }, 0);
  await expect.poll(depthHere).toBeGreaterThan(3);
  turnTo('spring');
  await expect.poll(frozen).toBe(false);
  await expect.poll(depthHere).toBeLessThanOrEqual(0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/frozen-lake-thawed.png` });

  // The boat is still moored where it froze.
  await expect.poll(async () => (await boats()).moored).toBe(1);

  expect(errors).toEqual([]);
});
