import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';

test.setTimeout(180000);
test.use({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: 0.7 });
test('opens meal preparation at a fire, packs tea without replacing a meal, then eats it intentionally', async ({
  page,
}) => {
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    raidIntervalSeconds: 86400,
    hungerEmptyAfterSeconds: Infinity,
  });
  sim.setCalendarShift(shared.clockShiftForSeason(sim.seed, 0, 'winter'));
  sim.setTestWeather('storm');
  sim.addPlayer(1, {
    netId: 1,
    x: 0,
    y: 0,
    z: 0,
    facingYaw: 0,
    hunger: 100,
    items: [
      { item: 'berry', count: 5 },
      { item: 'roastedMeat', count: 1 },
    ],
    meal: shared.startMeal('trailRation'),
    discoveriesClaimed: (1 << 0) | (1 << 2) | (1 << 3),
  });
  sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0);
  sim.restoreBuiltProps([
    {
      id: 77,
      kind: 'campfire',
      x: 1.5,
      z: 0,
      yaw: 0,
      lit: true,
      ownerKey: null,
      fuelMs: shared.FIRE_LOG_MS,
      litUntilMs: 1000000,
    },
  ]);
  let timer: ReturnType<typeof setInterval> | undefined,
    time = 1000;
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '' }));
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    let sentScene = false;
    const refresh = () => {
      send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1)!)));
      send(shared.encodeEquipped(sim.equippedList()));
      if (!sentScene) {
        send(shared.encodeBuiltProps(sim.builtPropsList()));
        send(shared.encodeFireFuel(sim.fireFuelViews(time)));
        send(shared.encodeDiscoveries(sim.discoveryStateOf(1)));
        sentScene = true;
      }
      send(shared.encodeMeal(sim.mealStateOf(1)));
      send(shared.encodeWarmth(sim.warmthOf(1)));
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
      if (request?.type === 'input') sim.queueInputs(1, request.inputs);
      if (request?.type === 'craft') {
        const refusal = sim.craftRefusalFor(1, request.item);
        if (refusal) send(shared.encodeCraftRefused(request.item, refusal));
        else {
          sim.craftItem(1, request.item);
          for (const event of sim.drainCraftEvents()) send(shared.encodeCrafted(event));
        }
        refresh();
      }
      if (request?.type === 'useItem') {
        sim.useItem(1, request.item);
        refresh();
      }
    });
    timer = setInterval(() => {
      sim.step((time += shared.TICK_MILLISECONDS));
      if (sim.tick % 2 === 0) refresh();
    }, shared.TICK_MILLISECONDS);
  });
  try {
    await page.goto('/?renderer=webgl2&world=camp-kitchen&season=winter');
    await page.locator('#home-name').fill('Trail cook');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120000 });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
      timeout: 120000,
    });
    await page.getByRole('button', { name: 'Prepare meals', exact: true }).click();
    await expect(page.getByTestId('meal-preparation')).toBeVisible();
    await expect(page.getByTestId('meal-preparation')).toContainText('preparing one does not');
    const tea = page.locator('[data-meal-recipe="berryTea"]');
    await tea.scrollIntoViewIfNeeded();
    await expect(tea).toContainText('Winter walks');
    await expect(tea).toContainText('+10 warmth');
    await tea.click();
    await expect.poll(() => sim.inventoryOf(1).berryTea ?? 0).toBe(1);
    expect(sim.mealStateOf(1).item).toBe('trailRation');
    await expect(tea).toContainText('1 packed');
    await page.keyboard.press('KeyC');
    // Use the real game request path twice: hold first, consume second at full hunger.
    await page.locator('.hotbar-slot[data-item="berryTea"]').click();
    await expect.poll(() => sim.equippedItemOf(1)).toBe('berryTea');
    expect(sim.mealStateOf(1).item).toBe('trailRation');
    await page.locator('.hotbar-slot[data-item="berryTea"]').click();
    await expect(page.locator('.meal-benefit')).toContainText('Berry tea');
    expect(sim.mealStateOf(1).item).toBe('berryTea');
    expect(shared.mealWarmthBonus(sim.mealStateOf(1))).toBe(10);
    expect(errors).toEqual([]);
  } finally {
    if (timer) clearInterval(timer);
    sim.dispose();
  }
});
test('shows the preparation guide and updates packed counts in its gallery', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '' }));
  for (const before of [true, false]) {
    await page.goto(`/?gallery=meal-preparation${before ? '&before' : ''}`);
    await expect(page.locator('body')).toHaveAttribute('data-gallery-ready', 'true');
    await page.screenshot({ path: testInfo.outputPath(before ? 'before.png' : 'after.png') });
  }
  const ration = page.locator('[data-meal-recipe="trailRation"]');
  await ration.click();
  await expect(ration).toContainText('2 packed');
  await expect(page.getByTestId('meal-preparation')).toContainText('4:30');
  expect(errors).toEqual([]);
});
