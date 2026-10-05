import { expect, test } from '@playwright/test';
import * as shared from '../packages/shared/src/index';
test.use({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 0.5 });
test.setTimeout(240_000);
test('follows spoor, records an elk sketch, collects a cache and builds an earned guardian trophy', async ({
  page,
}) => {
  const sim = new shared.WorldSimulation({ seed: shared.DEFAULT_WORLD_SEED });
  sim.addPlayer(
    1,
    {
      netId: 1,
      x: 0,
      y: 0,
      z: 0,
      facingYaw: 0,
      items: [],
      hunger: 100,
      health: 100,
      discoveriesFound: 64,
    },
    'tracker',
  );
  sim.restoreBuiltProps([
    {
      id: 7,
      kind: 'tent',
      x: 0,
      z: -4.2,
      yaw: 0,
      lit: false,
      ownerKey: 'tracker',
      litUntilMs: null,
    },
  ]);
  const spoor = shared
    .buildWoodlandTracks(shared.DEFAULT_WORLD_SEED)
    .find((track) => track.kind === 'elk')!;
  sim.placePlayer(
    1,
    { x: spoor.x, y: sim.collision.terrain.heightAt(spoor.x, spoor.z), z: spoor.z },
    0,
  );
  let sendWorld: ((data: ArrayBuffer) => void) | undefined;
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ body: '', contentType: 'text/css' }),
  );
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    sendWorld = send;
    send(shared.encodeWelcome(1, shared.DEFAULT_WORLD_SEED, sim.tick, Date.now()));
    send(shared.encodeDiscoveries(sim.discoveryStateOf(1)));
    send(shared.encodeBuiltProps(sim.builtPropsList(), () => true));
    send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
    send(shared.encodeSpace(0, spoor.x, spoor.z, 0));
    send(shared.encodeSnapshot(sim.tick, Date.now(), 0, sim.snapshotFor(1)));
    socket.onMessage((message) => {
      if (typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
      if (request?.type === 'build') sim.requestBuild(1, request);
      if (request?.type === 'input') {
        for (const input of request.inputs) {
          sim.queueInput(1, input);
          sim.step(Date.now());
        }
        for (const event of sim.drainDiscoveryChanges())
          send(shared.encodeDiscoveries(event.state));
        if (sim.drainBuildEvents().length > 0)
          send(shared.encodeBuiltProps(sim.builtPropsList(), () => true));
        send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
        send(
          shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
        );
      }
    });
  });
  const teleport = (x: number, z: number) => {
    sim.placePlayer(1, { x, y: sim.collision.terrain.heightAt(x, z), z }, 0);
    sendWorld!(shared.encodeSpace(0, x, z, 0));
    sendWorld!(
      shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
    );
  };
  const inspect = async (id: number) => {
    await page.keyboard.down('KeyE');
    await expect.poll(() => shared.discoveryKnown(sim.discoveryStateOf(1).claimed, id)).toBe(true);
    const releasedAt = sim.tick;
    await page.keyboard.up('KeyE');
    await expect.poll(() => sim.tick).toBeGreaterThan(releasedAt);
  };
  try {
    await page.goto('/?renderer=webgl2&world=woodland-ui');
    await page.locator('#home-name').fill('Woodland Tracker');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
    await page.locator('.hud-curtain').click();
    await expect(page.locator('.hud-hint')).toContainText('Split hoofprints');
    await page.screenshot({
      path: process.env.CI
        ? 'test-results/woodland-spoor.png'
        : '/workspace/acorn-woodland-spoor.png',
    });
    const elk = sim.discoverySites.find((site) => site.id === 4)!;
    sim.placeAnimal(1008, {
      x: elk.x + 8.5,
      y: sim.collision.terrain.heightAt(elk.x + 8.5, elk.z),
      z: elk.z,
    });
    teleport(elk.x, elk.z);
    await inspect(4);
    await page.keyboard.press('KeyC');
    await page.getByRole('button', { name: 'Discoveries', exact: true }).click();
    await expect(
      page.locator('.discovery-entry').filter({ hasText: 'The elk grove' }),
    ).toContainText('Sketch recorded');
    await page.keyboard.press('KeyC');
    await expect(page.locator('.hud-journal')).toHaveCount(0);
    const raccoon = sim.discoverySites.find((site) => site.id === 5)!;
    sim.placeAnimal(1009, {
      x: raccoon.x,
      y: sim.collision.terrain.heightAt(raccoon.x, raccoon.z),
      z: raccoon.z,
    });
    teleport(raccoon.x, raccoon.z);
    await inspect(5);
    expect(sim.inventoryOf(1).berry).toBe(4);
    expect(sim.inventoryOf(1).mushroom).toBe(3);
    const guardian = sim.discoverySites.find((site) => site.id === 6)!;
    sim.placeAnimal(1010, {
      x: guardian.x + 15,
      y: sim.collision.terrain.heightAt(guardian.x + 15, guardian.z),
      z: guardian.z,
    });
    teleport(guardian.x, guardian.z);
    await inspect(6);
    expect(sim.inventoryOf(1).guardianTrophy).toBe(1);
    teleport(0, 0);
    await page.keyboard.press('KeyB');
    // Straight to the Trophies page: a short list that does not scroll under the click.
    await page
      .locator('.craft-tabs')
      .getByRole('button', { name: 'Trophies', exact: true })
      .click();
    await page.locator('.hud-journal-entry').filter({ hasText: 'Guardian trophy' }).click();
    // The menu closes once the piece is in hand; a mouse move before that lands on the panel, not the world.
    await expect(page.locator('.hud-journal')).toHaveCount(0);
    const point = await page.evaluate(() => window.acornDebug?.screenPoint(2.5, 0, 0));
    if (point == null) throw new Error('trophy position is off screen');
    await page.mouse.move(point.x, point.y);
    // The preview starts out with no spot and no refusal, so wait for it to find
    // the spot under the mouse before clicking - at a few frames a second the
    // click would otherwise land first and place nothing.
    await expect
      .poll(() =>
        page.evaluate(() => {
          const preview = window.acornDebug?.buildPreview();
          return preview?.spot != null && preview.refusal === null;
        }),
      )
      .toBe(true);
    await page.mouse.click(point.x, point.y);
    await expect
      .poll(() => sim.builtPropsList().some((prop) => prop.kind === 'guardianTrophy'))
      .toBe(true);
    await page.screenshot({
      path: process.env.CI
        ? 'test-results/woodland-reward.png'
        : '/workspace/acorn-woodland-reward.png',
    });
    expect(errors).toEqual([]);
  } finally {
    sim.dispose();
  }
});
