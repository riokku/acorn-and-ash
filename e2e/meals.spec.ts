import { expect, test } from '@playwright/test';
import * as shared from '../packages/shared/src/index';
test.use({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 0.5 });
test.setTimeout(180_000);
test('prepares at full hunger, shows one benefit, replaces it and clears expiry', async ({
  page,
}) => {
  page.setDefaultTimeout(30_000);
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    hungerEmptyAfterSeconds: Infinity,
  });
  sim.addPlayer(
    1,
    {
      netId: 1,
      x: 0,
      y: 0,
      z: 0,
      facingYaw: 0,
      hunger: 100,
      health: 80,
      items: [],
      discoveriesFound: 15,
      discoveriesClaimed: 15,
    },
    'trail-cook',
  );
  Object.assign(sim.inventoryOf(1), {
    bag: 1,
    trailRation: 2,
    forestStew: 1,
    berryTea: 1,
    roastedMeat: 1,
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let sendWorld: ((data: ArrayBuffer) => void) | undefined;
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ body: '', contentType: 'text/css' }),
  );
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    sendWorld = send;
    const refresh = () => {
      send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
      send(shared.encodeMeal(sim.mealStateOf(1)));
      send(shared.encodeEquipped(sim.equippedList()));
      send(
        shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
      );
    };
    send(shared.encodeWelcome(1, shared.DEFAULT_WORLD_SEED, 0, Date.now()));
    send(shared.encodeSpace(0, 0, 0, 0));
    send(shared.encodeDiscoveries(sim.discoveryStateOf(1)));
    send(shared.encodeHunger({ netId: 1, hunger: 100, ate: null }));
    send(shared.encodeHealth({ netId: 1, health: 80, knockedOut: false, dodged: false }));
    refresh();
    socket.onMessage((message) => {
      if (typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
      if (request?.type === 'useItem') sim.useItem(1, request.item);
      if (request?.type === 'input')
        for (const input of request.inputs) {
          sim.queueInput(1, input);
          sim.step(Date.now());
        }
      refresh();
    });
  });
  try {
    await page.goto('/?renderer=webgl2&world=meal-ui');
    await page.locator('#home-name').fill('Trail Cook');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
      timeout: 120_000,
    });
    await expect(page.locator('.meal-benefit')).toHaveCount(0);
    await page.keyboard.down('KeyI');
    await expect(page.locator('.inventory-panel')).toBeVisible();
    await page.keyboard.up('KeyI');
    await page.getByRole('button', { name: /Trail ration, 2/ }).click();
    await expect.poll(() => sim.mealStateOf(1).item).toBe('trailRation');
    await expect(page.locator('.meal-benefit')).toContainText('Trail ration');
    await expect(page.locator('.meal-benefit')).toHaveAttribute(
      'title',
      /Dodge recovers 25% faster/,
    );
    expect(sim.hungerOf(1)).toBe(100);
    await page.getByRole('button', { name: /Roasted meat, 1/ }).click();
    expect(sim.inventoryOf(1).roastedMeat).toBe(1);
    await page.getByRole('button', { name: /Forest stew, 1/ }).click();
    await expect.poll(() => sim.mealStateOf(1).item).toBe('forestStew');
    await expect(page.locator('.meal-benefit')).toHaveAttribute('title', /Restores 2 health/);
    await page.getByRole('button', { name: /Berry tea, 1/ }).click();
    await expect.poll(() => sim.mealStateOf(1).item).toBe('berryTea');
    await expect(page.locator('.meal-benefit')).toHaveCount(1);
    await expect(page.locator('.meal-benefit')).toContainText('Berry tea');
    await page.keyboard.down('KeyI');
    await expect(page.locator('.inventory-panel')).toHaveCount(0);
    await page.keyboard.up('KeyI');
    await page.keyboard.down('KeyC');
    await expect(page.locator('.hud-journal')).toBeVisible();
    await page.keyboard.up('KeyC');
    await expect(page.locator('.hud-journal')).toContainText('10 active minutes');
    await page.keyboard.down('KeyC');
    await expect(page.locator('.hud-journal')).toHaveCount(0);
    await page.keyboard.up('KeyC');
    await page.screenshot({
      path: process.env.CI
        ? 'test-results/prepared-meal.png'
        : '/workspace/acorn-prepared-meal.png',
    });
    const saved = sim.persistablePlayers()[0]!;
    sim.removePlayer(1);
    sim.addPlayer(1, { ...saved, meal: { item: 'berryTea', ticksLeft: 1 } }, 'trail-cook');
    sim.step(Date.now());
    sendWorld!(shared.encodeMeal(sim.mealStateOf(1)));
    await expect(page.locator('.meal-benefit')).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    sim.dispose();
  }
});
