import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';
import { drawnScreenshot } from './skip-drawing';
test.use({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 0.75 });
test.setTimeout(240_000);

test('stores visible firewood, withdraws it, and fuels a cabin and outdoor fire', async ({
  page,
}) => {
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    forestEncounters: false,
    hungerEmptyAfterSeconds: Infinity,
  });
  const home = { id: 7, kind: 'cabin' as const, x: 0, z: -4.2, yaw: 0, lit: false };
  sim.restoreBuiltProps([
    { ...home, ownerKey: 'wood-owner', litUntilMs: null },
    {
      id: 8,
      kind: 'campfire',
      x: -10,
      z: 2,
      yaw: 0,
      lit: false,
      ownerKey: 'wood-owner',
      litUntilMs: null,
    },
  ]);
  const pile = shared.logStorageSpot(home),
    outside = { x: pile.x - 1.2, z: pile.z };
  sim.addPlayer(
    1,
    {
      netId: 1,
      ...outside,
      y: 0,
      facingYaw: 0,
      hunger: 100,
      items: [
        { item: 'bag', count: 1 },
        { item: 'log', count: 12 },
      ],
      takenPickups: sim.clearing.pickups.map((p) => p.id),
    },
    'wood-owner',
  );
  sim.placePlayer(1, { ...outside, y: 0 }, 0);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', (r) =>
    r.fulfill({ body: '', contentType: 'text/css' }),
  );
  await page.route('**/api/session', (r) =>
    r.fulfill({
      json: { signedIn: true, name: 'Wood keeper', providers: [], testSignIn: 'automatic' },
    }),
  );
  await page.route('**/api/worlds/*/character', (r) => r.fulfill({ json: { character: null } }));
  let moveTo = (_space: number, _x: number, _z: number) => {};
  let refresh = () => {};
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    refresh = () => {
      send(shared.encodeBuiltProps(sim.builtPropsList(), () => true));
      send(shared.encodeFireFuel(sim.fireFuelViews(Date.now())));
      send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
      send(shared.encodeEquipped(sim.equippedList()));
      send(
        shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
      );
    };
    moveTo = (space, x, z) => {
      sim.placePlayer(1, { x, y: 0, z }, 0, space);
      send(shared.encodeSpace(space, x, z, 0));
      refresh();
    };
    send(shared.encodeWelcome(1, sim.seed, 0, Date.now()));
    send(shared.encodeSpace(0, outside.x, outside.z, 0));
    send(shared.encodePickupsTaken(sim.clearing.pickups.map((p) => p.id)));
    refresh();
    socket.onMessage((message) => {
      if (typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
      if (request?.type === 'fire') {
        sim.requestFire(1, request, Date.now());
        refresh();
      }
      if (request?.type === 'input') {
        sim.queueInputs(1, request.inputs);
        for (let i = 0; i < request.inputs.length; i++) sim.step(Date.now());
        send(
          shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
        );
      }
    });
  });
  try {
    await page.goto('/?renderer=webgl2&world=fire-fuel');
    await page.locator('#home-name').fill('Wood keeper');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
    const storage = page.getByTestId('log-storage');
    await expect(storage).toContainText('0 / 20 logs');
    await storage.getByRole('button', { name: 'Store all', exact: true }).click();
    await expect(storage).toContainText('12 / 20 logs');
    expect(sim.inventoryOf(1).log ?? 0).toBe(0);
    await storage.getByRole('button', { name: 'Take 5', exact: true }).click();
    await expect(storage).toContainText('7 / 20 logs');
    expect(sim.inventoryOf(1).log).toBe(5);
    if (process.env.ACORN_FIRE_SHOTS) {
      await page.evaluate(({ x, z }) => window.acornDebug?.faceTowards(x, z), pile);
      await drawnScreenshot(page, `${process.env.ACORN_FIRE_SHOTS}/cabin-firewood.png`);
    }
    moveTo(7, 1.6, -0.9);
    const fire = page.getByTestId('fire-fuel');
    await expect(fire).toContainText('Fire out');
    await fire.getByRole('button', { name: 'Add log & light' }).click();
    await expect(fire).toContainText('Fire burning');
    expect(sim.inventoryOf(1).log).toBe(4);
    for (let i = 0; i < 4; i++) {
      await fire.getByRole('button', { name: 'Add log · +10m' }).click();
      await expect.poll(() => sim.inventoryOf(1).log ?? 0).toBe(3 - i);
    }
    await expect(fire.getByRole('button', { name: 'Fire full' })).toBeDisabled();
    await expect(fire.getByRole('meter', { name: 'Fire burn time' })).toHaveAttribute(
      'max',
      '3000000',
    );
    await fire.getByRole('button', { name: 'Put out', exact: true }).click();
    await expect(fire).toContainText('Fire out');
    const paused = sim.fireFuelRemainingMs(7, Date.now());
    expect(paused).toBeGreaterThan(shared.FIRE_CAPACITY_MS - 30_000);
    await fire.getByRole('button', { name: 'Light', exact: true }).click();
    await expect(fire).toContainText('Fire burning');
    sim.extinguishBurnedOutCampfires(Date.now() + shared.FIRE_CAPACITY_MS);
    refresh();
    await expect(fire).toContainText('0:00 remaining');
    await expect(fire.getByRole('button', { name: 'Light', exact: true })).toBeDisabled();
    moveTo(0, outside.x, outside.z);
    await expect(storage).toBeVisible();
    await storage.getByRole('button', { name: 'Take 1', exact: true }).click();
    await expect(storage).toContainText('6 / 20 logs');
    moveTo(0, -10, 3.5);
    await expect(fire).toContainText('Fire out');
    await fire.getByRole('button', { name: 'Add log & light' }).click();
    await expect(fire).toContainText('Fire burning');
    expect(sim.fireIsLit(8, Date.now())).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    sim.dispose();
  }
});
