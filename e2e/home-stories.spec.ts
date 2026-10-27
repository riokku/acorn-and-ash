import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';
test.use({ viewport: { width: 1180, height: 760 }, deviceScaleFactor: 0.75 });
test.setTimeout(180_000);
test('brings a rumor home, remembers it and unlocks the visible trail pennant', async ({
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
        active: 12,
        completed: 0,
        cycle: 0,
        progress: [1, 1, 1],
      },
    },
    'trail-owner',
  );
  Object.assign(sim.inventoryOf(1), { stick: 4, flower: 4 });
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
        const reply = sim.requestExpedition(1, req);
        send(shared.encodeExpeditionState(reply));
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
    await page.goto('/?renderer=webgl2&world=home-stories');
    await page.locator('#home-name').fill('Story Keeper');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120000 });
    await page.getByRole('button', { name: 'Read expedition board' }).click();
    await page.getByRole('button', { name: 'Claim rewards' }).click();
    await expect
      .poll(() => shared.rememberedRumors(sim.expeditionStateOf(1).cosmetics).length)
      .toBe(1);
    await page.getByRole('button', { name: 'Crafting', exact: true }).click();
    await page.locator('.craft-tabs').getByRole('button', { name: 'Home', exact: true }).click();
    const stories = page.getByRole('region', { name: 'Stories brought home' });
    await expect(stories).toContainText(`1 of ${shared.RUMORS.length} woodland stories remembered`);
    await expect(stories).toContainText('trail pennant recipe is learned');
    await stories.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('stories-brought-home.png') });
    await page.getByRole('button', { name: 'See your earned keepsakes' }).click();
    const pennant = page.locator('[data-keepsake="trailPennant"]');
    await expect(pennant).toContainText('Ready to bring home');
    expect(sim.expeditionStateOf(1).cosmetics & shared.TRAIL_PENNANT_SKILL).toBeTruthy();
    expect(errors).toEqual([]);
  } finally {
    sim.dispose();
  }
});
