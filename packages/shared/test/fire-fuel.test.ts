import { afterEach, expect, it } from 'vitest';
import {
  WorldSimulation,
  DEFAULT_WORLD_SEED,
  FIRE_LOG_MS,
  FIRE_CAPACITY_MS,
  HUNGER_MAX,
  logStorageSpot,
  countOf,
  clockShiftForSeason,
  encodeFireRequest,
  encodeFireFuel,
  decodeClientMessage,
  decodeServerMessage,
  createInput,
  PlayerButton,
  type BuildableKindId,
  type FireRequest,
} from '../src/index';
const worlds: WorldSimulation[] = [];
afterEach(() => worlds.splice(0).forEach((sim) => sim.dispose()));
function setup(kind: BuildableKindId = 'campfire') {
  const sim = new WorldSimulation({
    seed: DEFAULT_WORLD_SEED,
    forestEncounters: false,
    hungerEmptyAfterSeconds: Infinity,
  });
  worlds.push(sim);
  sim.restoreBuiltProps([
    { id: 7, kind, x: 0, z: 0, yaw: 0, lit: false, litUntilMs: null, ownerKey: 'owner' },
  ]);
  sim.addPlayer(
    1,
    {
      netId: 1,
      x: 0,
      y: 0,
      z: 0,
      facingYaw: 0,
      hunger: HUNGER_MAX,
      items: [
        { item: 'bag', count: 1 },
        { item: 'log', count: 20 },
      ],
    },
    'owner',
  );
  sim.placePlayer(
    1,
    kind === 'campfire' ? { x: 0, y: 0, z: 1.5 } : { x: 2, y: 0, z: -1.08 },
    0,
    kind === 'campfire' ? 0 : 7,
  );
  return sim;
}
it.each(['campfire', 'cabin', 'teepee', 'largeCabin'] as const)(
  '%s spends a log for exactly ten minutes of flame',
  (kind) => {
    const sim = setup(kind);
    expect(sim.fireIsLit(7)).toBe(false);
    expect(sim.requestFire(1, { propId: 7, action: 'addLog' }, 1000)).toBe(true);
    expect(countOf(sim.inventoryOf(1), 'log')).toBe(19);
    expect(sim.fireFuelRemainingMs(7, 1000)).toBe(FIRE_LOG_MS);
    expect(sim.fireIsLit(7, 1000 + FIRE_LOG_MS - 1)).toBe(true);
    expect(sim.fireIsLit(7, 1000 + FIRE_LOG_MS)).toBe(false);
    sim.extinguishBurnedOutCampfires(1000 + FIRE_LOG_MS);
    expect(sim.builtPropsList()[0]?.lit).toBe(false);
  },
);
it('caps fires at five whole logs without wasting a sixth, and preserves extinguished fuel', () => {
  const sim = setup();
  for (let i = 0; i < 5; i++)
    expect(sim.requestFire(1, { propId: 7, action: 'addLog' }, 1000)).toBe(true);
  expect(sim.fireFuelRemainingMs(7, 1000)).toBe(FIRE_CAPACITY_MS);
  expect(sim.requestFire(1, { propId: 7, action: 'addLog' }, 2000)).toBe(false);
  sim.requestFire(1, { propId: 7, action: 'toggle' }, 61_000);
  expect(sim.fireFuelRemainingMs(7, 9_000_000)).toBe(FIRE_CAPACITY_MS - 60_000);
  sim.requestFire(1, { propId: 7, action: 'toggle' }, 999_000);
  expect(countOf(sim.inventoryOf(1), 'log')).toBe(15);
  expect(sim.fireFuelRemainingMs(7, 999_000)).toBe(FIRE_CAPACITY_MS - 60_000);
});
it('refuses free, distant, elevated and cross-space ignition', () => {
  const sim = setup();
  sim.inventoryOf(1).log = 0;
  expect(sim.requestFire(1, { propId: 7, action: 'toggle' }, 1000)).toBe(false);
  sim.inventoryOf(1).log = 5;
  for (const p of [
    { x: 0, y: 0, z: 20 },
    { x: 0, y: 40, z: 1.5 },
  ]) {
    sim.placePlayer(1, p, 0);
    expect(sim.requestFire(1, { propId: 7, action: 'addLog' }, 1000)).toBe(false);
  }
  sim.placePlayer(1, { x: 0, y: 0, z: 1.5 }, 0, 9);
  expect(sim.requestFire(1, { propId: 7, action: 'addLog' }, 1000)).toBe(false);
  expect(countOf(sim.inventoryOf(1), 'log')).toBe(5);
});
it.each(['cabin', 'largeCabin'] as const)(
  'caps %s storage and withdraws through inventory without feeding the fire',
  (kind) => {
    const sim = setup(kind),
      capacity = kind === 'cabin' ? 20 : 50;
    const spot = logStorageSpot(sim.builtPropsList()[0]!);
    sim.placePlayer(1, { x: spot.x - 1.2, z: spot.z, y: 0 }, 0);
    sim.inventoryOf(1).log = capacity;
    expect(sim.requestFire(1, { propId: 7, action: 'storeLogs', amount: 50 })).toBe(true);
    expect(sim.fireFuelViews()[0]?.storedLogs).toBe(capacity);
    expect(countOf(sim.inventoryOf(1), 'log')).toBe(0);
    sim.inventoryOf(1).log = 1;
    expect(sim.requestFire(1, { propId: 7, action: 'storeLogs' })).toBe(false);
    expect(sim.requestFire(1, { propId: 7, action: 'takeLogs', amount: 5 })).toBe(true);
    expect(countOf(sim.inventoryOf(1), 'log')).toBe(6);
    expect(sim.fireFuelViews()[0]?.storedLogs).toBe(capacity - 5);
    expect(sim.fireFuelRemainingMs(7)).toBe(0);
    expect(sim.collision.colliders.some((c) => Math.abs(c.x - spot.x) < 0.01)).toBe(true);
    sim.addPlayer(2, undefined, 'visitor');
    sim.placePlayer(2, { ...spot, x: spot.x - 1.2, y: 0 }, 0);
    expect(sim.requestFire(2, { propId: 7, action: 'takeLogs' })).toBe(false);
    sim.placePlayer(1, { x: 20, y: 0, z: 20 }, 0);
    expect(sim.requestFire(1, { propId: 7, action: 'takeLogs' })).toBe(false);
  },
);
it('restores paused fuel and logs, and catches up elapsed burning time', () => {
  const sim = setup('cabin');
  const restored = new WorldSimulation({ seed: sim.seed, forestEncounters: false });
  worlds.push(restored);
  restored.restoreBuiltProps([
    {
      ...sim.builtPropsList()[0]!,
      storedLogs: 12,
      ownerKey: 'owner',
      fuelMs: 540_000,
      litUntilMs: null,
      lit: false,
    },
  ]);
  expect(restored.fireFuelViews(9_000_000)[0]).toMatchObject({
    storedLogs: 12,
    remainingMs: 540_000,
    lit: false,
  });
  const active = new WorldSimulation({ seed: sim.seed, forestEncounters: false });
  worlds.push(active);
  active.restoreBuiltProps([
    {
      ...sim.builtPropsList()[0]!,
      storedLogs: 12,
      ownerKey: 'owner',
      fuelMs: 600_000,
      litUntilMs: 601_000,
      lit: true,
    },
  ]);
  active.extinguishBurnedOutCampfires(700_000);
  expect(active.fireFuelViews(700_000)[0]).toMatchObject({
    storedLogs: 12,
    remainingMs: 0,
    lit: false,
  });
});
it('cooking and indoor winter recovery require burning fuel', () => {
  const sim = setup('cabin');
  sim.setCalendarShift(clockShiftForSeason(sim.seed, 0, 'winter'));
  expect(sim.nearCookingFireOf(1)).toBe(false);
  sim.requestFire(1, { propId: 7, action: 'addLog' }, 1000);
  sim.step(1000);
  expect(sim.warmthOf(1).heat).toBe('indoors');
  expect(sim.nearCookingFireOf(1)).toBe(true);
  sim.step(1000 + FIRE_LOG_MS);
  expect(sim.nearCookingFireOf(1)).toBe(false);
  expect(sim.warmthOf(1).heat).toBe(null);
});
it('round-trips actions and fuel/storage and rejects malformed or overfilled messages', () => {
  for (const request of [
    { propId: 7, action: 'addLog' },
    { propId: 7, action: 'toggle' },
    { propId: 7, action: 'storeLogs', amount: 20 },
    { propId: 7, action: 'takeLogs', amount: 5 },
  ] satisfies FireRequest[]) {
    const encoded = encodeFireRequest(request);
    expect(decodeClientMessage(encoded)).toEqual({ type: 'fire', ...request });
    expect(decodeClientMessage(encoded.slice(0, -1))).toBe(null);
    new Uint8Array(encoded)[3] = 9;
    expect(decodeClientMessage(encoded)).toBe(null);
  }
  const fire = { propId: 7, lit: true, remainingMs: 600_000, storedLogs: 20 };
  expect(decodeServerMessage(encodeFireFuel([fire]))).toEqual({ type: 'fireFuel', fires: [fire] });
  expect(decodeServerMessage(encodeFireFuel([fire, fire]))).toBe(null);
  expect(
    decodeServerMessage(encodeFireFuel([{ ...fire, remainingMs: FIRE_CAPACITY_MS + 1 }])),
  ).toBe(null);
});

