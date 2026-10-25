import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';

test.setTimeout(180000);
test.use({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 0.7 });
test('lets a player pick a colony clean, read its habitat and return to nearby regrowth', async ({
  page,
}) => {
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    raidIntervalSeconds: 86400,
  });
  sim.addPlayer(1);
  const patch = sim.gatherPatchesList().find((p) => p.id === 246)!;
  const start = { x: patch.x, z: patch.z + 0.8 };
  sim.placePlayer(1, { ...start, y: sim.collision.terrain.heightAt(start.x, start.z) }, 0);
  let timer: ReturnType<typeof setInterval> | undefined;
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '' }));
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    const refresh = () => {
      send(shared.encodeGatherPatches(sim.gatherPatchesList()));
      send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1)!)));
      const events = sim.drainCollectionEvents();
      if (events.length) send(shared.encodeCollected(events));
      const gestures = sim.drainGestureEvents();
      if (gestures.length) send(shared.encodeGestures(gestures));
      send(
        shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
      );
    };
    send(shared.encodeWelcome(1, sim.seed, 0, Date.now()));
    send(shared.encodeSpace(0, start.x, start.z, 0));
    refresh();
    socket.onMessage((message) => {
      if (typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
      if (request?.type === 'input') sim.queueInputs(1, request.inputs);
    });
    timer = setInterval(() => {
      sim.step(Date.now());
      refresh();
    }, shared.TICK_MILLISECONDS);
  });
  try {
    await page.goto('/?renderer=webgl2&world=forage-colony&season=summer');
    await page.locator('#home-name').fill('Woodland forager');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120000 });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
      timeout: 120000,
    });
    await page.keyboard.down('KeyE');
    try {
      await expect
        .poll(() => sim.gatherPatchesList().find((p) => p.id === patch.id)!.remaining, {
          timeout: 10000,
        })
        .toBe(0);
    } finally {
      await page.keyboard.up('KeyE');
    }
    expect(shared.countOf(sim.inventoryOf(1)!, 'berry')).toBe(patch.remaining);
    await expect(page.locator('.hud-hint')).toContainText('picked clean');
    sim.regrowPatches(Date.now() + 10000000);
    await expect
      .poll(() =>
        page.evaluate(
          (id) => window.acornDebug?.gatherSpots().find((p) => p.id === id)?.remaining ?? 0,
          patch.id,
        ),
      )
      .toBeGreaterThan(0);
    const grown = sim.gatherPatchesList().find((p) => p.id === patch.id)!;
    expect(Math.hypot(grown.x - patch.x, grown.z - patch.z)).toBeLessThanOrEqual(1.5);
    expect(errors).toEqual([]);
  } finally {
    if (timer) clearInterval(timer);
    sim.dispose();
  }
});
test(
  'shows the existing plant models arranged into recognizable colonies',
  { tag: '@real-drawing' },
  async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '' }));
    for (const before of [true, false]) {
      await page.goto(`/?gallery=forage-habitats&renderer=webgl2${before ? '&before' : ''}`);
      await expect(page.locator('body')).toHaveAttribute('data-gallery-ready', 'true', {
        timeout: 120000,
      });
      await page.screenshot({ path: testInfo.outputPath(before ? 'before.png' : 'after.png') });
    }
    expect(errors).toEqual([]);
  },
);
