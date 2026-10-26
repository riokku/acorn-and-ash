import { expect, test } from './fixtures';
import * as shared from '../packages/shared/src/index';
test.use({ viewport: { width: 1180, height: 850 }, deviceScaleFactor: 0.75 });
test.setTimeout(180000);

test('joins a friend on a two-seat outdoor bench, rises safely, and chooses furniture from Home', async ({
  page,
}) => {
  const sim = new shared.WorldSimulation({
    seed: shared.DEFAULT_WORLD_SEED,
    forestEncounters: false,
    hungerEmptyAfterSeconds: Infinity,
  });
  const bench = { id: 70, kind: 'cedarBench' as const, x: 8, z: 8, yaw: 0 };
  sim.restoreBuiltProps([
    { ...bench, ownerKey: 'owner', lit: false, litUntilMs: null },
    { id: 71, kind: 'tent', x: 8, z: 15, yaw: 0, ownerKey: 'owner', lit: false, litUntilMs: null },
  ]);
  const seats = shared.benchSeats(bench, () => 0);
  for (const [id, key] of [
    [1, 'owner'],
    [2, 'friend'],
  ] as const) {
    sim.addPlayer(id, undefined, key);
    sim.placePlayer(id, { ...seats[id - 1]!.stand, y: 0 }, 0);
  }
  sim.queueInput(2, shared.createInput(1, 0, 0, 0, shared.PlayerButton.Interact));
  sim.step(Date.now());
  Object.assign(sim.inventoryOf(1), { log: 20, stick: 20 });
  const errors: string[] = [];
  let closed = false;
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '' }));
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => {
      if (!closed) socket.send(Buffer.from(data));
    };
    socket.onClose(() => {
      closed = true;
    });
    const refresh = () => {
      send(shared.encodeInventory(shared.inventoryEntries(sim.inventoryOf(1))));
      send(
        shared.encodeSnapshot(sim.tick, Date.now(), sim.lastProcessedSeq(1), sim.snapshotFor(1)),
      );
    };
    send(shared.encodeWelcome(1, sim.seed, 0, Date.now()));
    send(
      shared.encodeRoster(
        [1, 2].map((netId) => ({
          netId,
          name: netId === 1 ? 'Host' : 'Friend',
          character: 'ranger',
          color: 'moss',
          skin: shared.DEFAULT_SKIN_TONE,
        })),
      ),
    );
    send(shared.encodeBuiltProps(sim.builtPropsList(), () => true));
    refresh();
    socket.onMessage((message) => {
      if (closed || typeof message === 'string') return;
      const request = shared.decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(shared.encodePong(request.clientTimeMs, Date.now()));
      if (request?.type === 'input') {
        for (const input of request.inputs) {
          sim.queueInput(1, input);
          sim.step(Date.now());
        }
        refresh();
      }
    });
  });
  try {
    await page.goto('/?renderer=webgl2&world=gathering-nook');
    await page.locator('#home-name').fill('Host');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120000 });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true');
    await expect(page.locator('.hud-hint')).toContainText('take a seat on the cedar bench');
    await page.keyboard.press('KeyE');
    await expect
      .poll(() => page.evaluate(() => window.acornDebug?.combatMove().kind))
      .toBe(shared.ActionKind.Sit);
    await expect(page.locator('.hud-hint')).toContainText('Taking a seat outdoors');
    const seated = sim.snapshotFor(1).filter((p) => [1, 2].includes(p.netId));
    expect(
      seated.every(
        (p) =>
          shared.unpackActionByte(p.action, shared.createActionState()).kind ===
          shared.ActionKind.Sit,
      ),
    ).toBe(true);
    expect(Math.abs(seated[0]!.x - seated[1]!.x)).toBeGreaterThan(0.7);
    await expect
      .poll(() => page.evaluate(() => window.acornDebug!.combatMove().age))
      .toBeGreaterThan(8);
    await page.keyboard.press('KeyE');
    await expect
      .poll(() => page.evaluate(() => window.acornDebug?.combatMove().kind))
      .toBe(shared.ActionKind.Idle);
    await page.keyboard.press('KeyC');
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    const guide = page.getByTestId('gathering-nook');
    await guide.locator('summary').click();
    await expect(guide).toContainText('Every bench seats two');
    await guide.getByRole('button', { name: 'Place Timber table', exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => window.acornDebug?.buildPreview()?.kind))
      .toBe('timberTable');
    expect(errors).toEqual([]);
  } finally {
    closed = true;
    sim.dispose();
  }
});

test('renders a furnished gathering nook using the existing models and seated character rigs', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '' }));
  for (const before of [true, false]) {
    await page.goto(`/?gallery=homestead&renderer=webgl2&nook&still${before ? '&before' : ''}`);
    await expect(page.locator('body')).toHaveAttribute('data-gallery-ready', 'true', {
      timeout: 120000,
    });
    await page.screenshot({ path: testInfo.outputPath(before ? 'before.png' : 'after.png') });
  }
  expect(errors).toEqual([]);
});
