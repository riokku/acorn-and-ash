import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';
import { drawnScreenshot, skipDrawing } from './skip-drawing';

// Opt-in, controlled poses from a measured walk along the authored Cedar trail.
test.use({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 1, actionTimeout: 120_000 });
test.setTimeout(600_000);
test('captures Cedar trail camera clearance', { tag: '@real-drawing' }, async ({ page }) => {
  const dir = process.env.CABIN_FOREST_SHOTS;
  test.skip(!dir, 'Set CABIN_FOREST_SHOTS to capture the evidence.');
  await skipDrawing(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ body: '' }));
  await page.route('**/api/session', (route) =>
    route.fulfill({
      json: { signedIn: true, name: 'Visitor', providers: [], testSignIn: 'automatic' },
    }),
  );
  await page.route('**/api/worlds/*/character', (route) =>
    route.fulfill({
      json:
        route.request().method() === 'GET'
          ? { made: false }
          : { made: true, ...route.request().postDataJSON() },
    }),
  );
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    forestEncounters: false,
    hungerEmptyAfterSeconds: Infinity,
  });
  const home = { id: 7, kind: 'cabin', x: 19, z: 5, yaw: 0, lit: true } as const;
  sim.restoreBuiltProps([{ ...home, ownerKey: 'traveller', litUntilMs: null }]);
  sim.addPlayer(1, undefined, 'traveller');
  sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0, home.id);
  let clock = shared.DAY_LENGTH_MS * 10 + shared.DAY_LENGTH_MS / 2;
  let weather: 'storm' | null = null;
  let publish = (_space: number, _x: number, _z: number) => {};
  let update = () => {};
  let closed = false;
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    socket.onClose(() => {
      closed = true;
    });
    const send = (data: ArrayBuffer) => {
      if (!closed) socket.send(Buffer.from(data));
    };
    const snapshot = () =>
      send(shared.encodeSnapshot(sim.tick, clock, sim.lastProcessedSeq(1), sim.snapshotFor(1)));
    update = () => {
      send(shared.encodeWildfire({ ...sim.wildfire.view(clock), testWeather: weather }));
      snapshot();
    };
    publish = (space, x, z) => {
      sim.placePlayer(
        1,
        { x, y: space === 0 ? sim.collision.terrain.heightAt(x, z) : 0, z },
        0,
        space,
      );
      send(shared.encodeSpace(space, x, z, 0));
      update();
    };
    send(shared.encodeWelcome(1, shared.DEFAULT_WORLD_SEED, 0, clock));
    send(
      shared.encodeRoster([
        {
          netId: 1,
          name: 'Traveller',
          character: 'ranger',
          color: 'amber',
          skin: shared.DEFAULT_SKIN_TONE,
        },
      ]),
    );
    send(shared.encodeEquipped([{ netId: 1, item: sim.equippedItemOf(1) }]));
    send(shared.encodeBuiltProps(sim.builtPropsList(), () => true));
    send(shared.encodeInventory([]));
    publish(home.id, 0, 0);
    socket.onMessage((message) => {
      if (closed || typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, clock));
      if (request?.type === 'input') {
        for (const input of request.inputs) {
          sim.queueInput(1, input);
          sim.step(clock);
        }
        snapshot();
      }
    });
  });
  const settle = () =>
    page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          let frames = 45;
          const next = () => {
            if (--frames <= 0) resolve();
            else requestAnimationFrame(next);
          };
          requestAnimationFrame(next);
        }),
    );
  const move = async (x: number, z: number, targetX: number, targetZ: number) => {
    publish(shared.OUTDOORS, x, z);
    await expect
      .poll(() => page.evaluate(() => window.acornDebug?.space()), { timeout: 60_000 })
      .toBe(shared.OUTDOORS);
    await expect
      .poll(() => page.evaluate(() => window.acornDebug?.localPosition().x), { timeout: 60_000 })
      .toBeCloseTo(x, 0);
    await expect
      .poll(() => page.evaluate(() => window.acornDebug?.localPosition().z), { timeout: 60_000 })
      .toBeCloseTo(z, 0);
    await page.evaluate(({ x, z }) => window.acornDebug?.faceTowards(x, z), {
      x: targetX,
      z: targetZ,
    });
  };
  try {
    await page.goto('/?renderer=webgl2&world=cabin-forest-direction&season=summer');
    await page.getByRole('textbox', { name: /what should we call you/i }).fill('Traveller');
    await page.getByRole('button', { name: 'Enter World' }).click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
    for (const condition of ['day', 'night', 'storm'] as const) {
      clock = shared.DAY_LENGTH_MS * 10 + (condition === 'night' ? 0 : shared.DAY_LENGTH_MS / 2);
      weather = condition === 'storm' ? 'storm' : null;
      update();
      await move(48, 16, 64, 39);
      await settle();
      await drawnScreenshot(page, `${dir}/${condition}-trail.png`);
    }
    clock = shared.DAY_LENGTH_MS * 10 + shared.DAY_LENGTH_MS / 2;
    weather = null;
    update();
    await move(60.784706229546046, 34.37801520497257, 76.78470622954605, 57.37801520497257);
    await settle();
    await drawnScreenshot(page, `${dir}/day-after-walk-position.png`);
    expect(errors).toEqual([]);
  } finally {
    closed = true;
    sim.dispose();
  }
});
