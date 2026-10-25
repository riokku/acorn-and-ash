import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';

test.setTimeout(180000);
test.use({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 0.7 });
test('shows recent shared animal tracks and removes the clue when history expires', async ({
  page,
}) => {
  const sim = new shared.WorldSimulation({ seed: 1234, raidIntervalSeconds: 86400 });
  sim.addPlayer(1);
  sim.placePlayer(1, { x: 0, y: 0, z: -32 }, 0);
  for (let i = 0; i < 200; i++) sim.step(1000 + i * 50);
  const history = sim.animalTracksOf(1);
  expect(history.length).toBeGreaterThan(0);
  const first = history[0]!,
    start = { x: first.x + 0.5, z: first.z };
  sim.placePlayer(1, { ...start, y: sim.collision.terrain.heightAt(start.x, start.z) }, 0);
  let visible = true,
    timer: ReturnType<typeof setInterval> | undefined;
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '' }));
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    const refresh = () => {
      send(shared.encodeAnimalTracks(visible ? history : []));
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
    timer = setInterval(refresh, 250);
  });
  try {
    await page.goto('/?renderer=webgl2&world=fresh-track-clue&season=summer');
    await page.locator('#home-name').fill('Forest tracker');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120000 });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
      timeout: 120000,
    });
    await expect(page.locator('.hud-hint')).toContainText('approach quietly');
    visible = false;
    await expect(page.locator('.hud-hint')).not.toContainText(
      /Fresh rabbit tracks|Fading rabbit tracks|Faint rabbit tracks/,
    );
    expect(errors).toEqual([]);
  } finally {
    if (timer) clearInterval(timer);
    sim.dispose();
  }
});
test(
  'renders fresh hoofprints fading along real ground in the gallery',
  { tag: '@real-drawing' },
  async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '' }));
    for (const before of [true, false]) {
      await page.goto(`/?gallery=fresh-tracks&renderer=webgl2${before ? '&before' : ''}`);
      await expect(page.locator('body')).toHaveAttribute('data-gallery-ready', 'true', {
        timeout: 120000,
      });
      await page.screenshot({ path: testInfo.outputPath(before ? 'before.png' : 'after.png') });
    }
    expect(errors).toEqual([]);
  },
);
