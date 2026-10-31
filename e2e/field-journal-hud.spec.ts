import { mkdir, writeFile } from 'node:fs/promises';
import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';
import { drawnScreenshot, skipDrawing } from './skip-drawing';

test.use({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1, actionTimeout: 120_000 });
test.setTimeout(600_000);
test('controlled field journal HUD review', { tag: '@real-drawing' }, async ({ page }) => {
  const dir = process.env.HUD_REVIEW_SHOTS;
  test.skip(!dir, 'Set HUD_REVIEW_SHOTS to capture the evidence.');
  await mkdir(dir!, { recursive: true });
  await skipDrawing(page);
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
  sim.addPlayer(
    1,
    { netId: 1, x: 0, y: 0, z: 0, facingYaw: 0, hunger: 76, health: 92, items: [] },
    'review',
  );
  Object.assign(sim.inventoryOf(1), { axe: 1, rod: 1, roastedMeat: 2, bag: 1, stick: 12, log: 8 });
  let clock = shared.DAY_LENGTH_MS * 10 + shared.DAY_LENGTH_MS / 2;
  let update = () => {};
  let closed = false;
  let warn = () => {};
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    socket.onClose(() => {
      closed = true;
    });
    const send = (data: ArrayBuffer) => {
      if (!closed) socket.send(Buffer.from(data));
    };
    update = () => {
      send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
      send(shared.encodeEquipped(sim.equippedList()));
      send(shared.encodeSnapshot(sim.tick, clock, sim.lastProcessedSeq(1), sim.snapshotFor(1)));
    };
    send(shared.encodeWelcome(1, shared.DEFAULT_WORLD_SEED, 0, clock));
    send(shared.encodeSpace(0, 0, 0, 0));
    send(shared.encodeHunger({ netId: 1, hunger: 76, ate: null }));
    send(shared.encodeHealth({ netId: 1, health: 92, knockedOut: false, dodged: false }));
    warn = () => {
      send(shared.encodeHunger({ netId: 1, hunger: 8, ate: null }));
      send(shared.encodeHealth({ netId: 1, health: 15, knockedOut: false, dodged: false }));
    };
    update();
    socket.onMessage((message) => {
      if (closed || typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, clock));
      if (request?.type === 'useItem') sim.useItem(1, request.item);
      if (request?.type === 'gear' && request.action === 'wear') {
        sim.wearGear(1, request.item, request.slot);
        send(shared.encodeWorn(sim.wornList()));
      }
      if (request?.type === 'input')
        for (const input of request.inputs) {
          sim.queueInput(1, input);
          clock += shared.TICK_MILLISECONDS;
          sim.step(clock);
        }
      update();
    });
  });
  try {
    await page.goto('/?renderer=webgl2&world=field-journal-review&season=summer');
    await page.locator('#home-name').fill('Traveller');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
      timeout: 120_000,
    });
    await expect(page.getByTestId('hunger-bar')).not.toHaveClass(/hunger-bar-low/);
    await expect(page.getByTestId('health-bar')).not.toHaveClass(/health-bar-low/);
    const bundle = await page.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .find((name) => /\/assets\/index-[^/]+\.js/.test(name)),
    );
    await writeFile(
      `${dir}/capture-metadata.json`,
      JSON.stringify(
        {
          bundle,
          viewport: [1366, 768],
          method:
            'Controlled frozen view: real game canvas rendered for one frame, then displayed behind the live HTML HUD; not continuous gameplay or a performance measurement.',
          conditions: ['day', 'night'],
          health: 92,
          hunger: 76,
          warningHealth: 15,
          warningHunger: 8,
          pinnedSlot1: 'axe (dragged from pack)',
          reusedBackgrounds: process.env.HUD_REUSE_BACKGROUNDS === '1',
          baselineCapture: process.env.HUD_CAPTURE_BASELINE === '1',
        },
        null,
        2,
      ),
    );
    const freeze = async (name: string) => {
      await page
        .locator('#hud-review-background')
        .evaluateAll((els) => els.forEach((el) => el.remove()));
      await page.locator('#scene').evaluate((el) => {
        (el as HTMLElement).style.visibility = 'visible';
      });
      if (process.env.HUD_REUSE_BACKGROUNDS !== '1')
        await drawnScreenshot(page, `${dir}/${name}-canvas.png`);
      const png = await import('node:fs/promises').then((fs) =>
        fs.readFile(`${dir}/${name}-canvas.png`, 'base64'),
      );
      await page.evaluate((data) => {
        const canvas = document.querySelector<HTMLElement>('#scene')!;
        canvas.style.visibility = 'hidden';
        const image = document.createElement('img');
        image.id = 'hud-review-background';
        image.src = `data:image/png;base64,${data}`;
        Object.assign(image.style, {
          position: 'fixed',
          inset: '0',
          width: '100%',
          height: '100%',
          zIndex: '0',
          pointerEvents: 'none',
        });
        canvas.parentElement!.insertBefore(image, canvas);
      }, png);
    };
    await freeze('day');
    // Pin the axe as a player can, so it stays visible when worn in the main hand.
    await page.keyboard.press('KeyI');
    await expect(page.locator('.inventory-panel')).toBeVisible();
    await page.getByTestId('pack-slot-axe').dragTo(page.locator('.hotbar-slot').first());
    await page.mouse.move(700, 350);
    await page.keyboard.press('KeyI');
    await page.keyboard.press('Digit1');
    await expect.poll(() => sim.equippedItemOf(1)).toBe('axe');
    await expect.poll(() => page.evaluate(() => window.acornDebug?.equippedItem())).toBe('axe');
    await expect(page.locator('.hotbar-slot[data-item=axe]')).toHaveClass(/hotbar-slot-equipped/);
    await page.screenshot({ path: `${dir}/day-hud.png` });
    await page.keyboard.press('KeyI');
    await expect(page.locator('.inventory-panel')).toBeVisible();
    await page.screenshot({ path: `${dir}/day-pack.png` });
    await page.getByTestId('pack-slot-rod').dragTo(page.locator('.hotbar-slot').last());
    await page.mouse.move(700, 350);
    await expect(page.locator('.hotbar-slot').last()).toHaveAttribute('data-item', 'rod');
    await page.keyboard.press('KeyI');
    await expect(page.locator('.inventory-panel')).toHaveCount(0);
    await page.keyboard.press('KeyB');
    await expect(page.locator('.inventory-panel')).toBeVisible();
    await page.keyboard.press('KeyB');
    await page.keyboard.press('KeyC');
    await expect(page.locator('.craft-panel')).toBeVisible();
    await page.screenshot({ path: `${dir}/day-craft.png` });
    await page.keyboard.press('KeyC');
    clock += shared.DAY_LENGTH_MS / 2;
    update();
    await page.waitForTimeout(1000);
    await freeze('night');
    await page.screenshot({ path: `${dir}/night-hud.png` });
    warn();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.getByTestId('hunger-bar')).toHaveClass(/hunger-bar-low/);
    await expect(page.getByTestId('health-bar')).toHaveClass(/health-bar-low/);
    await expect
      .poll(() =>
        page
          .locator('.health-bar-fill')
          .evaluate(
            (el) =>
              el.getBoundingClientRect().width / el.parentElement!.getBoundingClientRect().width,
          ),
      )
      .toBeLessThan(0.2);
    await expect
      .poll(() =>
        page
          .locator('.hunger-bar-fill')
          .evaluate(
            (el) =>
              el.getBoundingClientRect().width / el.parentElement!.getBoundingClientRect().width,
          ),
      )
      .toBeLessThan(0.12);
    await page.screenshot({ path: `${dir}/night-reduced-motion.png` });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('.hotbar')).toBeInViewport();
    await expect(page.getByTestId('health-bar')).toBeInViewport();
    await page.screenshot({ path: `${dir}/wide-layout.png` });
    await page.setViewportSize({ width: 900, height: 600 });
    const hotbar = (await page.locator('.hotbar').boundingBox())!;
    const health = (await page.getByTestId('health-bar').boundingBox())!;
    const separated =
      hotbar.x + hotbar.width <= health.x ||
      health.x + health.width <= hotbar.x ||
      hotbar.y + hotbar.height <= health.y ||
      health.y + health.height <= hotbar.y;
    await page.screenshot({ path: `${dir}/narrow-layout.png` });
    if (process.env.HUD_CAPTURE_BASELINE !== '1') expect(separated).toBe(true);
    await page.keyboard.press('KeyI');
    await expect(page.locator('.inventory-panel')).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus-visible')).toHaveCount(1);
    expect(errors).toEqual([]);
  } finally {
    closed = true;
    sim.dispose();
  }
});
