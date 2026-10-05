import { expect, test, type Page } from '@playwright/test';
import * as shared from '../packages/shared/src/index';

/**
 * Building a rowboat (decision 0092): the Craft menu has a Lake section, the
 * see-through preview floats on the water beside the bank (green where a boat
 * fits, red where it cannot float), one click moors it and takes six logs and
 * two rope, and it stays there.
 *
 * The server is played by an in-page copy of the simulation, with the player
 * already standing on the bank beside the first clump of reeds, so the test
 * covers what the browser shows and sends rather than a walk across the world.
 */
test.use({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 0.5 });
test.setTimeout(240_000);

/** Where to keep screenshots when somebody wants to look at them (not in CI). */
const SHOTS = process.env.SHOT_DIR;

async function enterWorld(page: Page, world: string): Promise<void> {
  await page.goto(`/?renderer=webgl2&world=${world}`);
  await page.locator('#home-name').fill('Mira');
  await page.locator('.home-play').click();
  await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
}

/** A boat's berth beside the first reed patch: lying along the bank, 2.5 m from the shore. */
function berth() {
  const spot = shared.REED_PATCHES[0]!;
  const circle = shared.LAKE.basin.reduce((best, c) => {
    const gap = (c: { x: number; z: number; radius: number }) =>
      Math.abs(Math.hypot(spot.x - c.x, spot.z - c.z) - c.radius);
    return gap(c) < gap(best) ? c : best;
  });
  const away = Math.hypot(circle.x - spot.x, circle.z - spot.z);
  const inward = { x: (circle.x - spot.x) / away, z: (circle.z - spot.z) / away };
  // The reeds stand 0.45 m from the shore, the middle of the boat 2.5 m from it.
  const x = spot.x + inward.x * 2.05;
  const z = spot.z + inward.z * 2.05;
  // Standing just on dry land, looking out across the water.
  const bank = { x: x - inward.x * 2.9, z: z - inward.z * 2.9 };
  return { x, z, inward, bank, facing: Math.atan2(-inward.x, -inward.z) };
}

test('you can build a rowboat on the lake and it stays moored', async ({ page }) => {
  const water = berth();
  const terrain = shared.createWildernessTerrain(shared.DEFAULT_WORLD_SEED);
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    hungerEmptyAfterSeconds: Infinity,
  });
  sim.addPlayer(1, undefined, 'boatwright');
  sim.placePlayer(
    1,
    { x: water.bank.x, y: terrain.heightAt(water.bank.x, water.bank.z), z: water.bank.z },
    water.facing,
  );
  Object.assign(sim.inventoryOf(1), { log: 6, rope: 2 });

  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ body: '', contentType: 'text/css' }),
  );
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    const sendPack = () =>
      send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
    send(shared.encodeWelcome(1, shared.DEFAULT_WORLD_SEED, 0, Date.now()));
    send(shared.encodeSpace(0, water.bank.x, water.bank.z, 0));
    send(shared.encodeBuiltProps(sim.builtPropsList(), () => true));
    sendPack();
    send(shared.encodeSnapshot(0, Date.now(), 0, sim.snapshotFor(1)));
    socket.onMessage((message) => {
      if (typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
      if (request?.type === 'build') sim.requestBuild(1, request);
      if (request?.type === 'input') {
        sim.queueInputs(1, request.inputs);
        sim.step(Date.now());
        if (sim.drainBuildEvents().length > 0) {
          send(shared.encodeBuiltProps(sim.builtPropsList(), () => true));
          sendPack();
        }
        send(
          shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
        );
      }
    });
  });

  await enterWorld(page, 'rowboat-berth');
  await page.locator('.hud-curtain').click();
  await page.evaluate(([x, z]) => window.acornDebug?.faceTowards(x!, z!), [water.x, water.z]);

  // The Craft menu has a Lake section with the rowboat and its price.
  await page.keyboard.press('KeyB');
  await page.locator('.craft-tabs').getByRole('button', { name: 'Lake', exact: true }).click();
  const entry = page.locator('.hud-journal-entry').filter({ hasText: 'Rowboat' });
  await expect(page.locator('.hud-journal')).toContainText('Lake');
  await expect(entry).toContainText('6');
  await expect(entry).toContainText('2');
  await entry.click();
  await expect(page.locator('.hud-journal')).toHaveCount(0);
  // Not a word about a home's building area: a boat does not need one.
  await expect(page.locator('.build-area-note')).toHaveCount(0);

  // Pointed at dry land, the preview says a boat floats.
  const land = await page.evaluate(
    ([x, z]) => window.acornDebug?.screenPoint(x!, 0, z!),
    [water.bank.x - water.inward.x * 2.5, water.bank.z - water.inward.z * 2.5],
  );
  if (land == null) throw new Error('the bank is off screen');
  await page.mouse.move(land.x, land.y);
  await expect
    .poll(() => page.evaluate(() => window.acornDebug?.buildPreview()?.refusal))
    .toContain('Rowboats float in the lake');

  // Pointed at the water a step or two out, it fits.
  const onWater = await page.evaluate(
    ([x, level, z]) => window.acornDebug?.screenPoint(x!, level!, z!),
    [water.x, shared.LAKE.level, water.z],
  );
  if (onWater == null) throw new Error('the water is off screen');
  await page.mouse.move(onWater.x, onWater.y);
  await expect
    .poll(() => page.evaluate(() => window.acornDebug?.buildPreview()?.refusal))
    .toBeNull();
  const preview = await page.evaluate(() => window.acornDebug?.buildPreview());
  expect(preview?.kind).toBe('rowboat');
  expect(
    Math.hypot((preview?.spot?.x ?? 0) - water.x, (preview?.spot?.z ?? 0) - water.z),
  ).toBeLessThan(0.6);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/rowboat-preview.png` });

  // One click moors it, and the logs and rope are spent.
  await page.mouse.click(onWater.x, onWater.y);
  await expect
    .poll(() =>
      page.evaluate(() => window.acornDebug?.builtProps().find((p) => p.kind === 'rowboat')?.yours),
    )
    .toBe(true);
  const carried = (item: string) => async () =>
    page.evaluate(
      (name) => window.acornDebug?.carrying().find((entry) => entry.item === name)?.count ?? 0,
      item,
    );
  await expect.poll(carried('log')).toBe(0);
  await expect.poll(carried('rope')).toBe(0);
  // One each: the preview is put away once it is built.
  await expect.poll(() => page.evaluate(() => window.acornDebug?.buildPreview())).toBeNull();
  await page.mouse.move(10, 10);
  await page.waitForTimeout(500);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/rowboat-moored.png` });

  const boats = sim.builtPropsList().filter((prop) => prop.kind === 'rowboat');
  expect(boats).toHaveLength(1);
  expect(errors).toEqual([]);
});
