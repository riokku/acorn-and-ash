import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';
test.use({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 0.5 });
test.setTimeout(180_000);
test('reads the ranger note with E and shows the next personal clue', async ({ page }) => {
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    hungerEmptyAfterSeconds: Infinity,
    raidIntervalSeconds: 86400,
  });
  const site = shared.SUNREACH_SURVEY[0];
  sim.addPlayer(
    1,
    {
      netId: 1,
      x: site.x,
      z: site.z,
      y: 20,
      facingYaw: 0,
      hunger: 100,
      expedition: { ...shared.emptyExpedition(), active: shared.SUNREACH_EXPEDITION_ID },
      items: [{ item: 'shovel', count: 1 }],
    },
    'survey-browser',
  );
  sim.placePlayer(1, { ...site, y: sim.collision.terrain.heightAt(site.x, site.z) }, 0);
  // This case tests clue input; creature combat has its own simulation tests.
  for (const den of shared.ANIMAL_DENS) sim.placeAnimal(den.id, { x: 280, y: 0, z: 280 });
  let ticking: ReturnType<typeof setInterval> | undefined;
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ body: '', contentType: 'text/css' }),
  );
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    const refresh = () => {
      send(shared.encodeExpeditionState(sim.expeditionStateOf(1)));
      send(
        shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
      );
    };
    send(shared.encodeWelcome(1, shared.DEFAULT_WORLD_SEED, 0, Date.now()));
    send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
    refresh();
    socket.onMessage((message) => {
      if (typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
      if (request?.type === 'input') sim.queueInputs(1, request.inputs);
    });
    ticking = setInterval(() => {
      sim.step(Date.now());
      refresh();
    }, shared.TICK_MILLISECONDS);
  });
  try {
    await page.goto('/?renderer=webgl2&world=survey-browser');
    await page.locator('#home-name').fill('Ranger');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
    const trail = page.getByRole('complementary', { name: 'Sunreach expedition' });
    await expect(trail).toContainText('Press E');
    await page.keyboard.press('KeyE');
    await expect(trail).toContainText('banner still stands');
    expect(sim.expeditionStateOf(1).progress).toEqual([1, 0, 0]);
    await page.keyboard.press('KeyE');
    expect(sim.expeditionStateOf(1).progress).toEqual([1, 0, 0]);
    expect(errors).toEqual([]);
  } finally {
    if (ticking !== undefined) clearInterval(ticking);
    sim.dispose();
  }
});
