import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';

test.setTimeout(180000);
test('shows a watching rabbit, then a fleeing rabbit when the player walks too close', async ({
  page,
}) => {
  const den = shared.ANIMAL_DENS[0]!;
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    raidIntervalSeconds: 86400,
  });
  sim.addPlayer(1);
  const start = { x: den.x, z: den.z + 4 };
  sim.placePlayer(1, { ...start, y: sim.collision.terrain.heightAt(start.x, start.z) }, 0);
  const animal = () =>
    sim
      .snapshotFor(1)
      .find((e) => e.netId === den.id && (e.flags & shared.SnapshotFlag.Animal) !== 0)!;
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '' }));
  let timer: ReturnType<typeof setInterval> | undefined;
  let started = false;
  let stepBack = () => {};
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    const refresh = () =>
      send(
        shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
      );
    stepBack = () => {
      const pose = animal();
      const spot = { x: pose.x, z: pose.z + shared.ANIMAL_KINDS.rabbit.safeRadius + 4 };
      sim.placePlayer(1, { ...spot, y: sim.collision.terrain.heightAt(spot.x, spot.z) }, 0);
      send(shared.encodeSpace(0, spot.x, spot.z, 0));
      refresh();
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
      if (started) sim.step(Date.now());
      refresh();
    }, shared.TICK_MILLISECONDS);
  });
  try {
    await page.goto('/?renderer=webgl2&world=quiet-stalking&season=summer');
    await page.locator('#home-name').fill('Quiet observer');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120000 });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
      timeout: 120000,
    });
    // Start after loading so the short first-look cue is not consumed behind the curtain.
    started = true;
    await expect.poll(() => animal().action & 4).toBe(4);
    expect(Math.hypot(animal().vx, animal().vz)).toBe(0);
    await expect
      .poll(() =>
        page.evaluate((id) => window.acornDebug?.animals().find((a) => a.id === id)?.z, den.id),
      )
      .toBeCloseTo(den.z, 1);
    await page.evaluate(({ x, z }) => window.acornDebug?.faceTowards(x, z), den);
    await page.keyboard.down('KeyW');
    try {
      await expect
        .poll(() => animal().action & shared.PREY_POSE.fleeing, { timeout: 5000 })
        .toBe(shared.PREY_POSE.fleeing);
    } finally {
      await page.keyboard.up('KeyW');
    }
    await expect
      .poll(() =>
        page.evaluate(
          (id) => window.acornDebug?.animals().find((a) => a.id === id)?.z ?? Infinity,
          den.id,
        ),
      )
      .toBeLessThan(den.z - 0.3);
    await expect
      .poll(() => page.evaluate(() => window.acornDebug?.wildlifeSoundCount() ?? 0))
      .toBeGreaterThan(0);
    stepBack();
    await expect
      .poll(() => animal().action & (4 | shared.PREY_POSE.tense | shared.PREY_POSE.fleeing), {
        timeout: 6000,
      })
      .toBe(0);
    expect(errors).toEqual([]);
  } finally {
    if (timer) clearInterval(timer);
    sim.dispose();
  }
});
