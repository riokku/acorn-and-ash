import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';
test.setTimeout(240_000);
test.use({ viewport: { width: 840, height: 740 }, deviceScaleFactor: 0.75 });

test('shows basic clothing on every body with a rigged cap', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const body of Object.keys(shared.CHARACTER_KINDS)) {
    await page.goto(`/?gallery=basic-clothing&body=${body}&renderer=webgl2&still`);
    await expect(page.locator('body')).toHaveAttribute('data-gallery-ready', 'true');
    // Worn gear is not drawn on the dwarf bodies until it is refitted (decision 0270).
    await expect(page.locator('body')).toHaveAttribute('data-winter-gear-heads', '0');
    await expect(page.locator('body')).toContainText('Protection 5% · Warmth 30');
    await page.screenshot({ path: testInfo.outputPath(`basic-${body}.png`) });
  }
  await page.goto('/?gallery=basic-clothing&body=ranger&renderer=webgl2&still&back');
  await expect(page.locator('body')).toHaveAttribute('data-gallery-ready', 'true');
  await page.screenshot({ path: testInfo.outputPath('basic-ranger-back.png') });
  await page.goto('/?gallery=basic-clothing&body=ranger&renderer=webgl2&still&before');
  await expect(page.locator('body')).toHaveAttribute('data-gallery-ready', 'true');
  await page.screenshot({ path: testInfo.outputPath('basic-before.png') });
  expect(errors).toEqual([]);
});

test('collects dropped clothes, equips each slot and restores warmth and protection bonuses', async ({
  page,
}) => {
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
    items: [{ item: 'bag', count: 1 }],
  });
  sim.placePlayer(1, { x: 0, y: 0, z: 10 }, 0);
  sim.restoreDroppedPiles(
    shared.BASIC_CLOTHING.map((item, i) => ({
      id: i + 1,
      item,
      count: 1,
      x: 0.6 + i * 0.2,
      z: 10,
      droppedAtMs: Date.now(),
    })),
    Date.now(),
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
      send(shared.encodeWorn(sim.wornList()));
      send(shared.encodeEquipped(sim.equippedList()));
      send(shared.encodeDroppedPiles(sim.droppedPilesList(1)));
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
      if (request?.type === 'gear' && request.action === 'wear') {
        sim.wearGear(1, request.item, request.slot);
        refresh();
      }
      if (request?.type === 'input') {
        for (const input of request.inputs) {
          sim.queueInput(1, input);
          sim.step(Date.now());
        }
        refresh();
      }
    });
  });
  try {
    await page.goto('/?renderer=webgl2&world=clothing-ui');
    await page.locator('#home-name').fill('Forest Wanderer');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
      timeout: 120_000,
    });
    await page.keyboard.down('KeyE');
    await expect
      .poll(() => shared.BASIC_CLOTHING.every((item) => sim.inventoryOf(1)[item] === 1))
      .toBe(true);
    await page.keyboard.up('KeyE');
    await page.keyboard.press('KeyZ');
    for (const item of shared.BASIC_CLOTHING)
      await page.getByTestId(`pack-slot-${item}`).click({ button: 'right' });
    await expect(page.getByTestId('character-stats')).toContainText('Protection5%');
    await expect(page.getByTestId('character-stats')).toContainText('Warmth30');
    expect(sim.wornOf(1)).toMatchObject({
      helm: 'woolCap',
      upperBody: 'linenShirt',
      lowerBody: 'workTrousers',
    });
    expect(shared.BASIC_CLOTHING.every((item) => sim.inventoryOf(1)[item] === undefined)).toBe(
      true,
    );
    expect(errors).toEqual([]);
  } finally {
    sim.dispose();
  }
});
