import { expect, test } from './fixtures';
import { drawnScreenshot } from './skip-drawing';
import * as shared from '../packages/shared/src/index';
test.use({ viewport: { width: 1100, height: 720 }, deviceScaleFactor: 0.75 });
test.setTimeout(180_000);

test('requires a shovel for treasure and preserves a partial find', async ({ page }, testInfo) => {
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    forestEncounters: false,
    hungerEmptyAfterSeconds: Infinity,
  });
  sim.addPlayer(1, {
    netId: 1,
    x: 0,
    y: 0,
    z: 10,
    facingYaw: 0,
    hunger: 100,
    equippedItem: 'axe',
    worn: [{ slot: 'mainHand', item: 'axe' }],
    items: [
      { item: 'stone', count: 10 },
      { item: 'shovel', count: 1 },
      { item: 'rod', count: 1 },
      { item: 'torch', count: 1 },
      { item: 'log', count: 18 },
    ],
  });
  sim.placePlayer(1, { x: 0, y: 0, z: 10 }, 0);
  sim.initializeTreasures([{ id: 1, x: 0.6, z: 10, items: [{ item: 'log', count: 4 }] }]);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ body: '', contentType: 'text/css' }),
  );
  let refresh = () => {};
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    refresh = () => {
      send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
      send(shared.encodeEquipped(sim.equippedList()));
      send(shared.encodeWorn(sim.wornList()));
      send(shared.encodeTreasure(sim.treasureSpots()));
      send(
        shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
      );
    };
    send(shared.encodeWelcome(1, sim.seed, 0, Date.now()));
    refresh();
    socket.onMessage((message) => {
      if (typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
      if (request?.type === 'useItem') {
        sim.useItem(1, request.item);
        refresh();
      }
      if (request?.type === 'gear' && request.action === 'wear') {
        const change = sim.wearGear(1, request.item, request.slot);
        if (!change.ok) send(shared.encodeGearRefused(change.reason));
        refresh();
      }
      if (request?.type === 'input') {
        for (const input of request.inputs) {
          sim.queueInput(1, input);
          sim.step(Date.now());
        }
        for (const event of sim.drainTreasureEvents()) send(shared.encodeCache(event));
        for (const event of sim.drainGestureEvents()) send(shared.encodeGestures([event]));
        refresh();
      }
    });
  });
  try {
    await page.goto('/?renderer=webgl2&world=treasure-ui&season=summer');
    await page.locator('#home-name').fill('Treasure Finder');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
      timeout: 120_000,
    });
    await expect(page.locator('body')).toContainText('equip a shovel to dig it up');
    await page.keyboard.press('KeyE');
    expect(sim.inventoryOf(1).log).toBe(18);
    await page.keyboard.press('KeyB');
    await page.getByTestId('pack-slot-shovel').click();
    await page.keyboard.press('KeyB');
    await expect(page.locator('body')).toContainText('Press E to dig up treasure');
    await drawnScreenshot(page, testInfo.outputPath('buried-treasure.png'));
    await page.keyboard.down('KeyE');
    await expect.poll(() => sim.inventoryOf(1).log).toBe(20);
    await page.keyboard.up('KeyE');
    await expect(page.locator('body')).toContainText('Some treasure collected');
    expect(sim.savedTreasures()[0]?.items).toEqual([{ item: 'log', count: 2 }]);
    expect(sim.digsList()).toEqual([]);
    delete sim.inventoryOf(1).axe;
    refresh();
    await page.keyboard.down('KeyE');
    await expect.poll(() => sim.treasureSpots().length).toBe(0);
    await page.keyboard.up('KeyE');
    await expect(page.locator('body')).toContainText('Treasure unearthed!');
    expect(sim.inventoryOf(1).log).toBe(22);
    expect(errors).toEqual([]);
  } finally {
    sim.dispose();
  }
});
