import { expect, test } from './fixtures';
test.use({ viewport: { width: 1180, height: 1000 } });
test('shows earned keepsake plans, places a carried trophy once, and keeps unearned recipes locked', async ({
  page,
}, testInfo) => {
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ body: '' }));
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?gallery=keepsakes&before');
  await expect(page.getByRole('button', { name: 'Trophies', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.screenshot({ path: testInfo.outputPath('before.png'), fullPage: true });
  await page.goto('/?gallery=keepsakes');
  const collection = page.getByTestId('trophy-collection');
  await expect(collection).toContainText('0/8 kinds on display');
  await expect(collection.locator('[data-keepsake=firstBellRelic] button')).toBeDisabled();
  await collection.locator('[data-keepsake=guardianTrophy] button').click();
  await expect(collection).toContainText('1/8 kinds on display');
  await expect(collection.locator('[data-keepsake=guardianTrophy] button')).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath('after.png'), fullPage: true });
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Your adventures · see keepsakes' }).click();
  await expect(collection).toBeVisible();
  expect(errors).toEqual([]);
});

test('recognizes a placed trophy in the game journal and reads its story from the world', async ({
  page,
}) => {
  test.setTimeout(180000);
  const shared = await import('../packages/shared/src/index');
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
      kind: 'guardianTrophy',
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
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ body: '' }));
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    send(shared.encodeWelcome(1, sim.seed, 0, Date.now()));
    send(shared.encodeBuiltProps(sim.builtPropsList(), () => true));
    send(shared.encodeSpace(0, 0, 1.5, 0));
    send(shared.encodeSnapshot(0, Date.now(), 0, sim.snapshotFor(1)));
    socket.onMessage((message) => {
      if (typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
    });
  });
  try {
    await page.goto('/?renderer=webgl2&world=keepsake-test&season=summer');
    await page.locator('#home-name').fill('Story Keeper');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120000 });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
      timeout: 120000,
    });
    const point = await page.evaluate(() => window.acornDebug?.screenPoint(0, 0.75, 0));
    if (!point) throw new Error('Trophy is off screen');
    await page.mouse.move(point.x, point.y);
    await expect(page.locator('.loot-hover')).toContainText('Your keepsake');
    await expect(page.locator('.loot-hover')).toContainText('woodland guardian');
    await page.keyboard.press('KeyC');
    await page.getByRole('button', { name: 'Trophies', exact: true }).click();
    const collection = page.getByTestId('trophy-collection');
    await expect(collection).toContainText('1/8 kinds on display');
    await expect(collection.locator('[data-keepsake=guardianTrophy]')).toHaveAttribute(
      'data-displayed',
      'true',
    );
  } finally {
    sim.dispose();
  }
});
