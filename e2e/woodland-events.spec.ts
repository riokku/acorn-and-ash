import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';

test.use({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 0.5 });
test.setTimeout(180_000);
test('shows the nearby mushroom flush hint only while harvest remains', async ({ page }) => {
  const sim = new shared.WorldSimulation({ seed: shared.DEFAULT_WORLD_SEED });
  const start = { x: 12, z: 10 };
  sim.addPlayer(1);
  sim.placePlayer(1, { ...start, y: sim.collision.terrain.heightAt(start.x, start.z) }, 0);
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
  let sendFlush: (remaining: number) => void = () => {};
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    sendFlush = (remaining) =>
      send(
        shared.encodeGatherPatches([
          { id: 240, item: 'mushroom', x: start.x + 3, z: start.z, remaining },
        ]),
      );
    send(shared.encodeWelcome(1, shared.DEFAULT_WORLD_SEED, 0, Date.now()));
    send(shared.encodeSpace(0, start.x, start.z, 0));
    send(shared.encodeSnapshot(sim.tick, Date.now(), 0, sim.snapshotFor(1)));
    sendFlush(3);
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
    await expect(page.getByText(/A mushroom flush!/)).toBeVisible();
    sendFlush(0);
    await expect(page.getByText(/A mushroom flush!/)).toBeHidden();
    expect(errors).toEqual([]);
  } finally {
    sim.dispose();
  }
});
