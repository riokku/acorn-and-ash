import { expect, test } from '@playwright/test';
import * as shared from '../packages/shared/src/index';
test.use({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 0.5 });
test.setTimeout(180_000);

test('renders blizzard snow, footprints, and pooled wildfire effects', async ({ page }) => {
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    forestEncounters: false,
    hungerEmptyAfterSeconds: Infinity,
  });
  sim.addPlayer(1, undefined, 'weather-test');
  const clock = shared.DAY_LENGTH_MS * 0.45;
  let weather: 'blizzard' | 'storm' = 'blizzard';
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && /THREE|shader|WebGL/i.test(message.text()))
      errors.push(message.text());
  });
  let sendWeather = () => {};
  let moveObserver = (_x: number, _z: number) => {};
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ body: '', contentType: 'text/css' }),
  );
  await page.route('**/api/session', (route) =>
    route.fulfill({
      json: { signedIn: true, name: 'Weather tester', providers: [], testSignIn: 'automatic' },
    }),
  );
  await page.route('**/api/worlds/*/character', (route) =>
    route.fulfill({ json: { character: null } }),
  );
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    moveObserver = (x, z) => {
      sim.placePlayer(1, { x, y: 0, z }, 0);
      send(shared.encodeSpace(0, x, z, 0));
      send(shared.encodeSnapshot(sim.tick, clock, sim.lastProcessedSeq(1), sim.snapshotFor(1)));
    };
    sendWeather = () =>
      send(shared.encodeWildfire({ ...sim.wildfire.view(clock), testWeather: weather }));
    send(shared.encodeWelcome(1, shared.DEFAULT_WORLD_SEED, 0, clock));
    send(shared.encodeSpace(0, 0, 0, 0));
    send(shared.encodeLakeIce(true));
    sendWeather();
    send(shared.encodeSnapshot(0, clock, 0, sim.snapshotFor(1)));
    socket.onMessage((message) => {
      if (typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, clock));
      if (request?.type === 'input') {
        for (const input of request.inputs) {
          sim.queueInput(1, input);
          sim.step(clock);
        }
        send(shared.encodeSnapshot(sim.tick, clock, sim.lastProcessedSeq(1), sim.snapshotFor(1)));
      }
    });
  });
  try {
    await page.goto('/?renderer=webgl2&world=severe-weather');
    await page.locator('#home-name').fill('Storm Watcher');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
    await expect
      .poll(() => page.evaluate(() => window.acornDebug?.seasonFall().snow ?? 0))
      .toBe(1000);
    await expect.poll(() => page.evaluate(() => window.acornDebug?.snowOnGround())).toBe(1);
    await page.keyboard.down('w');
    await expect
      .poll(() => page.evaluate(() => window.acornDebug?.snowFootprints() ?? 0))
      .toBeGreaterThan(0);
    await page.keyboard.up('w');
    await page.screenshot({ path: 'test-results/blizzard.png' });
    weather = 'storm';
    const props = sim.clearing.props
      .filter((prop) => shared.choppingRuleFor(shared.PROP_KINDS[prop.kind]) && prop.z < -4)
      .sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))
      .slice(0, 3);
    for (const prop of props)
      sim.wildfire.ignite(
        {
          id: prop.id,
          kind: 'tree',
          x: prop.x,
          y: prop.y ?? 0,
          z: prop.z,
          height: shared.propHeight(shared.PROP_KINDS[prop.kind]) * prop.scale,
          radius: 1,
        },
        clock - 15_000,
      );
    sendWeather();
    moveObserver(props[0]!.x, props[0]!.z + 8);
    await page.evaluate(({ x, z }) => window.acornDebug?.faceTowards(x, z), props[0]!);
    await expect
      .poll(() => page.evaluate(() => window.acornDebug?.wildfireEffects().fires))
      .toBe(3);
    await expect
      .poll(() => page.evaluate(() => window.acornDebug?.wildfireEffects().smoke))
      .toBe(84);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/wildfire.png' });
    sim.wildfire.lightning = {
      serial: Math.floor(clock / shared.LIGHTNING_INTERVAL_MS),
      x: props[0]!.x,
      y: 8,
      z: props[0]!.z,
    };
    sendWeather();
    await expect
      .poll(() => page.evaluate(() => window.acornDebug?.wildfireEffects().lightning))
      .toBe(true);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect
      .poll(() => page.evaluate(() => window.acornDebug?.wildfireEffects().embers))
      .toBe(0);
    await expect
      .poll(() => page.evaluate(() => window.acornDebug?.wildfireEffects().lightning))
      .toBe(false);
    expect(errors).toEqual([]);
  } finally {
    sim.dispose();
  }
});
