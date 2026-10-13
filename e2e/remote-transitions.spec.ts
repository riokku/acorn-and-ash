import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';

test.use({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 0.5 });
test.setTimeout(180_000);
test('places remote respawns directly rather than drawing them through the intervening world', async ({
  page,
}) => {
  let remoteX = 4;
  let seq = 0;
  let closed = false;
  let publish = () => {};
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const actor = (netId: number, x: number): shared.SnapshotEntity => ({
    netId,
    x,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: 0,
    flags: 0,
    action: 0,
    actionAge: 0,
    actionHeading: 0,
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
    publish = () =>
      send(shared.encodeSnapshot(seq, Date.now(), seq, [actor(1, 0), actor(2, remoteX)]));
    send(shared.encodeWelcome(1, shared.DEFAULT_WORLD_SEED, 0, Date.now()));
    publish();
    socket.onMessage((message) => {
      if (closed || typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
      if (request?.type === 'input') {
        seq = request.inputs.at(-1)!.seq;
        publish();
      }
    });
  });
  try {
    await page.goto('/?renderer=webgl2&world=remote-transition');
    await page.locator('#home-name').fill('Observer');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
    await expect
      .poll(() =>
        page.evaluate(() => window.acornDebug?.remotePlayers().find((p) => p.netId === 2)?.x),
      )
      .toBe(4);
    remoteX = 28;
    publish();
    const samples = await page.evaluate(
      () =>
        new Promise<number[]>((resolve) => {
          const samples: number[] = [];
          let frames = 30;
          function sample() {
            const p = window.acornDebug?.remotePlayers().find((p) => p.netId === 2);
            if (p) samples.push(p.x);
            if (--frames <= 0) resolve(samples);
            else requestAnimationFrame(sample);
          }
          requestAnimationFrame(sample);
        }),
    );
    expect(samples.length).toBeGreaterThan(0);
    expect(samples.every((x) => x <= 4.01 || x >= 27.99)).toBe(true);
    expect(samples.at(-1)).toBe(28);
    expect(errors).toEqual([]);
  } finally {
    closed = true;
  }
});
