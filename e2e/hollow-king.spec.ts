import { expect, test } from './fixtures';
import { drawnScreenshot } from './skip-drawing';
import * as shared from '../packages/shared/src/index';

test.use({ viewport: { width: 1100, height: 720 }, deviceScaleFactor: 0.5 });
test.setTimeout(180_000);

test('shows the giant king and his authoritative health in Crownbreaker Hold', async ({
  page,
}, testInfo) => {
  const hold = shared.CROWNBREAKER_HOLD;
  const start = { x: hold.x, z: hold.z - 19 };
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    forestEncounters: true,
    raidIntervalSeconds: 86400,
    hungerEmptyAfterSeconds: Infinity,
  });
  sim.addPlayer(1, undefined, 'king-visitor');
  sim.addPlayer(2, undefined, 'king-helper');
  sim.placePlayer(
    2,
    { x: start.x + 1.8, y: sim.collision.terrain.heightAt(start.x + 1.8, start.z), z: start.z },
    0,
  );
  sim.giveTestGear(1, ['kingsRequiem']);
  expect(sim.inventoryOf(1).kingsRequiem).toBe(1);
  sim.placePlayer(1, { ...start, y: sim.collision.terrain.heightAt(start.x, start.z) }, Math.PI);
  for (let i = 0; i < 60; i++) sim.step(Date.now());
  const king = sim.raidersList().find((r) => r.kind === 'hollowKing');
  expect(king).toBeDefined();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '' }));
  let timer: ReturnType<typeof setInterval> | undefined;
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    const equipment = () => {
      send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
      send(shared.encodeWorn(sim.wornList()));
      send(shared.encodeEquipped(sim.equippedList()));
    };
    const refresh = () => {
      for (const hit of sim.raids.drainHits()) send(shared.encodeRaiderHit(hit));
      for (const news of sim.raids.drainNews()) send(shared.encodeRaidNews(news));
      send(shared.encodeDroppedPiles(sim.droppedPilesList(1)));
      send(shared.encodeAllies(sim.alliesOf(1)));
      send(shared.encodeRaiders(sim.raidersList()));
      send(shared.encodeRaiderVitals(king!.id, sim.raids.maxHitsOf(king!.id)));
      send(
        shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
      );
    };
    send(shared.encodeWelcome(1, sim.seed, 0, Date.now()));
    send(shared.encodeSpace(0, start.x, start.z, Math.PI));
    equipment();
    send(
      shared.encodeRoster(
        [1, 2].map((netId) => ({
          netId,
          name: netId === 1 ? 'King challenger' : 'Rowan',
          character: shared.DEFAULT_CHARACTER,
          color: shared.DEFAULT_TINT_COLOR,
          skin: shared.DEFAULT_SKIN_TONE,
        })),
      ),
    );
    refresh();
    socket.onMessage((message) => {
      if (typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
      if (request?.type === 'input') sim.queueInputs(1, request.inputs);
      if (request?.type === 'gear' && request.action === 'wear') {
        const change = sim.wearGear(1, request.item, request.slot);
        if (!change.ok) send(shared.encodeGearRefused(change.reason));
        equipment();
      }
    });
    timer = setInterval(() => {
      sim.step(Date.now());
      refresh();
    }, shared.TICK_MILLISECONDS);
  });
  try {
    await page.goto('/?renderer=webgl2&world=king-encounter&season=summer');
    await page.locator('#home-name').fill('King challenger');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
      timeout: 120_000,
    });
    await expect(page.getByTestId('world-boss')).toContainText('The Hollow King');
    await expect(
      page.getByRole('progressbar', { name: "The Hollow King's health" }),
    ).toHaveAttribute('aria-valuenow', '220');
    await page.keyboard.press('KeyB');
    await page.getByTestId('pack-slot-kingsRequiem').click();
    await page.keyboard.press('KeyB');
    await expect
      .poll(() => page.evaluate(() => window.acornDebug?.equippedItem()))
      .toBe('kingsRequiem');
    expect(sim.wornOf(1).mainHand).toBe('kingsRequiem');
    (
      sim as unknown as { raiderStrikesPlayer(id: number, damage: number, tick: number): void }
    ).raiderStrikesPlayer(2, 1000, sim.tick);
    await expect(page.getByTestId('allies')).toContainText('Hold E');
    await page.keyboard.down('KeyE');
    await expect.poll(() => sim.healthOf(2)).toBe(35);
    await page.keyboard.up('KeyE');
    await expect(page.getByTestId('allies')).not.toContainText('Needs help');
    await page.evaluate(({ x, z }) => window.acornDebug?.faceTowards(x, z), hold);
    await drawnScreenshot(page, testInfo.outputPath('crownbreaker-hold.png'));
    const player = sim.snapshotFor(1).find((entity) => entity.netId === 1)!;
    sim.raids.placeRaider(king!.id, { x: player.x, y: player.y, z: player.z + 1.5 }, 0);
    sim.raids.blowLands(1, player, Math.PI, { kind: 'swing', step: 1 }, 0, 200000);
    const victory = page.getByTestId('king-victory');
    await expect(victory).toBeVisible();
    const victoryKey = await victory.getAttribute('data-victory-key');
    await expect(victory.locator('.king-victory-reward')).toHaveCSS('opacity', '1', {
      timeout: 8000,
    });
    await expect(victory).toHaveAttribute('data-victory-key', victoryKey!);
    await page.keyboard.down('KeyD');
    try {
      await expect
        .poll(
          () => {
            const now = sim.snapshotFor(1).find((entity) => entity.netId === 1)!;
            return Math.hypot(now.x - player.x, now.z - player.z);
          },
          { timeout: 5000 },
        )
        .toBeGreaterThan(0.2);
    } finally {
      await page.keyboard.up('KeyD');
    }
    await expect(victory).toBeHidden({ timeout: 15000 });
    expect(sim.droppedPilesList(1).some((pile) => pile.item === 'kingsRequiem')).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    if (timer) clearInterval(timer);
    sim.dispose();
  }
});
