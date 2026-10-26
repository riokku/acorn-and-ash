import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';
test.use({ viewport: { width: 1180, height: 1000 } });
test('prepares a meal from the outing journal without losing the chosen adventure', async ({
  page,
}, testInfo) => {
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ body: '' }));
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?gallery=expedition-preparation&before');
  await expect(page.locator('.expedition-active')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('before.png'), fullPage: true });
  await page.goto('/?gallery=expedition-preparation');
  const preparation = page.getByTestId('expedition-preparation');
  await expect(preparation).toContainText('Suggested: Forest stew');
  await expect(preparation.locator('[data-preparation=weapon]')).toHaveAttribute(
    'data-ready',
    'false',
  );
  await preparation.getByRole('button', { name: 'Prepare food' }).click();
  const stew = page.locator('[data-meal-recipe=forestStew]');
  await expect(stew).toContainText('0 packed');
  await stew.click();
  await expect(stew).toContainText('1 packed');
  await page.getByRole('button', { name: 'Back to chosen outing' }).click();
  await expect(preparation).toContainText('a special meal is packed or active');
  await expect(page.locator('.expedition-active h3').first()).toHaveText(
    shared.EXPEDITIONS[8]!.name,
  );
  await page.screenshot({ path: testInfo.outputPath('after.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('opens food, character equipment and backpack from a saved outing in the real game', async ({
  page,
}) => {
  test.setTimeout(180000);
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
  ]);
  sim.addPlayer(1, undefined, 'owner');
  const saved = sim.persistablePlayers()[0]!;
  sim.removePlayer(1);
  sim.addPlayer(1, { ...saved, expedition: { ...shared.emptyExpedition(), active: 0 } }, 'owner');
  sim.placePlayer(1, { x: 0, y: 0, z: 1.5 }, 0);
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ body: '' }));
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    send(shared.encodeWelcome(1, sim.seed, 0, Date.now()));
    send(shared.encodeBuiltProps(sim.builtPropsList(), () => true));
    send(shared.encodeSpace(0, 0, 1.5, 0));
    send(shared.encodeExpeditionState(sim.expeditionStateOf(1)));
    send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
    send(shared.encodeSnapshot(0, Date.now(), 0, sim.snapshotFor(1)));
    socket.onMessage((message) => {
      if (typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
    });
  });
  try {
    await page.goto('/?renderer=webgl2&world=preparation-test&season=summer');
    await page.locator('#home-name').fill('Trail Cook');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120000 });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
      timeout: 120000,
    });
    await page.keyboard.press('KeyC');
    await page.getByRole('button', { name: 'Expeditions', exact: true }).click();
    const preparation = page.getByTestId('expedition-preparation');
    await expect(preparation).toContainText('Bring an axe');
    await preparation.getByRole('button', { name: 'Prepare food' }).click();
    await expect(page.getByTestId('meal-preparation')).toBeVisible();
    await page.getByRole('button', { name: 'Expeditions', exact: true }).click();
    await preparation.getByRole('button', { name: 'Review equipment' }).click();
    await expect(page.locator('.character-panel')).toBeVisible();
    await page.keyboard.press('KeyZ');
    await page.keyboard.press('KeyC');
    await preparation.getByRole('button', { name: 'Check backpack' }).click();
    await expect(page.locator('.inventory-panel')).toBeVisible();
    expect(sim.expeditionStateOf(1).active).toBe(0);
  } finally {
    sim.dispose();
  }
});
