import { expect, test } from '@playwright/test';
import * as shared from '../packages/shared/src/index';
test.use({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 0.5 });
test.setTimeout(240_000);
test('turns real left and right dodge clicks into distinct airborne attacks', async ({ page }) => {
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    hungerEmptyAfterSeconds: Infinity,
  });
  sim.addPlayer(1, undefined, 'fighter');
  sim.placePlayer(1, { x: 0, y: 0, z: 10 }, 0);
  Object.assign(sim.inventoryOf(1), { axe: 1 });
  sim.useItem(1, 'axe');
  let closed = false;
  const poses: shared.SnapshotEntity[] = [];
  const started = new Set<number>(),
    errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ body: '', contentType: 'text/css' }),
  );
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    const refresh = () => {
      send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
      send(shared.encodeEquipped(sim.equippedList()));
      send(
        shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
      );
    };
    send(shared.encodeWelcome(1, shared.DEFAULT_WORLD_SEED, 0, Date.now()));
    refresh();
    socket.onMessage((message) => {
      if (closed || typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
      if (request?.type === 'input') {
        for (const input of request.inputs) {
          sim.queueInput(1, input);
          sim.step(Date.now());
          const me = sim.snapshotFor(1).find((entity) => entity.netId === 1)!;
          started.add(me.action & 0x1f);
          poses.push({ ...me });
        }
        refresh();
      }
    });
  });
  try {
    await page.goto('/?renderer=webgl2&world=dodge-combos');
    await page.locator('#home-name').fill('Trail Fighter');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
    await page.locator('.hud-curtain').click();
    await page.mouse.move(480, 260);
    for (const [kind, strong] of [
      [shared.ActionKind.DodgeLight, false],
      [shared.ActionKind.DodgeHeavy, true],
    ] as const) {
      await expect
        .poll(() => page.evaluate(() => window.acornDebug?.combatMove().kind), { intervals: [50] })
        .toBe(shared.ActionKind.Idle);
      // Let the normal dodge cooldown expire before the next attempt.
      await page.waitForTimeout(1500);
      if (strong) await page.keyboard.down('KeyD');
      await page.keyboard.down('ControlLeft');
      await expect
        .poll(() => page.evaluate(() => window.acornDebug?.combatMove().kind), { intervals: [20] })
        .toBe(shared.ActionKind.Dodge);
      await page.keyboard.up('ControlLeft');
      await page.mouse.click(480, 260, { button: strong ? 'right' : 'left' });
      expect(await page.evaluate(() => document.pointerLockElement === null)).toBe(true);
      await expect.poll(() => started.has(kind), { intervals: [20] }).toBe(true);
      const launch = poses.find((pose) => (pose.action & 0x1f) === kind)!;
      expect(launch.actionHeading).toBe(strong ? 64 : 0);
      expect(strong ? launch.vx : launch.vz).toBeGreaterThan(5);
      if (strong) {
        // Turn away from the trees at the clearing edge on landing. Changing
        // the held direction in the air must not redirect the dodge momentum.
        await page.keyboard.up('KeyD');
        await page.keyboard.down('KeyA');
        await expect
          .poll(
            () =>
              poses.some(
                (pose) =>
                  (pose.action & 0x1f) === kind &&
                  pose.actionAge > shared.DODGE_ATTACKS.heavy.land &&
                  pose.vx < 0,
              ),
            { intervals: [20] },
          )
          .toBe(true);
        await page.keyboard.up('KeyA');
      }
    }
    expect(errors).toEqual([]);
  } finally {
    closed = true;
    sim.dispose();
  }
});
for (const demo of ['dodge-slash', 'dodge-slam']) {
  test(`renders the ${demo} launch, airborne turn and landing`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('https://fonts.googleapis.com/**', (route) =>
      route.fulfill({ body: '', contentType: 'text/css' }),
    );
    await page.goto(`/?gallery=moves&demo=${demo}&strip=7&renderer=webgl2`);
    await expect(page.locator('body')).toHaveAttribute('data-gallery-ready', 'true', {
      timeout: 120_000,
    });
    await page.screenshot({ path: `/workspace/acorn-${demo}-poses.png` });
    expect(errors).toEqual([]);
  });
}
