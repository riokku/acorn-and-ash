import { expect, test } from './fixtures';
import {
  DEFAULT_WORLD_SEED,
  WorldSimulation,
  decodeClientMessage,
  encodeEquipped,
  encodeGearRefused,
  encodeInventory,
  encodePong,
  encodeSnapshot,
  encodeWelcome,
  encodeWorn,
  inventoryEntries,
} from '../packages/shared/src/index';

// The character screen (Z): drag gear from the pack onto a slot, see it on the
// model, swap, take off, and be told when the server says no (decision 0113).
// The real rules run against a private simulation behind a faked socket.
test.use({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
test.setTimeout(420_000);

test('wears, swaps and takes off gear from the character screen', async ({ page }, testInfo) => {
  const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED });
  sim.addPlayer(1, undefined, 'gear-owner');
  sim.addPlayer(2, undefined, 'gear-friend');
  sim.giveTestGear(1, [
    'bag',
    'bag',
    'rustySword',
    'rod',
    'knightHelmet',
    'mageHat',
    'travelerTunic',
    'travelerTrousers',
    'leatherBoots',
    'leatherGloves',
    'ironSword',
    'woodenShield',
  ]);
  sim.wearGear(2, 'bearHat', 'helm');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    const sendState = () => {
      send(encodeInventory(inventoryEntries(sim.inventoryOf(1))));
      send(encodeWorn(sim.wornList()));
      send(encodeEquipped([{ netId: 1, item: sim.equippedItemOf(1) }]));
    };
    send(encodeWelcome(1, DEFAULT_WORLD_SEED, 0, Date.now()));
    sendState();
    send(encodeSnapshot(0, Date.now(), 0, sim.snapshotFor(1)));
    socket.onMessage((message) => {
      if (typeof message === 'string') return;
      const request = decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(encodePong(request.clientTimeMs, Date.now()));
      if (request?.type === 'useItem') {
        sim.useItem(1, request.item);
        sendState();
      }
      if (request?.type === 'gear') {
        const change =
          request.action === 'wear'
            ? sim.wearGear(1, request.item, request.slot)
            : request.action === 'takeOff'
              ? sim.takeOffGear(1, request.slot)
              : sim.swapGear(1, request.from, request.to);
        if (change.ok) sendState();
        else send(encodeGearRefused(change.reason));
      }
    });
  });

  // The UI receives an owner capability; real admin routes retain their independent server checks.
  await page.route('**/api/session', async (route) => {
    const response = await route.fetch();
    const status = await response.json();
    await route.fulfill({ response, json: { ...status, canEditItems: status.signedIn === true } });
  });
  await page.goto('/?renderer=webgl2&world=gear-ui');
  await expect(page.getByRole('link', { name: 'Manage items' })).toHaveAttribute('href', '/admin');
  await page.locator('#home-name').fill('Dresser');
  await page.locator('.home-play').click();
  await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120_000 });
  await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
    timeout: 120_000,
  });

  await page.keyboard.press('KeyZ');
  const panel = page.getByTestId('character-panel');
  await expect(panel).toBeVisible();
  await expect(page.getByTestId('character-stats')).toContainText('Attack power100%');
  await expect(panel.getByRole('link', { name: 'Manage items' })).toHaveAttribute('href', '/admin');
  await expect(page.getByTestId('pack-slot-knightHelmet')).toBeVisible();
  await expect(page.getByTestId('gear-preview')).toHaveAttribute('data-state', 'ready', {
    timeout: 60_000,
  });

  // While a helmet is held, only the helm slot glows.
  await page.getByTestId('pack-slot-knightHelmet').dispatchEvent('dragstart', {
    dataTransfer: await page.evaluateHandle(() => new DataTransfer()),
  });
  await expect(page.getByTestId('gear-slot-helm')).toHaveClass(/gear-slot-fits/);
  await expect(page.getByTestId('gear-slot-feet')).not.toHaveClass(/gear-slot-fits/);
  await page.getByTestId('pack-slot-knightHelmet').dispatchEvent('dragend');
  await expect(page.getByTestId('gear-slot-helm')).not.toHaveClass(/gear-slot-fits/);

  // Drag onto a slot, and it is worn.
  await page.getByTestId('pack-slot-knightHelmet').dragTo(page.getByTestId('gear-slot-helm'));
  await expect(page.getByTestId('gear-slot-helm')).toHaveAttribute('data-item', 'knightHelmet');
  await expect(page.getByTestId('pack-slot-knightHelmet')).toHaveCount(0);
  await expect(page.getByTestId('character-stats')).toContainText('Protection8%');
  await expect(page.getByTestId('character-stats')).toContainText('Warmth5');

  // A pinned dropped sword stays usable after it leaves the pack for the main hand.
  await page.getByTestId('pack-slot-rustySword').dragTo(page.locator('.hotbar-slot').first());
  const sword = page.locator('.hotbar-slot[data-item="rustySword"]');
  await sword.click();
  await expect(page.getByTestId('gear-slot-mainHand')).toHaveAttribute('data-item', 'rustySword');
  await expect(sword).not.toHaveClass(/hotbar-slot-unavailable/);
  await page.locator('.hotbar-slot[data-item="rod"]').click();
  await expect.poll(() => sim.equippedItemOf(1)).toBe('rod');
  await sword.click();
  await expect.poll(() => sim.equippedItemOf(1)).toBe('rustySword');

  await page.locator('.hotbar-slot[data-item="rod"]').click();
  await expect.poll(() => sim.equippedItemOf(1)).toBe('rod');
  await page.keyboard.press('KeyZ');
  await expect(panel).toBeHidden();
  await page.keyboard.press('Digit1');
  await expect.poll(() => sim.equippedItemOf(1)).toBe('rustySword');
  await page.keyboard.press('KeyZ');
  await expect(panel).toBeVisible();

  // Ordinary pack clicks equip weapons too, using their main-hand gear slot.
  await page.getByTestId('pack-slot-ironSword').click();
  await expect(page.getByTestId('gear-slot-mainHand')).toHaveAttribute('data-item', 'ironSword');
  await expect(page.getByTestId('character-stats')).toContainText('Attack power150%');

  // Dragging onto an occupied slot swaps the two.
  await page.getByTestId('pack-slot-mageHat').dragTo(page.getByTestId('gear-slot-helm'));
  await expect(page.getByTestId('gear-slot-helm')).toHaveAttribute('data-item', 'mageHat');
  await expect(page.getByTestId('pack-slot-knightHelmet')).toBeVisible();
  await expect(page.getByTestId('character-stats')).toContainText('Protection1%');
  await expect(page.getByTestId('character-stats')).toContainText('Vitality110');
  await expect(page.getByTestId('health-bar')).toHaveAttribute('aria-valuemax', '110');

  // A piece that does not fit is turned down, and the screen says so.
  await page.getByTestId('pack-slot-knightHelmet').dragTo(page.getByTestId('gear-slot-feet'));
  await expect(page.getByRole('status').filter({ hasText: "doesn't go there" })).toBeVisible();

  await page.getByTestId('pack-slot-travelerTunic').click({ button: 'right' });
  await page.getByTestId('pack-slot-woodenShield').click({ button: 'right' });
  for (const item of ['travelerTrousers', 'leatherBoots', 'leatherGloves']) {
    await page.getByTestId(`pack-slot-${item}`).click({ button: 'right' });
  }
  await expect(page.getByTestId('gear-slot-hands')).toHaveAttribute('data-item', 'leatherGloves');
  await expect(page.getByTestId('gear-slot-offHand')).toHaveAttribute('data-item', 'woodenShield');
  await expect(page.getByTestId('health-bar')).toHaveAttribute('aria-valuemax', '120');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: testInfo.outputPath('gear-worn.png') });

  // Right-click a worn piece to take it off.
  await page.getByTestId('gear-slot-helm').click({ button: 'right' });
  await expect(page.getByTestId('gear-slot-helm')).toHaveAttribute('data-item', '');
  await expect(page.getByTestId('pack-slot-mageHat')).toBeVisible();

  await page.getByTestId('gear-slot-mainHand').click({ button: 'right' });
  await expect(page.getByTestId('character-stats')).toContainText('Attack power100%');

  // Z puts it all away again.
  await page.keyboard.press('KeyZ');
  await expect(panel).toBeHidden();
  expect(errors).toEqual([]);
});

