import { expect, test } from './fixtures';
import type { WebSocketRoute } from '@playwright/test';
import * as shared from '../packages/shared/src/index';

test.use({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 0.5 });
test.setTimeout(180_000);

async function frames(page: import('@playwright/test').Page, count = 20) {
  await page.evaluate(
    (n) =>
      new Promise<void>((resolve) => {
        function frame() {
          if (--n <= 0) resolve();
          else requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      }),
    count,
  );
}

test('pauses held movement through an outage and waits for the returning player snapshot', async ({
  page,
}) => {
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    hungerEmptyAfterSeconds: Infinity,
  });
  sim.addPlayer(1, undefined, 'returning-player');
  sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0);
  let active: WebSocketRoute | undefined;
  let allowConnection = true;
  let holdSnapshot = false;
  let attempts = 0;
  let movingInputs = 0;
  let inputsBeforeReady = 0;
  let releaseSnapshot = () => {};
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', (r) =>
    r.fulfill({ body: '', contentType: 'text/css' }),
  );
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    attempts++;
    if (!allowConnection) {
      socket.close({ code: 1000 });
      return;
    }
    active = socket;
    let closed = false;
    let ready = !holdSnapshot;
    socket.onClose(() => {
      closed = true;
    });
    const send = (data: ArrayBuffer) => {
      if (!closed) socket.send(Buffer.from(data));
    };
    const snapshot = () =>
      send(
        shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
      );
    releaseSnapshot = () => {
      ready = true;
      snapshot();
    };
    send(shared.encodeWelcome(1, shared.DEFAULT_WORLD_SEED, 0, Date.now()));
    send(shared.encodeSpace(0, 0, 0, 0));
    if (ready) snapshot();
    socket.onMessage((message) => {
      if (closed || typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
      if (request?.type !== 'input') return;
      if (!ready) inputsBeforeReady += request.inputs.length;
      movingInputs += request.inputs.filter((i) => i.moveX !== 0 || i.moveZ !== 0).length;
      sim.queueInputs(1, request.inputs);
      for (const _input of request.inputs) sim.step(Date.now());
      if (ready) snapshot();
    });
  });
  const position = () => page.evaluate(() => window.acornDebug!.localPosition());
  try {
    await page.goto('/?renderer=webgl2&world=reconnection-polish');
    await page.locator('#home-name').fill('Returning Walker');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
    const start = await position();
    await page.keyboard.down('KeyW');
    await expect
      .poll(async () => {
        const p = await position();
        return Math.hypot(p.x - start.x, p.z - start.z);
      })
      .toBeGreaterThan(1);
    allowConnection = false;
    active!.close({ code: 1000 });
    await expect(page.locator('.connection-notice')).toContainText('Actions are paused');
    const stopped = await position();
    await page.keyboard.down('KeyW');
    await frames(page);
    expect(await position()).toEqual(stopped);
    holdSnapshot = true;
    allowConnection = true;
    const oldAttempts = attempts;
    await expect.poll(() => attempts).toBeGreaterThan(oldAttempts);
    await expect(page.locator('.connection-notice')).toHaveText(
      'Connecting to the world… Actions are paused.',
    );
    await page.keyboard.down('KeyW');
    await frames(page);
    expect(inputsBeforeReady).toBe(0);
    releaseSnapshot();
    await expect(page.locator('.connection-notice')).toBeHidden();
    const resumed = await position();
    const count = movingInputs;
    await frames(page);
    expect(await position()).toEqual(resumed);
    expect(movingInputs).toBe(count);
    await page.keyboard.up('KeyW');
    await page.keyboard.down('KeyW');
    await expect
      .poll(async () => {
        const p = await position();
        return Math.hypot(p.x - resumed.x, p.z - resumed.z);
      })
      .toBeGreaterThan(1);
    await page.keyboard.up('KeyW');
    expect(errors).toEqual([]);
  } finally {
    allowConnection = false;
    active?.close({ code: 1000 });
    sim.dispose();
  }
});
