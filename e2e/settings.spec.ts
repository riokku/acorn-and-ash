import { expect, test } from '@playwright/test';
import * as shared from '../packages/shared/src/index';

test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 0.65 });
test.setTimeout(180_000);

test('opens settings during play, shows a wide guide and resumes controls on close', async ({
  page,
}, testInfo) => {
  const sim = new shared.WorldSimulation({ seed: shared.DEFAULT_WORLD_SEED });
  sim.addPlayer(1, undefined, 'settings-player');
  let walkingInputs = 0;
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ body: '', contentType: 'text/css' }),
  );
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    send(shared.encodeWelcome(1, shared.DEFAULT_WORLD_SEED, sim.tick, Date.now()));
    send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
    send(shared.encodeSpace(0, 0, 0, 0));
    send(shared.encodeSnapshot(sim.tick, Date.now(), 0, sim.snapshotFor(1)));
    socket.onMessage((message) => {
      if (typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
      if (request?.type === 'input') {
        walkingInputs += request.inputs.filter(
          (input) => input.moveX !== 0 || input.moveZ !== 0,
        ).length;
        sim.queueInputs(1, request.inputs);
        sim.step(Date.now());
        send(
          shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
        );
      }
    });
  });
  try {
    await page.goto('/?renderer=webgl2&world=settings-ui');
    await page.locator('#home-name').fill('Settings Explorer');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
      timeout: 120_000,
    });
    await expect(page.locator('.hud-curtain')).toHaveCount(0);
    await expect(page.locator('.hotbar-slot .hotbar-slot-icon')).toHaveCount(0);
    await page.keyboard.down('KeyW');
    await expect.poll(() => walkingInputs).toBeGreaterThan(0);
    await page.keyboard.up('KeyW');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
    await expect(dialog).toBeVisible();
    walkingInputs = 0;
    await page.getByRole('tab', { name: 'Keybindings' }).click();
    expect(
      await dialog.evaluate((element) => element.getBoundingClientRect().width),
    ).toBeGreaterThan(850);
    expect(
      await page
        .locator('.keybindings-groups')
        .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length),
    ).toBe(2);
    await page.keyboard.down('KeyW');
    await page.keyboard.press('KeyC');
    await page.keyboard.press('KeyB');
    await page.waitForTimeout(350);
    await page.keyboard.up('KeyW');
    expect(walkingInputs).toBe(0);
    await expect(page.locator('.hud-journal')).toHaveCount(0);
    await page.screenshot({
      path: process.env.CI
        ? testInfo.outputPath('settings-wide.png')
        : '/workspace/acorn-settings-wide.png',
    });
    await page.setViewportSize({ width: 600, height: 800 });
    expect(
      await page
        .locator('.keybindings-groups')
        .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length),
    ).toBe(1);
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('.hud-curtain')).toHaveCount(0);
    await page.keyboard.down('KeyW');
    await expect.poll(() => walkingInputs).toBeGreaterThan(0);
    await page.keyboard.up('KeyW');
    await page.keyboard.press('Escape');
    await expect(page.locator('.hud-curtain')).toHaveCount(0);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('.hud-curtain')).toHaveCount(0);
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true');
    const beforeWalking = walkingInputs;
    await page.keyboard.down('KeyW');
    await expect.poll(() => walkingInputs).toBeGreaterThan(beforeWalking);
    await page.keyboard.up('KeyW');
    expect(errors).toEqual([]);
  } finally {
    sim.dispose();
  }
});
