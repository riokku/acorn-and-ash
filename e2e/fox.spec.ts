import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';

test.use({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 0.5 });
test.setTimeout(180_000);

test('an axe click catches a fleeing fox and confirms its meat reward', async ({ page }) => {
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    hungerEmptyAfterSeconds: Infinity,
  });
  const foxId = shared.ANIMAL_DENS.find((den) => den.kind === 'fox')!.id;
  const fox = { x: 0, y: 0, z: 11.5 };
  sim.addPlayer(1, undefined, 'fox-hunter');
  sim.placePlayer(1, { x: 0, y: 0, z: 12 }, 0);
  sim.inventoryOf(1).axe = 1;
  sim.useItem(1, 'axe');
  sim.placeAnimal(foxId, fox);
  let started = false,
    fled = false,
    caught = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ body: '', contentType: 'text/css' }),
  );
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    const snapshot = () =>
      send(
        shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
      );
    send(shared.encodeWelcome(1, sim.seed, 0, Date.now()));
    send(shared.encodeSpace(0, 0, 12, 0));
    send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
    send(shared.encodeEquipped(sim.equippedList()));
    snapshot();
    socket.onMessage((message) => {
      if (typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
      if (request?.type === 'input') {
        for (const input of request.inputs) {
          if (!started && (input.buttons & shared.PlayerButton.Swing) !== 0) {
            // Keep setup independent of how long model loading takes. After
            // the real click, the fox flees and the real combat rules decide.
            sim.placeAnimal(foxId, fox);
            started = true;
          }
          sim.queueInput(1, input);
        }
      }
    });
    timer = setInterval(() => {
      if (!started) sim.placeAnimal(foxId, fox);
      sim.step(Date.now());
      const animal = sim.snapshotFor(1).find((entity) => entity.netId === foxId);
      if (started && animal !== undefined && Math.hypot(animal.vx, animal.vz) > 1) fled = true;
      for (const event of sim.drainCatchEvents()) {
        caught =
          event.netId === 1 && event.item === 'meat' && event.added === 1 && animal === undefined;
        send(shared.encodeCaught(event));
        send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
      }
      snapshot();
    }, 1000 / shared.TICK_HZ);
  });
  try {
    await page.goto('/?renderer=webgl2&world=fox-click');
    await page.locator('#home-name').fill('Fox Hunter');
    await page.locator('.home-play').click();
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
      timeout: 120_000,
    });
    await expect(page.locator('.hud-hint')).toContainText('Left click to catch the fox');
    const point = await page.evaluate(() => window.acornDebug?.screenPoint(0, 0.3, 11.5));
    if (point == null) throw new Error('fox fixture is off screen');
    await page.mouse.click(point.x, point.y, { delay: 100 });
    await expect.poll(() => caught).toBe(true);
    expect(fled).toBe(true);
    await expect
      .poll(() =>
        page.evaluate(
          () => window.acornDebug?.carrying().find((entry) => entry.item === 'meat')?.count,
        ),
      )
      .toBe(1);
    await expect(page.locator('.hud-news')).toContainText('You caught some meat!');
    expect(errors).toEqual([]);
  } finally {
    if (timer !== undefined) clearInterval(timer);
    sim.dispose();
  }
});
