import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';

test.setTimeout(180000);
test.use({ viewport: { width: 1000, height: 760 }, deviceScaleFactor: 0.7 });
test('collects one plant immediately and still allows movement after picking', async ({ page }) => {
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    raidIntervalSeconds: 86400,
  });
  sim.addPlayer(1);
  const patch = sim.gatherPatchesList().find((p) => p.item === 'flower' && p.remaining > 1)!;
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
    await page.goto('/?renderer=webgl2&world=harvest-contact&season=summer');
    await page.locator('#home-name').fill('Forager');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120000 });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
      timeout: 120000,
    });
    const before = sim.gatherPatchesList().find((p) => p.id === patch.id)!.remaining;
    await page.keyboard.press('KeyE');
    await expect
      .poll(() => sim.gatherPatchesList().find((p) => p.id === patch.id)!.remaining)
      .toBe(before - 1);
    expect(shared.countOf(sim.inventoryOf(1)!, 'flower')).toBe(1);
    // A full pack must not remove a plant or issue another collection gesture.
    const tick = sim.tick;
    await expect.poll(() => sim.tick).toBeGreaterThan(tick + 20);
    sim.inventoryOf(1)!.flower = shared.ITEM_KINDS.flower.stackSize * shared.BASE_PACK_SLOTS;
    const remaining = sim.gatherPatchesList().find((p) => p.id === patch.id)!.remaining;
    const refusedAt = sim.tick;
    await page.keyboard.press('KeyE');
    await expect.poll(() => sim.tick).toBeGreaterThan(refusedAt + 3);
    expect(sim.gatherPatchesList().find((p) => p.id === patch.id)!.remaining).toBe(remaining);
    const at = sim.readPlayer(1)!.position;
    await page.keyboard.down('KeyD');
    try {
      await expect.poll(() => sim.readPlayer(1)!.position.x).toBeGreaterThan(at.x + 0.5);
    } finally {
      await page.keyboard.up('KeyD');
    }
    expect(errors).toEqual([]);
  } finally {
    if (timer) clearInterval(timer);
    sim.dispose();
  }
});

test(
  'renders the harvesting contact before and after in the real gallery',
  { tag: '@real-drawing' },
  async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '' }));
    for (const before of [true, false]) {
      await page.goto(`/?gallery=harvesting&renderer=webgl2&at=0.18${before ? '&before' : ''}`);
      await expect(page.locator('body')).toHaveAttribute('data-gallery-ready', 'true', {
        timeout: 120000,
      });
      await page.screenshot({ path: testInfo.outputPath(before ? 'before.png' : 'after.png') });
    }
    expect(errors).toEqual([]);
  },
);
