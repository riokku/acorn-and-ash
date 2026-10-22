import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';
test.use({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 0.75 });
test.setTimeout(180_000);
test('right-click dismantles an owned outdoor object only after confirmation', async ({ page }) => {
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    hungerEmptyAfterSeconds: Infinity,
  });
  sim.restoreBuiltProps([
    {
      id: 7,
      kind: 'fence',
      x: 0,
      z: -2.5,
      yaw: 0,
      ownerKey: 'owner',
      lit: false,
      litUntilMs: null,
    },
  ]);
  sim.addPlayer(1, undefined, 'owner');
  sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0);
  let requests = 0;
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ body: '', contentType: 'text/css' }),
  );
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    let closed = false;
    const send = (data: ArrayBuffer) => {
      if (!closed) socket.send(Buffer.from(data));
    };
    socket.onClose(() => {
      closed = true;
    });
    const refresh = () => {
      send(shared.encodeBuiltProps(sim.builtPropsList(), () => true));
      send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
      send(
        shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
      );
    };
    send(shared.encodeWelcome(1, shared.DEFAULT_WORLD_SEED, 0, Date.now()));
    refresh();
    socket.onMessage((message) => {
      if (closed || typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
      if (request?.type === 'decoration') {
        requests++;
        const result = sim.requestDecoration(1, request);
        refresh();
        send(shared.encodeDecorationReply(request, result.reason));
      }
      if (request?.type === 'input') {
        sim.queueInputs(1, request.inputs);
        for (const _ of request.inputs) sim.step(Date.now());
        send(
          shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
        );
      }
    });
  });
  try {
    await page.goto('/?renderer=webgl2&world=object-actions');
    await page.locator('#home-name').fill('Object Owner');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
      timeout: 120_000,
    });
    const point = await page.evaluate(() => window.acornDebug!.screenPoint(0.7, 0.4, -2.5));
    await page.mouse.click(point!.x, point!.y, { button: 'right' });
    const menu = page.getByRole('dialog', { name: 'Manage placed object' });
    await expect(menu).toBeVisible();
    await expect(menu).toContainText('Returns:');
    await menu.getByRole('button', { name: 'Dismantle…', exact: true }).click();
    expect(requests).toBe(0);
    await menu.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(sim.builtPropsList()).toHaveLength(1);
    await menu.getByRole('button', { name: 'Dismantle…', exact: true }).click();
    await menu.getByRole('button', { name: 'Confirm dismantle', exact: true }).click();
    await expect.poll(() => sim.builtPropsList().length).toBe(0);
    expect(requests).toBe(1);
    for (const cost of shared.placedObjectRefund('fence'))
      expect(sim.inventoryOf(1)[cost.item]).toBe(cost.amount);
    await expect(page.locator('.interaction-note')).toHaveText('Fence dismantled.');
  } finally {
    sim.dispose();
  }
});
