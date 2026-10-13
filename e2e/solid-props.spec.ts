import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';
test.use({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 0.5 });
test.setTimeout(180_000);
test('a restored fence blocks walking, allows jumping over it, and agrees with the server', async ({
  page,
}) => {
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    hungerEmptyAfterSeconds: Infinity,
  });
  sim.addPlayer(1, undefined, 'fence-walker');
  sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0);
  sim.restoreBuiltProps([
    { id: 1, kind: 'fence', x: 0, z: -3, yaw: 0, lit: false, ownerKey: null, litUntilMs: null },
  ]);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', (r) =>
    r.fulfill({ body: '', contentType: 'text/css' }),
  );
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    send(shared.encodeWelcome(1, shared.DEFAULT_WORLD_SEED, 0, Date.now()));
    send(shared.encodeSpace(0, 0, 0, 0));
    send(shared.encodeBuiltProps(sim.builtPropsList(), () => true));
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
  try {
    await page.goto('/?renderer=webgl2&world=solid-fence');
    await page.locator('#home-name').fill('Fence Walker');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true');
    await page.evaluate(() => window.acornDebug?.faceTowards(0, -10));
    await page.keyboard.down('KeyW');
    await expect.poll(() => sim.outdoorPositionOf(1)!.z).toBeLessThan(-2.4);
    await page.waitForTimeout(700);
    expect(sim.outdoorPositionOf(1)!.z).toBeGreaterThan(-2.58);
    const here = await page.evaluate(() => window.acornDebug?.localPosition());
    expect(here!.z).toBeGreaterThan(-2.65);
    expect(Math.abs(here!.z - sim.outdoorPositionOf(1)!.z)).toBeLessThan(0.2);
    await page.keyboard.down('Space');
    await page.waitForTimeout(250);
    await page.keyboard.up('Space');
    await expect.poll(() => sim.outdoorPositionOf(1)!.z).toBeLessThan(-4);
    await page.keyboard.up('KeyW');
    await expect.poll(() => sim.outdoorPositionOf(1)!.y).toBeCloseTo(0, 2);
    expect(errors).toEqual([]);
  } finally {
    sim.dispose();
  }
});
