import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';
import { drawnScreenshot, skipDrawing } from './skip-drawing';

// Optional actual-world comparison captures; gameplay tests keep their fast draw fixture.
test.use({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 1 });
test.setTimeout(300_000);
test(
  'captures the same clearing at night, in a blizzard, and at noon',
  { tag: '@real-drawing' },
  async ({ page }) => {
    test.skip(
      !process.env.READABILITY_SHOTS,
      'Run with READABILITY_SHOTS for before/after captures.',
    );
    await skipDrawing(page);
    const sim = new shared.WorldSimulation({
      seed: shared.DEFAULT_WORLD_SEED,
      forestEncounters: false,
      hungerEmptyAfterSeconds: Infinity,
    });
    sim.addPlayer(1, undefined, 'night-watcher');
    sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0);
    let clock = shared.DAY_LENGTH_MS * 10;
    let weather: 'blizzard' | null = null;
    let update = () => {};
    let closed = false;
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && /shader|WebGL|WGSL|GLSL/i.test(message.text()))
        errors.push(message.text());
    });
    await page.route('https://fonts.googleapis.com/**', (r) =>
      r.fulfill({ body: '', contentType: 'text/css' }),
    );
    await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
      socket.onClose(() => {
        closed = true;
      });
      const send = (data: ArrayBuffer) => {
        if (!closed) socket.send(Buffer.from(data));
      };
      const snapshot = () =>
        send(shared.encodeSnapshot(sim.tick, clock, sim.lastProcessedSeq(1), sim.snapshotFor(1)));
      update = () => {
        send(shared.encodeWildfire({ ...sim.wildfire.view(clock), testWeather: weather }));
        snapshot();
      };
      send(shared.encodeWelcome(1, shared.DEFAULT_WORLD_SEED, 0, clock));
      send(shared.encodeSpace(0, 0, 0, 0));
      update();
      socket.onMessage((message) => {
        if (typeof message === 'string') return;
        const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
        if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, clock));
        if (request?.type === 'input') {
          for (const input of request.inputs) {
            sim.queueInput(1, input);
            sim.step(clock);
          }
          snapshot();
        }
      });
    });
    const settle = () =>
      page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            let n = 180;
            function frame() {
              if (--n <= 0) resolve();
              else requestAnimationFrame(frame);
            }
            requestAnimationFrame(frame);
          }),
      );
    try {
      await page.goto('/?renderer=webgl2&world=night-readability&season=summer');
      await page.locator('#home-name').fill('Night Walker');
      await page.locator('.home-play').click();
      await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
      await settle();
      await drawnScreenshot(page, `${process.env.READABILITY_SHOTS}/night.png`);
      weather = 'blizzard';
      update();
      await expect.poll(() => page.evaluate(() => window.acornDebug?.snowOnGround())).toBe(1);
      await settle();
      await drawnScreenshot(page, `${process.env.READABILITY_SHOTS}/blizzard.png`);
      weather = null;
      clock += shared.DAY_LENGTH_MS / 2;
      update();
      await settle();
      await drawnScreenshot(page, `${process.env.READABILITY_SHOTS}/day.png`);
      expect(errors).toEqual([]);
    } finally {
      closed = true;
      sim.dispose();
    }
  },
);