test('equips sword and axe with a legacy spare shovel in a 10-of-24-slot pack and shows refusals outside Z', async ({
  page,
}) => {
  const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED, forestEncounters: false });
  sim.addPlayer(1, undefined, 'spare-shovel');
  sim.giveTestGear(1, [
    'bag',
    'bag',
    'bag',
    'bag',
    'bag',
    'shovel',
    'axe',
    'rustySword',
    'log',
    'stick',
    'bone',
    'reed',
    'flower',
    'stone',
    'clay',
  ]);
  expect(sim.wearGear(1, 'shovel', 'mainHand').ok).toBe(true);
  sim.inventoryOf(1).shovel = 1;
  let refuse = false;
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ body: '' }));
  await page.routeWebSocket('**/api/worlds/*/ws*', (socket) => {
    const send = (data: ArrayBuffer) => socket.send(Buffer.from(data));
    const refresh = () => {
      send(encodeInventory(inventoryEntries(sim.inventoryOf(1))));
      send(encodeWorn(sim.wornList()));
      send(encodeEquipped(sim.equippedList()));
    };
    send(encodeWelcome(1, sim.seed, 0, Date.now()));
    refresh();
    send(encodeSnapshot(0, Date.now(), 0, sim.snapshotFor(1)));
    socket.onMessage((message) => {
      if (typeof message === 'string') return;
      const request = decodeClientMessage(new Uint8Array(message).buffer);
      if (request?.type === 'ping') send(encodePong(request.clientTimeMs, Date.now()));
      if (request?.type === 'gear' && request.action === 'wear') {
        if (refuse) {
          send(encodeGearRefused('busy'));
          return;
        }
        const result = sim.wearGear(1, request.item, request.slot);
        if (result.ok) refresh();
        else send(encodeGearRefused(result.reason));
      }
    });
  });
  try {
    await page.goto('/?renderer=webgl2&world=spare-shovel');
    await page.locator('#home-name').fill('Ready to Equip');
    await page.locator('.home-play').click();
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 120000 });
    await expect(page.locator('.hud-panel')).toHaveAttribute('data-world-ready', 'true', {
      timeout: 120000,
    });
    await page.keyboard.press('KeyZ');
    await expect(page.locator('.inventory-meter-label')).toHaveText('10 of 24 slots');
    await page.getByTestId('pack-slot-rustySword').dragTo(page.locator('.hotbar-slot').first());
    const sword = page.locator('.hotbar-slot[data-item="rustySword"]');
    await sword.click();
    await expect(page.getByTestId('gear-slot-mainHand')).toHaveAttribute('data-item', 'rustySword');
    expect(sim.inventoryOf(1).shovel).toBe(2);
    await page.getByTestId('pack-slot-axe').click();
    await expect(page.getByTestId('gear-slot-mainHand')).toHaveAttribute('data-item', 'axe');
    await page
      .getByTestId('pack-slot-shovel')
      .first()
      .dragTo(page.getByTestId('gear-slot-mainHand'));
    await expect(page.getByTestId('gear-slot-mainHand')).toHaveAttribute('data-item', 'shovel');
    expect(sim.inventoryOf(1).shovel).toBe(1);
    await page.keyboard.press('KeyZ');
    refuse = true;
    await sword.click();
    await expect(page.locator('.interaction-note')).toContainText(
      "You can't change gear right now.",
    );
    refuse = false;
    await sword.click();
    await expect.poll(() => sim.equippedItemOf(1)).toBe('rustySword');
    await expect(page.locator('.interaction-note')).toHaveCount(0);
    expect(sim.inventoryOf(1).shovel).toBe(2);
    expect(errors).toEqual([]);
  } finally {
    sim.dispose();
  }
});
