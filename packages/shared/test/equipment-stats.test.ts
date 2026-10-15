import { afterEach, describe, expect, it } from 'vitest';
import {
  ANIMAL_DENS,
  DEFAULT_WORLD_SEED,
  WorldSimulation,
  characterStats,
  statsWithItem,
  encodeHealth,
  decodeServerMessage,
  EQUIPMENT_BONUSES,
  GEAR_ITEMS,
  gearSlotsOf,
  TOOL_ITEMS,
} from '../src/index';
const worlds: WorldSimulation[] = [];
afterEach(() => worlds.splice(0).forEach((sim) => sim.dispose()));
function world() {
  const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED });
  worlds.push(sim);
  sim.addPlayer(1);
  sim.giveTestGear(1, ['ironSword', 'huntingKnife', 'axe', 'refinedAxe']);
  return sim;
}
describe('equipment power', () => {
  it('uses the active hand rather than a holstered weapon or off-hand knife', () => {
    expect(characterStats({ mainHand: 'ironSword' }).power).toBe(150);
    expect(characterStats({ mainHand: 'ironSword' }, 'axe').power).toBe(110);
    expect(characterStats({ mainHand: 'ironSword' }, 'refinedAxe').power).toBe(125);
    expect(characterStats({ offHand: 'huntingKnife' }, 'axe').power).toBe(110);
    expect(characterStats({ mainHand: 'ironSword' }, 'berry').power).toBe(100);
    expect(characterStats({}, null).power).toBe(100);
  });
  it('compares the slot that right-click actually chooses, without mutating worn gear', () => {
    const worn = { mainHand: 'ironSword' } as const;
    expect(statsWithItem(worn, 'ironSword', 'huntingKnife').power).toBe(150);
    expect(statsWithItem(worn, 'axe', 'ironSword').power).toBe(150);
    expect(statsWithItem(worn, 'ironSword', 'huntingKnife', 'mainHand').power).toBe(125);
    expect(worn).toEqual({ mainHand: 'ironSword' });
  });
  it('makes a worn sword stronger against wildlife while a selected axe uses only its own bonus', () => {
    const sim = world();
    const target = ANIMAL_DENS.find((animal) => animal.kind === 'maskedRaccoon')!;
    expect(target).toBeDefined();
    sim.wearGear(1, 'ironSword', 'mainHand');
    const internal = sim as unknown as {
      players: Map<number, unknown>;
      catchAnimal(runtime: unknown, id: number, charged: boolean): void;
    };
    internal.catchAnimal(internal.players.get(1), target.id, false);
    expect(sim.drainThreatHitEvents().at(-1)?.hitsLeft).toBe(2);
    internal.catchAnimal(internal.players.get(1), target.id, false);
    expect(sim.drainCatchEvents().at(-1)?.netId).toBe(1);
    const baseline = world();
    const other = ANIMAL_DENS.find((animal) => animal.kind === 'maskedRaccoon')!;
    baseline.wearGear(1, 'ironSword', 'mainHand');
    baseline.useItem(1, 'axe');
    const ordinary = baseline as unknown as typeof internal;
    ordinary.catchAnimal(ordinary.players.get(1), other.id, false);
    ordinary.catchAnimal(ordinary.players.get(1), other.id, false);
    expect(baseline.drainThreatHitEvents().at(-1)?.hitsLeft).toBe(1);
    expect(baseline.drainCatchEvents()).toHaveLength(0);
  });
});

describe('equipment protection', () => {
  it('adds only valid worn slots and keeps hand selection separate from armor', () => {
    expect(
      characterStats({ helm: 'knightHelmet', offHand: 'woodenShield' }, 'axe').protection,
    ).toBe(23);
    expect(characterStats({ feet: 'knightHelmet' }, 'axe').protection).toBe(0);
    expect(characterStats({ offHand: 'huntingKnife' }, 'axe').protection).toBe(0);
  });
  it('reduces authoritative hostile damage and preserves ordinary damage without gear', () => {
    const protectedPlayer = world();
    protectedPlayer.giveTestGear(1, ['woodenShield']);
    expect(protectedPlayer.wearGear(1, 'woodenShield', 'offHand').ok).toBe(true);
    const strike = (sim: WorldSimulation) =>
      (
        sim as unknown as { raiderStrikesPlayer(id: number, damage: number, tick: number): void }
      ).raiderStrikesPlayer(1, 20, sim.tick);
    strike(protectedPlayer);
    expect(protectedPlayer.healthOf(1)).toBe(83);
    expect(protectedPlayer.drainHealthEvents().at(-1)?.health).toBe(83);
    const ordinary = world();
    strike(ordinary);
    expect(ordinary.healthOf(1)).toBe(80);
  });
});

