import { expect, test } from './fixtures';
import { skipDrawing } from './skip-drawing';
import * as shared from '../packages/shared/src/index';
test.use({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 0.75 });
test.setTimeout(240_000);
test('keeps decoration previews through delay and refusal, and ignores broadcasts and late results', async ({
  page,
}) => {
  page.setDefaultTimeout(30_000);
  await skipDrawing(page);
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    hungerEmptyAfterSeconds: Infinity,
  });
  sim.restoreBuiltProps([
    {
      id: 7,
      kind: 'cabin',
      x: 0,
      z: -4.2,
      yaw: 0,
      ownerKey: 'decorator',
      lit: false,
      litUntilMs: null,
    },
  ]);
  sim.addPlayer(1, undefined, 'decorator');
  sim.placePlayer(1, { x: 0, y: 0, z: 2 }, 0, 7);
  Object.assign(sim.inventoryOf(1), { bag: 1, log: 20, stick: 20, flower: 10 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ body: '', contentType: 'text/css' }),
  );
  let complete: (() => void) | undefined;
  let sendWorld: ((data: ArrayBuffer) => void) | undefined;
  let requests = 0;
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    sendWorld = send;
    const refresh = () => {
      send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
      send(
        shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
      );
    };
    send(shared.encodeWelcome(1, shared.DEFAULT_WORLD_SEED, 0, Date.now()));
    send(shared.encodeBuiltProps(sim.builtPropsList(), () => true));
    send(shared.encodeSpace(7, 0, 2, 0));
    send(shared.encodeDecorationState({ pieces: [], reason: null }));
    refresh();
    socket.onMessage((message) => {
      if (typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
      if (request?.type === 'decoration') {
        requests++;
        complete = () => {
          const result = sim.requestDecoration(1, request);
          send(shared.encodeDecorationState(result));
          send(shared.encodeDecorationReply(request, result.reason));
          refresh();
        };
      }
      if (request?.type === 'input')
        for (const input of request.inputs) {
          sim.queueInput(1, input);
          sim.step(Date.now());
        }
      refresh();
    });
  });
  const menu = async () => {
    await page.getByRole('button', { name: 'Decorate', exact: true }).click();
    await expect(page.locator('.decor-panel')).toBeVisible();
  };
  const aim = async (x: number, z: number) => {
    await expect(page.locator('.decor-panel')).toHaveCount(0);
    const point = await page.evaluate(({ x, z }) => window.acornDebug!.screenPoint(x, 0, z), {
      x,
      z,
    });
    expect(point).not.toBeNull();
    await page.mouse.move(point!.x, point!.y);
    await expect
      .poll(() => page.evaluate(() => window.acornDebug!.buildPreview()?.spot?.x))
      .toBeCloseTo(x, 1);
    await expect
      .poll(() => page.evaluate(() => window.acornDebug!.buildPreview()?.spot?.z))
      .toBeCloseTo(z, 1);
    await expect
      .poll(() => page.evaluate(() => window.acornDebug!.buildPreview()?.refusal))
      .toBeNull();
    return point!;
  };
  try {
    await page.goto('/?renderer=webgl2&world=decoration-feedback');
    await page.locator('#home-name').fill('Patient Decorator');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true');
    await menu();
    await page.getByRole('button', { name: /1 · Cedar bench/ }).click();
    const point = await aim(-0.5, -0.125);
    const yaw = await page.evaluate(() => window.acornDebug!.buildPreview()!.spot!.yaw);
    await page.mouse.click(point.x, point.y);
    await expect.poll(() => requests).toBe(1);
    await expect(page.locator('.interaction-note')).toContainText('to be confirmed');
    await expect(page.locator('.hud-hint')).toContainText('Waiting for confirmation');
    sendWorld!(shared.encodeDecorationState({ pieces: [], reason: null }));
    await page.mouse.click(point.x, point.y);
    await page.mouse.wheel(0, 120);
    const tick = sim.tick;
    await expect.poll(() => sim.tick).toBeGreaterThan(tick + 3);
    expect(requests).toBe(1);
    expect(await page.evaluate(() => window.acornDebug!.buildPreview()!.spot!.yaw)).toBe(yaw);
    expect(sim.decorationsList()).toEqual([]);

    // Materials changed after submission. The refusal must leave the preview available.
    sim.inventoryOf(1).log = 0;
    complete!();
    await expect(page.locator('.interaction-note')).toHaveText('Gather the listed materials first');
    await expect
      .poll(() => page.evaluate(() => window.acornDebug!.buildPreview()?.kind))
      .toBe('cedarBench');
    expect(sim.decorationsList()).toEqual([]);
    sim.inventoryOf(1).log = 20;
    sendWorld!(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
    await aim(-0.5, -0.125);
    await page.mouse.click(point.x, point.y);
    await expect.poll(() => requests).toBe(2);

    // Hiding a submitted preview is not cancellation. Its late result must leave a new preview alone.
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => window.acornDebug!.buildPreview())).toBeNull();
    await menu();
    await page.getByRole('button', { name: /2 · Timber table/ }).click();
    await aim(1.5, 0.4);
    complete!();
    await expect(page.locator('.interaction-note')).toHaveText('Cedar bench placed.');
    await expect
      .poll(() => page.evaluate(() => window.acornDebug!.buildPreview()?.kind))
      .toBe('timberTable');
    expect(sim.decorationsList()).toHaveLength(1);
    const nextPoint = await aim(1.5, 0.4);
    await page.mouse.click(nextPoint.x, nextPoint.y);
    await expect.poll(() => requests).toBe(3);
    complete!();
    await expect(page.locator('.interaction-note')).toHaveText('Timber table placed.');
    await expect.poll(() => page.evaluate(() => window.acornDebug!.buildPreview())).toBeNull();
    expect(sim.decorationsList()).toHaveLength(2);
    expect(errors).toEqual([]);
  } finally {
    sim.dispose();
  }
});
