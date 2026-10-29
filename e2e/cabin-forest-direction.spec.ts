import { mkdir, writeFile } from 'node:fs/promises';
import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';
import { drawnScreenshot, skipDrawing } from './skip-drawing';

// Opt-in, controlled poses from a measured walk along the authored Cedar trail.
test.use({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 1, actionTimeout: 120_000 });
test.setTimeout(600_000);
test('captures the cabin and forest visual review', { tag: '@real-drawing' }, async ({ page }) => {
  const dir = process.env.CABIN_FOREST_SHOTS;
  test.skip(!dir, 'Set CABIN_FOREST_SHOTS to capture the evidence.');
  await skipDrawing(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ body: '' }));
  await page.route('**/api/session', (route) =>
    route.fulfill({
      json: { signedIn: true, name: 'Visitor', providers: [], testSignIn: 'automatic' },
    }),
  );
  await page.route('**/api/worlds/*/character', (route) =>
    route.fulfill({
      json:
        route.request().method() === 'GET'
          ? { made: false }
          : { made: true, ...route.request().postDataJSON() },
    }),
  );
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    forestEncounters: false,
    hungerEmptyAfterSeconds: Infinity,
  });
  const review = process.env.CABIN_REVIEW ?? 'trail';
  expect(['trail', 'home', 'route', 'combat', 'stress']).toContain(review);
  await mkdir(dir!, { recursive: true });
  const legalHome = review !== 'stress';
  const home = {
    id: 7,
    kind: 'cabin',
    x: legalHome ? -2 : 19,
    z: legalHome ? -4.2 : 5,
    yaw: 0,
    lit: true,
  } as const;
  sim.restoreBuiltProps([
    { ...home, kind: legalHome ? 'teepee' : 'cabin', ownerKey: 'traveller', litUntilMs: null },
  ]);
  sim.addPlayer(
    1,
    legalHome
      ? { netId: 1, x: 0, y: 0, z: 0, facingYaw: 0, items: [], hunger: 100, homeSkills: 7 }
      : undefined,
    'traveller',
  );
  if (legalHome) {
    Object.assign(sim.inventoryOf(1), { log: 120, stick: 24, bone: 20 });
    sim.placePlayer(1, { x: 0, y: sim.collision.terrain.heightAt(0, 0), z: 0 }, 0);
    sim.requestBuild(1, { kind: 'cabin', x: home.x, z: home.z, yaw: 0 });
    sim.queueInput(1, shared.createInput(1, 0, 0, 0));
    sim.step(1000);
    expect(sim.drainBuildReplies()[0]?.reason).toBeNull();
    expect(sim.builtPropsList().find((prop) => prop.id === home.id)?.kind).toBe('cabin');
    // Restore the same validated upgrade as lit to review the warm home.
    sim.restoreBuiltProps([{ ...home, ownerKey: 'traveller', litUntilMs: null }]);
  }
  sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0, home.id);
  let clock = shared.DAY_LENGTH_MS * 10 + shared.DAY_LENGTH_MS / 2;
  let weather: 'storm' | null = null;
  let publish = (_space: number, _x: number, _z: number) => {};
  let update = () => {};
  let addCompanion = () => {};
  let closed = false;
  const setCondition = (condition: string) => {
    expect(['day', 'night', 'storm']).toContain(condition);
    const phase = condition === 'night' ? 0 : shared.DAY_LENGTH_MS / 2;
    clock += (phase - (clock % shared.DAY_LENGTH_MS) + shared.DAY_LENGTH_MS) % shared.DAY_LENGTH_MS;
    weather = condition === 'storm' ? 'storm' : null;
    update();
  };
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    socket.onClose(() => {
      closed = true;
    });
    const send = (data: ArrayBuffer) => {
      if (!closed) socket.send(Buffer.from(data));
    };
    const snapshot = () => {
      send(shared.encodeRaiders(sim.raidersList()));
      send(shared.encodeSnapshot(sim.tick, clock, sim.lastProcessedSeq(1), sim.snapshotFor(1)));
    };
    update = () => {
      send(shared.encodeWildfire({ ...sim.wildfire.view(clock), testWeather: weather }));
      snapshot();
    };
    publish = (space, x, z) => {
      sim.placePlayer(
        1,
        { x, y: space === 0 ? sim.collision.terrain.heightAt(x, z) : 0, z },
        0,
        space,
      );
      send(shared.encodeSpace(space, x, z, 0));
      update();
    };
    send(shared.encodeWelcome(1, shared.DEFAULT_WORLD_SEED, 0, clock));
    send(
      shared.encodeRoster([
        {
          netId: 1,
          name: 'Traveller',
          character: 'ranger',
          color: 'amber',
          skin: shared.DEFAULT_SKIN_TONE,
        },
      ]),
    );
    addCompanion = () => {
      sim.addPlayer(2, undefined, 'companion');
      const x = home.x + 5;
      const z = home.z + 5;
      sim.placePlayer(2, { x, y: sim.collision.terrain.heightAt(x, z), z }, 0);
      send(
        shared.encodeRoster([
          {
            netId: 1,
            name: 'Traveller',
            character: 'ranger',
            color: 'amber',
            skin: shared.DEFAULT_SKIN_TONE,
          },
          {
            netId: 2,
            name: 'Rowan',
            character: 'ranger',
            color: 'amber',
            skin: shared.DEFAULT_SKIN_TONE,
          },
        ]),
      );
      update();
    };
    send(shared.encodeEquipped([{ netId: 1, item: sim.equippedItemOf(1) }]));
    send(shared.encodeBuiltProps(sim.builtPropsList(), () => true));
    send(shared.encodeInventory([]));
    publish(home.id, 0, 0);
    socket.onMessage((message) => {
      if (closed || typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, clock));
      if (request?.type === 'input') {
        for (const input of request.inputs) {
          sim.queueInput(1, input);
          clock += shared.TICK_MILLISECONDS;
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
          let frames = 45;
          const next = () => {
            if (--frames <= 0) resolve();
            else requestAnimationFrame(next);
          };
          requestAnimationFrame(next);
        }),
    );
  const move = async (x: number, z: number, targetX: number, targetZ: number) => {
    publish(shared.OUTDOORS, x, z);
    await expect
      .poll(() => page.evaluate(() => window.acornDebug?.space()), { timeout: 60_000 })
      .toBe(shared.OUTDOORS);
    await expect
      .poll(() => page.evaluate(() => window.acornDebug?.localPosition().x), { timeout: 60_000 })
      .toBeCloseTo(x, 0);
    await expect
      .poll(() => page.evaluate(() => window.acornDebug?.localPosition().z), { timeout: 60_000 })
      .toBeCloseTo(z, 0);
    await page.evaluate(({ x, z }) => window.acornDebug?.faceTowards(x, z), {
      x: targetX,
      z: targetZ,
    });
  };
  try {
    const renderer = process.env.CABIN_RENDERER === 'auto' ? '' : '&renderer=webgl2';
    await page.goto(`/?world=cabin-forest-direction&season=summer${renderer}`);
    await page.getByRole('textbox', { name: /what should we call you/i }).fill('Traveller');
    await page.getByRole('button', { name: 'Enter World' }).click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
    const bundle = await page.evaluate(
      () =>
        performance
          .getEntriesByType('resource')
          .map((entry) => entry.name)
          .find((name) => /\/assets\/index-[^/]+\.js/.test(name)) ?? null,
    );
    expect(bundle).not.toBeNull();
    await writeFile(
      `${dir}/capture-metadata.json`,
      JSON.stringify(
        {
          review,
          conditions:
            review === 'trail' || (review === 'home' && !process.env.CABIN_CONDITION)
              ? ['day', 'night', 'storm']
              : [
                  review === 'home' || review === 'route' || review === 'combat'
                    ? (process.env.CABIN_CONDITION ?? 'day')
                    : 'day',
                ],
          renderer: process.env.CABIN_RENDERER === 'auto' ? 'auto' : 'webgl2',
          bundle,
          home: legalHome
            ? { x: home.x, z: home.z, validatedUpgrade: true }
            : { x: home.x, z: home.z, validatedUpgrade: false },
        },
        null,
        2,
      ),
    );
    if (review === 'stress') {
      await move(29, 15, 19, 5);
      await settle();
      const camera = await page.evaluate(() =>
        (window.acornDebug as unknown as { cameraView(): unknown }).cameraView(),
      );
      await writeFile(`${dir}/camera.json`, JSON.stringify(camera, null, 2));
      await drawnScreenshot(page, `${dir}/stress-return.png`);
      expect(errors).toEqual([]);
      return;
    }
    if (review === 'home') {
      const conditions = process.env.CABIN_CONDITION
        ? [process.env.CABIN_CONDITION]
        : ['day', 'night', 'storm'];
      for (const condition of conditions) {
        setCondition(condition);
        await move(home.x, home.z + 10, 48, 16);
        await settle();
        await drawnScreenshot(page, `${dir}/${condition}-departure.png`);
        await move(home.x + 10, home.z + 10, home.x, home.z);
        await settle();
        await drawnScreenshot(page, `${dir}/${condition}-return-home.png`);
      }
      await move(home.x + 10, home.z + 10, home.x + 5, home.z + 5);
      addCompanion();
      await settle();
      await drawnScreenshot(page, `${dir}/remote-companion.png`);
      expect(errors).toEqual([]);
      return;
    }
    if (review === 'route' || review === 'combat') {
      const condition = process.env.CABIN_CONDITION ?? 'day';
      setCondition(condition);
      // These are controlled route poses, with a real input-driven walk between
      // the two documented trail positions. They are not an online playthrough.
      if (review === 'route') {
        await move(home.x, home.z + 10, 48, 16);
        await settle();
        await drawnScreenshot(page, `${dir}/departure.png`);
        await move(48, 16, 64, 39);
        await settle();
        await drawnScreenshot(page, `${dir}/trail-start.png`);
        await page.keyboard.down('KeyW');
        const trace = await page.evaluate(
          (height) =>
            new Promise<Array<{ time: number; x: number; z: number; span: number | null }>>(
              (resolve) => {
                const start = window.acornDebug!.localPosition();
                const started = performance.now();
                const samples: Array<{ time: number; x: number; z: number; span: number | null }> =
                  [];
                const frame = (time: number) => {
                  const debug = window.acornDebug!;
                  const p = debug.localPosition();
                  const feet = debug.screenPoint(p.x, p.y, p.z);
                  const head = debug.screenPoint(p.x, p.y + height, p.z);
                  samples.push({
                    time: time - started,
                    x: p.x,
                    z: p.z,
                    span: feet && head ? Math.abs(feet.y - head.y) : null,
                  });
                  if (Math.hypot(p.x - start.x, p.z - start.z) >= 22.4 || time - started > 90000)
                    resolve(samples);
                  else requestAnimationFrame(frame);
                };
                requestAnimationFrame(frame);
              },
            ),
          shared.PLAYER_HEIGHT,
        );
        await page.keyboard.up('KeyW');
        await writeFile(`${dir}/walk-trace.json`, JSON.stringify(trace, null, 2));
        const start = trace[0]!;
        const end = trace[trace.length - 1]!;
        expect(Math.hypot(end.x - start.x, end.z - start.z)).toBeGreaterThan(20);
        await settle();
        await drawnScreenshot(page, `${dir}/walk-destination.png`);
      } else {
        await move(60.784706229546046, 34.37801520497257, 76.78470622954605, 57.37801520497257);
        await settle();
      }
      if (review === 'combat') {
        // Stage a single normal AI raider; simulation runs while the browser
        // checks the actual displayed phase in the same frame as each image.
        const player = sim.snapshotFor(1).find((entity) => entity.netId === 1)!;
        const raid = sim.raids.startRaid(1, ['warrior']);
        expect(raid).not.toBeNull();
        const raider = sim.raidersList()[0]!;
        const x = player.x + 1.4;
        const z = player.z + 2;
        sim.raids.placeRaider(raider.id, { x, y: sim.collision.terrain.heightAt(x, z), z }, 0);
        update();
        await page.evaluate(({ x, z }) => window.acornDebug?.faceTowards(x, z), { x, z });
        for (const name of ['windup', 'swing', 'recovery'] as const) {
          const captured = await page.evaluate(
            ({ id, name, windup, swing, impacts, ends, windups, targetHeight }) =>
              new Promise<{
                png: string;
                display: {
                  kind: number;
                  step: number;
                  age: number;
                  warning: { visible: boolean; opacity: number };
                };
                health: number;
                point: { x: number; y: number };
              } | null>((resolve) => {
                const host = window as unknown as {
                  acornE2eDrawing?: (enabled: boolean) => void;
                  acornDebug: {
                    raiderDisplay(id: number): {
                      kind: number;
                      step: number;
                      age: number;
                      warning: { visible: boolean; opacity: number };
                    } | null;
                    raiders(): Array<{ id: number; x: number; z: number }>;
                    health(): number;
                    screenPoint(x: number, y: number, z: number): { x: number; y: number } | null;
                  };
                };
                const start = performance.now();
                const matches = (d: ReturnType<typeof host.acornDebug.raiderDisplay>) => {
                  if (!d) return false;
                  if (name === 'windup')
                    return d.kind === windup && d.age < windups[d.step]! && d.warning.visible;
                  if (d.kind !== swing || d.step < 1) return false;
                  const impact = impacts[d.step - 1]!;
                  return name === 'swing'
                    ? Math.abs(d.age - impact) < 2
                    : d.age >= impact + 2 && d.age < ends[d.step - 1]! && !d.warning.visible;
                };
                const scan = () => {
                  if (performance.now() - start > 90000 || host.acornDebug.health() <= 0) {
                    resolve(null);
                    return;
                  }
                  if (!matches(host.acornDebug.raiderDisplay(id))) {
                    requestAnimationFrame(scan);
                    return;
                  }
                  host.acornE2eDrawing?.(true);
                  requestAnimationFrame(() => {
                    const display = host.acornDebug.raiderDisplay(id);
                    const enemy = host.acornDebug.raiders().find((r) => r.id === id);
                    const point = enemy
                      ? host.acornDebug.screenPoint(enemy.x, targetHeight, enemy.z)
                      : null;
                    const health = host.acornDebug.health();
                    const png = document
                      .querySelector<HTMLCanvasElement>('#scene')!
                      .toDataURL('image/png');
                    host.acornE2eDrawing?.(false);
                    if (
                      display &&
                      matches(display) &&
                      health > 0 &&
                      point &&
                      point.x > 0 &&
                      point.x < 960 &&
                      point.y > 0 &&
                      point.y < 640
                    )
                      resolve({ png, display, health, point });
                    else requestAnimationFrame(scan);
                  });
                };
                requestAnimationFrame(scan);
              }),
            {
              id: raider.id,
              name,
              windup: shared.ActionKind.Windup,
              swing: shared.ActionKind.Swing,
              impacts: shared.LIGHT_COMBO.map((move) => move.impact),
              ends: shared.LIGHT_COMBO.map((move) => move.end),
              windups: shared.WINDUP_TICKS,
              targetHeight: sim.collision.terrain.heightAt(x, z) + 0.9,
            },
          );
          expect(captured).not.toBeNull();
          if (captured) {
            await writeFile(
              `${dir}/skeleton-${name}.png`,
              Buffer.from(captured.png.split(',')[1]!, 'base64'),
            );
            await writeFile(
              `${dir}/skeleton-${name}.json`,
              JSON.stringify(
                { display: captured.display, health: captured.health, point: captured.point },
                null,
                2,
              ),
            );
          }
        }
      }
      if (review === 'route') {
        await move(home.x + 10, home.z + 10, home.x, home.z);
        await settle();
        await drawnScreenshot(page, `${dir}/return-home.png`);
      }
      expect(errors).toEqual([]);
      return;
    }
    await move(60.784706229546046, 34.37801520497257, 76.78470622954605, 57.37801520497257);
    await settle();
    await drawnScreenshot(page, `${dir}/day-after-walk-position.png`);
    for (const condition of ['day', 'night', 'storm'] as const) {
      setCondition(condition);
      await move(48, 16, 64, 39);
      await settle();
      await drawnScreenshot(page, `${dir}/${condition}-trail.png`);
    }
    expect(errors).toEqual([]);
  } finally {
    closed = true;
    sim.dispose();
  }
});
