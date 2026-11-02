import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';

test.use({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 0.5 });
test.setTimeout(180_000);

test('keeps the forest ready through repeated visits to a far-away home', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  const models: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (/\.glb(?:\?|$)/.test(request.url())) models.push(request.url());
  });
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ body: '', contentType: 'text/css' }),
  );
  const sim = new shared.WorldSimulation({ seed: shared.DEFAULT_WORLD_SEED });
  const home = { id: 7, kind: 'cabin', x: 80, z: -70, yaw: 0, lit: false } as const;
  const doorway = shared.cabinDoorway(home);
  const doorstep = { x: doorway.x, z: doorway.z };
  sim.restoreBuiltProps([{ ...home, ownerKey: 'traveller', litUntilMs: null }]);
  sim.addPlayer(1, undefined, 'traveller');
  // Start inside: a returning player may never have drawn this part of the forest.
  sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0, home.id);
  let publishSpace = (_space: number, _x: number, _z: number) => {};
  let collect = () => {};
  let sendWorld = (_data: ArrayBuffer) => {};
  let closed = false;
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    socket.onClose(() => {
      closed = true;
    });
    const send = (data: ArrayBuffer) => {
      if (!closed) socket.send(Buffer.from(data));
    };
    sendWorld = send;
    collect = () =>
      send(
        shared.encodeCollected([
          { netId: 1, item: 'log', count: 5, x: doorstep.x, z: doorstep.z, depleted: false },
        ]),
      );
    const snapshot = () =>
      send(
        shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
      );
    publishSpace = (space, x, z) => {
      sim.placePlayer(
        1,
        { x, y: space === 0 ? sim.collision.terrain.heightAt(x, z) : 0, z },
        0,
        space,
      );
      send(shared.encodeSpace(space, x, z, 0));
      snapshot();
    };
    send(shared.encodeWelcome(1, shared.DEFAULT_WORLD_SEED, 0, Date.now()));
    send(
      shared.encodeRoster(
        Array.from({ length: 9 }, (_, i) => ({
          netId: i + 1,
          name: `Long Trail Companion ${i + 1}`,
          character: 'ranger' as const,
          color: 'moss' as const,
          skin: shared.DEFAULT_SKIN_TONE,
        })),
      ),
    );
    send(shared.encodeBuiltProps(sim.builtPropsList(), () => true));
    publishSpace(home.id, 0, 0);
    socket.onMessage((message) => {
      if (closed || typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
      if (request?.type === 'input') {
        for (const input of request.inputs) {
          sim.queueInput(1, input);
          sim.step(Date.now());
        }
        snapshot();
      }
    });
  });
  try {
    await page.goto('/?renderer=webgl2&world=home-transition');
    await page.locator('#home-name').fill('Traveller');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
    const checkParty = async () => {
      sendWorld(
        shared.encodeAllies(
          Array.from({ length: 9 }, (_, i) => ({
            netId: i + 1,
            health: 20,
            maxHealth: 100,
            downTicks: 200,
            rescueTicks: 0,
            rescuerId: 0,
            inReach: true,
          })),
        ),
      );
      const allies = page.getByTestId('allies');
      const list = page.getByTestId('allies-list');
      const rescue = allies.locator('.rescue-self');
      await expect(rescue).toBeVisible();
      const details = page.getByTestId('hud-diagnostics');
      await details.locator('summary').focus();
      await page.keyboard.press('Enter');
      await expect(details).toHaveAttribute('open', '');
      for (const viewport of [
        { width: 1366, height: 768 },
        { width: 900, height: 600 },
      ]) {
        await page.setViewportSize(viewport);
        await list.focus();
        await page.keyboard.press('End');
        await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
        await expect
          .poll(() =>
            list.evaluate((element) => {
              const last = element.querySelector('.ally:last-child')!.getBoundingClientRect();
              return last.bottom - element.getBoundingClientRect().bottom;
            }),
          )
          .toBeLessThanOrEqual(1);
        const bounds = await page.evaluate(() => {
          const rect = (selector: string) =>
            document.querySelector(selector)!.getBoundingClientRect().toJSON();
          return {
            list: rect('.allies-list'),
            last: rect('.ally:last-child'),
            rescue: rect('.rescue-self'),
            vitals: rect('.vitals'),
            panel: rect('.hud-panel'),
          };
        });
        expect(bounds.last.bottom).toBeLessThanOrEqual(bounds.list.bottom + 1);
        expect(bounds.panel.bottom).toBeLessThanOrEqual(bounds.rescue.top);
        expect(bounds.rescue.bottom).toBeLessThanOrEqual(bounds.list.top);
        expect(bounds.list.bottom).toBeLessThanOrEqual(bounds.vitals.top);
      }
      // Scroll keys belong to the focused HUD, even while the player can move.
      sendWorld(
        shared.encodeAllies(
          Array.from({ length: 8 }, (_, i) => ({
            netId: i + 2,
            health: 80,
            maxHealth: 100,
            downTicks: 0,
            rescueTicks: 0,
            rescuerId: 0,
            inReach: true,
          })),
        ),
      );
      await expect(rescue).toHaveCount(0);
      const beforeScroll = await page.evaluate(() => window.acornDebug!.localPosition());
      for (const region of [list, page.getByRole('region', { name: 'Connection readings' })]) {
        await region.focus();
        await page.keyboard.press('Home');
        await expect.poll(() => region.evaluate((element) => element.scrollTop)).toBe(0);
        await page.keyboard.down('ArrowDown');
        await page.waitForTimeout(250);
        await page.keyboard.up('ArrowDown');
        await expect.poll(() => region.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
      }
      const afterScroll = await page.evaluate(() => window.acornDebug!.localPosition());
      expect(
        Math.hypot(afterScroll.x - beforeScroll.x, afterScroll.z - beforeScroll.z),
      ).toBeLessThan(0.02);
      await details.locator('summary').focus();
      await page.keyboard.press('Space');
      await expect(details).not.toHaveAttribute('open', '');
      sendWorld(shared.encodeAllies([]));
      await expect(allies).toHaveCount(0);
    };
    const preparing = page.locator('.scene-fade-preparing');
    await expect(preparing).toHaveCount(0);
    for (let visit = 0; visit < 3; visit++) {
      await expect.poll(() => page.evaluate(() => window.acornDebug?.space())).toBe(home.id);
      await expect
        .poll(() => page.evaluate(() => window.acornDebug?.outdoorFocus()))
        .toEqual(doorstep);
      // Spend frames moving in room coordinates. The hidden forest must stay at the home.
      publishSpace(home.id, -1, -1);
      await expect.poll(() => page.evaluate(() => window.acornDebug?.localPosition().x)).toBe(-1);
      await expect
        .poll(() => page.evaluate(() => window.acornDebug?.outdoorFocus()))
        .toEqual(doorstep);
      const recap = page.getByRole('status', { name: 'Outing recap' });
      if (visit === 1) {
        await expect(recap).toBeVisible();
        await expect(recap).toContainText('+5 Logs');
        await page.screenshot({ path: testInfo.outputPath('homecoming-recap.png') });
        await page.keyboard.press('KeyI');
        await expect(page.locator('.inventory-panel')).toBeVisible();
        await expect(recap).toHaveCount(0);
        await page.keyboard.press('KeyI');
        await expect(page.locator('.inventory-panel')).toHaveCount(0);
        await expect(recap).toBeVisible();
        await page.getByRole('button', { name: 'Dismiss outing recap' }).click();
        await expect(recap).toHaveCount(0);
        await page.keyboard.press('KeyI');
        await expect(page.locator('.inventory-panel')).toBeVisible();
        await page.keyboard.press('KeyI');
        await expect(page.locator('.inventory-panel')).toHaveCount(0);
        await expect(recap).toHaveCount(0);
      }
      if (visit === 2) {
        await expect(recap).toBeVisible();
        await page.keyboard.press('KeyI');
        await expect(page.locator('.inventory-panel')).toBeVisible();
        await expect(recap).toHaveCount(0);
      }
      const loadedModels = [...models];
      publishSpace(shared.OUTDOORS, doorstep.x, doorstep.z);
      await expect
        .poll(() => page.evaluate(() => window.acornDebug?.space()))
        .toBe(shared.OUTDOORS);
      await expect(preparing).toHaveCount(0);
      await expect(page.locator('.scene-arrival')).toBeHidden();
      expect(models).toEqual(loadedModels);
      await expect(page.getByRole('status', { name: 'Outing recap' })).toHaveCount(0);
      if (visit === 2) {
        await page.keyboard.press('KeyI');
        await expect(page.locator('.inventory-panel')).toHaveCount(0);
        await expect(recap).toHaveCount(0);
      }
      if (visit === 0) await checkParty();
      if (visit < 2) collect();
      // Controls resume after preparation rather than requiring a refresh.
      await page.keyboard.press('KeyI');
      await expect(page.locator('.inventory-panel')).toBeVisible();
      await page.keyboard.press('KeyI');
      await expect(page.locator('.inventory-panel')).toHaveCount(0);
      if (visit < 2) {
        publishSpace(home.id, 0, 0);
        await expect(preparing).toHaveCount(0);
      }
    }
    expect(errors).toEqual([]);
  } finally {
    closed = true;
  }
});
