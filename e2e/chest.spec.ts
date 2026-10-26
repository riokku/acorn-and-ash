import { expect, test } from './fixtures';
import {
  DEFAULT_WORLD_SEED,
  HOME_FURNITURE,
  HOME_WAKE_SPOT,
  WorldSimulation,
  decodeClientMessage,
  encodeBuiltProps,
  encodeChestState,
  encodeInventory,
  encodePong,
  encodeSnapshot,
  encodeSpace,
  encodeWelcome,
  inventoryEntries,
} from '../packages/shared/src/index';

// Exercise the real room, ray picking, protocol and panel with a seeded private
// home. Durable Object persistence and isolation are covered by the Worker test.
test.use({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 0.5 });
test.setTimeout(180_000);
test('opens the bed chest by clicking its model and moves saved stacks both ways', async ({
  page,
}, testInfo) => {
  const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED });
  const home = { id: 7, kind: 'cabin' as const, x: 0, z: -20, yaw: 0, lit: false };
  sim.restoreBuiltProps([{ ...home, ownerKey: 'chest-owner', litUntilMs: null }]);
  sim.addPlayer(1, undefined, 'chest-owner');
  Object.assign(sim.inventoryOf(1), { log: 12, stick: 4 });
  let finishStorage: (() => void) | null = null;
  let deferStorage = false;
  let storageRequests = 0;
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    send(encodeWelcome(1, DEFAULT_WORLD_SEED, 0, Date.now()));
    send(encodeBuiltProps([home], () => true));
    send(encodeInventory(inventoryEntries(sim.inventoryOf(1))));
    send(encodeSpace(7, HOME_WAKE_SPOT.x, HOME_WAKE_SPOT.z, HOME_WAKE_SPOT.yaw));
    send(encodeSnapshot(0, Date.now(), 0, sim.snapshotFor(1)));
    socket.onMessage((message) => {
      if (typeof message === 'string') return;
      const request = decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(encodePong(request.clientTimeMs, Date.now()));
      if (request?.type === 'chest') {
        storageRequests++;
        const finish = () => {
          const result = sim.requestChest(1, request);
          send(encodeInventory(inventoryEntries(sim.inventoryOf(1))));
          send(encodeChestState(result));
        };
        if (deferStorage) finishStorage = finish;
        else finish();
      }
    });
  });
  try {
    await page.goto('/?renderer=webgl2&world=chest-ui');
    await page.locator('#home-name').fill('Chest Keeper');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
      timeout: 120_000,
    });
    await expect
      .poll(() => page.evaluate(() => window.acornDebug?.localPosition().x))
      .toBeCloseTo(HOME_WAKE_SPOT.x, 1);
    const point = await page.evaluate(
      ([x, z]) => window.acornDebug?.screenPoint(x!, 0.3, z!),
      [HOME_FURNITURE.chest.x, HOME_FURNITURE.chest.z],
    );
    if (point == null) throw new Error('Chest is off screen');
    await page.mouse.move(point.x, point.y);
    await expect(page.locator('.loot-hover')).toContainText('Storage chest');
    await page.mouse.click(point.x, point.y);
    const panel = page.getByTestId('chest-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('0/10');
    await expect(page.locator('[data-testid^="chest-withdraw-"]')).toHaveCount(10);
    deferStorage = true;
    await page.getByRole('button', { name: 'Store 10 Log', exact: true }).click();
    await expect(panel).toHaveAttribute('aria-busy', 'true');
    await expect(panel.getByRole('status')).toContainText('Waiting for storage confirmation');
    await expect(page.getByRole('button', { name: 'Store 10 Log', exact: true })).toBeDisabled();
    await expect(panel.getByRole('status')).toContainText('still waiting', { timeout: 12000 });
    expect(storageRequests).toBe(2);
    finishStorage!();
    deferStorage = false;
    await expect(panel).toContainText('1/10');
    await page
      .getByRole('button', { name: 'Take 10 Log', exact: true })
      .click({ modifiers: ['Shift'] });
    await expect(page.getByRole('button', { name: 'Take 9 Log', exact: true })).toBeVisible();
    await page.screenshot({
      path: process.env.CI
        ? testInfo.outputPath('storage-chest.png')
        : '/workspace/acorn-storage-chest.png',
    });
    deferStorage = true;
    await page.getByRole('button', { name: 'Take 9 Log', exact: true }).click();
    await expect(panel).toHaveAttribute('aria-busy', 'true');
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(page.locator('.interaction-note')).toContainText('Waiting for storage');
    await page.mouse.click(point.x, point.y);
    // Pointer actions are consumed by the game's frame, not the DOM click callback.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    expect(storageRequests).toBe(4);
    finishStorage!();
    deferStorage = false;
    await expect(page.locator('.interaction-note')).toHaveText('9 items moved.');
    await expect(panel).toBeHidden();
    await page.mouse.click(point.x, point.y);
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('0/10');
    await page.getByRole('button', { name: 'Store building supplies', exact: true }).click();
    await expect(panel).toContainText('3/10');
    await expect(
      page.getByRole('button', { name: 'Store building supplies', exact: true }),
    ).toBeDisabled();
    expect(sim.inventoryOf(1).log ?? 0).toBe(0);
    expect(sim.inventoryOf(1).stick ?? 0).toBe(0);
    await page.getByRole('button', { name: 'Close storage chest' }).click();
    await expect(panel).toBeHidden();
    expect(errors).toEqual([]);
  } finally {
    sim.dispose();
  }
});
