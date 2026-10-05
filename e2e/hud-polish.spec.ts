import { expect, test, type Page } from '@playwright/test';
import * as shared from '../packages/shared/src/index';
import { skipDrawing } from './skip-drawing';

test.use({ viewport: { width: 1100, height: 700 } });
test.setTimeout(180_000);

/**
 * A world of one player, played through a fake server (the same way the meals
 * test does it), so the numbers on screen are exactly the ones chosen here.
 */
async function startFakeWorld(
  page: Page,
  options: {
    hunger: number;
    health: number;
    items: Partial<Record<shared.ItemId, number>>;
  },
): Promise<shared.WorldSimulation> {
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    hungerEmptyAfterSeconds: Infinity,
  });
  sim.addPlayer(
    1,
    {
      netId: 1,
      x: 0,
      y: 0,
      z: 0,
      facingYaw: 0,
      hunger: options.hunger,
      health: options.health,
      items: [],
    },
    'polish',
  );
  Object.assign(sim.inventoryOf(1), options.items);
  await skipDrawing(page);
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ body: '', contentType: 'text/css' }),
  );
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    const refresh = () => {
      send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
      send(shared.encodeEquipped(sim.equippedList()));
      send(
        shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
      );
    };
    send(shared.encodeWelcome(1, shared.DEFAULT_WORLD_SEED, 0, Date.now()));
    send(shared.encodeSpace(0, 0, 0, 0));
    send(shared.encodeHunger({ netId: 1, hunger: options.hunger, ate: null }));
    send(
      shared.encodeHealth({ netId: 1, health: options.health, knockedOut: false, dodged: false }),
    );
    refresh();
    socket.onMessage((message) => {
      if (typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
      if (request?.type === 'input')
        for (const input of request.inputs) {
          sim.queueInput(1, input);
          sim.step(Date.now());
        }
      refresh();
    });
  });
  await page.goto('/?renderer=webgl2&world=hud-polish');
  await page.locator('#home-name').fill('Polish');
  await page.locator('.home-play').click();
  await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
  await page.locator('.hud-curtain').click();
  return sim;
}

test.describe('hunger and health bars', () => {
  test('hunger sits above health, and both throb when nearly empty', async ({ page }) => {
    const sim = await startFakeWorld(page, { hunger: 8, health: 15, items: {} });
    try {
      const hunger = page.getByTestId('hunger-bar');
      const health = page.getByTestId('health-bar');
      await expect(hunger).toBeVisible();
      await expect(health).toBeVisible();
      const hungerBox = (await hunger.boundingBox())!;
      const healthBox = (await health.boundingBox())!;
      expect(hungerBox.y + hungerBox.height).toBeLessThanOrEqual(healthBox.y);
      await expect(hunger).toHaveClass(/hunger-bar-low/);
      await expect(health).toHaveClass(/health-bar-low/);
    } finally {
      sim.dispose();
    }
  });

  test('neither throbs when you are well fed and healthy', async ({ page }) => {
    const sim = await startFakeWorld(page, { hunger: 60, health: 90, items: {} });
    try {
      await expect(page.getByTestId('hunger-bar')).not.toHaveClass(/hunger-bar-low/);
      await expect(page.getByTestId('health-bar')).not.toHaveClass(/health-bar-low/);
    } finally {
      sim.dispose();
    }
  });

  test('exactly on the line is still calm: hunger 10 and health 20', async ({ page }) => {
    const sim = await startFakeWorld(page, { hunger: 10, health: 20, items: {} });
    try {
      await expect(page.getByTestId('hunger-bar')).not.toHaveClass(/hunger-bar-low/);
      await expect(page.getByTestId('health-bar')).not.toHaveClass(/health-bar-low/);
    } finally {
      sim.dispose();
    }
  });
});

test.describe('pack hover labels', () => {
  test('hovering a pack item shows the label in full without any sideways scroll', async ({
    page,
  }) => {
    const sim = await startFakeWorld(page, {
      hunger: 100,
      health: 100,
      items: { bag: 1, roastedMeat: 2, forestStew: 1, berryTea: 1, trailRation: 3 },
    });
    try {
      await page.keyboard.down('KeyI');
      const panel = page.locator('.inventory-panel');
      await expect(panel).toBeVisible();
      await page.keyboard.up('KeyI');
      const items = page.locator('.inventory-item');
      const count = await items.count();
      expect(count).toBeGreaterThan(2);
      for (let i = 0; i < count; i += 1) {
        await items.nth(i).hover();
        const tip = page.locator('.hud-tooltip');
        await expect(tip).toHaveCount(1);
        await expect(tip).toBeVisible();
        const box = (await tip.boundingBox())!;
        const view = page.viewportSize()!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(view.width);
        expect(box.y + box.height).toBeLessThanOrEqual(view.height);
        // No sideways scroll on the pack, and the label is not inside it to cause one.
        const scrolls = await panel.evaluate((el) => el.scrollWidth > el.clientWidth);
        expect(scrolls).toBe(false);
        expect(await panel.locator('.hud-tooltip').count()).toBe(0);
      }
    } finally {
      sim.dispose();
    }
  });
});
