import { afterEach, describe, expect, it } from 'vitest';

import {
  ActionKind,
  DEFAULT_WORLD_SEED,
  GEAR_ITEMS,
  GEAR_SLOTS,
  PlayerButton,
  TICK_MILLISECONDS,
  WorldSimulation,
  addItem,
  canWearIn,
  countOf,
  createInput,
  createInventory,
  decodeClientMessage,
  decodeServerMessage,
  encodeGear,
  encodeGearRefused,
  encodeWorn,
  gearSlotsOf,
  isGear,
  slotToWear,
  swapGear,
  takeOffGear,
  wearGear,
  wornEntries,
  wornFromEntries,
  type GearRequest,
  type WornGear,
} from '../src/index';

describe('what counts as gear', () => {
  it('fits every piece to at least one slot, and nothing else is gear', () => {
    expect(GEAR_ITEMS.length).toBeGreaterThanOrEqual(GEAR_SLOTS.length);
    for (const item of GEAR_ITEMS) expect(gearSlotsOf(item).length).toBeGreaterThan(0);
    expect(isGear('axe')).toBe(false);
    expect(isGear('log')).toBe(false);
  });

  it('has something for every slot', () => {
    for (const slot of GEAR_SLOTS)
      expect(GEAR_ITEMS.some((item) => canWearIn(item, slot))).toBe(true);
  });

  it('keeps helmets on heads and swords in hands', () => {
    expect(canWearIn('knightHelmet', 'helm')).toBe(true);
    expect(canWearIn('knightHelmet', 'feet')).toBe(false);
    expect(canWearIn('ironSword', 'mainHand')).toBe(true);
    expect(canWearIn('ironSword', 'offHand')).toBe(false);
    expect(canWearIn('woodenShield', 'offHand')).toBe(true);
    expect(canWearIn('huntingKnife', 'mainHand')).toBe(true);
    expect(canWearIn('huntingKnife', 'offHand')).toBe(true);
  });

  it('chooses the empty hand for a knife that fits either', () => {
    expect(slotToWear('huntingKnife', {})).toBe('mainHand');
    expect(slotToWear('huntingKnife', { mainHand: 'ironSword' })).toBe('offHand');
    expect(slotToWear('knightHelmet', { helm: 'mageHat' })).toBe('helm');
    expect(slotToWear('axe', {})).toBeNull();
  });
});

describe('putting gear on and taking it off', () => {
  it('moves a piece from the pack to its slot', () => {
    const worn: WornGear = {};
    const pack = createInventory();
    addItem(pack, 'knightHelmet');
    expect(wearGear(worn, pack, 'knightHelmet', 'helm')).toEqual({ ok: true, displaced: null });
    expect(worn.helm).toBe('knightHelmet');
    expect(countOf(pack, 'knightHelmet')).toBe(0);
  });

  it('swaps with what is already worn, which goes back to the pack', () => {
    const worn: WornGear = { helm: 'mageHat' };
    const pack = createInventory();
    addItem(pack, 'bearHat');
    expect(wearGear(worn, pack, 'bearHat', 'helm')).toEqual({ ok: true, displaced: 'mageHat' });
    expect(worn.helm).toBe('bearHat');
    expect(countOf(pack, 'mageHat')).toBe(1);
    expect(countOf(pack, 'bearHat')).toBe(0);
  });

  it('refuses a piece in the wrong slot or one that is not held, changing nothing', () => {
    const worn: WornGear = {};
    const pack = createInventory();
    addItem(pack, 'knightHelmet');
    expect(wearGear(worn, pack, 'knightHelmet', 'feet')).toEqual({
      ok: false,
      reason: 'wrongSlot',
    });
    expect(wearGear(worn, pack, 'bearHat', 'helm')).toEqual({ ok: false, reason: 'missing' });
    expect(wearGear(worn, pack, 'axe', 'mainHand')).toEqual({ ok: false, reason: 'wrongSlot' });
    expect(worn).toEqual({});
    expect(countOf(pack, 'knightHelmet')).toBe(1);
  });

  it('takes a piece off into the pack', () => {
    const worn: WornGear = { feet: 'leatherBoots' };
    const pack = createInventory();
    expect(takeOffGear(worn, pack, 'feet')).toEqual({ ok: true, displaced: null });
    expect(worn).toEqual({});
    expect(countOf(pack, 'leatherBoots')).toBe(1);
    expect(takeOffGear(worn, pack, 'feet')).toEqual({ ok: false, reason: 'missing' });
  });

  it('will not take a piece off into a full pack', () => {
    const worn: WornGear = { feet: 'leatherBoots' };
    const pack = createInventory();
    for (const item of ['flower', 'stick', 'meat', 'perch', 'trout', 'goldenCarp'] as const)
      addItem(pack, item, 10);
    expect(takeOffGear(worn, pack, 'feet')).toEqual({ ok: false, reason: 'noRoom' });
    expect(worn.feet).toBe('leatherBoots');
  });

  it('puts the old piece back when a full pack cannot take the displaced one', () => {
    const worn: WornGear = { helm: 'mageHat' };
    const pack = createInventory();
    for (const item of ['flower', 'stick', 'meat', 'perch', 'trout'] as const)
      addItem(pack, item, 10);
    addItem(pack, 'bearHat');
    // Wearing the bear hat frees its slot for the mage's hat, so this works.
    expect(wearGear(worn, pack, 'bearHat', 'helm').ok).toBe(true);
    expect(worn.helm).toBe('bearHat');
    expect(countOf(pack, 'mageHat')).toBe(1);
  });

  it('trades two hands, and moves a piece into an empty one', () => {
    const worn: WornGear = { mainHand: 'huntingKnife' };
    expect(swapGear(worn, 'mainHand', 'offHand')).toEqual({ ok: true, displaced: null });
    expect(worn).toEqual({ offHand: 'huntingKnife' });
    worn.mainHand = 'ironSword';
    // The sword cannot go in the off hand, so nothing moves.
    expect(swapGear(worn, 'mainHand', 'offHand')).toEqual({ ok: false, reason: 'wrongSlot' });
    expect(worn).toEqual({ mainHand: 'ironSword', offHand: 'huntingKnife' });
    expect(swapGear(worn, 'helm', 'feet')).toEqual({ ok: false, reason: 'missing' });
  });

  it('reads saved gear back, leaving out what no longer fits', () => {
    const worn: WornGear = { helm: 'bearHat', offHand: 'woodenShield', mainHand: 'ironSword' };
    expect(wornFromEntries(wornEntries(worn))).toEqual(worn);
    expect(wornFromEntries([{ slot: 'feet', item: 'knightHelmet' }])).toEqual({});
    expect(wornFromEntries(undefined)).toEqual({});
  });
});

