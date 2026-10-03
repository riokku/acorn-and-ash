import { expect, test } from '@playwright/test';
import {
  DEFAULT_WORLD_SEED,
  WorldSimulation,
  decodeClientMessage,
  encodeBuiltProps,
  encodeHomeSkills,
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
test('learns a carried blueprint and upgrades the existing tent from the build journal', async ({
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
  Object.assign(sim.inventoryOf(1), { teepeeBlueprint: 1, log: 4, stick: 8 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    send(encodeWelcome(1, DEFAULT_WORLD_SEED, 0, Date.now()));
    send(encodeBuiltProps(sim.builtPropsList(), () => true));
    send(encodeHomeSkills(0));
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
    await page.locator('.hud-curtain').click();
    await page.keyboard.press('KeyB');
    await expect(page.locator('.hud-journal')).toContainText('Teepee · blueprint needed');
    await page.keyboard.press('KeyI');
    await page.getByRole('button', { name: /Teepee blueprint, 1/ }).click();
    await expect.poll(() => sim.homeSkillsOf(1)).toBe(1);
    await page.keyboard.press('KeyB');
    await expect(page.locator('.hud-journal')).toContainText('Upgrade to Teepee');
    await expect(page.locator('.hud-journal')).not.toContainText('blueprint needed');
    await page.locator('.hud-journal-entry').filter({ hasText: 'Upgrade to Teepee' }).click();
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
    expect(sim.inventoryOf(1).teepeeBlueprint ?? 0).toBe(0);
    expect(sim.inventoryOf(1).log ?? 0).toBe(0);
    expect(sim.inventoryOf(1).stick ?? 0).toBe(0);
    expect(errors).toEqual([]);
  } finally {
    sim.dispose();
  }
});