it('withdraws only what fits and leaves a full pack and its storage unchanged', () => {
  const sim = setup('cabin'),
    spot = logStorageSpot(sim.builtPropsList()[0]!);
  sim.placePlayer(1, { x: spot.x - 1.2, z: spot.z, y: 0 }, 0);
  sim.requestFire(1, { propId: 7, action: 'storeLogs', amount: 20 });
  delete sim.inventoryOf(1).bag;
  sim.inventoryOf(1).log = 59;
  expect(sim.requestFire(1, { propId: 7, action: 'takeLogs', amount: 5 })).toBe(true);
  expect(sim.inventoryOf(1).log).toBe(60);
  expect(sim.fireFuelViews()[0]?.storedLogs).toBe(19);
  expect(sim.requestFire(1, { propId: 7, action: 'takeLogs' })).toBe(false);
  expect(sim.inventoryOf(1).log).toBe(60);
  expect(sim.fireFuelViews()[0]?.storedLogs).toBe(19);
});

it('cannot cook held food at an empty indoor fire', () => {
  const sim = setup('cabin');
  sim.inventoryOf(1).log = 0;
  sim.inventoryOf(1).meat = 1;
  sim.useItem(1, 'meat');
  sim.queueInput(1, createInput(1, 0, 0, 0, PlayerButton.Interact));
  sim.step(1000);
  expect(sim.inventoryOf(1).meat).toBe(1);
  expect(sim.inventoryOf(1).roastedMeat ?? 0).toBe(0);
  expect(sim.fireIsLit(7)).toBe(false);
});
