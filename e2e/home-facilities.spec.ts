import { expect, test } from '@playwright/test';
import * as shared from '../packages/shared/src/index';
test.use({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 0.5 });
test.setTimeout(240_000);
test('cooks at home, makes an improved axe and tends a persistent garden', async ({ page }) => {
  page.setDefaultTimeout(30_000);
  const sim = new shared.WorldSimulation({ seed: shared.DEFAULT_WORLD_SEED });
  sim.restoreBuiltProps([
    {
      id: 7,
      kind: 'largeCabin',
      x: 0,
      z: -4.2,
      yaw: 0,
      lit: false,
      ownerKey: 'gardener',
      litUntilMs: null,
    },
  ]);
  sim.addPlayer(1, undefined, 'gardener');
  Object.assign(sim.inventoryOf(1), { axe: 1, log: 6, bone: 4, berry: 1, meat: 1 });
  let sendWorld: ((data: ArrayBuffer) => void) | undefined;
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const scale = shared.homeRoomScale('largeCabin');
  const spot = (facility: 'cooking' | 'workbench' | 'garden') => {
    const at = shared.HOME_FACILITIES[facility];
    return { x: at.x * scale - 0.75, z: at.z * scale };
  };
  const initial = spot('cooking');
  sim.placePlayer(1, { ...initial, y: 0 }, 0, 7);
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ body: '', contentType: 'text/css' }),
  );
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    sendWorld = send;
    const refresh = () => {
      send(shared.encodeEquipped(sim.equippedList()));
      send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
      send(shared.encodeGardenState(sim.gardenStateOf(1)));
      send(
        shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
      );
    };
    send(shared.encodeWelcome(1, shared.DEFAULT_WORLD_SEED, 0, Date.now()));
    send(shared.encodeBuiltProps(sim.builtPropsList(), () => true));
    send(shared.encodeSpace(7, initial.x, initial.z, 0));
    refresh();
    socket.onMessage((message) => {
      if (typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
      if (request?.type === 'garden') send(shared.encodeGardenState(sim.requestGarden(1, request)));
      if (request?.type === 'useItem') sim.useItem(1, request.item);
      if (request?.type === 'craft') sim.craftItem(1, request.item);
      if (request?.type === 'input')
        for (const input of request.inputs) {
          sim.queueInput(1, input);
          sim.step(Date.now());
        }
      refresh();
    });
  });
  const teleport = (facility: 'cooking' | 'workbench' | 'garden') => {
    const at = spot(facility);
    sim.placePlayer(1, { ...at, y: 0 }, 0, 7);
    sendWorld!(shared.encodeSpace(7, at.x, at.z, 0));
    sendWorld!(
      shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
    );
  };
  try {
    await page.goto('/?renderer=webgl2&world=facilities-ui');
    await page.locator('#home-name').fill('Home Gardener');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
    await page.locator('.hud-curtain').click();
    await page.keyboard.down('KeyI');
    await expect(page.locator('.inventory-panel')).toBeVisible();
    await page.keyboard.up('KeyI');
    await page.getByRole('button', { name: /Meat, 1/ }).click();
    await page.keyboard.down('KeyI');
    await expect(page.locator('.inventory-panel')).toHaveCount(0);
    await page.keyboard.up('KeyI');
    await expect.poll(() => sim.equippedItemOf(1)).toBe('meat');
    await page.keyboard.down('KeyE');
    await expect.poll(() => sim.inventoryOf(1).roastedMeat ?? 0).toBe(1);
    await page.keyboard.up('KeyE');
    teleport('workbench');
    await page.keyboard.down('KeyC');
    await expect(page.locator('.hud-journal')).toBeVisible();
    await page.keyboard.up('KeyC');
    await page.locator('.hud-journal-entry').filter({ hasText: 'Refined axe' }).click();
    await expect.poll(() => sim.inventoryOf(1).refinedAxe ?? 0).toBe(1);
    await page.keyboard.down('KeyC');
    await expect(page.locator('.hud-journal')).toHaveCount(0);
    await page.keyboard.up('KeyC');
    teleport('garden');
    await page.keyboard.down('KeyC');
    await expect(page.locator('.hud-journal')).toBeVisible();
    await page.keyboard.up('KeyC');
    await page.getByRole('button', { name: 'Garden', exact: true }).click();
    await page
      .getByRole('button', { name: 'Plant forest berries · 1', exact: true })
      .first()
      .click();
    await expect(page.locator('.garden-box').first()).toContainText('Growing');
    const ripe = shared.emptyGarden();
    ripe[0] = { crop: 'berry', growTicks: 0 };
    sim.restoreGarden(7, ripe);
    sendWorld!(shared.encodeGardenState(sim.gardenStateOf(1)));
    await page.getByRole('button', { name: 'Harvest 3 forest berries', exact: true }).click();
    await expect.poll(() => sim.inventoryOf(1).berry ?? 0).toBe(3);
    await expect(page.locator('.garden-box').first()).toContainText('Ready to plant');
    await page.screenshot({
      path: process.env.CI ? 'test-results/home-garden.png' : '/workspace/acorn-home-garden.png',
    });
    expect(errors).toEqual([]);
  } finally {
    sim.dispose();
  }
});
