import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';
import type { WebSocketRoute } from '@playwright/test';
test.setTimeout(180_000);

for (const replyDelay of [0, 125])
  test(`schedules visible contacts and one landing with ${replyDelay} ms replies`, async ({
    page,
  }) => {
    const sim = new shared.WorldSimulation({
      seed: shared.DEFAULT_WORLD_SEED,
      hungerEmptyAfterSeconds: Infinity,
      forestEncounters: false,
    });
    sim.addPlayer(1);
    sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0);
    let active: WebSocketRoute | undefined;
    const pendingReplies = new Set<ReturnType<typeof setTimeout>>();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
      active = socket;
      let closed = false;
      socket.onClose(() => {
        closed = true;
      });
      const send = (data: ArrayBuffer) => {
        if (!closed) socket.send(Buffer.from(data));
      };
      const snapshot = () => {
        const data = shared.encodeSnapshot(
          sim.tick,
          Date.now(),
          sim.lastProcessedSeq(1),
          sim.snapshotFor(1),
        );
        if (replyDelay === 0) send(data);
        else {
          const reply = setTimeout(() => {
            pendingReplies.delete(reply);
            send(data);
          }, replyDelay);
          pendingReplies.add(reply);
        }
      };
      send(shared.encodeWelcome(1, shared.DEFAULT_WORLD_SEED, 0, Date.now()));
      send(shared.encodeSpace(0, 0, 0, 0));
      send(shared.encodeBuiltProps([], () => true));
      send(shared.encodeInventory([]));
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
      await page.clock.install();
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/?renderer=webgl2&world=footstep-contact');
      await page.locator('#home-name').fill('Footstep Walker');
      await page.locator('.home-play').click();
      await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
        timeout: 120000,
      });
      await expect(page.getByTestId('loading-screen')).toBeHidden();
      // Keep the animation frame cadence deterministic. A >=250 ms CPU
      // frame intentionally suppresses atmospheric sounds after a pause;
      // it must not make this contact-scheduling check depend on runner load.
      // Replies still use the real host timer, preserving both latency cases.
      // Allow a busy renderer time to receive the pause command.
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 5000));
      const count = () => page.evaluate(() => window.acornDebug!.footstepCount());
      await page.keyboard.down('KeyW');
      await page.clock.runFor(1000);
      await expect.poll(count).toBeGreaterThan(0);
      await page.keyboard.up('KeyW');
      await page.clock.runFor(500);
      await expect.poll(() => sim.snapshotFor(1).find((entity) => entity.netId === 1)?.vz).toBe(0);
      await expect
        .poll(() => page.evaluate(() => window.acornDebug!.combatMove().grounded))
        .toBe(true);
      const stopped = await count();
      await page.clock.runFor(350);
      expect(await count()).toBe(stopped);
      await page.keyboard.down('Space');
      await page.clock.runFor(50);
      await page.keyboard.up('Space');
      await expect
        .poll(() => page.evaluate(() => window.acornDebug!.combatMove().grounded))
        .toBe(false);
      expect(await count()).toBe(stopped);
      await page.clock.runFor(2000);
      await expect
        .poll(() => page.evaluate(() => window.acornDebug!.combatMove().grounded))
        .toBe(true);
      await expect.poll(count).toBe(stopped + 1);
      await page.clock.runFor(350);
      expect(await count()).toBe(stopped + 1);
      expect(errors).toEqual([]);
    } finally {
      for (const reply of pendingReplies) clearTimeout(reply);
      active?.close();
      sim.dispose();
    }
  });
