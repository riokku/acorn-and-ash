import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';
test.use({ viewport: { width: 1280, height: 900 } });
test('explains the active kit and updates specialties when clothing or the active weapon changes', async ({
  page,
}, testInfo) => {
  test.setTimeout(180000);
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    forestEncounters: false,
  });
  sim.addPlayer(1);
  sim.giveTestGear(1, [
    'ironSword',
    'travelerTunic',
    'leatherBoots',
    'winterJacket',
    'huntingKnife',
  ]);
  sim.wearGear(1, 'ironSword', 'mainHand');
  sim.wearGear(1, 'travelerTunic', 'upperBody');
  sim.wearGear(1, 'leatherBoots', 'feet');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ body: '' }));
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    const refresh = () => {
      send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
      send(shared.encodeWorn(sim.wornList()));
      send(shared.encodeEquipped([{ netId: 1, item: sim.equippedItemOf(1) }]));
    };
    send(shared.encodeWelcome(1, sim.seed, 0, Date.now()));
    refresh();
    send(shared.encodeSnapshot(0, Date.now(), 0, sim.snapshotFor(1)));
    socket.onMessage((message) => {
      if (typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
      if (request?.type === 'gear' && request.action === 'wear') {
        const result = sim.wearGear(1, request.item, request.slot);
        if (!result.ok) send(shared.encodeGearRefused(result.reason));
        refresh();
      }
    });
  });
  try {
    await page.goto('/?renderer=webgl2&world=know-your-kit&season=summer');
    await page.locator('#home-name').fill('Trail duelist');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120000 });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
      timeout: 120000,
    });
    await page.keyboard.press('KeyZ');
    const kit = page.getByTestId('equipment-traits');
    await expect(kit).not.toHaveAttribute('open');
    await kit.locator('summary').click();
    await expect(kit).toContainText('3 active specialties');
    await expect(kit).toContainText('Duelist');
    await expect(kit).toContainText('Trail comfort');
    const jacket = page.getByTestId('pack-slot-winterJacket');
    await jacket.hover();
    const tooltip = page.getByRole('tooltip');
    await expect(tooltip).toContainText('Gain Heat keeper');
    await expect(tooltip).toContainText('Give up Trail comfort');
    await jacket.click({ button: 'right' });
    await expect(kit).toContainText('Heat keeper');
    await expect(kit).not.toContainText('Trail comfort');
    const knife = page.getByTestId('pack-slot-huntingKnife');
    // Cover keyboard-accessible comparisons as well as the mouse hover above.
    await knife.focus();
    await expect(page.getByRole('tooltip')).toContainText(
      'Main-hand equip: Attack power 150% → 125%',
    );
    await knife.click();
    await expect(kit).toContainText('Careful harvest');
    await expect(kit).not.toContainText('Duelist');
    await page.mouse.move(5, 5);
    await page
      .getByTestId('character-panel')
      .screenshot({ path: testInfo.outputPath('active-kit.png'), animations: 'disabled' });
    await page.setViewportSize({ width: 1280, height: 640 });
    const bounds = await page.getByTestId('character-panel').boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.y).toBeGreaterThanOrEqual(8);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(632);
    expect(errors).toEqual([]);
  } finally {
    sim.dispose();
  }
});
