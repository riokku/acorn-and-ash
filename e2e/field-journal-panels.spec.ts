import { mkdir, writeFile } from 'node:fs/promises';
import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';
import { drawnScreenshot, skipDrawing } from './skip-drawing';

test.use({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1, actionTimeout: 120_000 });
test.setTimeout(600_000);
test('controlled field journal panels review', { tag: '@real-drawing' }, async ({ page }) => {
  const dir = process.env.MENU_REVIEW_SHOTS;
  test.skip(!dir, 'Set MENU_REVIEW_SHOTS to capture the evidence.');
  await mkdir(dir!, { recursive: true });
  await skipDrawing(page, { sceneOnly: true });
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
  Object.assign(sim.inventoryOf(1), {
    axe: 1,
    rod: 1,
    shovel: 1,
    torch: 1,
    berry: 4,
    mushroom: 3,
    meat: 2,
    roastedMeat: 2,
    bag: 4,
    log: 8,
    stick: 12,
    rope: 2,
    reed: 9,
    bone: 5,
    stone: 8,
    forestStew: 1,
  });
  let clock = shared.DAY_LENGTH_MS * 10 + shared.DAY_LENGTH_MS / 2;
  let update = () => {};
  let closed = false;
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
    await expect
      .poll(() => page.evaluate(() => window.acornDebug?.mapState().painted), { timeout: 120_000 })
      .toBe(true);
    const bundle = await page.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .find((name) => /\/assets\/index-[^/]+\.js/.test(name)),
    );
    const background = process.env.MENU_REVIEW_BACKGROUND ?? `${dir}/day-canvas.png`;
    if (!process.env.MENU_REVIEW_BACKGROUND) await drawnScreenshot(page, background);
    await writeFile(
      `${dir}/capture-metadata.json`,
      JSON.stringify(
        {
          bundle,
          viewport: [1366, 768],
          method:
            'Live HTML menus over a fixed game frame. MENU_REVIEW_BACKGROUND may supply a previously rendered frame for matched comparisons; otherwise one is rendered during this run.',
          background,
          healthyVitals: { hunger: 76, health: 92 },
        },
        null,
        2,
      ),
    );
    const png = await import('node:fs/promises').then((fs) => fs.readFile(background, 'base64'));
    await page.evaluate((data) => {
      const canvas = document.querySelector<HTMLElement>('#scene')!;
      canvas.style.visibility = 'hidden';
      const image = document.createElement('img');
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
    await page.keyboard.press('KeyI');
    await expect(page.locator('.inventory-panel')).toBeVisible();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${dir}/pack-populated.png` });
    await page.getByTestId('pack-slot-axe').dragTo(page.locator('.hotbar-slot').first());
    await page.mouse.move(700, 350);
    await page.keyboard.press('KeyI');
    await page.keyboard.press('Digit1');
    await expect.poll(() => page.evaluate(() => window.acornDebug?.equippedItem())).toBe('axe');
    await expect(page.locator('.hotbar-slot[data-item=axe]')).toHaveClass(/hotbar-slot-equipped/);
    await page.keyboard.press('KeyI');
    await page.getByTestId('pack-slot-berry').hover();
    await expect(page.locator('.hud-tooltip')).toBeVisible();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${dir}/pack-tooltip.png` });
    await page.getByTestId('pack-slot-berry').click({ button: 'right' });
    await expect(page.getByTestId('slot-menu')).toBeVisible();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${dir}/pack-context.png` });
    await page.keyboard.press('Escape');
    await page.keyboard.press('KeyI');
    await page.keyboard.press('KeyC');
    await expect(page.locator('.craft-panel')).toBeVisible();
    await page.mouse.move(700, 350);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${dir}/craft-all.png` });
    await page.locator('.craft-tabs').getByRole('button', { name: 'Gear', exact: true }).click();
    await expect(
      page.locator('.hud-journal-entry').filter({ hasText: 'Warm jacket' }),
    ).toBeVisible();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${dir}/craft-gear.png` });
    await page.locator('.hud-journal-tabs').getByRole('button', { name: 'Discoveries' }).click();
    await expect(page.locator('.hud-discoveries')).toBeVisible();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${dir}/discoveries.png` });
    await page.keyboard.press('KeyC');
    await page.keyboard.press('KeyZ');
    await expect(page.getByTestId('character-panel')).toBeVisible();
    await expect(page.getByTestId('gear-preview')).toHaveAttribute('data-state', 'ready', {
      timeout: 120_000,
    });
    await expect(page.locator('.inventory-panel')).toBeVisible();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${dir}/character-pack.png` });
    await page.keyboard.press('KeyZ');
    for (const key of Object.keys(sim.inventoryOf(1)) as shared.ItemId[])
      sim.inventoryOf(1)[key] = 0;
    update();
    await page.keyboard.press('KeyI');
    await expect(page.locator('.inventory-panel')).toBeVisible();
    await expect(page.locator('.inventory-item')).toHaveCount(0);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${dir}/pack-empty.png` });
    await page.setViewportSize({ width: 900, height: 600 });
    await expect(page.locator('.inventory-panel')).toBeInViewport();
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus-visible')).toHaveCount(1);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${dir}/narrow-pack.png` });
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('KeyC');
    await page.locator('.hud-journal-tabs').getByRole('button', { name: 'Crafting' }).click();
    await expect(page.locator('.craft-panel')).toBeInViewport();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${dir}/narrow-craft.png` });
    expect(errors).toEqual([]);
  } finally {
    closed = true;
    sim.dispose();
  }
});
