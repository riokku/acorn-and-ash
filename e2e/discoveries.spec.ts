import { expect, test } from '@playwright/test';
import * as shared from '../packages/shared/src/index';
test.use({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 0.65 });
test.setTimeout(180_000);

test('records a discovery, inspects its personal reward and crafts the learned recipe from the journal', async ({
  page,
}, testInfo) => {
  const sim = new shared.WorldSimulation({ seed: shared.DEFAULT_WORLD_SEED });
  sim.addPlayer(1, undefined, 'explorer');
  const site = sim.discoverySites.find((s) => s.kind === 'camp')!;
  sim.placePlayer(1, { x: site.x, y: 0, z: site.z }, 0);
  sim.inventoryOf(1).roastedMeat = 1;
  sim.step(Date.now());
  const crafts: string[] = [],
    errors: string[] = [];
  let sendWorld: ((data: ArrayBuffer) => void) | undefined;
  page.on('pageerror', (error) => errors.push(error.message));
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    sendWorld = send;
    send(shared.encodeWelcome(1, shared.DEFAULT_WORLD_SEED, sim.tick, Date.now()));
    send(shared.encodeDiscoveries(sim.discoveryStateOf(1)));
    send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
    send(shared.encodeGatherPatches(sim.gatherPatchesList()));
    send(shared.encodeSpace(0, site.x, site.z, 0));
    send(shared.encodeSnapshot(sim.tick, Date.now(), 0, sim.snapshotFor(1)));
    socket.onMessage((message) => {
      if (typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
      if (request?.type === 'craft') {
        crafts.push(request.item);
        sim.craftItem(1, request.item);
        send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
      }
      if (request?.type === 'loot') sim.requestLoot(1, request);
      if (request?.type === 'input') {
        sim.queueInputs(1, request.inputs);
        sim.step(Date.now());
        for (const event of sim.drainDiscoveryChanges())
          send(shared.encodeDiscoveries(event.state));
        send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
        send(shared.encodeGatherPatches(sim.gatherPatchesList()));
        send(
          shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
        );
      }
    });
  });
  try {
    await page.goto('/?renderer=webgl2&world=discoveries-ui');
    await page.locator('#home-name').fill('Forest Explorer');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
      timeout: 120_000,
    });
    await page.keyboard.press('KeyC');
    await page.getByRole('button', { name: 'Discoveries', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Discovery journal' })).toContainText(
      '1 / 7 found',
    );
    await expect(page.locator('.discovery-entry-found')).toContainText('Marked on your map');
    await page.keyboard.press('Digit1');
    expect(crafts).toEqual([]);
    await page.screenshot({
      path: process.env.CI
        ? testInfo.outputPath('discovery-journal.png')
        : '/workspace/acorn-discovery-journal.png',
    });
    await page.keyboard.press('KeyC');
    await expect(page.locator('.hud-journal')).toHaveCount(0);
    await page.keyboard.down('KeyE');
    await expect.poll(() => sim.discoveryStateOf(1).claimed).toBe(1);
    await page.keyboard.up('KeyE');
    await page.keyboard.press('KeyC');
    await expect(page.locator('.discovery-entry-found')).toContainText('Learned: Trail ration');
    await page.getByRole('button', { name: 'Crafting', exact: true }).click();
    await page.locator('.hud-journal-entry').filter({ hasText: 'Trail ration' }).click();
    await expect.poll(() => sim.inventoryOf(1).trailRation ?? 0).toBe(1);
    expect(crafts).toEqual(['trailRation']);
    // Follow a decoded forage ID all the way back through a targeted pickup.
    await page.keyboard.press('KeyC');
    const patch = sim.gatherPatchesList().find((p) => p.item === 'berry')!;
    const before = sim.inventoryOf(1).berry ?? 0;
    sim.placePlayer(1, { x: patch.x, y: 0, z: patch.z + 0.6 }, 0);
    sendWorld!(shared.encodeSpace(0, patch.x, patch.z + 0.6, 0));
    sendWorld!(
      shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
    );
    await expect(page.locator('.hud-journal')).toHaveCount(0);
    const point = await page.evaluate(({ x, y, z }) => window.acornDebug?.screenPoint(x, y, z), {
      ...patch,
      x: patch.x + 0.13,
      y:
        shared.createWildernessTerrain(shared.DEFAULT_WORLD_SEED).heightAt(patch.x, patch.z) +
        0.055,
    });
    if (point == null) throw new Error('forage is off screen');
    await page.mouse.move(point.x, point.y);
    await expect(page.locator('.loot-hover')).toContainText('Forest berries');
    await page.mouse.click(point.x, point.y, { button: 'right' });
    await expect.poll(() => sim.inventoryOf(1).berry ?? 0).toBe(before + 1);
    expect(errors).toEqual([]);
  } finally {
    sim.dispose();
  }
});
for (const kind of ['camp', 'logging', 'grove', 'shrine', 'forest-food']) {
  test(`renders the ${kind} discovery artwork`, async ({ page }, testInfo) => {
    await page.route('https://fonts.googleapis.com/**', (route) =>
      route.fulfill({ contentType: 'text/css', body: '' }),
    );
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(
      `/?gallery=${kind === 'forest-food' ? kind : `discovery-${kind}`}&renderer=webgl2&time=0.42`,
    );
    await expect(page.locator('body')).toHaveAttribute('data-gallery-ready', 'true', {
      timeout: 120_000,
    });
    await page.screenshot({
      path: process.env.CI
        ? testInfo.outputPath(`discovery-${kind}.png`)
        : `/workspace/acorn-discovery-${kind}.png`,
    });
    expect(errors).toEqual([]);
  });
}