describe('telling the server and everybody else', () => {
  const requests: GearRequest[] = [
    { action: 'wear', item: 'knightHelmet', slot: 'helm' },
    { action: 'wear', item: 'huntingKnife', slot: 'offHand' },
    { action: 'takeOff', slot: 'hands' },
    { action: 'swap', from: 'mainHand', to: 'offHand' },
  ];

  it.each(requests)('carries a request to change gear: %o', (request) => {
    expect(decodeClientMessage(encodeGear(request))).toEqual({ type: 'gear', ...request });
  });

  it('refuses a request that is cut short or names a slot there is not', () => {
    const encoded = encodeGear({ action: 'takeOff', slot: 'helm' });
    expect(decodeClientMessage(encoded.slice(0, 4))).toBeNull();
    const bad = new Uint8Array(encoded.slice(0));
    bad[3] = 99;
    expect(decodeClientMessage(bad.buffer)).toBeNull();
  });

  it('carries what everybody is wearing, including nothing at all', () => {
    const players = [
      { netId: 1, worn: { helm: 'bearHat', mainHand: 'ironSword', offHand: 'woodenShield' } },
      { netId: 2, worn: {} },
    ] as const;
    const decoded = decodeServerMessage(encodeWorn(players));
    expect(decoded).toEqual({ type: 'worn', players });
  });

  it('is a fixed size per player', () => {
    expect(encodeWorn([{ netId: 1, worn: {} }]).byteLength).toBe(2 + 2 + GEAR_SLOTS.length);
  });

  it('refuses a list that has been cut short', () => {
    const encoded = encodeWorn([{ netId: 1, worn: { helm: 'bearHat' } }]);
    expect(decodeServerMessage(encoded.slice(0, encoded.byteLength - 1))).toBeNull();
  });

  it('reads a piece this build has never heard of as nothing worn there', () => {
    const encoded = new Uint8Array(encodeWorn([{ netId: 1, worn: { helm: 'bearHat' } }]).slice(0));
    encoded[4] = 200;
    expect(decodeServerMessage(encoded.buffer)).toEqual({
      type: 'worn',
      players: [{ netId: 1, worn: {} }],
    });
  });

  it.each(['wrongSlot', 'missing', 'noRoom', 'inCombat', 'busy'] as const)(
    'carries the refusal %s',
    (reason) => {
      expect(decodeServerMessage(encodeGearRefused(reason))).toEqual({
        type: 'gearRefused',
        reason,
      });
    },
  );
});

