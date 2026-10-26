import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';
test.setTimeout(180000);
test.use({ viewport: { width: 1180, height: 1000 }, deviceScaleFactor: 0.75 });
test('the homestead journal takes three projects from plans to an established trailstead', async ({
  page,
}, testInfo) => {
  await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '' }));
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?gallery=homestead&view=plan');
  const plan = page.getByTestId('homestead-plan');
  await expect(plan).toContainText('0/3 projects');
  await page.screenshot({ path: testInfo.outputPath('plan.png'), fullPage: true });
  for (const { kind } of shared.HOMESTEAD_PROJECTS) {
    await plan
      .locator(`[data-project=${kind}]`)
      .getByRole('button', { name: 'Choose a spot' })
      .click();
    await expect(plan.locator(`[data-project=${kind}]`)).toHaveAttribute('data-complete', 'true');
  }
  await expect(plan).toContainText('Trailstead established · 3/3 projects');
  await expect(plan.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3');
  expect(errors).toEqual([]);
});
test('renders a campsite before and after its useful homestead additions', async ({
  page,
}, testInfo) => {
  await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '' }));
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (e) => {
    if (e.type() === 'error') errors.push(e.text());
  });
  for (const before of [true, false]) {
    await page.goto(`/?gallery=homestead&renderer=webgl2&still${before ? '&before' : ''}`);
    await expect(page.locator('body')).toHaveAttribute('data-gallery-ready', 'true', {
      timeout: 120000,
    });
    await page.screenshot({ path: testInfo.outputPath(before ? 'before.png' : 'after.png') });
  }
  expect(errors).toEqual([]);
});
test('shows built project progress and opens the real outdoor garden from the journal', async ({
  page,
}) => {
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    forestEncounters: false,
  });
  sim.restoreBuiltProps([
    {
      id: 7,
      kind: 'tent',
      x: -2,
      z: -4.2,
      yaw: 0,
      lit: false,
      ownerKey: 'owner',
      litUntilMs: null,
    },
    {
      id: 8,
      kind: 'kitchenGarden',
      x: 0,
      z: 0,
      yaw: 0,
      lit: false,
      ownerKey: 'owner',
      litUntilMs: null,
    },
    {
      id: 9,
      kind: 'trailWorkbench',
      x: 3,
      z: 0,
      yaw: 0,
      lit: false,
      ownerKey: 'owner',
      litUntilMs: null,
    },
  ]);
  sim.addPlayer(1, undefined, 'owner');
  sim.placePlayer(1, { x: 0, y: 0, z: 1.6 }, 0);
  Object.assign(sim.inventoryOf(1), { berry: 1 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '' }));
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    send(shared.encodeWelcome(1, sim.seed, 0, Date.now()));
    send(shared.encodeBuiltProps(sim.builtPropsList(), () => true));
    send(shared.encodeSpace(0, 0, 1.6, 0));
    const refresh = () => {
      send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
      send(shared.encodeGardenState(sim.gardenStateOf(1)));
      send(shared.encodeHomesteadAppearance(sim.homesteadAppearanceOf(1)));
      send(
        shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
      );
    };
    refresh();
    socket.onMessage((message) => {
      if (typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
      if (request?.type === 'garden') send(shared.encodeGardenState(sim.requestGarden(1, request)));
      refresh();
    });
  });
  try {
    await page.goto('/?renderer=webgl2&world=homestead-test&season=summer');
    await page.locator('#home-name').fill('Homesteader');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120000 });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
      timeout: 120000,
    });
    await page.keyboard.press('KeyC');
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await expect(page.getByTestId('homestead-plan')).toContainText('2/3 projects');
    await expect(page.locator('[data-project=trailWorkbench]')).toHaveAttribute(
      'data-complete',
      'true',
    );
    await page.getByRole('button', { name: 'Garden', exact: true }).click();
    const garden = page.getByRole('region', { name: 'Garden journal' });
    await garden
      .getByRole('button', { name: 'Plant forest berries · 1', exact: true })
      .first()
      .click();
    await expect(garden).toContainText('Growing · about 10 minutes');
    expect(sim.inventoryOf(1).berry ?? 0).toBe(0);
    expect(sim.savedGardens()[0]?.homeId).toBe(8);
    expect(errors).toEqual([]);
  } finally {
    sim.dispose();
  }
});

test('opens the pantry by clicking its outdoor model and stores private supplies', async ({
  page,
}) => {
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    forestEncounters: false,
  });
  sim.restoreBuiltProps([
    {
      id: 7,
      kind: 'tent',
      x: -2,
      z: -4.2,
      yaw: 0,
      lit: false,
      ownerKey: 'owner',
      litUntilMs: null,
    },
    {
      id: 8,
      kind: 'trailPantry',
      x: 0,
      z: 0,
      yaw: 0,
      lit: false,
      ownerKey: 'owner',
      litUntilMs: null,
    },
  ]);
  sim.addPlayer(1, undefined, 'owner');
  sim.placePlayer(1, { x: 0, y: 0, z: 1.5 }, 0);
  Object.assign(sim.inventoryOf(1), { log: 4 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '' }));
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    send(shared.encodeWelcome(1, sim.seed, 0, Date.now()));
    send(shared.encodeBuiltProps(sim.builtPropsList(), () => true));
    send(shared.encodeSpace(0, 0, 1.5, 0));
    send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
    send(shared.encodeSnapshot(0, Date.now(), 0, sim.snapshotFor(1)));
    socket.onMessage((message) => {
      if (typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
      if (request?.type === 'chest') {
        const result = sim.requestChest(1, request);
        send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
        send(shared.encodeChestState(result));
      }
    });
  });
  try {
    await page.goto('/?renderer=webgl2&world=homestead-pantry&season=summer');
    await page.locator('#home-name').fill('Pantry Keeper');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120000 });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
      timeout: 120000,
    });
    const point = await page.evaluate(() => window.acornDebug?.screenPoint(0, 0.3, 0));
    if (!point) throw new Error('Pantry is off screen');
    await page.mouse.move(point.x, point.y);
    await expect(page.locator('.loot-hover')).toContainText('Trail pantry');
    await page.mouse.click(point.x, point.y);
    const panel = page.getByTestId('chest-panel');
    await expect(panel).toBeVisible();
    await page.getByRole('button', { name: 'Store 4 Log', exact: true }).click();
    await expect(panel).toContainText('1/10');
    expect(sim.chestSlots(8)[0]).toEqual({ item: 'log', count: 4 });
    expect(sim.chestSlots(7)).toEqual(shared.emptyChest());
    await page.getByRole('button', { name: 'Close storage chest' }).click();
    await expect(panel).toBeHidden();
    expect(errors).toEqual([]);
  } finally {
    sim.dispose();
  }
});
