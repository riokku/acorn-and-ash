import { afterEach, describe, expect, it } from 'vitest';
import {
  ActionKind,
  COLD_DAMAGE_INTERVAL_TICKS,
  COLD_GRACE_TICKS,
  DEFAULT_WORLD_SEED,
  PlayerButton,
  TICK_HZ,
  WorldSimulation,
  advanceWarmth,
  characterStats,
  clockShiftForSeason,
  createInput,
  decodeServerMessage,
  encodeHealth,
  encodeWarmth,
  warmthFromSaved,
  warmthView,
  type WarmthEnvironment,
  type WarmthState,
} from '../src/index';
const WINTER: WarmthEnvironment = { winter: true, blizzard: false, insulation: 0, heat: null };
const worlds: WorldSimulation[] = [];
afterEach(() => worlds.splice(0).forEach((sim) => sim.dispose()));
function world(warmth: WarmthState = { value: 100, coldTicks: 0 }, health = 100) {
  const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED, raidIntervalSeconds: 86400 });
  worlds.push(sim);
  sim.setCalendarShift(clockShiftForSeason(sim.seed, 0, 'winter'));
  sim.setTestWeather('storm');
  sim.addPlayer(1, {
    netId: 1,
    x: 0,
    y: 0,
    z: 0,
    facingYaw: 0,
    hunger: 100,
    health,
    items: [],
    warmth,
  });
  sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0);
  return sim;
}
describe('winter exposure', () => {
  it('warns well before zero and gives a grace period, followed by slow periodic damage', () => {
    let state = warmthFromSaved(null),
      damage = 0,
      firstDamageTick = 0,
      warningTick = 0;
    for (let tick = 1; tick <= 205 * TICK_HZ; tick++) {
      const next = advanceWarmth(state, WINTER);
      state = next.state;
      damage += next.damage;
      if (warmthView(state, WINTER).status === 'cold' && !warningTick) warningTick = tick;
      if (next.damage && !firstDamageTick) firstDamageTick = tick;
    }
    expect(warningTick / TICK_HZ).toBeGreaterThan(100);
    expect(firstDamageTick / TICK_HZ).toBeGreaterThan(200);
    expect(firstDamageTick - warningTick).toBeGreaterThan(COLD_GRACE_TICKS);
    expect(damage).toBe(1);
    state = { value: 0, coldTicks: COLD_GRACE_TICKS };
    for (let tick = 1; tick < COLD_DAMAGE_INTERVAL_TICKS; tick++) {
      const next = advanceWarmth(state, WINTER);
      state = next.state;
      expect(next.damage).toBe(0);
    }
    expect(advanceWarmth(state, WINTER).damage).toBe(1);
  });
  it('makes partial insulation useful, needs more for blizzards and recovers safely in shelter', () => {
    const start = { value: 50, coldTicks: 0 };
    const bare = advanceWarmth(start, WINTER).state.value;
    const partial = advanceWarmth(start, { ...WINTER, insulation: 25 }).state.value;
    expect(partial).toBeGreaterThan(bare);
    expect(advanceWarmth(start, { ...WINTER, insulation: 60 }).state.value).toBeGreaterThan(50);
    expect(
      advanceWarmth(start, { ...WINTER, insulation: 60, blizzard: true }).state.value,
    ).toBeLessThan(50);
    for (const heat of ['fire', 'indoors'] as const) {
      const next = advanceWarmth(
        { value: 0, coldTicks: COLD_GRACE_TICKS + 99 },
        { ...WINTER, heat },
      );
      expect(next.damage).toBe(0);
      expect(next.state.value).toBeGreaterThan(0);
      expect(next.state.coldTicks).toBe(0);
    }
    expect(advanceWarmth(start, { ...WINTER, winter: false }).state.value).toBeGreaterThan(50);
  });
  it('validates old and malformed saves, preserving an already-cold countdown', () => {
    for (const saved of [
      undefined,
      null,
      { value: NaN, coldTicks: 1 },
      { value: -1, coldTicks: 0 },
      { value: 0, coldTicks: 0.5 },
    ])
      expect(warmthFromSaved(saved)).toEqual({ value: 100, coldTicks: 0 });
    expect(warmthFromSaved({ value: 0, coldTicks: 690 })).toEqual({ value: 0, coldTicks: 690 });
    expect(warmthFromSaved({ value: 10, coldTicks: 500 })).toEqual({ value: 10, coldTicks: 0 });
  });
});
describe('authoritative winter warmth', () => {
  it('continues exposure without incoming inputs and cannot be dodged or blocked with armor', () => {
    const sim = world({ value: 0, coldTicks: COLD_GRACE_TICKS + COLD_DAMAGE_INTERVAL_TICKS - 1 });
    sim.giveTestGear(1, ['woodenShield']);
    sim.wearGear(1, 'woodenShield', 'offHand');
    sim.queueInput(1, createInput(1, 0, 1, 0, PlayerButton.Dodge));
    sim.step(1000);
    expect(sim.healthOf(1)).toBe(99);
    expect(sim.actionOf(1)?.kind).toBe(ActionKind.Dodge);
    const event = sim.drainHealthEvents().at(-1)!;
    expect(event).toMatchObject({ cold: true, dodged: false, knockedOut: false });
    expect(decodeServerMessage(encodeHealth(event))).toEqual({ type: 'health', event });
    for (let tick = 0; tick < COLD_DAMAGE_INTERVAL_TICKS; tick++) sim.step(1050 + tick * 50);
    expect(sim.healthOf(1)).toBe(98);
  });
  it('warms by any nearby lit fire, ignoring a closer unlit one, and stops after expiry', () => {
    const sim = world({ value: 12, coldTicks: 0 });
    sim.restoreBuiltProps([
      {
        id: 500,
        kind: 'campfire',
        x: 1,
        z: 0,
        yaw: 0,
        lit: false,
        ownerKey: null,
        litUntilMs: null,
      },
      {
        id: 501,
        kind: 'campfire',
        x: 3,
        z: 0,
        yaw: 0,
        lit: true,
        ownerKey: null,
        litUntilMs: 1500,
      },
    ]);
    sim.step(1000);
    expect(sim.warmthOf(1).heat).toBe('fire');
    expect(sim.warmthStateOf(1).value).toBeGreaterThan(12);
    sim.step(2000);
    expect(sim.warmthOf(1).heat).toBeNull();
    expect(sim.warmthOf(1).status).toBe('cold');
  });
  it('does not warm from distant fires or through a large height difference', () => {
    const sim = world({ value: 12, coldTicks: 0 });
    sim.restoreBuiltProps([
      {
        id: 501,
        kind: 'campfire',
        x: 3,
        z: 0,
        yaw: 0,
        lit: true,
        ownerKey: null,
        litUntilMs: null,
      },
    ]);
    sim.placePlayer(1, { x: 0, y: 8, z: 0 }, 0);
    sim.step(1000);
    expect(sim.warmthOf(1).heat).toBeNull();
    sim.placePlayer(1, { x: -10, y: 0, z: 0 }, 0);
    sim.step(1050);
    expect(sim.warmthOf(1).heat).toBeNull();
  });
  it('crafts warm clothing from gathered fibers and saves its derived rating and exposure', () => {
    const sim = world({ value: 12, coldTicks: 0 });
    Object.assign(sim.inventoryOf(1), { reed: 12, rope: 3 });
    expect(sim.craftItem(1, 'winterJacket')).toBe(true);
    expect(sim.craftItem(1, 'mageHat')).toBe(true);
    expect(sim.wearGear(1, 'winterJacket', 'upperBody').ok).toBe(true);
    expect(sim.wearGear(1, 'mageHat', 'helm').ok).toBe(true);
    expect(characterStats(sim.wornOf(1)).warmth).toBe(75);
    sim.step(1000);
    expect(sim.warmthOf(1).status).toBe('warming');
    const saved = sim.persistablePlayers()[0]!;
    sim.removePlayer(1);
    sim.addPlayer(1, saved);
    expect(sim.warmthStateOf(1)).toEqual(saved.warmth);
    expect(characterStats(sim.wornOf(1)).warmth).toBe(75);
  });
  it('restores cold exposure across reconnects instead of granting a fresh grace period', () => {
    const sim = world({ value: 0, coldTicks: 690 });
    const saved = sim.persistablePlayers()[0]!;
    sim.removePlayer(1);
    sim.addPlayer(1, saved);
    for (let i = 0; i < 10; i++) sim.step(1000 + i * 50);
    expect(sim.healthOf(1)).toBe(99);
  });
  it('recovers indoors even when the outdoor fire is in a different coordinate space', () => {
    const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED });
    worlds.push(sim);
    sim.setCalendarShift(clockShiftForSeason(sim.seed, 0, 'winter'));
    sim.restoreBuiltProps([
      {
        id: 900,
        kind: 'cabin',
        x: 12,
        z: 12,
        yaw: 0,
        lit: false,
        ownerKey: 'owner',
        litUntilMs: null,
      },
    ]);
    sim.addPlayer(
      1,
      {
        netId: 1,
        x: 0,
        y: 0,
        z: 0,
        facingYaw: 0,
        hunger: 100,
        items: [],
        warmth: { value: 10, coldTicks: 0 },
      },
      'owner',
    );
    sim.step(1000);
    expect(sim.warmthOf(1).heat).toBe('indoors');
    expect(sim.warmthStateOf(1).value).toBeGreaterThan(10);
  });
});
it('round-trips private warmth views and rejects truncated and inconsistent messages', () => {
  const freezing = warmthView({ value: 0, coldTicks: 690 }, WINTER);
  expect(decodeServerMessage(encodeWarmth(freezing))).toEqual({ type: 'warmth', ...freezing });
  const warm = warmthView({ value: 20, coldTicks: 0 }, { ...WINTER, heat: 'fire' });
  expect(decodeServerMessage(encodeWarmth(warm))).toEqual({ type: 'warmth', ...warm });
  expect(decodeServerMessage(encodeWarmth(warm).slice(0, -1))).toBeNull();
  const invalid = encodeWarmth(freezing);
  new DataView(invalid).setUint8(1, 101);
  expect(decodeServerMessage(invalid)).toBeNull();
});

it('shows one health point while fractional health remains and preserves the actual value', () => {
  const sim = world(
    { value: 0, coldTicks: COLD_GRACE_TICKS + COLD_DAMAGE_INTERVAL_TICKS - 1 },
    1.4,
  );
  sim.step(1000);
  expect(sim.healthOf(1)).toBeCloseTo(0.4, 8);
  const event = sim.drainHealthEvents().at(-1)!;
  expect(event).toMatchObject({ health: 1, knockedOut: false });
  expect(decodeServerMessage(encodeHealth(event))).toEqual({ type: 'health', event });
  expect(decodeServerMessage(encodeHealth({ ...event, health: 0.4 }))).toMatchObject({
    event: { health: 1 },
  });
  expect(sim.persistablePlayers()[0]?.health).toBeCloseTo(0.4, 8);
});