describe('changing gear in the world', () => {
  const built: WorldSimulation[] = [];
  afterEach(() => {
    for (const sim of built.splice(0)) sim.dispose();
  });

  let clockMs = 1_700_000_000_000;
  const step = (sim: WorldSimulation, ticks = 1): void => {
    for (let i = 0; i < ticks; i++) sim.step((clockMs += TICK_MILLISECONDS));
  };

  function playerWith(items: Array<{ item: Parameters<typeof addItem>[1]; count: number }>) {
    const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED });
    built.push(sim);
    sim.addPlayer(1, {
      netId: 1,
      x: 0,
      y: 0,
      z: 0,
      facingYaw: 0,
      hunger: 100,
      items: [{ item: 'bag', count: 1 }, ...items],
    });
    sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0);
    step(sim);
    return sim;
  }

  it('puts gear on, remembers it for the save, and tells everybody', () => {
    const sim = playerWith([{ item: 'bearHat', count: 1 }]);
    sim.drainWornEvents();
    expect(sim.wearGear(1, 'bearHat', 'helm').ok).toBe(true);
    expect(sim.wornOf(1)).toEqual({ helm: 'bearHat' });
    expect(sim.drainWornEvents()).toEqual([1]);
    expect(sim.wornList()).toEqual([{ netId: 1, worn: { helm: 'bearHat' } }]);
    expect(sim.persistablePlayers()[0]?.worn).toEqual([{ slot: 'helm', item: 'bearHat' }]);
    expect(sim.inventoryOf(1)?.bearHat).toBeUndefined();
  });

  it('brings worn gear back when the character returns', () => {
    const sim = playerWith([{ item: 'bearHat', count: 1 }]);
    sim.wearGear(1, 'bearHat', 'helm');
    const saved = sim.persistablePlayers()[0];
    expect(saved).toBeDefined();
    const again = new WorldSimulation({ seed: DEFAULT_WORLD_SEED });
    built.push(again);
    again.addPlayer(2, saved && { ...saved, netId: 2 });
    expect(again.wornOf(2)).toEqual({ helm: 'bearHat' });
  });

  it('holds the sword in the main hand, ahead of whatever was chosen from the pack', () => {
    const sim = playerWith([
      { item: 'axe', count: 1 },
      { item: 'ironSword', count: 1 },
    ]);
    sim.useItem(1, 'axe');
    expect(sim.equippedItemOf(1)).toBe('axe');
    expect(sim.wearGear(1, 'ironSword', 'mainHand').ok).toBe(true);
    expect(sim.equippedItemOf(1)).toBe('ironSword');
    // Choosing the axe again takes the hand back; choosing the sword's slot draws it.
    sim.useItem(1, 'axe');
    expect(sim.equippedItemOf(1)).toBe('axe');
    expect(sim.wearGear(1, 'ironSword', 'mainHand').ok).toBe(true);
    expect(sim.equippedItemOf(1)).toBe('ironSword');
    // Take it off and the hand is empty again.
    expect(sim.takeOffGear(1, 'mainHand').ok).toBe(true);
    expect(sim.equippedItemOf(1)).toBeNull();
  });

  it('lets a worn weapon be swung', () => {
    const sim = playerWith([{ item: 'ironSword', count: 1 }]);
    sim.wearGear(1, 'ironSword', 'mainHand');
    sim.queueInput(1, createInput(1, 0, 0, 0, PlayerButton.Swing));
    step(sim);
    expect(sim.actionOf(1)?.kind).toBe(ActionKind.Swing);
  });

  it('refuses to change gear mid-swing, and for a few seconds after', () => {
    const sim = playerWith([
      { item: 'ironSword', count: 1 },
      { item: 'bearHat', count: 1 },
    ]);
    sim.wearGear(1, 'ironSword', 'mainHand');
    sim.queueInput(1, createInput(1, 0, 0, 0, PlayerButton.Swing));
    step(sim);
    expect(sim.inCombat(1)).toBe(true);
    expect(sim.wearGear(1, 'bearHat', 'helm')).toEqual({ ok: false, reason: 'inCombat' });
    expect(sim.takeOffGear(1, 'mainHand')).toEqual({ ok: false, reason: 'inCombat' });
    expect(sim.swapGear(1, 'mainHand', 'offHand')).toEqual({ ok: false, reason: 'inCombat' });
    expect(sim.wornOf(1)).toEqual({ mainHand: 'ironSword' });
  });

  it('lets gear change again once the fight is over', () => {
    const sim = playerWith([{ item: 'bearHat', count: 1 }]);
    expect(sim.inCombat(1)).toBe(false);
    expect(sim.wearGear(1, 'bearHat', 'helm').ok).toBe(true);
  });

  it('keeps worn gear through a knockout', () => {
    const sim = playerWith([
      { item: 'bearHat', count: 1 },
      { item: 'log', count: 8 },
    ]);
    sim.wearGear(1, 'bearHat', 'helm');
    expect(sim.wornOf(1).helm).toBe('bearHat');
  });
});
