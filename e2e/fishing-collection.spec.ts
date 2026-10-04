import { expect, test } from '@playwright/test';
import * as shared from '../packages/shared/src';
test.use({ viewport: { width: 960, height: 640 }, deviceScaleFactor: 0.5 });
test.setTimeout(180000);
test('lands a rare fish with real clicks and illustrates the saved collection', async ({
  page,
}, testInfo) => {
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    hungerEmptyAfterSeconds: Infinity,
  });
  const pool = shared.POND[0]!,
    pos = { x: pool.x - pool.radius - 0.5, y: 0, z: pool.z },
    yaw = -Math.PI / 2;
  sim.addPlayer(
    1,
    {
      netId: 1,
      ...pos,
      facingYaw: yaw,
      items: [{ item: 'rod', count: 1 }],
      equippedItem: 'rod',
      hunger: 100,
      fishRecords: shared.fishRecordsFromSaved({ counts: [3, 1, 0], bestCm: [28, 42, 0] }),
    },
    'fish-ui',
  );
  sim.placePlayer(1, pos, yaw);
  sim.restoreTakenPickups([shared.ROD_PICKUP_ID]);
  let closed = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**', (r) =>
    r.fulfill({ body: '', contentType: 'text/css' }),
  );
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => {
      if (!closed) socket.send(Buffer.from(data));
    };
    const refresh = () => {
      send(
        shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
      );
      send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
    };
    send(shared.encodeWelcome(1, sim.seed, 0, Date.now()));
    send(shared.encodeEquipped(sim.equippedList()));
    send(shared.encodePickupsTaken([shared.ROD_PICKUP_ID]));
    send(shared.encodeFishRecords(sim.fishRecordsOf(1)));
    refresh();
    socket.onClose(() => {
      closed = true;
    });
    socket.onMessage((message) => {
      if (closed || typeof message === 'string') return;
      const req = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (req?.type === 'ping') send(shared.encodePong(req.clientTimeMs, Date.now()));
      if (req?.type === 'input')
        for (const input of req.inputs) {
          const cast = sim.castOf(1);
          // Force the rare fixture at the authoritative hook; all reel inputs still come from the browser.
          if (
            cast?.biting &&
            input.buttons & shared.PlayerButton.Fish &&
            input.buttons & shared.PlayerButton.SawBite &&
            !rareStarted
          ) {
            while (shared.fishOnTheLine(sim.seed, cast.castNumber, sim.tick + 1) !== 'goldenCarp')
              sim.step(Date.now());
            rareStarted = true;
          }
          sim.queueInput(1, input);
        }
    });
    timer = setInterval(() => {
      if (closed) return;
      sim.step(Date.now());
      for (const event of sim.drainFishingEvents()) send(shared.encodeFishing(event));
      for (const update of sim.drainReelChanges()) send(shared.encodeRareReel(update.state));
      for (const id of sim.drainFishRecordChanges())
        send(shared.encodeFishRecords(sim.fishRecordsOf(id)));
      refresh();
    }, 50);
  });
  let rareStarted = false;
  try {
    await page.goto('/?renderer=webgl2&world=fish-ui');
    await page.locator('#home-name').fill('Water Walker');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120000 });
    await page.locator('.hud-curtain').click();
    await page.evaluate(
      ([x, z]) =>
        (
          window as unknown as { acornDebug: { faceTowards(x: number, z: number): void } }
        ).acornDebug.faceTowards(x!, z!),
      [pool.x, pool.z],
    );
    await expect(page.locator('.hud-hint')).toContainText('Left click to cast');
    const click = async () => {
      await page.mouse.move(480, 320);
      await page.mouse.down();
      await page.waitForTimeout(90);
      await page.mouse.up();
    };
    // Set up a cast at the water; the hook and both rare pulls are real browser clicks.
    sim.queueInput(
      1,
      shared.createInput(sim.lastProcessedSeq(1) + 1, 0, 0, yaw, shared.PlayerButton.Fish),
    );
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            (
              window as unknown as { acornDebug: { fishing(): string | null } }
            ).acornDebug.fishing(),
          ),
        { timeout: 20000, intervals: [25] },
      )
      .toBe('biting');
    await click();
    const challenge = page.getByRole('region', { name: 'Rare fish challenge' });
    await expect(challenge).toBeVisible();
    for (const hits of [0, 1]) {
      await expect
        .poll(() => page.locator('.rare-reel-steady').count(), { intervals: [25] })
        .toBe(1);
      await click();
      if (hits === 0) await expect(challenge).toContainText('1 / 2');
      await expect(page.locator('.rare-reel-steady')).toHaveCount(0);
    }
    await expect(challenge).toBeHidden();
    expect(sim.fishRecordsOf(1).counts).toEqual([3, 1, 1]);
    await page.keyboard.press('KeyC');
    await page.getByRole('button', { name: 'Fishing', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Fishing collection' })).toBeVisible();
    await expect(page.locator('.fishing-species article')).toHaveCount(3);
    await expect(page.locator('.fishing-journal')).toContainText(
      'Golden collection display recipe learned',
    );
    await page.screenshot({
      path: process.env.CI
        ? testInfo.outputPath('fishing-journal.png')
        : '/workspace/acorn-fishing-journal.png',
    });
    expect(errors).toEqual([]);
  } finally {
    closed = true;
    if (timer !== undefined) clearInterval(timer);
    sim.dispose();
  }
});
test('keeps saved species pages and journal tabs readable in wide and narrow windows', async ({
  page,
}, testInfo) => {
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    hungerEmptyAfterSeconds: Infinity,
  });
  sim.addPlayer(1, undefined, 'book-reader');
  let closed = false;
  await page.route('https://fonts.googleapis.com/**', (r) =>
    r.fulfill({ body: '', contentType: 'text/css' }),
  );
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => {
      if (!closed) socket.send(Buffer.from(data));
    };
    send(shared.encodeWelcome(1, sim.seed, 0, Date.now()));
    send(shared.encodeSnapshot(0, Date.now(), 0, sim.snapshotFor(1)));
    send(shared.encodeInventory([]));
    send(
      shared.encodeFishRecords(
        shared.fishRecordsFromSaved({ counts: [3, 1, 1], bestCm: [28, 42, 55] }),
      ),
    );
    socket.onClose(() => {
      closed = true;
    });
    socket.onMessage((message) => {
      if (typeof message === 'string') return;
      const req = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (req?.type === 'ping') send(shared.encodePong(req.clientTimeMs, Date.now()));
    });
  });
  try {
    await page.goto('/?renderer=webgl2&world=fish-book');
    await page.locator('#home-name').fill('River Reader');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120000 });
    await page.locator('.hud-curtain').click();
    await page.keyboard.press('KeyC');
    await page.getByRole('button', { name: 'Fishing', exact: true }).click();
    const journal = page.locator('.fishing-journal');
    await expect(journal).toContainText('Best 55 cm');
    expect((await journal.boundingBox())!.width).toBeGreaterThan(700);
    await page.screenshot({
      path: process.env.CI
        ? testInfo.outputPath('fishing-journal-wide.png')
        : '/workspace/acorn-fishing-journal-wide.png',
    });
    await page.setViewportSize({ width: 600, height: 640 });
    await expect(journal).toBeVisible();
    expect(await journal.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
    const rect = (await journal.boundingBox())!;
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(600);
    await page.getByRole('button', { name: 'Crafting', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Fishing', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Fishing', exact: true }).click();
    await expect(journal).toContainText('Best 55 cm');
  } finally {
    closed = true;
    sim.dispose();
  }
});
for (const model of ['fish-display', 'golden-fish-display'])
  test(`renders ${model}`, async ({ page }, info) => {
    await page.route('https://fonts.googleapis.com/**', (r) =>
      r.fulfill({ body: '', contentType: 'text/css' }),
    );
    await page.goto(`/?gallery=${model}&renderer=webgl2`);
    await expect(page.locator('body')).toHaveAttribute('data-gallery-ready', 'true', {
      timeout: 120000,
    });
    await page.screenshot({
      path: process.env.CI ? info.outputPath(`${model}.png`) : `/workspace/acorn-${model}.png`,
    });
  });
