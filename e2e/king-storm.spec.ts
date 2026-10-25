import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';

test.use({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 0.5 });
test.setTimeout(180000);
test('lets a player reach a ward and survive the authoritative storm without damage', async ({
  page,
}) => {
  const ward = shared.KING_WARDS[0],
    start = { x: ward.x - 5.2, z: ward.z };
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    forestEncounters: true,
    raidIntervalSeconds: 86400,
    hungerEmptyAfterSeconds: Infinity,
  });
  sim.addPlayer(1, undefined, 'storm-challenger');
  sim.placePlayer(1, { ...start, y: sim.collision.terrain.heightAt(start.x, start.z) }, 0);
  for (let i = 0; i < 80; i++) sim.step(Date.now());
  const king = sim.raidersList().find((r) => r.kind === 'hollowKing')!;
  expect(king).toBeDefined();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '' }));
  let timer: ReturnType<typeof setInterval> | undefined;
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    const refresh = () => {
      send(shared.encodeRaiders(sim.raidersList()));
      send(shared.encodeRaiderVitals(king.id, sim.raids.maxHitsOf(king.id)));
      send(shared.encodeKingStorm(sim.kingStormOf(1)));
      for (const event of sim.drainHealthEvents())
        if (event.netId === 1) send(shared.encodeHealth(event));
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
    await page.goto('/?renderer=webgl2&world=storm-shelter&season=summer');
    await page.locator('#home-name').fill('Ward runner');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120000 });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
      timeout: 120000,
    });
    const at = sim.readPlayer(1)!.position;
    sim.raids.placeRaider(king.id, { ...at, z: at.z + 1.5 }, 0);
    sim.raids.blowLands(1, at, Math.PI, { kind: 'swing', step: 1 }, 0, 40000);
    const record = (
      sim.raids as unknown as { raiders: Map<number, { action: shared.ActionState; mode: string }> }
    ).raiders.get(king.id)!;
    shared.beginAction(record.action, shared.ActionKind.Idle);
    record.mode = 'circle';
    const storm = page.getByTestId('king-storm');
    await expect(storm).toHaveAttribute('data-phase', 'warning');
    await expect(storm).toContainText('Exposed');
    await expect(storm).toContainText('Nearest ward');
    await page.evaluate(({ x, z }) => window.acornDebug?.faceTowards(x, z), ward);
    await page.keyboard.down('KeyW');
    try {
      await expect(storm).toHaveAttribute('data-sheltered', 'true', { timeout: 5000 });
    } finally {
      await page.keyboard.up('KeyW');
    }
    const health = sim.healthOf(1);
    await expect(storm).toHaveAttribute('data-phase', 'storm', { timeout: 10000 });
    await expect(storm).toContainText('protected');
    await expect(storm).toHaveAttribute('data-phase', 'recovery', { timeout: 8000 });
    expect(sim.healthOf(1)).toBe(health);
    await expect(storm).toBeHidden({ timeout: 6000 });
    expect(errors).toEqual([]);
  } finally {
    if (timer) clearInterval(timer);
    sim.dispose();
  }
});
test(
  'renders glowing ward shelters and the storm shroud in the WebGL gallery',
  { tag: '@real-drawing' },
  async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '' }));
    for (const before of [true, false]) {
      await page.goto(
        `/?gallery=king-storm&renderer=webgl2&at=8.5&time=.22${before ? '&before' : ''}`,
      );
      await expect(page.locator('body')).toHaveAttribute('data-gallery-ready', 'true', {
        timeout: 120000,
      });
      if (!before) {
        await expect(page.getByTestId('king-storm')).toHaveAttribute('data-phase', 'storm');
        await expect(page.getByTestId('king-storm')).toContainText('Exposed');
      }
      await page.screenshot({ path: testInfo.outputPath(before ? 'before.png' : 'after.png') });
    }
    expect(errors).toEqual([]);
  },
);
