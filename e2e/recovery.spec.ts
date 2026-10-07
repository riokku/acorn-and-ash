import { expect, test } from '@playwright/test';
import * as shared from '../packages/shared/src/index';
test.use({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 0.5 });
test.setTimeout(180_000);
test('keeps private recovery guidance after partial recovery with a crowded world', async ({
  page,
}, testInfo) => {
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    hungerEmptyAfterSeconds: Infinity,
  });
  sim.addPlayer(1, undefined, 'recovering');
  sim.placePlayer(1, { x: 0, y: 0, z: 10 }, 0);
  Object.assign(sim.inventoryOf(1), { log: 58 });
  sim.restoreBuriedCaches(
    Array.from({ length: 300 }, (_, i) => ({
      id: 70000 + i,
      ownerPlayerKey: 'recovering',
      x: i === 0 ? 0 : 100,
      z: i === 0 ? 10 : 100 + i / 100,
      items: [{ item: 'log' as const, count: i === 0 ? 4 : 1 }],
    })),
  );
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
      send(shared.encodeRecoveryMarkers(sim.buriedCachesList()));
      send(shared.encodeBuriedCaches([]));
    };
    send(shared.encodeWelcome(1, shared.DEFAULT_WORLD_SEED, 0, Date.now()));
    refresh();
    socket.onMessage((message) => {
      if (typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
      if (request?.type === 'input') {
        for (const input of request.inputs) {
          sim.queueInput(1, input);
          sim.step(Date.now());
        }
        for (const event of sim.drainCacheEvents()) send(shared.encodeCache(event));
        refresh();
      }
    });
  });
  try {
    await page.goto('/?renderer=webgl2&world=recovery-ui');
    await page.locator('#home-name').fill('Trail Keeper');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
      timeout: 120_000,
    });
    await expect(page.locator('body')).toContainText('Press E to recover belongings');
    await expect
      .poll(() => page.evaluate(() => window.acornDebug?.buriedCaches().length))
      .toBe(300);
    await page.keyboard.down('KeyE');
    await expect.poll(() => sim.inventoryOf(1).log).toBe(60);
    await page.keyboard.up('KeyE');
    await expect(page.locator('body')).toContainText('Some belongings recovered');
    await expect(page.locator('body')).toContainText('leftovers stay safely here');
    expect(sim.buriedCachesList()).toHaveLength(300);
    await page.screenshot({
      path: process.env.CI
        ? testInfo.outputPath('recovery-guidance.png')
        : '/workspace/acorn-recovery-guidance.png',
    });
    expect(errors).toEqual([]);
  } finally {
    sim.dispose();
  }
});
