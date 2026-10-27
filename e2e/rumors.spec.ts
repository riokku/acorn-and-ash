import { drawnScreenshot } from './skip-drawing';
import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';
test.use({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 0.75 });
test.setTimeout(180000);
test('follows personal rumor clues with E, equips a shovel and reveals the recovered find', async ({
  page,
}, testInfo) => {
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    hungerEmptyAfterSeconds: Infinity,
    raidIntervalSeconds: 86400,
  });
  const expedition = { ...shared.emptyExpedition(), active: 12 };
  const route = shared.rumorRoute(expedition, sim.discoverySites);
  sim.addPlayer(
    1,
    {
      netId: 1,
      x: route[0]!.x,
      z: route[0]!.z,
      y: 0,
      facingYaw: 0,
      hunger: 100,
      expedition,
      items: [{ item: 'shovel', count: 1 }],
    },
    'rumor-browser',
  );
  for (const den of shared.ANIMAL_DENS) sim.placeAnimal(den.id, { x: 280, y: 0, z: 280 });
  let timer: ReturnType<typeof setInterval> | undefined;
  let goTo = (index: number) => {
    void index;
  };
  let closed = false;
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '' }));
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => {
      if (!closed) socket.send(Buffer.from(data));
    };
    const refresh = () => {
      send(shared.encodeExpeditionState(sim.expeditionStateOf(1)));
      send(
        shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
      );
    };
    goTo = (index) => {
      const site = route[index]!;
      const at = { ...site, x: site.x + (index === 2 ? 1.4 : 0) };
      sim.placePlayer(1, { ...at, y: sim.collision.terrain.heightAt(at.x, at.z) }, 0);
      send(shared.encodeSpace(0, at.x, at.z, 0));
      refresh();
    };
    send(shared.encodeWelcome(1, sim.seed, 0, Date.now()));
    send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
    goTo(0);
    socket.onClose(() => {
      closed = true;
    });
    socket.onMessage((message) => {
      if (closed || typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
      if (request?.type === 'input') sim.queueInputs(1, request.inputs);
      if (request?.type === 'gear' && request.action === 'wear') {
        const result = sim.wearGear(1, request.item, request.slot);
        if (!result.ok) send(shared.encodeGearRefused(result.reason));
        send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
        send(shared.encodeWorn(sim.wornList()));
        send(shared.encodeEquipped(sim.equippedList()));
      }
      if (request?.type === 'useItem') {
        sim.useItem(1, request.item);
        send(shared.encodeEquipped(sim.equippedList()));
      }
    });
    timer = setInterval(() => {
      if (!closed) {
        sim.step(Date.now());
        refresh();
      }
    }, shared.TICK_MILLISECONDS);
  });
  try {
    await page.goto('/?renderer=webgl2&world=rumor-browser');
    await page.locator('#home-name').fill('Trail Reader');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120000 });
    const trail = page.getByRole('complementary', { name: 'Rumors of the Wild' });
    await expect(trail).toContainText('Clue 1 of 3');
    await page.keyboard.press('KeyE');
    await expect(trail).toContainText('Left the pack with the cutters');
    expect(sim.expeditionStateOf(1).progress).toEqual([1, 0, 0]);
    goTo(1);
    await expect(page.locator('.hud-hint')).toContainText('read the rumor');
    await page.keyboard.press('KeyE');
    await expect(trail).toContainText('The grove stayed dry');
    goTo(2);
    await expect(trail).toContainText('Equip a shovel');
    await drawnScreenshot(page, testInfo.outputPath('rumor-bundle-in-world.png'));
    await page.locator('.hotbar-slot[data-item="shovel"]').click();
    await expect(trail).toContainText('E · Uncover');
    await page.keyboard.press('KeyE');
    await expect(trail).toContainText('Trail complete');
    expect(sim.expeditionStateOf(1).progress).toEqual([1, 1, 1]);
    await page.keyboard.press('KeyC');
    await page.getByRole('button', { name: 'Expeditions', exact: true }).click();
    await expect(page.locator('.rumor-outcome')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Claim rewards' })).toBeDisabled();
    await page.screenshot({ path: testInfo.outputPath('rumor-recovered.png') });
    expect(errors).toEqual([]);
  } finally {
    if (timer) clearInterval(timer);
    sim.dispose();
  }
});
