import { expect, test } from '@playwright/test';
import * as shared from '../packages/shared/src/index';
test.use({ viewport: { width: 1180, height: 760 }, deviceScaleFactor: 0.75 });
test.setTimeout(180_000);
test('reads three outings, claims a completed reward and learns a placeable cosmetic', async ({
  page,
}, testInfo) => {
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    hungerEmptyAfterSeconds: Infinity,
  });
  const home = {
    id: 7,
    kind: 'tent' as const,
    x: 0,
    z: -4.2,
    yaw: 0,
    ownerKey: 'trail-owner',
    lit: false,
    litUntilMs: null,
  };
  sim.restoreBuiltProps([home]);
  sim.addPlayer(1, undefined, 'trail-owner');
  const saved = sim.persistablePlayers()[0]!;
  sim.removePlayer(1);
  sim.addPlayer(
    1,
    {
      ...saved,
      expedition: {
        ...shared.emptyExpedition(),
        active: 0,
        completed: 2,
        cycle: 2,
        progress: shared.EXPEDITIONS[0]!.objectives.map((g) => g.goal),
      },
    },
    'trail-owner',
  );
  const spot = shared.expeditionBoardSpot(home);
  sim.placePlayer(1, { ...spot, y: sim.collision.terrain.heightAt(spot.x, spot.z) }, 0);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', (r) =>
    r.fulfill({ body: '', contentType: 'text/css' }),
  );
  let closed = false;
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => {
      if (!closed) socket.send(Buffer.from(data));
    };
    const refresh = () => {
      send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
      send(shared.encodeExpeditionState(sim.expeditionStateOf(1)));
      send(
        shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
      );
    };
    send(shared.encodeWelcome(1, shared.DEFAULT_WORLD_SEED, 0, Date.now()));
    send(shared.encodeBuiltProps(sim.builtPropsList(), () => true));
    refresh();
    socket.onClose(() => {
      closed = true;
    });
    socket.onMessage((message) => {
      if (closed || typeof message === 'string') return;
      const req = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (req?.type === 'ping') send(shared.encodePong(req.clientTimeMs, Date.now()));
      if (req?.type === 'expedition') {
        send(shared.encodeExpeditionState(sim.requestExpedition(1, req)));
        send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
        return;
      }
      if (req?.type === 'input')
        for (const input of req.inputs) {
          sim.queueInput(1, input);
          sim.step(Date.now());
        }
      refresh();
    });
  });
  try {
    await page.goto('/?renderer=webgl2&world=trail-ui');
    await page.locator('#home-name').fill('Trail Walker');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
      timeout: 120_000,
    });
    const read = page.getByRole('button', { name: 'Read expedition board' });
    await expect(read).toBeVisible();
    await page.screenshot({
      path: process.env.CI
        ? testInfo.outputPath('expedition-board.png')
        : '/workspace/acorn-expedition-board.png',
    });
    await read.click();
    await expect(page.getByRole('region', { name: 'Expedition board' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Claim rewards' })).toBeEnabled();
    await page.getByRole('button', { name: 'Claim rewards' }).click();
    await expect(page.locator('.expedition-offer')).toHaveCount(3);
    await expect(page.locator('.expedition-milestone')).toContainText(
      'Trail pennant recipe learned',
    );
    expect(sim.inventoryOf(1)).toEqual({ log: 6, stick: 4 });
    await page.screenshot({
      path: process.env.CI
        ? testInfo.outputPath('expedition-journal.png')
        : '/workspace/acorn-expedition-journal.png',
    });
    await page.getByRole('button', { name: 'Choose outing' }).first().click();
    await expect(page.locator('.expedition-active')).toBeVisible();
    expect(sim.expeditionStateOf(1).active).not.toBeNull();
    await page.keyboard.down('KeyC');
    await expect(page.locator('.expedition-panel')).toHaveCount(0);
    await page.keyboard.up('KeyC');
    await page.keyboard.down('KeyC');
    await expect(page.locator('.hud-journal')).toBeVisible();
    await page.keyboard.up('KeyC');
    await expect(
      page.locator('.hud-journal-entry').filter({ hasText: 'Trail pennant' }),
    ).not.toHaveAttribute('aria-disabled', 'true');
    await page.setViewportSize({ width: 640, height: 700 });
    expect(
      await page.locator('.hud-journal').evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
    ).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    closed = true;
    sim.dispose();
  }
});
