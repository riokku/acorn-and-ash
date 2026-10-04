import { expect, test, type Page } from '@playwright/test';
import * as shared from '../packages/shared/src/index';

/**
 * The lake (decision 0090): it is in the world, it shows on the map, and the
 * shore holds a walker back instead of letting them wade in.
 *
 * Test sign-in is automatic here, so each test starts as a fresh test player
 * and only has to name a character and press play.
 */
test.use({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 0.5 });
test.setTimeout(240_000);

async function enterWorld(page: Page, world: string): Promise<void> {
  await page.goto(`/?renderer=webgl2&world=${world}`);
  await page.locator('#home-name').fill('Mira');
  await page.locator('.home-play').click();
  await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
}

test('has a big lake with five islands, and paints it on the map', async ({ page }) => {
  await enterWorld(page, `lake-${Date.now()}`);
  const lake = await page.evaluate(() => window.acornDebug?.lake());
  expect(lake?.islands).toHaveLength(5);
  expect(lake?.basin.length).toBeGreaterThan(2);
  // Painted from the same lake, in a worker, a second or so after arriving.
  await expect.poll(() => page.evaluate(() => window.acornDebug?.mapState().painted)).toBe(true);
});

test('holds a walker back at the shore instead of letting them wade in', async ({ page }) => {
  const terrain = shared.createWildernessTerrain(shared.DEFAULT_WORLD_SEED);
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    hungerEmptyAfterSeconds: Infinity,
  });
  // On the west bank of the biggest blob of water, facing east, into the lake.
  const start = { x: 53, z: -88 };
  sim.addPlayer(1, undefined, 'walker');
  sim.placePlayer(1, { x: start.x, y: terrain.heightAt(start.x, start.z), z: start.z }, 0);
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
      if (request?.type === 'input') {
        for (const input of request.inputs) {
          sim.queueInput(1, input);
          sim.step(Date.now());
        }
        send(
          shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
        );
      }
    });
  });

  await enterWorld(page, 'lake-shore');
  await page.locator('.hud-curtain').click();
  await page.evaluate(() => window.acornDebug?.faceTowards(88, -88));
  await page.keyboard.down('KeyW');
  // Long enough to have walked thirty metres out, if the water were not there.
  await page.waitForTimeout(8_000);
  await page.keyboard.up('KeyW');

  const here = await page.evaluate(() => window.acornDebug?.localPosition());
  expect(here).toBeDefined();
  // Still on the bank: the water's edge is at x = 56, and a body is a third of a metre wide.
  expect(shared.isOnLake(shared.LAKE, here!.x, here!.z)).toBe(false);
  expect(here!.x).toBeGreaterThan(start.x + 0.5);
  expect(here!.x).toBeLessThan(56);
  // The server agrees about where they are, so nothing was fighting the wall.
  const server = sim.outdoorPositionOf(1);
  expect(shared.isOnLake(shared.LAKE, server!.x, server!.z)).toBe(false);
  expect(errors).toEqual([]);
});
