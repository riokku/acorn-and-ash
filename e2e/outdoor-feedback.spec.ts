import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';
test.use({ viewport: { width: 1180, height: 760 }, deviceScaleFactor: 0.75 });
test.setTimeout(180_000);
test('waits for outdoor results, retains refused previews, and leaves newer previews alone', async ({
  page,
}) => {
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    hungerEmptyAfterSeconds: Infinity,
  });
  sim.addPlayer(1, undefined, 'builder');
  sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0);
  Object.assign(sim.inventoryOf(1), { stick: 20, log: 20 });
  let complete: (() => void) | undefined, sendWorld: ((data: ArrayBuffer) => void) | undefined;
  let requests = 0,
    closed = false;
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', (r) =>
    r.fulfill({ body: '', contentType: 'text/css' }),
  );
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => {
      if (!closed) socket.send(Buffer.from(data));
    };
    sendWorld = send;
    socket.onClose(() => {
      closed = true;
    });
    const refresh = () => {
      send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
      send(shared.encodeBuiltProps(sim.builtPropsList(), () => true));
      send(
        shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
      );
    };
    send(shared.encodeWelcome(1, shared.DEFAULT_WORLD_SEED, 0, Date.now()));
    refresh();
    socket.onMessage((message) => {
      if (closed || typeof message === 'string') return;
      const req = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (req?.type === 'ping') send(shared.encodePong(req.clientTimeMs, Date.now()));
      if (req?.type === 'build') {
        requests++;
        complete = () => {
          sim.requestBuild(1, req);
          sim.step(Date.now());
          refresh();
          for (const reply of sim.drainBuildReplies()) send(shared.encodeBuildReply(reply));
        };
      }
      if (req?.type === 'input') {
        sim.queueInputs(1, req.inputs);
        for (const _ of req.inputs) sim.step(Date.now());
        send(
          shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
        );
      }
    });
  });
  const aim = async (x: number, z: number) => {
    await expect(page.locator('.hud-journal')).toHaveCount(0);
    const point = await page.evaluate(({ x, z }) => window.acornDebug!.screenPoint(x, 0, z), {
      x,
      z,
    });
    expect(point).not.toBeNull();
    await page.mouse.move(point!.x, point!.y);
    await expect
      .poll(() => page.evaluate(() => window.acornDebug!.buildPreview()?.spot?.z))
      .toBeCloseTo(z, 1);
    await expect
      .poll(() => page.evaluate(() => window.acornDebug!.buildPreview()?.refusal))
      .toBeNull();
    return point!;
  };
  try {
    await page.goto('/?renderer=webgl2&world=outdoor-feedback');
    await page.locator('#home-name').fill('Patient Builder');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true');
    await page.keyboard.press('KeyC');
    await page.locator('.craft-tabs').getByRole('button', { name: 'Home', exact: true }).click();
    await page.locator('.hud-journal-entry').filter({ hasText: /Tent/ }).first().click();
    const point = await aim(0, -4.2);
    await page.mouse.click(point.x, point.y);
    await expect.poll(() => requests).toBe(1);
    await expect(page.locator('.hud-hint')).toContainText('Waiting for confirmation');
    sendWorld!(shared.encodeBuiltProps([], () => true));
    await page.mouse.click(point.x, point.y);
    const tick = sim.tick;
    await expect.poll(() => sim.tick).toBeGreaterThan(tick + 3);
    expect(requests).toBe(1);
    sim.inventoryOf(1).stick = 0;
    complete!();
    await expect(page.locator('.interaction-note')).toHaveText(
      'Gather the listed building materials first.',
    );
    await expect
      .poll(() => page.evaluate(() => window.acornDebug!.buildPreview()?.kind))
      .toBe('tent');
    sim.inventoryOf(1).stick = 20;
    sendWorld!(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
    await aim(0, -4.2);
    await page.mouse.click(point.x, point.y);
    await expect.poll(() => requests).toBe(2);
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => window.acornDebug!.buildPreview())).toBeNull();
    await page.keyboard.press('KeyC');
    await page.locator('.craft-tabs').getByRole('button', { name: 'Camp', exact: true }).click();
    await page
      .locator('.hud-journal-entry')
      .filter({ hasText: /Campfire/ })
      .first()
      .click();
    complete!();
    await expect(page.locator('.interaction-note')).toHaveText('Tent placed.');
    await expect
      .poll(() => page.evaluate(() => window.acornDebug!.buildPreview()?.kind))
      .toBe('campfire');
    const next = await aim(3, -1);
    await page.mouse.click(next.x, next.y);
    await expect.poll(() => requests).toBe(3);
    complete!();
    await expect(page.locator('.interaction-note')).toHaveText('Campfire placed.');
    expect(sim.builtPropsList()).toHaveLength(2);
    expect(errors).toEqual([]);
  } finally {
    closed = true;
    sim.dispose();
  }
});
