import { expect, test } from '@playwright/test';
import { skipDrawing } from './skip-drawing';
import * as shared from '../packages/shared/src/index';
test.use({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 0.75 });
test.setTimeout(240_000);
test('places, rotates, moves and packs up decorations in a private home', async ({ page }) => {
  page.setDefaultTimeout(30_000);
  await skipDrawing(page);
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    hungerEmptyAfterSeconds: Infinity,
  });
  sim.restoreBuiltProps([
    {
      id: 7,
      kind: 'cabin',
      x: 0,
      z: -4.2,
      yaw: 0,
      ownerKey: 'decorator',
      lit: false,
      litUntilMs: null,
    },
  ]);
  sim.addPlayer(1, undefined, 'decorator');
  sim.placePlayer(1, { x: 0, y: 0, z: 2 }, 0, 7);
  Object.assign(sim.inventoryOf(1), { bag: 1, log: 20, stick: 20, flower: 10 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ body: '', contentType: 'text/css' }),
  );
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    const refresh = () => {
      send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
      send(
        shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
      );
    };
    send(shared.encodeWelcome(1, shared.DEFAULT_WORLD_SEED, 0, Date.now()));
    send(shared.encodeBuiltProps(sim.builtPropsList(), () => true));
    send(shared.encodeSpace(7, 0, 2, 0));
    send(shared.encodeDecorationState({ pieces: [], reason: null }));
    refresh();
    socket.onMessage((message) => {
      if (typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
      if (request?.type === 'decoration')
        send(shared.encodeDecorationState(sim.requestDecoration(1, request)));
      if (request?.type === 'input')
        for (const input of request.inputs) {
          sim.queueInput(1, input);
          sim.step(Date.now());
        }
      refresh();
    });
  });
  const menu = async () => {
    await page.getByRole('button', { name: 'Decorate', exact: true }).click();
    await expect(page.locator('.decor-panel')).toBeVisible();
  };
  const moveFloor = async (x: number, z: number) => {
    await expect(page.locator('.decor-panel')).toHaveCount(0);
    const point = await page.evaluate(({ x, z }) => window.acornDebug?.screenPoint(x, 0, z), {
      x,
      z,
    });
    expect(point).not.toBeNull();
    await page.mouse.move(point!.x, point!.y);

    await expect
      .poll(() => page.evaluate(() => window.acornDebug?.buildPreview()?.spot?.x))
      .toBeCloseTo(x, 1);
    await expect
      .poll(() => page.evaluate(() => window.acornDebug?.buildPreview()?.spot?.z))
      .toBeCloseTo(z, 1);
    await expect
      .poll(() => page.evaluate(() => window.acornDebug?.buildPreview()?.refusal))
      .toBeNull();
    return point!;
  };
  const clickFloor = async (x: number, z: number) => {
    const point = await moveFloor(x, z);
    await page.mouse.click(point.x, point.y);
  };
  try {
    await page.goto('/?renderer=webgl2&world=decor-ui');
    await page.locator('#home-name').fill('Home Decorator');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
      timeout: 120_000,
    });
    // Indoor B opens the pack too; the button owns decorating in every home.
    await page.keyboard.press('KeyB');
    await expect(page.locator('.inventory-panel')).toBeVisible();
    await expect(page.locator('.decor-panel')).toHaveCount(0);
    await page.keyboard.press('KeyB');
    await expect(page.locator('.inventory-panel')).toHaveCount(0);
    await page.getByRole('button', { name: 'Decorate', exact: true }).click();
    await expect(page.locator('.decor-panel')).toBeVisible();
    await page.getByRole('button', { name: 'Close decorating', exact: true }).click();
    await expect(page.locator('.decor-panel')).toHaveCount(0);
    await menu();
    await page.getByRole('button', { name: /1 · Cedar bench/ }).click();
    await clickFloor(-0.5, -0.125);
    await expect.poll(() => sim.decorationsList().length).toBe(1);
    await menu();
    await page.getByRole('button', { name: /2 · Timber table/ }).click();
    await clickFloor(1.5, 0.4);
    await expect.poll(() => sim.decorationsList().length).toBe(2);
    await menu();
    await page.getByRole('button', { name: /3 · Woven forest rug/ }).click();
    await clickFloor(0, 0);
    await expect.poll(() => sim.decorationsList().length).toBe(3);
    await menu();
    await page.getByRole('button', { name: /Fern lantern/ }).click();
    await clickFloor(1.6, -1.6);
    await expect.poll(() => sim.decorationsList().length).toBe(4);
    await menu();
    await page.getByRole('button', { name: /Moonlit lantern/ }).click();
    await clickFloor(-0.5, -2.5);
    await expect.poll(() => sim.decorationsList().length).toBe(5);
    await menu();
    await page.getByRole('button', { name: /Woodland flower planter/ }).click();
    await clickFloor(1.6, 1.8);
    await expect.poll(() => sim.decorationsList().length).toBe(6);
    await menu();
    await page
      .locator('.decor-owned')
      .filter({ hasText: 'Cedar bench' })
      .getByRole('button', { name: 'Move', exact: true })
      .click();
    await moveFloor(0, -1.1);
    const originalYaw = sim.decorationsList()[0]!.yaw;
    await page.mouse.wheel(0, 120);
    await expect
      .poll(() => page.evaluate(() => window.acornDebug?.buildPreview()?.spot?.yaw))
      .not.toBe(originalYaw);
    await clickFloor(0, -1.1);
    await expect.poll(() => sim.decorationsList()[0]?.z).toBeCloseTo(-1.1, 1);
    expect(sim.inventoryOf(1).log).toBe(7);
    await page.screenshot({
      path: process.env.CI
        ? 'test-results/decorated-home.png'
        : '/workspace/acorn-decorated-home.png',
    });
    await menu();
    await page
      .locator('.decor-owned')
      .filter({ hasText: 'Cedar bench' })
      .getByRole('button', { name: 'Pack up', exact: true })
      .click();
    await expect.poll(() => sim.decorationsList().length).toBe(5);
    expect(sim.inventoryOf(1).log).toBe(11);
    expect(errors).toEqual([]);
  } finally {
    sim.dispose();
  }
});
