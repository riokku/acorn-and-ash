import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';

test.use({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 0.5 });
test.setTimeout(180_000);

test('keeps the forest ready through repeated visits to a far-away home', async ({ page }) => {
  const errors: string[] = [];
  const models: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (/\.glb(?:\?|$)/.test(request.url())) models.push(request.url());
  });
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ body: '', contentType: 'text/css' }),
  );
  const sim = new shared.WorldSimulation({ seed: shared.DEFAULT_WORLD_SEED });
  const home = { id: 7, kind: 'cabin', x: 80, z: -70, yaw: 0, lit: false } as const;
  const doorway = shared.cabinDoorway(home);
  const doorstep = { x: doorway.x, z: doorway.z };
  sim.restoreBuiltProps([{ ...home, ownerKey: 'traveller', litUntilMs: null }]);
  sim.addPlayer(1, undefined, 'traveller');
  // Start inside: a returning player may never have drawn this part of the forest.
  sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0, home.id);
  let publishSpace = (_space: number, _x: number, _z: number) => {};
  let closed = false;
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
    publishSpace = (space, x, z) => {
      sim.placePlayer(
        1,
        { x, y: space === 0 ? sim.collision.terrain.heightAt(x, z) : 0, z },
        0,
        space,
      );
      send(shared.encodeSpace(space, x, z, 0));
      snapshot();
    };
    send(shared.encodeWelcome(1, shared.DEFAULT_WORLD_SEED, 0, Date.now()));
    send(shared.encodeBuiltProps(sim.builtPropsList(), () => true));
    publishSpace(home.id, 0, 0);
    socket.onMessage((message) => {
      if (closed || typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
      if (request?.type === 'input') {
        for (const input of request.inputs) {
          sim.queueInput(1, input);
          sim.step(Date.now());
        }
        snapshot();
      }
    });
  });
  try {
    await page.goto('/?renderer=webgl2&world=home-transition');
    await page.locator('#home-name').fill('Traveller');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
    const preparing = page.locator('.scene-fade-preparing');
    await expect(preparing).toHaveCount(0);
    for (let visit = 0; visit < 3; visit++) {
      await expect.poll(() => page.evaluate(() => window.acornDebug?.space())).toBe(home.id);
      await expect
        .poll(() => page.evaluate(() => window.acornDebug?.outdoorFocus()))
        .toEqual(doorstep);
      // Spend frames moving in room coordinates. The hidden forest must stay at the home.
      publishSpace(home.id, -1, -1);
      await expect.poll(() => page.evaluate(() => window.acornDebug?.localPosition().x)).toBe(-1);
      await expect
        .poll(() => page.evaluate(() => window.acornDebug?.outdoorFocus()))
        .toEqual(doorstep);
      const loadedModels = [...models];
      publishSpace(shared.OUTDOORS, doorstep.x, doorstep.z);
      await expect
        .poll(() => page.evaluate(() => window.acornDebug?.space()))
        .toBe(shared.OUTDOORS);
      await expect(preparing).toHaveCount(0);
      await expect(page.locator('.scene-arrival')).toBeHidden();
      expect(models).toEqual(loadedModels);
      // Controls resume after preparation rather than requiring a refresh.
      await page.keyboard.press('KeyI');
      await expect(page.locator('.inventory-panel')).toBeVisible();
      await page.keyboard.press('KeyI');
      await expect(page.locator('.inventory-panel')).toHaveCount(0);
      if (visit < 2) {
        publishSpace(home.id, 0, 0);
        await expect(preparing).toHaveCount(0);
      }
    }
    expect(errors).toEqual([]);
  } finally {
    closed = true;
  }
});
