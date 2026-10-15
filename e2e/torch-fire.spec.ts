import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';

test.use({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 0.5 });
test.setTimeout(180_000);

test('a torch ignites a tree and burns it down without loot', async ({ page }) => {
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    forestEncounters: false,
    hungerEmptyAfterSeconds: Infinity,
  });
  sim.setCalendarShift(shared.clockShiftForSeason(sim.seed, 0, 'summer'));
  const tree = sim.clearing.props.find((prop) => prop.kind === 'oak')!;
  const radius = shared.PROP_KINDS[tree.kind].colliderRadius * tree.scale;
  const x = tree.x;
  const z = tree.z + radius + 1;
  sim.addPlayer(1, {
    netId: 1,
    x,
    y: tree.y ?? 0,
    z,
    facingYaw: 0,
    hunger: shared.HUNGER_MAX,
    items: [
      { item: 'bag', count: 1 },
      { item: 'axe', count: 1 },
      { item: 'torch', count: 1 },
    ],
    equippedItem: 'torch',
    takenPickups: sim.clearing.pickups.map((pickup) => pickup.id),
  });
  let finishBurn = () => {};
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ body: '', contentType: 'text/css' }),
  );
  await page.route('**/api/session', (route) =>
    route.fulfill({
      json: { signedIn: true, name: 'Torch tester', providers: [], testSignIn: 'automatic' },
    }),
  );
  await page.route('**/api/worlds/*/character', (route) =>
    route.fulfill({ json: { character: null } }),
  );
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    const clock = () => sim.tick * shared.TICK_MILLISECONDS;
    finishBurn = () => {
      const fire = sim.wildfire.fires.get(`tree:${tree.id}`)!;
      sim.tick = Math.ceil(fire.startedAt / 1000 + shared.fireLifetime(fire)) * shared.TICK_HZ - 1;
      sim.step(clock());
      send(shared.encodeTreeStates(sim.changedTrees()));
      send(shared.encodeWildfire(sim.wildfireView()));
    };
    send(shared.encodeWelcome(1, sim.seed, 0, clock()));
    send(shared.encodeSpace(0, x, z, 0));
    send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
    send(shared.encodeEquipped(sim.equippedList()));
    send(shared.encodePickupsTaken(sim.clearing.pickups.map((pickup) => pickup.id)));
    send(shared.encodeSnapshot(0, clock(), 0, sim.snapshotFor(1)));
    socket.onMessage((message) => {
      if (typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, clock()));
      if (request?.type !== 'input') return;
      sim.queueInputs(1, request.inputs);
      for (let i = 0; i < request.inputs.length; i++) sim.step(clock());
      send(shared.encodeSnapshot(sim.tick, clock(), sim.lastProcessedSeq(1), sim.snapshotFor(1)));
      send(shared.encodeWildfire(sim.wildfireView()));
    });
  });
  try {
    await page.goto('/?renderer=webgl2&world=torch-fire&season=summer');
    await page.locator('#home-name').fill('Torch tester');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true');
    await page.evaluate(({ x, z }) => window.acornDebug?.faceTowards(x, z), tree);
    await expect(page.locator('.hud-hint')).toContainText('dry summer fires can spread');
    expect(sim.wildfire.fires.size).toBe(0);
    const point = await page.evaluate(
      ({ x, y, z }) => window.acornDebug!.screenPoint(x, (y ?? 0) + 1.4, z),
      tree,
    );
    expect(point).not.toBeNull();
    await page.mouse.click(point!.x, point!.y);
    await expect.poll(() => sim.wildfire.fires.has(`tree:${tree.id}`)).toBe(true);
    await expect
      .poll(() => page.evaluate(() => window.acornDebug?.wildfireEffects().fires))
      .toBeGreaterThan(0);
    expect(sim.isFelled(tree.id)).toBe(false);
    finishBurn();
    await expect
      .poll(() => page.evaluate(() => window.acornDebug?.felledTrees()))
      .toContain(tree.id);
    expect(sim.changedTrees().find((t) => t.treeId === tree.id)?.burned).toBe(true);
    expect(sim.droppedPilesList()).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    sim.dispose();
  }
});
