import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';

test.use({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 0.5 });
test.setTimeout(180_000);

test('wades into the opening pond, stops at deep water and walks back ashore', async ({ page }) => {
  const terrain = shared.createWildernessTerrain(shared.DEFAULT_WORLD_SEED);
  const start = { x: 6, z: -5 };
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    hungerEmptyAfterSeconds: Infinity,
    forestEncounters: false,
  });
  sim.addPlayer(1, undefined, 'pond-walker');
  sim.placePlayer(1, { ...start, y: terrain.heightAt(start.x, start.z) }, 0);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ body: '', contentType: 'text/css' }),
  );
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    send(shared.encodeWelcome(1, shared.DEFAULT_WORLD_SEED, 0, Date.now()));
    send(shared.encodeSpace(0, start.x, start.z, 0));
    send(shared.encodeSnapshot(0, Date.now(), 0, sim.snapshotFor(1)));
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
    await page.goto('/?renderer=webgl2&world=pond-wading');
    await page.locator('#home-name').fill('Pond walker');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
      timeout: 120_000,
    });
    await page.evaluate(() => window.acornDebug?.faceTowards(12.8, -5));
    await page.keyboard.down('KeyW');
    // Hold into the water long enough to reach the deeper contour, not just dip a toe.
    await expect
      .poll(() => {
        const here = sim.outdoorPositionOf(1)!;
        return shared.pondWaterDepthAt(shared.POND, here.x, here.z);
      })
      .toBeGreaterThan(0.45);
    await page.waitForTimeout(1500);
    await page.keyboard.up('KeyW');
    const here = await page.evaluate(() => window.acornDebug?.localPosition());
    expect(here).toBeDefined();
    expect(shared.isOnWater(shared.POND, here!.x, here!.z)).toBe(true);
    expect(shared.pondWaterDepthAt(shared.POND, here!.x, here!.z)).toBeGreaterThan(0.4);
    expect(
      shared.pondWaterDepthAt(shared.POND, here!.x + shared.PLAYER_RADIUS, here!.z),
    ).toBeLessThanOrEqual(shared.LAKE_WADING_DEPTH + 0.01);
    expect(here!.y).toBeCloseTo(terrain.heightAt(here!.x, here!.z), 1);
    const authoritative = sim.outdoorPositionOf(1)!;
    expect(Math.hypot(authoritative.x - here!.x, authoritative.z - here!.z)).toBeLessThan(0.5);
    await page.keyboard.down('KeyS');
    await expect
      .poll(() => {
        const position = sim.outdoorPositionOf(1)!;
        return shared.isOnWater(shared.POND, position.x, position.z);
      })
      .toBe(false);
    await page.keyboard.up('KeyS');
    expect(errors).toEqual([]);
  } finally {
    sim.dispose();
  }
});
