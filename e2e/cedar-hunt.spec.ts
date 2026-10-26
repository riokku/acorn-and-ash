import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';
test.setTimeout(180000);
test.use({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: 0.75 });
test('pins the hunt, catches the stag through real input, stitches the coat and wears it', async ({
  page,
}) => {
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    raidIntervalSeconds: 86400,
    hungerEmptyAfterSeconds: Infinity,
  });
  const den = shared.CEDAR_STAG;
  const at = { x: den.x, z: den.z, y: sim.collision.terrain.heightAt(den.x, den.z) };
  sim.addPlayer(1, {
    netId: 1,
    ...at,
    z: at.z + 2.05,
    facingYaw: 0,
    hunger: 100,
    items: [
      { item: 'axe', count: 1 },
      { item: 'rope', count: 2 },
      { item: 'reed', count: 4 },
    ],
  });
  sim.placeAnimal(den.id, at);
  sim.useItem(1, 'axe');
  let time = 1000,
    hunting = false;
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '' }));
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    const refresh = () => {
      send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
      send(shared.encodeWorn(sim.wornList()));
      send(shared.encodeEquipped(sim.equippedList()));
      const caught = sim.drainCatchEvents();
      for (const event of caught) send(shared.encodeCaught(event));
      send(
        shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
      );
    };
    send(shared.encodeWelcome(1, sim.seed, 0, Date.now()));
    send(shared.encodeSpace(0, at.x, at.z + 2.05, 0));
    refresh();
    socket.onMessage((message) => {
      if (typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
      if (request?.type === 'input' && hunting)
        for (const input of request.inputs) {
          sim.queueInput(1, input);
          sim.step((time += shared.TICK_MILLISECONDS));
        }
      if (request?.type === 'craft') {
        const refusal = sim.craftRefusalFor(1, request.item);
        if (refusal) send(shared.encodeCraftRefused(request.item, refusal));
        else {
          sim.craftItem(1, request.item);
          for (const event of sim.drainCraftEvents()) send(shared.encodeCrafted(event));
        }
      }
      if (request?.type === 'gear' && request.action === 'wear')
        sim.wearGear(1, request.item, request.slot);
      if (request?.type === 'useItem') sim.useItem(1, request.item);
      refresh();
    });
  });
  try {
    await page.goto('/?renderer=webgl2&world=cedar-trail&season=summer');
    await page.locator('#home-name').fill('Cedar hunter');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120000 });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
      timeout: 120000,
    });
    await page.keyboard.press('KeyC');
    await page.getByRole('button', { name: 'Gear', exact: true }).click();
    await expect(page.getByTestId('cedar-hunt-plan')).toContainText('0/1');
    await page.getByRole('button', { name: 'Pin upgrade goal', exact: true }).click();
    await page.keyboard.press('KeyC');
    await expect(page.getByRole('complementary', { name: 'Pinned upgrade goal' })).toContainText(
      'hoofprints',
    );
    // The owned fixture pauses while reading the guide, then starts beside a calm quarry.
    // All hits still go through the real input/swing rules.
    hunting = true;
    await page.locator('#scene').click({ position: { x: 590, y: 440 } });
    await expect.poll(() => sim.inventoryOf(1).cedarHide ?? 0).toBe(1);
    await expect(page.getByRole('complementary', { name: 'Pinned upgrade goal' })).toContainText(
      'Materials ready',
    );
    await expect.poll(() => sim.actionOf(1)?.kind).toBe(shared.ActionKind.Idle);
    await page.keyboard.press('KeyC');
    const coat = page
      .locator('.craft-group[aria-label="Clothing & equipment"] .hud-journal-entry')
      .filter({ hasText: 'Cedarstalker coat' });
    await coat.scrollIntoViewIfNeeded();
    await coat.click();
    await expect.poll(() => sim.inventoryOf(1).cedarstalkerCoat ?? 0).toBe(1);
    expect(sim.inventoryOf(1).cedarHide ?? 0).toBe(0);
    await page.keyboard.press('KeyC');
    await page.keyboard.press('KeyZ');
    await page.getByTestId('pack-slot-cedarstalkerCoat').click({ button: 'right' });
    await expect.poll(() => sim.wornOf(1).upperBody).toBe('cedarstalkerCoat');
    await expect(page.getByTestId('character-stats')).toContainText('Warmth45');
    expect(errors).toEqual([]);
  } finally {
    sim.dispose();
  }
});
test('shows the hunt plan, keeps the pin, and updates the earned upgrade in its gallery', async ({
  page,
}, info) => {
  await page.goto('/?gallery=cedar-hunt&view=plan&hide');
  await expect(page.getByTestId('cedar-hunt-plan')).toBeVisible();
  await page.getByRole('button', { name: 'Pin upgrade goal', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Pinned upgrade goal' })).toContainText(
    'Materials ready',
  );
  await page.screenshot({ path: info.outputPath('plan.png') });
  await page.getByRole('button', { name: 'Stitch coat', exact: true }).click();
  await expect(page.getByTestId('cedar-hunt-plan')).toContainText('Coat ready');
  await page.getByRole('button', { name: 'Unpin upgrade goal', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Pinned upgrade goal' })).toHaveCount(0);
});
test(
  'shows the existing elk and clothing beside the named quarry and earned coat',
  { tag: '@real-drawing' },
  async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '' }));
    for (const before of [true, false]) {
      await page.goto(`/?gallery=cedar-hunt&renderer=webgl2&still${before ? '&before' : ''}`);
      await expect(page.locator('body')).toHaveAttribute('data-gallery-ready', 'true', {
        timeout: 120000,
      });
      await page.screenshot({ path: info.outputPath(before ? 'before.png' : 'after.png') });
    }
    expect(errors).toEqual([]);
  },
);
