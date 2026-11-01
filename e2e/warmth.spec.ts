import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';
test.use({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
test.setTimeout(240_000);

test('explains winter cold, equips a jacket and recovers warmth by a lit fire', async ({
  page,
}) => {
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    hungerEmptyAfterSeconds: Infinity,
    forestEncounters: false,
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
      { item: 'bag', count: 1 },
      { item: 'winterJacket', count: 1 },
      { item: 'log', count: 1 },
    ],
    warmth: { value: 20, coldTicks: 0 },
  });
  sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let refresh = () => {};
  let sendWorld = (_data: ArrayBuffer) => {};
  let simulationTime = 1000;
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ body: '', contentType: 'text/css' }),
  );
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    sendWorld = send;
    refresh = () => {
      send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
      send(shared.encodeWorn(sim.wornList()));
      send(shared.encodeEquipped(sim.equippedList()));
      send(shared.encodeBuiltProps(sim.builtPropsList()));
      send(shared.encodeFireFuel(sim.fireFuelViews(simulationTime)));
      send(shared.encodeWarmth(sim.warmthOf(1)));
      send(
        shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
      );
    };
    send(shared.encodeWelcome(1, sim.seed, 0, Date.now()));
    send(shared.encodeLakeIce(true));
    refresh();
    socket.onMessage((message) => {
      if (typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
      if (request?.type === 'gear') {
        if (request.action === 'wear') sim.wearGear(1, request.item, request.slot);
        if (request.action === 'takeOff') sim.takeOffGear(1, request.slot);
        if (request.action === 'swap') sim.swapGear(1, request.from, request.to);
        sim.step(simulationTime);
        refresh();
      }
    });
  });
  try {
    await page.goto('/?renderer=webgl2&world=warmth-ui&season=summer');
    await page.locator('#home-name').fill('Winter Walker');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
      timeout: 120_000,
    });
    const meter = page.getByTestId('warmth-meter');
    const warmthBox = (await meter.boundingBox())!;
    const hungerBox = (await page.getByTestId('hunger-bar').boundingBox())!;
    const healthBox = (await page.getByTestId('health-bar').boundingBox())!;
    expect(warmthBox.y + warmthBox.height).toBeLessThanOrEqual(hungerBox.y);
    expect(hungerBox.y + hungerBox.height).toBeLessThanOrEqual(healthBox.y);
    await expect(meter).toHaveAttribute('data-status', 'cold');
    await expect(meter).toContainText('warmer gear');
    await page.keyboard.press('KeyZ');
    await expect(page.getByTestId('character-stats')).toContainText('Warmth0');
    await page.getByTestId('pack-slot-winterJacket').click({ button: 'right' });
    await expect(page.getByTestId('character-stats')).toContainText('Warmth60');
    await expect(meter).toHaveAttribute('data-status', 'warming');
    await page.getByTestId('gear-slot-upperBody').click({ button: 'right' });
    await expect(meter).toHaveAttribute('data-status', 'cold');
    await page.keyboard.press('KeyZ');
    sim.restoreBuiltProps([
      {
        id: 500,
        kind: 'campfire',
        x: 3,
        z: 0,
        yaw: 0,
        lit: false,
        ownerKey: null,
        litUntilMs: null,
      },
    ]);
    // Fuel the fire through the same validated action as a player, then stand
    // within its warmth radius (outside the shorter refueling reach).
    sim.placePlayer(1, { x: 1.6, y: 0, z: 0 }, 0);
    expect(sim.requestFire(1, { propId: 500, action: 'addLog' }, simulationTime)).toBe(true);
    expect(shared.countOf(sim.inventoryOf(1), 'log')).toBe(0);
    sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0);
    simulationTime += 100;
    sim.step(simulationTime);
    refresh();
    await expect(meter).toContainText('Warming by the campfire');
    simulationTime += shared.FIRE_LOG_MS;
    sim.extinguishBurnedOutCampfires(simulationTime);
    sim.step(simulationTime);
    refresh();
    await expect(meter).toHaveAttribute('data-status', 'cold');
    await expect(meter).not.toContainText('Warming by the campfire');
    sendWorld(
      shared.encodeWarmth({ value: 0, status: 'freezing', heat: null, secondsToDamage: 12 }),
    );
    await expect(meter).toContainText('health loss in 12s');
    sendWorld(shared.encodeLakeIce(false));
    sendWorld(
      shared.encodeWarmth({ value: 100, status: 'comfortable', heat: null, secondsToDamage: null }),
    );
    await expect(meter).toBeVisible();
    await expect(meter).toContainText('Comfortably warm');
    expect(errors).toEqual([]);
  } finally {
    sim.dispose();
  }
});

test(
  'shows winter clothing on an animated body in the gallery',
  { tag: '@real-drawing' },
  async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/?gallery=winter-gear&body=ranger&renderer=webgl2');
    await expect(page.locator('body')).toHaveAttribute('data-gallery-ready', 'true', {
      timeout: 120_000,
    });
    await expect(page.getByText('Winter clothing · Warmth 100')).toBeVisible();
    // Worn gear is not drawn on the dwarf bodies until it is refitted (decision 0270).
    await expect(page.locator('body')).toHaveAttribute('data-winter-gear-heads', '0');
    expect(errors).toEqual([]);
  },
);
