import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';

test.use({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 0.5 });
test.setTimeout(180_000);
test('keeps surface loot out of reach underground and restores the hint and collection on the surface', async ({
  page,
}) => {
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    forestEncounters: false,
    hungerEmptyAfterSeconds: Infinity,
  });
  const x = 8.5,
    z = 8.5,
    now = Date.now();
  sim.restoreDigs([
    { ix: 16, iy: -8, iz: 16, dir: shared.CUBE_DIG },
    { ix: 16, iy: -6, iz: 16, dir: shared.CUBE_DIG },
  ]);
  sim.restoreDroppedPiles([{ id: 40, item: 'stick', count: 1, x, z, droppedAtMs: now }], now);
  sim.addPlayer(1, undefined, 'cave-walker');
  sim.placePlayer(1, { x, y: -4, z }, 0);
  let closed = false,
    interactions = 0;
  let surface = () => {};
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', (r) =>
    r.fulfill({ body: '', contentType: 'text/css' }),
  );
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    socket.onClose(() => {
      closed = true;
    });
    const send = (data: ArrayBuffer) => {
      if (!closed) socket.send(Buffer.from(data));
    };
    const snapshot = () =>
      send(
        shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
      );
    const pack = () => {
      send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
      send(shared.encodeDroppedPiles(sim.droppedPilesList()));
    };
    surface = () => {
      sim.placePlayer(1, { x, y: 0, z }, 0);
      send(shared.encodeSpace(0, x, z, 0));
      snapshot();
    };
    send(shared.encodeWelcome(1, shared.DEFAULT_WORLD_SEED, 0, Date.now()));
    send(shared.encodeDug(sim.dug.digs, true));
    send(shared.encodeSpace(0, x, z, 0));
    pack();
    snapshot();
    socket.onMessage((message) => {
      if (closed || typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
      if (request?.type === 'input') {
        for (const input of request.inputs) {
          if (input.buttons & shared.PlayerButton.Interact) interactions++;
          sim.queueInput(1, input);
          sim.step(Date.now());
        }
        pack();
        snapshot();
      }
    });
  });
  try {
    await page.goto('/?renderer=webgl2&world=terrain-reach');
    await page.locator('#home-name').fill('Cave Walker');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
    await expect(page.getByText('Connected', { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.acornDebug?.localPosition().y)).toBe(-4);
    expect(await page.evaluate(() => window.acornDebug?.nearbyPile())).toBeNull();
    await page.keyboard.press('KeyE');
    await expect.poll(() => interactions).toBeGreaterThan(0);
    expect(sim.inventoryOf(1).stick ?? 0).toBe(0);
    expect(sim.droppedPilesList()).toHaveLength(1);
    surface();
    await expect
      .poll(() => page.evaluate(() => window.acornDebug?.nearbyPile()?.item))
      .toBe('stick');
    await page.keyboard.press('KeyE');
    await expect.poll(() => sim.inventoryOf(1).stick ?? 0).toBe(1);
    await expect.poll(() => page.evaluate(() => window.acornDebug?.nearbyPile())).toBeNull();
    expect(errors).toEqual([]);
  } finally {
    closed = true;
    sim.dispose();
  }
});
