import { expect, test, type Page } from '@playwright/test';
import * as shared from '../packages/shared/src/index';
import { skipDrawing } from './skip-drawing';

/**
 * Reeds and rope (decisions 0091 and 0101): mature reeds grow along the bank of
 * the lake and of the clearing's pond, E cuts one, and three of them twist into
 * a rope from the Craft menu.
 *
 * The server is played by an in-page copy of the simulation standing in for
 * it, with the player already on the bank beside a patch. That keeps the test
 * to the part that is new - what the browser shows and sends - instead of a
 * walk across the world.
 */
test.use({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 0.5 });
test.setTimeout(240_000);

async function enterWorld(page: Page, world: string): Promise<void> {
  await page.goto(`/?renderer=webgl2&world=${world}`);
  await page.locator('#home-name').fill('Mira');
  await page.locator('.home-play').click();
  await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
}

/** Where a walker ends up standing when they step up to a patch from the water. */
function bankBeside(spot: { x: number; z: number }): { x: number; z: number } {
  const terrain = shared.createWildernessTerrain(shared.DEFAULT_WORLD_SEED);
  const probe = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    hungerEmptyAfterSeconds: Infinity,
  });
  probe.addPlayer(1, undefined, 'probe');
  probe.placePlayer(1, { x: spot.x, y: terrain.heightAt(spot.x, spot.z), z: spot.z }, 0);
  probe.queueInput(1, shared.createInput(1, 0, 0, 0, 0));
  probe.step(Date.now());
  const bank = probe.outdoorPositionOf(1);
  probe.dispose();
  if (bank === null) throw new Error('the probe walker vanished');
  return bank;
}

for (const water of ['lake', 'pond'] as const) {
  test(`you can cut reeds at the ${water} and twist them into rope`, async ({ page }) => {
    await cutReedsAndTwistRope(page, water);
  });
}

async function cutReedsAndTwistRope(page: Page, water: 'lake' | 'pond'): Promise<void> {
  // What this checks is what the browser sends and shows, not the picture (decision
  // 0100). Drawn in software, the pond's busy clearing leaves the page too slow to
  // send a press of E for seconds at a time, and the cut was never reached.
  await skipDrawing(page);
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    hungerEmptyAfterSeconds: Infinity,
  });
  // A patch at this water with enough reeds for one rope, so the test never waits for regrowth.
  const patch = sim
    .gatherPatchesList()
    .find(
      (view) =>
        view.item === 'reed' && view.remaining >= 3 && shared.reedWaterOf(view.id)?.name === water,
    );
  if (patch === undefined) throw new Error(`no reed patch at the ${water} holds three reeds`);
  const start = bankBeside(patch);
  sim.addPlayer(1, undefined, 'cutter');
  sim.placePlayer(1, { x: start.x, y: 0, z: start.z }, 0);

  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ body: '', contentType: 'text/css' }),
  );
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    const sendPack = () => {
      send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
      send(shared.encodeGatherPatches(sim.gatherPatchesList()));
    };
    send(shared.encodeWelcome(1, shared.DEFAULT_WORLD_SEED, 0, Date.now()));
    send(shared.encodeSpace(0, start.x, start.z, 0));
    sendPack();
    send(shared.encodeSnapshot(0, Date.now(), 0, sim.snapshotFor(1)));
    socket.onMessage((message) => {
      if (typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
      if (request?.type === 'craft') {
        sim.craftItem(1, request.item);
        sendPack();
      }
      if (request?.type === 'input') {
        for (const input of request.inputs) {
          sim.queueInput(1, input);
          sim.step(Date.now());
        }
        send(
          shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
        );
        sendPack();
      }
    });
  });

  await enterWorld(page, `reeds-${water}`);
  await page.locator('.hud-curtain').click();

  // The browser knows about every clump along every bank, drawn from what the server says.
  const spots = await page.evaluate(() => window.acornDebug?.gatherSpots() ?? []);
  expect(spots.filter((spot) => spot.item === 'reed')).toHaveLength(shared.REED_PATCHES.length);
  await expect(page.locator('.hud-hint')).toContainText(
    'Right-click or press E to gather mature reeds',
  );

  // Taps, not a hold: gathering is paced the same way a swing is.
  const reedsCarried = async () =>
    page.evaluate(
      () => window.acornDebug?.carrying().find((entry) => entry.item === 'reed')?.count ?? 0,
    );
  for (let attempt = 0; attempt < 30 && (await reedsCarried()) < 3; attempt++) {
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(400);
  }
  expect(await reedsCarried()).toBe(3);

  // Three reeds, one rope, from the Craft menu and no workbench. Rope is on its
  // Lake page (decision 0096), first in the list there, so it is key 1. It reads
  // "Ready" the moment the third reed is in the pack - the bug that started this
  // was a rope you could not see because the list ran off the bottom of the screen.
  await page.keyboard.press('KeyC');
  await page.locator('.craft-tabs').getByRole('button', { name: 'Lake', exact: true }).click();
  const ropeEntry = page.locator('.hud-journal-entry').filter({ hasText: /^\d?Rope/ });
  await expect(ropeEntry).toBeVisible();
  await expect(ropeEntry).toContainText('Ready');
  await page.keyboard.press('Digit1');
  await expect
    .poll(() =>
      page.evaluate(
        () => window.acornDebug?.carrying().find((entry) => entry.item === 'rope')?.count ?? 0,
      ),
    )
    .toBe(1);
  expect(await reedsCarried()).toBe(0);
  expect(errors).toEqual([]);
}
