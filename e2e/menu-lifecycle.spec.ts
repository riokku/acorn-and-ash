import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';
import type { WebSocketRoute } from '@playwright/test';
test.setTimeout(180_000);

test('keeps menu focus, scroll position and Escape cancellation consistent', async ({ page }) => {
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    hungerEmptyAfterSeconds: Infinity,
  });
  sim.addPlayer(1);
  sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0);
  Object.assign(sim.inventoryOf(1), { stick: 4, axe: 1, leatherBoots: 1 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let active: WebSocketRoute | undefined;
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    active = socket;
    let closed = false;
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
    send(shared.encodeWelcome(1, shared.DEFAULT_WORLD_SEED, 0, Date.now()));
    send(shared.encodeSpace(0, 0, 0, 0));
    send(shared.encodeBuiltProps([], () => true));
    send(shared.encodeHomeSkills(sim.homeSkillsOf(1)));
    send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
    snapshot();
    socket.onMessage((message) => {
      if (closed || typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
      if (request?.type === 'input') {
        sim.queueInputs(1, request.inputs);
        for (let i = 0; i < request.inputs.length; i++) sim.step(Date.now());
        snapshot();
      }
    });
  });
  try {
    await page.goto('/?renderer=webgl2&world=menu-lifecycle');
    await page.locator('#home-name').fill('Menu Walker');
    await page.locator('.home-play').click();
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
      timeout: 120000,
    });
    await expect(page.getByTestId('loading-screen')).toBeHidden();
    const pack = page.locator('.inventory-panel');
    await page.getByRole('button', { name: /Open your pack/ }).click();
    await expect(pack).toBeFocused();
    const sticks = page.getByTestId('pack-slot-stick');
    await sticks.click({ button: 'right' });
    await expect(page.getByTestId('slot-menu-drop-one')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('slot-menu')).toHaveCount(0);
    await expect(pack).toBeVisible();
    await expect(sticks).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(pack).toHaveCount(0);
    await page.keyboard.press('KeyC');
    await expect(page.locator('.craft-panel')).toBeFocused();
    const list = page.locator('.craft-list');
    await list.evaluate((element) => {
      element.scrollTop = 400;
    });
    await expect(list).toHaveJSProperty('scrollTop', 400);
    await page.keyboard.press('KeyC');
    await expect(list).toHaveCount(0);
    await page.keyboard.press('KeyC');
    await expect(list).toHaveJSProperty('scrollTop', 400);
    await page.keyboard.press('KeyC');
    await page.keyboard.press('KeyM');
    await expect(page.getByTestId('world-map')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('world-map')).toHaveCount(0);
    await page.keyboard.press('KeyZ');
    await expect(page.locator('.character-panel')).toBeFocused();
    await page.getByTestId('pack-slot-leatherBoots').evaluate((element) => {
      element.dispatchEvent(
        new DragEvent('dragstart', { bubbles: true, dataTransfer: new DataTransfer() }),
      );
    });
    await expect(page.locator('.gear-slot-fits')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('.gear-slot-fits')).toHaveCount(0);
    await expect(page.locator('.character-panel')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.character-panel')).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    active?.close();
    sim.dispose();
  }
});
