import { expect, test, type Page } from '@playwright/test';
import * as shared from '../packages/shared/src/index';

/**
 * Climbing into a rowboat, rowing it and climbing out (decision 0093).
 *
 * The server is played by an in-page copy of the simulation, with a boat
 * already moored beside the first clump of reeds and the player standing on
 * the bank a few steps along from it. A second player, who only exists on
 * the server's side, climbs in and out afterwards, so the test also covers
 * what somebody else's boat looks like and says.
 */
test.use({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 0.5 });
test.setTimeout(300_000);

/** Where to keep screenshots when somebody wants to look at them (not in CI). */
const SHOTS = process.env.SHOT_DIR;

const BOAT_ID = 7;
const BOT = 2;

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
  // 2.5 m from the shore, and the reeds 0.45 m out from it.
  const x = spot.x + inward.x * 2.05;
  const z = spot.z + inward.z * 2.05;
  return {
    x,
    z,
    inward,
    along,
    yaw: Math.atan2(-along.z, along.x),
    // Far enough along the bank from the reeds that E cuts none, near enough to reach the boat.
    bank: { x: x - inward.x * 2.9 + along.x * 3.5, z: z - inward.z * 2.9 + along.z * 3.5 },
  };
}

test('you can climb into a rowboat, row it, and climb out again', async ({ page }) => {
  const water = berth();
  const terrain = shared.createWildernessTerrain(shared.DEFAULT_WORLD_SEED);
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    hungerEmptyAfterSeconds: Infinity,
  });
  sim.restoreBuiltProps([
    {
      id: BOAT_ID,
      kind: 'rowboat',
      x: water.x,
      z: water.z,
      yaw: water.yaw,
      lit: false,
      // Somebody else's: anybody may climb into any boat.
      ownerKey: 'a-boatwright',
      litUntilMs: null,
    },
  ]);
  sim.addPlayer(1, undefined, 'rower');
  sim.placePlayer(
    1,
    { x: water.bank.x, y: terrain.heightAt(water.bank.x, water.bank.z), z: water.bank.z },
    0,
  );
  sim.addPlayer(BOT, undefined, 'passenger');
  sim.placePlayer(BOT, { x: water.bank.x, y: 0, z: water.bank.z }, 0);

  const boat = () => sim.builtPropsList().find((prop) => prop.id === BOAT_ID)!;
  // The other player pressing and letting go of E.
  let botSeq = 0;
  const botPressesE = () => {
    sim.queueInput(BOT, shared.createInput(++botSeq, 0, 0, 0, shared.PlayerButton.Interact));
    sim.queueInput(BOT, shared.createInput(++botSeq, 0, 0, 0, 0));
  };

  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ body: '', contentType: 'text/css' }),
  );
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    send(shared.encodeWelcome(1, shared.DEFAULT_WORLD_SEED, 0, Date.now()));
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
      // One tick for each input, the way the real server's loop would take them.
      for (let each = 0; each < Math.max(1, request.inputs.length); each++) sim.step(Date.now());
      // Anybody climbing in or out changes the boat's place in the list of built things.
      if (sim.drainBoatChanges().length > 0)
        send(shared.encodeBuiltProps(sim.builtPropsList(), () => true));
      send(
        shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
      );
    });
  });

  await enterWorld(page, 'rowing-boat');
  await page.locator('.hud-curtain').click();

  const here = () => page.evaluate(() => window.acornDebug!.localPosition());
  const move = () => page.evaluate(() => window.acornDebug!.combatMove().kind);
  const boats = () => page.evaluate(() => window.acornDebug!.boats());
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

  // On the bank beside a free boat: it says how to climb in, and it is drawn moored.
  await expect(hint).toContainText('Press E to climb into the rowboat');
  expect(await boats()).toEqual({ moored: 1, rowed: [] });
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/rowing-bank.png` });

  // One press and you are in it, seated in the middle, and the moored boat gives way to the one under you.
  await pressE();
  await expect.poll(move).toBe(shared.ActionKind.Row);
  await expect.poll(async () => (await boats()).rowed.length).toBe(1);
  await expect.poll(async () => (await boats()).moored).toBe(0);
  const seated = await here();
  expect(Math.hypot(seated.x - water.x, seated.z - water.z)).toBeLessThan(0.5);
  expect(seated.y).toBeCloseTo(shared.LAKE.level, 1);
  // Close to the shore, so it says E climbs out.
  await expect(hint).toContainText('press E to climb out here');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/rowing-aboard.png` });

  // Rowing straight out takes the boat with you, and it is too deep to climb out.
  await faceFrom(water.inward.x, water.inward.z);
  await page.keyboard.down('KeyW');
  await expect
    .poll(async () => {
      const spot = await here();
      return Math.hypot(spot.x - water.x, spot.z - water.z);
    })
    .toBeGreaterThan(7);
  await page.keyboard.up('KeyW');
  await expect(hint).toContainText('row up to a shore to climb out');
  const out = await here();
  const drawn = (await boats()).rowed[0]!;
  expect(Math.hypot(drawn.x - out.x, drawn.z - out.z)).toBeLessThan(1);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/rowing-out.png` });
  // Out there, E does nothing: still in the boat.
  await pressE();
  await page.waitForTimeout(600);
  expect(await move()).toBe(shared.ActionKind.Row);

  // Back to a shore, a good way along the bank from where the boat was moored.
  await faceFrom(water.along.x, water.along.z);
  await page.keyboard.down('KeyW');
  await expect
    .poll(async () => {
      const spot = await here();
      return Math.hypot(spot.x - water.x, spot.z - water.z);
    })
    .toBeGreaterThan(12);
  await page.keyboard.up('KeyW');
  const toShore = shared.landingBeside((await here()).x, (await here()).z);
  await faceFrom(-toShore.towardX, -toShore.towardZ);
  await page.keyboard.down('KeyW');
  await expect(hint).toContainText('press E to climb out here', { timeout: 120_000 });
  await page.keyboard.up('KeyW');

  // E climbs out onto the bank, the boat stays where it was left and is moored again.
  await pressE();
  await expect.poll(move).toBe(shared.ActionKind.Idle);
  await expect.poll(async () => (await boats()).moored).toBe(1);
  await expect.poll(async () => (await boats()).rowed).toEqual([]);
  const ashore = await here();
  expect(shared.lakeDepthAt(shared.LAKE, ashore.x, ashore.z)).toBeLessThanOrEqual(0);
  const left = { x: boat().x, z: boat().z };
  expect(Math.hypot(left.x - water.x, left.z - water.z)).toBeGreaterThan(6);
  expect(boat().rower).toBeUndefined();
  await page.waitForTimeout(1000);
  expect({ x: boat().x, z: boat().z }).toEqual(left);
  await expect(hint).toContainText('Press E to climb into the rowboat');
  const mooredAt = (await page.evaluate(() => window.acornDebug!.builtProps())).find(
    (prop) => prop.id === BOAT_ID,
  )!;
  expect(Math.hypot(mooredAt.x - left.x, mooredAt.z - left.z)).toBeLessThan(0.01);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/rowing-ashore.png` });

  // Somebody else climbs in: their boat is drawn under them, ours says it is taken, and E does not help.
  sim.placePlayer(BOT, { x: ashore.x, y: ashore.y, z: ashore.z }, 0);
  botPressesE();
  await expect.poll(async () => (await boats()).rowed.map((each) => each.netId)).toEqual([BOT]);
  await expect.poll(async () => (await boats()).moored).toBe(0);
  await expect(hint).toContainText('Somebody is already rowing this boat');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/rowing-taken.png` });
  await pressE();
  await page.waitForTimeout(600);
  expect(await move()).toBe(shared.ActionKind.Idle);
  expect(boat().rower).toBe(BOT);

  // And when they climb out, it is there for anybody again.
  botPressesE();
  await expect.poll(async () => (await boats()).moored).toBe(1);
  await expect.poll(async () => (await boats()).rowed).toEqual([]);
  await expect(hint).toContainText('Press E to climb into the rowboat');

  expect(errors).toEqual([]);
});
