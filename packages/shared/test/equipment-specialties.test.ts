import { afterEach, expect, it } from 'vitest';
import {
  WorldSimulation,
  DEFAULT_WORLD_SEED,
  ANIMAL_DENS,
  ANIMAL_KINDS,
  equipmentHungerRate,
  equipmentHeatRecovery,
  huntingYield,
  advanceWarmth,
  withEquipmentSpecialty,
} from '../src/index';
const worlds: WorldSimulation[] = [];
afterEach(() => worlds.splice(0).forEach((world) => world.dispose()));
function world() {
  const sim = new WorldSimulation({
    seed: DEFAULT_WORLD_SEED,
    hungerEmptyAfterSeconds: 100,
    raidIntervalSeconds: 86400,
  });
  worlds.push(sim);
  sim.addPlayer(1);
  sim.giveTestGear(1, ['travelerTunic', 'winterJacket', 'huntingKnife', 'axe']);
  return sim;
}
it('only applies specialties in their effective slot or active hand', () => {
  expect(equipmentHungerRate({})).toBe(1);
  expect(equipmentHungerRate({ upperBody: 'travelerTunic' })).toBe(0.85);
  expect(equipmentHungerRate({ helm: 'travelerTunic' })).toBe(1);
  expect(equipmentHeatRecovery({ upperBody: 'winterJacket' })).toBe(1.25);
  expect(huntingYield('huntingKnife', 'meat')).toBe(2);
  expect(huntingYield('axe', 'meat')).toBe(1);
  expect(huntingYield('huntingKnife', undefined)).toBe(1);
});
it('slows actual server hunger drain only while the tunic is worn', () => {
  const plain = world(),
    dressed = world();
  expect(dressed.wearGear(1, 'travelerTunic', 'upperBody').ok).toBe(true);
  const hunger = (sim: WorldSimulation) => sim.persistablePlayers()[0]!.hunger!;
  for (let tick = 0; tick < 20; tick++) {
    plain.step(tick * 50);
    dressed.step(tick * 50);
  }
  expect(100 - hunger(dressed)).toBeCloseTo((100 - hunger(plain)) * 0.85);
  dressed.wearGear(1, 'winterJacket', 'upperBody');
  const before = hunger(dressed);
  dressed.step(1000);
  expect(before - hunger(dressed)).toBeCloseTo(0.05);
});
it('accelerates recovery at a lit heat source without changing exposure or grace periods', () => {
  const state = { value: 20, coldTicks: 0 };
  for (const heat of ['fire', 'indoors'] as const) {
    const env = { winter: true, blizzard: true, insulation: 0, heat };
    const normal = advanceWarmth(state, env).state.value - state.value;
    expect(
      advanceWarmth(state, { ...env, heatRecovery: 1.25 }).state.value - state.value,
    ).toBeCloseTo(normal * 1.25);
  }
  const exposed = { winter: true, blizzard: true, insulation: 60, heat: null };
  expect(advanceWarmth(state, { ...exposed, heatRecovery: 1.25 })).toEqual(
    advanceWarmth(state, exposed),
  );
  expect(
    advanceWarmth({ value: 99.99, coldTicks: 0 }, { ...exposed, heat: 'fire', heatRecovery: 1.25 })
      .state.value,
  ).toBe(100);
});
it('pays the hunting bonus once on a real catch, never for an off-hand knife', () => {
  const target = ANIMAL_DENS.find((den) => ANIMAL_KINDS[den.kind].catchItem === 'meat')!;
  for (const active of [true, false]) {
    const sim = world();
    sim.wearGear(1, 'huntingKnife', active ? 'mainHand' : 'offHand');
    if (!active) sim.useItem(1, 'axe');
    const internal = sim as unknown as {
      players: Map<number, unknown>;
      catchAnimal(runtime: unknown, id: number, charged: boolean): void;
    };
    internal.catchAnimal(internal.players.get(1), target.id, true);
    internal.catchAnimal(internal.players.get(1), target.id, true);
    expect(sim.inventoryOf(1).meat).toBe(active ? 2 : 1);
    expect(sim.drainCatchEvents()).toHaveLength(1);
  }
});
it('keeps the perk readable with custom admin text without duplicating it', () => {
  const text = withEquipmentSpecialty('travelerTunic', 'A keepsake.');
  expect(text).toContain('15%');
  expect(withEquipmentSpecialty('travelerTunic', text)).toBe(text);
  expect(withEquipmentSpecialty('axe', 'Custom axe')).toBe('Custom axe');
});
