import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';

test.use({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 0.5 });
test.setTimeout(180_000);

for (const kind of ['river rock', 'stump'] as const) {
  test(`stands, jumps and walks off the ${kind} with matching server footing`, async ({ page }) => {
    const sim = new shared.WorldSimulation({
      seed: shared.DEFAULT_WORLD_SEED,
      hungerEmptyAfterSeconds: Infinity,
    });
    const ground = shared.createWildernessTerrain(shared.DEFAULT_WORLD_SEED);
    const placement =
      kind === 'river rock'
        ? shared.buildSloughBoulders(shared.STREAM, ground)[0]!
        : { ...shared.AXE_STUMP };
    const solid = sim.collision.colliders.find(
      (collider) => collider.x === placement.x && collider.z === placement.z && collider.standable,
    )!;
    const roof = shared.colliderTopAt(solid, solid.x, solid.z)!;
    sim.addPlayer(1, undefined, 'scenery-walker');
    sim.placePlayer(1, { x: solid.x, y: roof + 2, z: solid.z }, 0);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('https://fonts.googleapis.com/**', (route) =>
      route.fulfill({ body: '', contentType: 'text/css' }),
    );
    await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
      const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
      send(shared.encodeWelcome(1, shared.DEFAULT_WORLD_SEED, 0, Date.now()));
      send(shared.encodeSpace(0, solid.x, solid.z, 0));
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
            shared.encodeSnapshot(
              sim.tick,
              Date.now(),
              sim.lastProcessedSeq(1),
              sim.snapshotFor(1),
            ),
          );
        }
      });
    });
    try {
      await page.goto(`/?renderer=webgl2&world=scenery-${kind.replace(' ', '-')}&season=summer`);
      await page.locator('#home-name').fill('Rock Walker');
      await page.locator('.home-play').click();
      await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
      await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true');
      await expect.poll(() => sim.outdoorPositionOf(1)?.y).toBeCloseTo(roof, 2);
      await expect
        .poll(() => page.evaluate(() => window.acornDebug?.localPosition().y))
        .toBeCloseTo(roof, 2);
      await page.keyboard.down('Space');
      await expect.poll(() => sim.outdoorPositionOf(1)!.y).toBeGreaterThan(roof + 0.15);
      await page.keyboard.up('Space');
      await expect.poll(() => sim.outdoorPositionOf(1)!.y).toBeCloseTo(roof, 2);
      await expect
        .poll(() => page.evaluate(() => window.acornDebug?.localPosition().y))
        .toBeCloseTo(roof, 2);
      await page.evaluate(({ x, z }) => window.acornDebug?.faceTowards(x + 10, z), {
        x: solid.x,
        z: solid.z,
      });
      await page.keyboard.down('KeyW');
      await expect
        .poll(() => sim.outdoorPositionOf(1)!.x)
        .toBeGreaterThan(solid.x + shared.colliderFootprintRadius(solid) + 1.2);
      await page.keyboard.up('KeyW');
      await expect
        .poll(() => {
          const position = sim.outdoorPositionOf(1)!;
          return Math.abs(position.y - ground.heightAt(position.x, position.z));
        })
        .toBeLessThan(0.05);
      await expect
        .poll(async () => {
          const here = await page.evaluate(() => window.acornDebug?.localPosition());
          const server = sim.outdoorPositionOf(1)!;
          return here
            ? Math.hypot(here.x - server.x, here.y - server.y, here.z - server.z)
            : Infinity;
        })
        .toBeLessThan(0.5);
      expect(errors).toEqual([]);
    } finally {
      sim.dispose();
    }
  });
}
