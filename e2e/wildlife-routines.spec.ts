import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';
test.use({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 0.5 });
test.setTimeout(180_000);
test('renders a sheltered rabbit settling, then fleeing when the player approaches', async ({
  page,
}) => {
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    hungerEmptyAfterSeconds: Infinity,
    raidIntervalSeconds: 86400,
  });
  const terrain = sim.collision.terrain;
  sim.addPlayer(1, {
    netId: 1,
    x: 0,
    y: terrain.heightAt(0, -39),
    z: -39,
    facingYaw: 0,
    hunger: 100,
    items: [],
  });
  sim.setTestWeather('storm');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ body: '', contentType: 'text/css' }),
  );
  let ticking: ReturnType<typeof setInterval> | undefined;
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    send(shared.encodeWelcome(1, shared.DEFAULT_WORLD_SEED, 0, Date.now()));
    send(shared.encodeSpace(0, 0, -39, 0));
    send(shared.encodeInventory([]));
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
  try {
    await page.goto('/?renderer=webgl2&world=wildlife-habits');
    await page.locator('#home-name').fill('Naturalist');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
    await expect
      .poll(() =>
        page.evaluate(() => window.acornDebug?.animals().some((animal) => animal.id === 1001)),
      )
      .toBe(true);
    const rabbit = () => sim.snapshotFor(1).find((entity) => entity.netId === 1001)!;
    await expect.poll(() => Math.hypot(rabbit().vx, rabbit().vz)).toBe(0);
    const resting = { x: rabbit().x, z: rabbit().z };
    sim.placePlayer(
      1,
      { x: resting.x + 1, y: terrain.heightAt(resting.x + 1, resting.z), z: resting.z },
      0,
    );
    await expect.poll(() => Math.hypot(rabbit().vx, rabbit().vz)).toBeGreaterThan(5);
    await expect
      .poll(() => Math.hypot(rabbit().x - resting.x, rabbit().z - resting.z))
      .toBeGreaterThan(1);
    expect(errors).toEqual([]);
  } finally {
    if (ticking !== undefined) clearInterval(ticking);
    sim.dispose();
  }
});
