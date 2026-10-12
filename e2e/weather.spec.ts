import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';
import { drawnScreenshot, skipDrawing } from './skip-drawing';
test.use({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 0.5 });
// Includes two actual forest render/readbacks on CPU-only CI machines.
test.setTimeout(300_000);
test(
  'renders shared rain and dusk fireflies without errors',
  { tag: '@real-drawing' },
  async ({ page }) => {
    await skipDrawing(page);
    const sim = new shared.WorldSimulation({
      seed: shared.DEFAULT_WORLD_SEED,
      hungerEmptyAfterSeconds: Infinity,
    });
    sim.addPlayer(1, undefined, 'weather-watcher');
    let clock =
      shared.WEATHER_CYCLE_MS * 12 +
      shared.weatherPlan(shared.DEFAULT_WORLD_SEED, 12).rainStarts +
      1000;
    const errors: string[] = [];
    let pushClock = () => {};
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && /shader|WebGL|WGSL|GLSL/i.test(message.text()))
        errors.push(message.text());
    });
    await page.route('https://fonts.googleapis.com/**', (route) =>
      route.fulfill({ body: '', contentType: 'text/css' }),
    );
    await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
      const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
      pushClock = () =>
        send(shared.encodeSnapshot(sim.tick, clock, sim.lastProcessedSeq(1), sim.snapshotFor(1)));
      send(shared.encodeWelcome(1, shared.DEFAULT_WORLD_SEED, 0, clock));
      send(shared.encodeSpace(0, 0, 0, 0));
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
      // Summer, so the rain is rain: in winter the snow takes over from it (decision 0089).
      await page.goto('/?renderer=webgl2&world=weather-ui&season=summer');
      await page.locator('#home-name').fill('Rain Watcher');
      await page.locator('.home-play').click();
      await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
      await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
        timeout: 120_000,
      });
      await expect(page.locator('canvas').first()).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => window.acornDebug?.weatherEffects().rainDrops ?? 0))
        .toBeGreaterThan(30);
      await drawnScreenshot(
        page,
        process.env.CI ? 'test-results/forest-rain.png' : '/workspace/acorn-forest-rain.png',
      );
      // Dusk on a clear forecast: both effects use the authoritative shared clock.
      // Stay on the same day: jumping twelve days also moves the requested
      // summer calendar into winter, where a blizzard hides the fireflies.
      clock =
        Math.floor(clock / shared.DAY_LENGTH_MS) * shared.DAY_LENGTH_MS +
        shared.DAY_LENGTH_MS * 0.72;
      pushClock();
      await expect
        .poll(() => page.evaluate(() => window.acornDebug?.weatherEffects().fireflies))
        .toBe(32);
      await drawnScreenshot(
        page,
        process.env.CI ? 'test-results/forest-dusk.png' : '/workspace/acorn-forest-dusk.png',
      );
      expect(errors).toEqual([]);
    } finally {
      sim.dispose();
    }
  },
);
