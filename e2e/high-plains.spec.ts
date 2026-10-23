import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';

test.use({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 0.5 });
test.setTimeout(240_000);

test('walks through Windbreak Pass into Sunreach and back without losing inventory or loading a new world', async ({
  page,
}) => {
  const terrain = shared.createWildernessTerrain(shared.DEFAULT_WORLD_SEED);
  const route = shared.HIGH_PLAINS_PASS.slice(2);
  const start = route[0]!;
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    hungerEmptyAfterSeconds: Infinity,
  });
  sim.addPlayer(
    1,
    {
      netId: 1,
      x: start[0],
      y: start[2],
      z: start[1],
      facingYaw: 0,
      hunger: 100,
      items: [
        { item: 'bag', count: 1 },
        { item: 'axe', count: 1 },
        { item: 'log', count: 3 },
      ],
    },
    'plains-walker',
  );
  sim.placePlayer(1, { x: start[0], y: terrain.heightAt(start[0], start[1]), z: start[1] }, 0);
  const pack = shared.inventoryEntries(sim.inventoryOf(1));
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ body: '', contentType: 'text/css' }),
  );
  let ticking: ReturnType<typeof setInterval> | undefined;
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    send(shared.encodeWelcome(1, shared.DEFAULT_WORLD_SEED, 0, Date.now()));
    send(shared.encodeSpace(0, start[0], start[1], 0));
    send(shared.encodeInventory(pack));
    send(shared.encodeEquipped(sim.equippedList()));
    send(shared.encodeSnapshot(sim.tick, Date.now(), 0, sim.snapshotFor(1)));
    socket.onMessage((message) => {
      if (typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
      if (request?.type === 'input') sim.queueInputs(1, request.inputs);
    });
    ticking = setInterval(() => {
      sim.step(Date.now());
      send(
        shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
      );
    }, shared.TICK_MILLISECONDS);
  });
  async function walkTo(point: readonly [number, number, number]) {
    await page.evaluate(([x, z]) => window.acornDebug?.faceTowards(x!, z!), point);
    await page.keyboard.down('KeyW');
    try {
      await expect
        .poll(
          () => {
            const here = sim.outdoorPositionOf(1)!;
            return Math.hypot(here.x - point[0], here.z - point[1]);
          },
          { timeout: 25_000, intervals: [100] },
        )
        .toBeLessThan(1.8);
    } finally {
      await page.keyboard.up('KeyW');
    }
  }
  try {
    await page.goto('/?renderer=webgl2&world=plains-walk');
    await page.locator('#home-name').fill('Trailwalker');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
    await expect(page.getByTestId('world-zone')).toHaveText('Evergreen Mountains');
    for (const point of route.slice(1)) await walkTo(point);
    await expect(page.getByTestId('world-zone')).toHaveText('Sunreach High Plains');
    await expect
      .poll(() =>
        page.evaluate(() => window.acornDebug?.animals().map((animal) => animal.id) ?? []),
      )
      .toContain(1106);
    expect(shared.inventoryEntries(sim.inventoryOf(1))).toEqual(pack);
    for (const point of route.slice(0, -1).reverse()) await walkTo(point);
    await expect(page.getByTestId('world-zone')).toHaveText('Evergreen Mountains');
    await expect(page.getByTestId('loading-screen')).toBeHidden();
    expect(shared.inventoryEntries(sim.inventoryOf(1))).toEqual(pack);
    expect(errors).toEqual([]);
  } finally {
    if (ticking !== undefined) clearInterval(ticking);
    sim.dispose();
  }
});
