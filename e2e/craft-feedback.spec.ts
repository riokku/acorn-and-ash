import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';

test.use({ viewport: { width: 1180, height: 760 }, deviceScaleFactor: 0.75 });
test.setTimeout(180_000);
test('waits for a delayed craft, prevents duplicate clicks, and explains authoritative refusal', async ({
  page,
}) => {
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    hungerEmptyAfterSeconds: Infinity,
  });
  sim.addPlayer(1);
  Object.assign(sim.inventoryOf(1), { reed: 6 });
  let requests = 0;
  let complete: (() => void) | undefined;
  let hold = true;
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', (r) =>
    r.fulfill({ body: '', contentType: 'text/css' }),
  );
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    let closed = false;
    socket.onClose(() => {
      closed = true;
    });
    const send = (data: ArrayBuffer) => {
      if (!closed) socket.send(Buffer.from(data));
    };
    const inventory = () =>
      send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
    const snapshot = () =>
      send(
        shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
      );
    send(shared.encodeWelcome(1, shared.DEFAULT_WORLD_SEED, 0, Date.now()));
    inventory();
    snapshot();
    socket.onMessage((message) => {
      if (closed || typeof message === 'string') return;
      const req = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (req?.type === 'ping') send(shared.encodePong(req.clientTimeMs, Date.now()));
      if (req?.type === 'input') {
        sim.queueInputs(1, req.inputs);
        for (const _ of req.inputs) sim.step(Date.now());
        snapshot();
      }
      if (req?.type === 'craft') {
        requests++;
        complete = () => {
          const refusal = sim.craftRefusalFor(1, req.item);
          if (refusal !== null) send(shared.encodeCraftRefused(req.item, refusal));
          else {
            sim.craftItem(1, req.item);
            for (const event of sim.drainCraftEvents()) send(shared.encodeCrafted(event));
          }
          inventory();
        };
        if (!hold) complete();
      }
    });
  });
  try {
    await page.goto('/?renderer=webgl2&world=craft-feedback');
    await page.locator('#home-name').fill('Patient Crafter');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true');
    await page.keyboard.press('KeyC');
    await page.locator('.craft-tabs').getByRole('button', { name: 'Lake', exact: true }).click();
    const rope = page.getByRole('button', { name: /^Key 1 Rope / });
    await rope.click();
    await expect.poll(() => requests).toBe(1);
    await expect(rope).toHaveAttribute('aria-busy', 'true');
    await expect(rope).toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator('.interaction-note')).toContainText('Waiting for confirmation');
    await page.keyboard.press('KeyC');
    await expect(page.locator('.hud-journal')).toHaveCount(0);
    await page.keyboard.press('KeyC');
    await expect(rope).toHaveAttribute('aria-busy', 'true');
    await rope.dispatchEvent('click');
    await page.keyboard.press('Digit1');
    const tick = sim.tick;
    await expect.poll(() => sim.tick).toBeGreaterThan(tick + 3);
    expect(requests).toBe(1);
    expect(sim.inventoryOf(1).rope ?? 0).toBe(0);
    complete!();
    await expect(rope).not.toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator('.interaction-note')).toHaveText('Rope ready.');
    expect(sim.inventoryOf(1).rope).toBe(1);
    expect(sim.inventoryOf(1).reed).toBe(3);

    // Another action changed the server's pack, but its update has not reached the client yet.
    sim.inventoryOf(1).reed = 0;
    hold = false;
    await rope.click();
    await expect.poll(() => requests).toBe(2);
    await expect(page.locator('.interaction-note')).toHaveText(
      'You need more materials to craft this.',
    );
    await expect(rope).not.toHaveAttribute('aria-disabled', 'true');
    expect(sim.inventoryOf(1).rope).toBe(1);
    expect(errors).toEqual([]);
  } finally {
    sim.dispose();
  }
});
