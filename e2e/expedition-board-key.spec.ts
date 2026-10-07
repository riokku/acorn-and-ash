import { expect, test, type Page } from '@playwright/test';
import * as shared from '../packages/shared/src/index';
import { skipDrawing } from './skip-drawing';

test.use({ viewport: { width: 1180, height: 760 } });
test.setTimeout(180_000);

const HOME = {
  id: 7,
  kind: 'tent' as const,
  x: 0,
  z: -4.2,
  yaw: 0,
  ownerKey: 'trail-owner',
  lit: false,
  litUntilMs: null,
};

/** A fake world with your tent in it, and you standing `away` metres from its expedition board. */
async function startAtTheBoard(
  page: Page,
  away: number,
): Promise<{ sim: shared.WorldSimulation; interactsSent: () => number }> {
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    hungerEmptyAfterSeconds: Infinity,
  });
  sim.restoreBuiltProps([HOME]);
  sim.addPlayer(1, undefined, 'trail-owner');
  const spot = shared.expeditionBoardSpot(HOME);
  const x = spot.x + away;
  sim.placePlayer(1, { x, z: spot.z, y: sim.collision.terrain.heightAt(x, spot.z) }, 0);
  let interacts = 0;
  await skipDrawing(page);
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ body: '', contentType: 'text/css' }),
  );
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    const refresh = () => {
      send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
      send(shared.encodeExpeditionState(sim.expeditionStateOf(1)));
      send(
        shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
      );
    };
    send(shared.encodeWelcome(1, shared.DEFAULT_WORLD_SEED, 0, Date.now()));
    send(shared.encodeBuiltProps(sim.builtPropsList(), () => true));
    refresh();
    socket.onMessage((message) => {
      if (typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
      if (request?.type === 'expedition') {
        send(shared.encodeExpeditionState(sim.requestExpedition(1, request)));
        return;
      }
      if (request?.type === 'input')
        for (const input of request.inputs) {
          if (shared.isHeld(input, shared.PlayerButton.Interact)) interacts += 1;
          sim.queueInput(1, input);
          sim.step(Date.now());
        }
      refresh();
    });
  });
  await page.goto('/?renderer=webgl2&world=board-key');
  await page.locator('#home-name').fill('Trail Walker');
  await page.locator('.home-play').click();
  await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
  await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
    timeout: 120_000,
  });
  return { sim, interactsSent: () => interacts };
}

test('E reads the expedition board and E puts it away again', async ({ page }) => {
  const { sim, interactsSent } = await startAtTheBoard(page, 0);
  try {
    await expect(page.locator('.hud-hint')).toContainText('Press E to read the expedition board');
    await expect(page.getByRole('button', { name: 'Read expedition board · E' })).toBeVisible();

    await page.keyboard.down('KeyE');
    await expect(page.getByRole('region', { name: 'Expedition board' })).toBeVisible();
    await page.keyboard.up('KeyE');
    await expect(page.locator('.hud-journal-closehint')).toContainText('E');

    await page.keyboard.down('KeyE');
    await expect(page.locator('.expedition-panel')).toHaveCount(0);
    await page.keyboard.up('KeyE');

    // And once more, to be sure it can be opened again after closing.
    await page.keyboard.down('KeyE');
    await expect(page.locator('.expedition-panel')).toBeVisible();
    await page.keyboard.up('KeyE');

    // None of those presses went to the server as "interact".
    expect(interactsSent()).toBe(0);
  } finally {
    sim.dispose();
  }
});

test('E does nothing special away from the board', async ({ page }) => {
  const { sim } = await startAtTheBoard(page, 6);
  try {
    await expect(page.locator('.hud-hint').filter({ hasText: 'expedition board' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Read expedition board/ })).toHaveCount(0);
    await page.keyboard.down('KeyE');
    await page.keyboard.up('KeyE');
    await page.waitForTimeout(500);
    await expect(page.locator('.expedition-panel')).toHaveCount(0);
  } finally {
    sim.dispose();
  }
});
