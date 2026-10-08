import { expect, test } from '@playwright/test';
import {
  DEFAULT_WORLD_SEED,
  WorldSimulation,
  decodeClientMessage,
  encodeBuiltProps,
  encodeHomeSkills,
  encodeHomeSupplies,
  encodeHomeBuildFeedback,
  encodeInventory,
  encodeWelcome,
  encodeSpace,
  encodePong,
  encodeSnapshot,
  inventoryEntries,
} from '../packages/shared/src/index';

test.use({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 0.5 });
test.setTimeout(180_000);
test('learns a blueprint, previews the larger home boundary and upgrades in place', async ({
  page,
}) => {
  const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED });
  sim.restoreBuiltProps([
    {
      id: 7,
      kind: 'tent',
      x: 0,
      z: -4.2,
      yaw: 0,
      lit: false,
      ownerKey: 'builder',
      litUntilMs: null,
    },
  ]);
  sim.addPlayer(1, undefined, 'builder');
  sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0);
  Object.assign(sim.inventoryOf(1), { teepeeBlueprint: 1, log: 4, stick: 16 });
  sim.restoreChest(7, [{ item: 'log', count: 8 }, ...Array(9).fill(null)]);
  const errors: string[] = [];
  page.on('pageerror', (error) => {
    errors.push(error.message);
    console.error('Housing page error:', error.message);
  });
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ body: '', contentType: 'text/css' }),
  );
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    send(encodeWelcome(1, DEFAULT_WORLD_SEED, 0, Date.now()));
    send(encodeBuiltProps(sim.builtPropsList(), () => true));
    send(encodeHomeSkills(0));
    send(encodeHomeSupplies(sim.homeSuppliesOf(1)));
    send(encodeInventory(inventoryEntries(sim.inventoryOf(1))));
    send(encodeSpace(0, 0, 0, 0));
    send(encodeSnapshot(0, Date.now(), 0, sim.snapshotFor(1)));
    socket.onMessage((message) => {
      if (typeof message === 'string') return;
      const request = decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(encodePong(request.clientTimeMs, Date.now()));
      if (request?.type === 'useItem') {
        sim.useItem(1, request.item);
        send(encodeHomeSkills(sim.homeSkillsOf(1)));
        send(encodeInventory(inventoryEntries(sim.inventoryOf(1))));
      }
      if (request?.type === 'build') sim.requestBuild(1, request);
      if (request?.type === 'input') {
        sim.queueInputs(1, request.inputs);
        sim.step(Date.now());
        const events = sim.drainBuildEvents();
        if (events.length > 0) {
          send(encodeBuiltProps(sim.builtPropsList(), () => true));
          send(encodeInventory(inventoryEntries(sim.inventoryOf(1))));
        }
        for (const feedback of sim.drainHomeBuildFeedback())
          send(encodeHomeBuildFeedback(feedback));
        send(encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)));
      }
    });
  });
  try {
    await page.goto('/?renderer=webgl2&world=housing-ui');
    await page.locator('#home-name').fill('Home Builder');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
      timeout: 120_000,
    });
    await page.keyboard.press('KeyC');
    await expect(page.locator('.hud-journal')).toContainText('Teepee · blueprint needed');
    await expect(page.locator('.hud-journal')).toContainText(
      'Uses backpack first, then your private home chest',
    );
    await expect(page.locator('.build-area-note')).toContainText('12 m radius');
    const noteBounds = await page.locator('.build-area-note').boundingBox();
    const journalBounds = await page.locator('.hud-journal').boundingBox();
    expect(noteBounds!.y + noteBounds!.height).toBeLessThan(journalBounds!.y);
    await expect
      .poll(() => page.evaluate(() => window.acornDebug?.buildBoundaryVisible()))
      .toBe(true);
    await page.keyboard.press('KeyI');
    await page.getByRole('button', { name: /Teepee blueprint, 1/ }).click();
    await expect.poll(() => sim.homeSkillsOf(1)).toBe(1);
    await page.keyboard.press('KeyC');
    await page.locator('.craft-tabs').getByRole('button', { name: 'Home', exact: true }).click();
    await expect(page.locator('.hud-journal')).toContainText('Upgrade to Teepee');
    await expect(page.locator('.hud-journal')).not.toContainText('blueprint needed');
    await page.locator('.hud-journal-entry').filter({ hasText: 'Upgrade to Teepee' }).click();
    await expect(page.locator('.hud-journal')).toHaveCount(0);
    await expect(page.locator('.build-area-note')).toContainText('18 m radius');
    const point = await page.evaluate(() => window.acornDebug?.screenPoint(0, 0, -4.2));
    if (point == null) throw new Error('home is off screen');
    await page.mouse.move(point.x, point.y);
    await expect
      .poll(() => page.evaluate(() => window.acornDebug?.buildPreview()?.refusal))
      .toBeNull();
    await page.mouse.click(point.x, point.y);
    await expect
      .poll(() =>
        page.evaluate(() => window.acornDebug?.builtProps().find((prop) => prop.id === 7)?.kind),
      )
      .toBe('teepee');
    await page.keyboard.down('KeyC');
    await expect.poll(() => page.evaluate(() => window.acornDebug?.craftMenuOpen())).toBe(true);
    await page.keyboard.up('KeyC');
    await expect(page.locator('.build-area-note')).toContainText('18 m radius');
    await expect
      .poll(() => page.evaluate(() => window.acornDebug?.buildBoundaryVisible()))
      .toBe(true);
    await page.screenshot({
      path: process.env.CI
        ? 'test-results/homestead-boundary.png'
        : '/workspace/acorn-homestead-boundary.png',
    });
    await page.keyboard.press('KeyC');
    await expect(page.locator('.build-area-note')).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => window.acornDebug?.buildBoundaryVisible()))
      .toBe(false);
    expect(sim.inventoryOf(1).teepeeBlueprint ?? 0).toBe(0);
    expect(sim.inventoryOf(1).log ?? 0).toBe(0);
    expect(sim.inventoryOf(1).stick ?? 0).toBe(0);
    expect(errors).toEqual([]);
  } finally {
    sim.dispose();
  }
});
