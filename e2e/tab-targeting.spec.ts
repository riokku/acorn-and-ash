import { expect, test } from '@playwright/test';
import { skipDrawing } from './skip-drawing';

test('Tab selects, cycles, draws, and clears hostile targets through the game input loop', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await skipDrawing(page);
  const shared = await import('../packages/shared/src/index');
  const sim = new shared.WorldSimulation({ seed: shared.DEFAULT_WORLD_SEED });
  sim.addPlayer(1, { netId: 1, x: 0, y: 0, z: 0, facingYaw: 0, items: [], hunger: 100 }, 'owner');
  sim.step(Date.now());
  const raid = sim.startRaid(1, ['minion', 'minion', 'minion'])!;
  const [front, side, behind] = sim.raids.raidersOf(raid);
  if (front === undefined || side === undefined || behind === undefined)
    throw new Error('Raid did not spawn');
  sim.raids.placeRaider(front, { x: 0, y: 0, z: -8 });
  sim.raids.placeRaider(side, { x: 4, y: 0, z: -8 });
  sim.raids.placeRaider(behind, { x: 0, y: 0, z: 3 });
  let send: (data: ArrayBuffer) => void = () => {
    throw new Error('No connection');
  };
  const removed = new Set<number>();
  const sendSnapshot = (ack = 0): void =>
    send(
      shared.encodeSnapshot(
        sim.tick,
        Date.now(),
        ack,
        sim
          .snapshotFor(1)
          .filter(
            (entity) =>
              (entity.netId === 1 || [front, side, behind].includes(entity.netId)) &&
              !removed.has(entity.netId),
          ),
      ),
    );
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    send = (data) => socket.send(Buffer.from(data));
    send(shared.encodeWelcome(1, shared.DEFAULT_WORLD_SEED, sim.tick, Date.now()));
    send(shared.encodeInventory([]));
    send(shared.encodeSpace(0, 0, 0, 0));
    send(shared.encodeRaiders(sim.raidersList()));
    sendSnapshot();
    socket.onMessage((message) => {
      if (typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
      // Keep enemies still so this exercises targeting independently of raid AI.
      if (request?.type === 'input') sendSnapshot(request.inputs.at(-1)?.seq ?? 0);
    });
  });
  const selected = (): Promise<number | null | undefined> =>
    page.evaluate(() => window.acornDebug?.selectedTargetId());
  try {
    await page.goto('/?renderer=webgl2&world=tab-targeting');
    await page.locator('#home-name').fill('Target Tester');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
      timeout: 120_000,
    });
    await page.keyboard.press('Tab');
    await expect.poll(selected).toBe(front);
    // Gold selection feedback is painted on the existing combat canvas.
    await expect
      .poll(() =>
        page.getByTestId('combat-overlay').evaluate((canvas) => {
          const image = (canvas as HTMLCanvasElement)
            .getContext('2d')!
            .getImageData(
              0,
              0,
              (canvas as HTMLCanvasElement).width,
              (canvas as HTMLCanvasElement).height,
            );
          for (let i = 0; i < image.data.length; i += 4) {
            if (
              image.data[i] === 255 &&
              image.data[i + 1] === 212 &&
              image.data[i + 2] === 92 &&
              image.data[i + 3]! > 200
            )
              return true;
          }
          return false;
        }),
      )
      .toBe(true);
    await page.keyboard.press('Tab');
    await expect.poll(selected).toBe(side);
    await page.keyboard.press('Shift+Tab');
    await expect.poll(selected).toBe(front);
    await page.keyboard.press('Shift+Tab');
    await expect.poll(selected).toBe(behind);
    await page.keyboard.press('Tab');
    await expect.poll(selected).toBe(front);
    await page.keyboard.press('KeyI');
    await expect(page.locator('.inventory-panel')).toBeVisible();
    await page.keyboard.press('Tab');
    await expect.poll(selected).toBe(front);
    await page.keyboard.press('Escape');
    await expect(page.locator('.inventory-panel')).toBeHidden();
    // Release UI focus before returning keyboard control to the world.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    send(
      shared.encodeRaiderHit({
        raiderId: front,
        hitsLeft: 0,
        netId: 1,
        heavy: false,
        shrugged: false,
      }),
    );
    await expect.poll(selected).toBeNull();
    await page.keyboard.press('Tab');
    await expect.poll(selected).toBe(side);
    removed.add(side);
    sendSnapshot();
    await expect.poll(selected).toBeNull();
    await page.keyboard.press('Tab');
    await expect.poll(selected).toBe(behind);
    sim.raids.placeRaider(behind, { x: 0, y: 0, z: 31 });
    sendSnapshot();
    await expect.poll(selected).toBeNull();
    await page.keyboard.press('Tab');
    await expect.poll(selected).toBeNull();
  } finally {
    sim.dispose();
  }
});
