import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1000, height: 700 }, deviceScaleFactor: 0.75 });
for (const kind of ['ruins', 'patrolTrail']) {
  test(`renders the ${kind} forest landmark`, async ({ page }, testInfo) => {
    await page.route('https://fonts.googleapis.com/**', (route) =>
      route.fulfill({ contentType: 'text/css', body: '' }),
    );
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto(`/?gallery=${kind}&renderer=webgl2&time=0.42`);
    await expect(page.locator('body')).toHaveAttribute('data-gallery-ready', 'true', {
      timeout: 120_000,
    });
    await page.screenshot({
      path: process.env.CI ? testInfo.outputPath(`${kind}.png`) : `/workspace/acorn-${kind}.png`,
    });
    expect(errors).toEqual([]);
  });
}

test('right-clicks a personal blueprint reward and learns its housing tier', async ({ page }) => {
  const shared = await import('../packages/shared/src/index');
  const sim = new shared.WorldSimulation({ seed: shared.DEFAULT_WORLD_SEED });
  sim.addPlayer(
    1,
    { netId: 1, x: 0, y: 0, z: 0, facingYaw: 0, items: [], hunger: 100, blueprintMisses: 5 },
    'owner',
  );
  sim.addPlayer(
    2,
    { netId: 2, x: 0, y: 0, z: 0, facingYaw: 0, items: [], hunger: 100, blueprintMisses: 5 },
    'helper',
  );
  sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0);
  sim.placePlayer(2, { x: 0, y: 0, z: 0 }, 0);
  sim.step(Date.now());
  const raid = sim.startRaid(1, ['warrior'])!;
  const raider = sim.raids.raidersOf(raid)[0]!;
  sim.raids.placeRaider(raider, { x: 0, y: 0, z: -1.4 }, Math.PI);
  sim.raids.blowLands(2, { x: 0, y: 0, z: 0 }, 0, { kind: 'strike' }, 0);
  sim.raids.blowLands(1, { x: 0, y: 0, z: 0 }, 0, { kind: 'strike' }, 0);
  const reward = sim.droppedPilesList(1)[0]!;
  expect(sim.droppedPilesList(1)).toHaveLength(1);
  expect(sim.droppedPilesList(2)[0]?.id).not.toBe(reward.id);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    send(shared.encodeWelcome(1, shared.DEFAULT_WORLD_SEED, sim.tick, Date.now()));
    send(shared.encodeHomeSkills(0));
    send(shared.encodeInventory([]));
    send(shared.encodeDroppedPiles(sim.droppedPilesList(1)));
    send(shared.encodeSpace(0, 0, 0, 0));
    send(shared.encodeSnapshot(sim.tick, Date.now(), 0, sim.snapshotFor(1)));
    socket.onMessage((message) => {
      if (typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
      if (request?.type === 'loot') sim.requestLoot(1, request);
      if (request?.type === 'useItem') {
        sim.useItem(1, request.item);
        send(shared.encodeHomeSkills(sim.homeSkillsOf(1)));
        send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
      }
      if (request?.type === 'input') {
        sim.queueInputs(1, request.inputs);
        sim.step(Date.now());
        send(
          shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
        );
        send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
        send(shared.encodeDroppedPiles(sim.droppedPilesList(1)));
      }
    });
  });
  try {
    await page.goto('/?renderer=webgl2&world=encounter-rewards');
    await page.locator('#home-name').fill('Forest Explorer');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
    await page.locator('.hud-curtain').click();
    const point = await page.evaluate(
      ({ x, z }) => window.acornDebug?.screenPoint(x, 0.1, z),
      reward,
    );
    if (point == null) throw new Error('reward is off screen');
    await page.mouse.move(point.x, point.y);
    await page.mouse.click(point.x, point.y, { button: 'right' });
    await expect.poll(() => sim.inventoryOf(1).teepeeBlueprint ?? 0).toBe(1);
    await page.keyboard.press('KeyI');
    await page.getByRole('button', { name: /Teepee blueprint, 1/ }).click();
    await expect.poll(() => sim.homeSkillsOf(1)).toBe(1);
    expect(sim.inventoryOf(1).teepeeBlueprint ?? 0).toBe(0);
    expect(sim.droppedPilesList(2)).toHaveLength(1);
    expect(errors).toEqual([]);
  } finally {
    sim.dispose();
  }
});
