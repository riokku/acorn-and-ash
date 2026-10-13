import { expect, test } from './fixtures';
import type { WebSocketRoute } from '@playwright/test';
import * as shared from '../packages/shared/src/index';

test.use({ viewport: { width: 1180, height: 760 }, deviceScaleFactor: 0.75 });
test.setTimeout(180_000);

test('explains disconnected actions, keeps a tent preview, and submits only fresh clicks after reconnecting', async ({
  page,
}) => {
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    hungerEmptyAfterSeconds: Infinity,
  });
  sim.addPlayer(1, undefined, 'feedback-owner');
  sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0);
  Object.assign(sim.inventoryOf(1), { reed: 6, stick: 20, teepeeBlueprint: 1 });
  const before = { ...sim.inventoryOf(1) };
  const requests: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let active: WebSocketRoute | undefined;
  let allowConnection = true;
  await page.route('https://fonts.googleapis.com/**', (r) =>
    r.fulfill({ body: '', contentType: 'text/css' }),
  );
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    if (!allowConnection) {
      socket.close({ code: 1000, reason: 'Test connection interrupted' });
      return;
    }
    active = socket;
    let closed = false;
    socket.onClose(() => {
      closed = true;
    });
    const send = (message: ArrayBuffer) => {
      if (!closed) socket.send(Buffer.from(message));
    };
    const inventory = () =>
      send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
    const snapshot = () =>
      send(
        shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
      );
    send(shared.encodeWelcome(1, shared.DEFAULT_WORLD_SEED, 0, Date.now()));
    send(shared.encodeSpace(0, 0, 0, 0));
    send(shared.encodeBuiltProps(sim.builtPropsList(), () => true));
    send(shared.encodeHomeSkills(sim.homeSkillsOf(1)));
    inventory();
    snapshot();
    socket.onMessage((message) => {
      if (closed || typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
      if (request?.type === 'craft') {
        requests.push('craft');
        sim.craftItem(1, request.item);
        for (const event of sim.drainCraftEvents()) send(shared.encodeCrafted(event));
        inventory();
      }
      if (request?.type === 'useItem') {
        requests.push('useItem');
        sim.useItem(1, request.item);
        send(shared.encodeHomeSkills(sim.homeSkillsOf(1)));
        inventory();
      }
      if (request?.type === 'build') {
        requests.push('build');
        sim.requestBuild(1, request);
      }
      if (request?.type === 'input') {
        sim.queueInputs(1, request.inputs);
        for (let i = 0; i < request.inputs.length; i++) sim.step(Date.now());
        if (sim.drainBuildEvents().length) {
          send(shared.encodeBuiltProps(sim.builtPropsList(), () => true));
          inventory();
        }
        for (const feedback of sim.drainHomeBuildFeedback())
          send(shared.encodeHomeBuildFeedback(feedback));
        snapshot();
      }
    });
  });
  try {
    await page.goto('/?renderer=webgl2&world=action-feedback');
    await page.locator('#home-name').fill('Feedback Walker');
    await page.locator('.home-play').click();
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
      timeout: 120_000,
    });
    await expect(page.getByTestId('loading-screen')).toBeHidden();
    allowConnection = false;
    active!.close({ code: 1000, reason: 'Test connection interrupted' });
    await expect(page.getByText('Offline', { exact: true })).toBeVisible();

    await page.keyboard.press('KeyC');
    await page.locator('.craft-tabs').getByRole('button', { name: 'Lake', exact: true }).click();
    await page.getByRole('button', { name: /^Key 1 Rope / }).click();
    await expect(page.locator('.interaction-note')).toHaveText('Reconnect to craft.');
    await expect(page.locator('.hud-journal')).toBeVisible();
    await page.keyboard.press('KeyI');
    await page.getByRole('button', { name: /Teepee blueprint, 1/ }).click();
    await expect(page.locator('.interaction-note')).toHaveText('Reconnect to use this item.');

    await page.keyboard.press('KeyC');
    await page.locator('.craft-tabs').getByRole('button', { name: 'Home', exact: true }).click();
    await page
      .locator('.hud-journal-entry')
      .filter({ hasText: /^.*Tent/ })
      .first()
      .click();
    await expect(page.locator('.hud-journal')).toHaveCount(0);
    const point = await page.evaluate(() => window.acornDebug!.screenPoint(0, 0, -4.2));
    expect(point).not.toBeNull();
    await page.mouse.move(point!.x, point!.y);
    await expect
      .poll(() => page.evaluate(() => window.acornDebug!.buildPreview()?.spot?.z))
      .toBeCloseTo(-4.2, 1);
    await expect
      .poll(() => page.evaluate(() => window.acornDebug!.buildPreview()?.refusal))
      .toBeNull();
    await page.mouse.click(point!.x, point!.y);
    await expect(page.locator('.interaction-note')).toHaveText('Reconnect to build.');
    await expect
      .poll(() => page.evaluate(() => window.acornDebug!.buildPreview()?.kind))
      .toBe('tent');
    expect(requests).toEqual([]);
    expect(sim.inventoryOf(1)).toEqual(before);
    expect(sim.builtPropsList()).toEqual([]);

    allowConnection = true;
    await expect(page.getByText('Connected', { exact: true })).toBeVisible();
    // Give the new socket several input exchanges: old clicks must never be queued for it.
    const tick = sim.tick;
    await expect.poll(() => sim.tick).toBeGreaterThan(tick + 3);
    expect(requests).toEqual([]);
    await expect
      .poll(() => page.evaluate(() => window.acornDebug!.buildPreview()?.kind))
      .toBe('tent');
    await page.mouse.click(point!.x, point!.y);
    await expect.poll(() => sim.builtPropsList().some((p) => p.kind === 'tent')).toBe(true);
    await expect.poll(() => page.evaluate(() => window.acornDebug!.buildPreview())).toBeNull();
    await expect(page.locator('.interaction-note')).toHaveCount(0);
    expect(requests).toEqual(['build']);
    expect(sim.inventoryOf(1).stick).toBe(before.stick! - 6);
    await page.keyboard.press('KeyC');
    await page.locator('.craft-tabs').getByRole('button', { name: 'Lake', exact: true }).click();
    await page.getByRole('button', { name: /^Key 1 Rope / }).click();
    await expect.poll(() => sim.inventoryOf(1).rope).toBe(1);
    await expect(page.locator('.hud-news')).toContainText('You made a rope.');
    expect(requests).toEqual(['build', 'craft']);
    expect(errors).toEqual([]);
  } finally {
    allowConnection = false;
    active?.close();
    sim.dispose();
  }
});
