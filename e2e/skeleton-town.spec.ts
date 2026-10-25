import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';

test.use({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 0.5 });
test.setTimeout(180_000);
test('enters Bonehollow with thirteen independently patrolling residents', async ({ page }) => {
  const town = shared.SKELETON_TOWN;
  const terrain = shared.createWildernessTerrain(shared.DEFAULT_WORLD_SEED);
  const start = { x: town.x, z: town.z + 40 };
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    forestEncounters: true,
    hungerEmptyAfterSeconds: Infinity,
  });
  sim.addPlayer(1, undefined, 'town-visitor');
  sim.placePlayer(1, { ...start, y: terrain.heightAt(start.x, start.z) }, 0);
  for (let i = 0; i < shared.TICK_HZ * 2; i++) sim.step(Date.now());
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '' }));
  // This browser test owns its server simulation; no account or world service is needed.
  await page.route('**/api/session', (r) =>
    r.fulfill({
      json: { signedIn: true, name: 'Visitor', providers: [], testSignIn: 'automatic' },
    }),
  );
  await page.route('**/api/worlds/*/character', (r) =>
    r.fulfill({
      json:
        r.request().method() === 'GET'
          ? { made: false }
          : { made: true, ...r.request().postDataJSON() },
    }),
  );
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    send(shared.encodeWelcome(1, shared.DEFAULT_WORLD_SEED, 0, Date.now()));
    send(shared.encodeSpace(0, start.x, start.z, 0));
    send(shared.encodeSnapshot(sim.tick, Date.now(), 0, sim.snapshotFor(1)));
    socket.onMessage((message) => {
      if (typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
      if (request?.type !== 'input') return;
      for (const input of request.inputs) {
        sim.queueInput(1, input);
        sim.step(Date.now());
      }
      send(
        shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
      );
    });
  });
  try {
    await page.goto('/?renderer=webgl2&world=bonehollow-smoke');
    await page.locator('#home-name').fill('Town visitor');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
      timeout: 120_000,
    });
    const nearby = sim.snapshotFor(1).filter(shared.isRaiderEntity);
    expect(
      nearby.filter(
        (entity) => Math.abs(entity.x - town.x) < 26 && Math.abs(entity.z - town.z) < 26,
      ),
    ).toHaveLength(13);
    // The tracker includes awake approach guards nearby as well as townspeople.
    await expect(page.getByTestId('raid-tracker')).toContainText(`${nearby.length} skeletons left`);
    await page.evaluate(({ x, z }) => window.acornDebug?.faceTowards(x, z), town);
    await page.keyboard.down('KeyW');
    await expect.poll(() => sim.outdoorPositionOf(1)!.z).toBeLessThan(town.z + 31);
    await page.keyboard.up('KeyW');
    const here = await page.evaluate(() => window.acornDebug?.localPosition());
    const authoritative = sim.outdoorPositionOf(1)!;
    expect(Math.hypot(here!.x - authoritative.x, here!.z - authoritative.z)).toBeLessThan(0.6);
    expect(errors).toEqual([]);
  } finally {
    sim.dispose();
  }
});
