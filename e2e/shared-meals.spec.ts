import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';

test('offers two prepared servings to a nearby companion and gives both the meal benefit', async ({
  page,
}) => {
  test.setTimeout(180000);
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    forestEncounters: false,
    raidIntervalSeconds: 86400,
  });
  sim.setCalendarShift(shared.clockShiftForSeason(sim.seed, 0, 'summer'));
  sim.addPlayer(
    1,
    {
      netId: 1,
      x: 0,
      y: 0,
      z: 0,
      facingYaw: 0,
      hunger: 100,
      health: 100,
      items: [{ item: 'forestStew', count: 4 }],
    },
    'cook',
  );
  sim.addPlayer(2, undefined, 'friend');
  sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0);
  sim.placePlayer(2, { x: 1.8, y: 0, z: 0 }, 0);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ body: '' }));
  let timer: ReturnType<typeof setInterval> | undefined;
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    const refresh = () => {
      send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
      send(shared.encodeEquipped([{ netId: 1, item: sim.equippedItemOf(1) }]));
      send(shared.encodeAllies(sim.alliesOf(1)));
      send(shared.encodeMeal(sim.mealStateOf(1)));
      send(
        shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
      );
    };
    send(shared.encodeWelcome(1, sim.seed, 0, Date.now()));
    send(shared.encodeSpace(0, 0, 0, 0));
    send(
      shared.encodeRoster([
        {
          netId: 1,
          name: 'Trail cook',
          character: 'ranger',
          color: 'moss',
          skin: shared.DEFAULT_SKIN_TONE,
        },
        {
          netId: 2,
          name: 'Fern',
          character: 'ranger',
          color: 'moss',
          skin: shared.DEFAULT_SKIN_TONE,
        },
      ]),
    );
    refresh();
    socket.onMessage((message) => {
      if (typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
      if (request?.type === 'input') sim.queueInputs(1, request.inputs);
      if (request?.type === 'useItem') {
        sim.useItem(1, request.item);
        refresh();
      }
    });
    timer = setInterval(() => {
      sim.step(Date.now());
      refresh();
    }, shared.TICK_MILLISECONDS);
  });
  try {
    await page.goto('/?renderer=webgl2&world=shared-supper&season=summer');
    await page.locator('#home-name').fill('Trail cook');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120000 });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
      timeout: 120000,
    });
    await page.keyboard.press('Digit1');
    await expect(page.getByTestId('allies')).toContainText('uses 2 servings, one each');
    expect(sim.mealStateOf(1).item).toBeNull();
    await page.keyboard.press('KeyE');
    await expect.poll(() => sim.mealStateOf(2).item).toBe('forestStew');
    expect(sim.mealStateOf(1).item).toBe('forestStew');
    expect(sim.inventoryOf(1).forestStew).toBe(2);
    await expect(page.getByTestId('allies')).not.toContainText('Share');
    expect(errors).toEqual([]);
  } finally {
    if (timer) clearInterval(timer);
    sim.dispose();
  }
});