it('lets a player make and wear a protective shield with ordinary gathered supplies', () => {
  const sim = world();
  Object.assign(sim.inventoryOf(1), { log: 4, rope: 1 });
  expect(sim.craftItem(1, 'woodenShield')).toBe(true);
  expect(sim.wearGear(1, 'woodenShield', 'offHand').ok).toBe(true);
  expect(characterStats(sim.wornOf(1), sim.equippedItemOf(1)).protection).toBe(15);
  expect(sim.inventoryOf(1).log).toBeUndefined();
  expect(sim.inventoryOf(1).rope).toBeUndefined();
});

describe('equipment vitality', () => {
  it('raises the cap without healing, clamps removal, and cannot heal by repeatedly swapping', () => {
    const sim = world();
    sim.giveTestGear(1, ['bearHat']);
    expect(sim.wearGear(1, 'bearHat', 'helm').ok).toBe(true);
    expect(characterStats(sim.wornOf(1)).vitality).toBe(115);
    expect(sim.healthOf(1)).toBe(100);
    const saved = sim.persistablePlayers()[0]!;
    sim.removePlayer(1);
    sim.addPlayer(1, { ...saved, health: 115 });
    expect(sim.takeOffGear(1, 'helm').ok).toBe(true);
    expect(sim.healthOf(1)).toBe(100);
    const adjustment = sim.drainHealthEvents().at(-1)!;
    expect(adjustment.adjusted).toBe(true);
    expect(decodeServerMessage(encodeHealth(adjustment))).toEqual({
      type: 'health',
      event: adjustment,
    });
    expect(sim.wearGear(1, 'bearHat', 'helm').ok).toBe(true);
    expect(sim.healthOf(1)).toBe(100);
  });
  it('restores the derived cap on reconnect and heals meals up to that cap', () => {
    const sim = world();
    const saved = sim.persistablePlayers()[0]!;
    sim.removePlayer(1);
    sim.addPlayer(1, {
      ...saved,
      health: 114,
      worn: [{ slot: 'helm', item: 'bearHat' }],
      meal: { item: 'forestStew', ticksLeft: 1 },
    });
    sim.step(1000);
    expect(sim.healthOf(1)).toBe(115);
    expect(sim.persistablePlayers()[0]?.health).toBe(115);
  });
  it('wakes a knocked-out player at their equipment cap', () => {
    const sim = world();
    sim.giveTestGear(1, ['bearHat']);
    sim.wearGear(1, 'bearHat', 'helm');
    (
      sim as unknown as { raiderStrikesPlayer(id: number, damage: number, tick: number): void }
    ).raiderStrikesPlayer(1, 500, sim.tick);
    expect(sim.drainHealthEvents().at(-1)).toMatchObject({ health: 115, knockedOut: true });
    expect(sim.healthOf(1)).toBe(115);
  });
});

it('preserves fractional armor damage through saving and reconnecting', () => {
  const sim = world();
  sim.giveTestGear(1, ['travelerTunic']);
  expect(sim.wearGear(1, 'travelerTunic', 'upperBody').ok).toBe(true);
  (
    sim as unknown as { raiderStrikesPlayer(id: number, damage: number, tick: number): void }
  ).raiderStrikesPlayer(1, 20, sim.tick);
  expect(sim.healthOf(1)).toBeCloseTo(80.8, 8);
  const saved = sim.persistablePlayers()[0]!;
  expect(saved.health).toBeCloseTo(80.8, 8);
  sim.removePlayer(1);
  sim.addPlayer(1, saved);
  expect(sim.healthOf(1)).toBeCloseTo(80.8, 8);
});

it('gives every garment both protection and insulation, and every weapon/tool an active-hand bonus', () => {
  const clothes = GEAR_ITEMS.filter((item) =>
    gearSlotsOf(item).some((slot) => !['mainHand', 'offHand'].includes(slot)),
  );
  for (const item of clothes) {
    expect(EQUIPMENT_BONUSES[item]?.protection, item).toBeGreaterThan(0);
    expect(EQUIPMENT_BONUSES[item]?.warmth, item).toBeGreaterThan(0);
  }
  for (const item of [...TOOL_ITEMS, 'ironSword', 'huntingKnife', 'torch'] as const) {
    expect(characterStats({}, item).power, item).toBeGreaterThan(100);
  }
});
