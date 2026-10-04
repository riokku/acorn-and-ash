import { afterEach, describe, expect, it } from 'vitest';
import {
  WorldSimulation,
  DEFAULT_WORLD_SEED,
  NO_MEAL,
  MAX_MEAL_TICKS,
  startMeal,
  advanceMeal,
  mealFromSaved,
  mealCooldown,
  MEAL_ITEMS,
  TICK_HZ,
  DODGE,
  PlayerButton,
  createInput,
  encodeMeal,
  decodeServerMessage,
  type PersistedPlayer,
} from '../src/index';
const sims: WorldSimulation[] = [];
afterEach(() => sims.splice(0).forEach((sim) => sim.dispose()));
function world(saved?: Partial<PersistedPlayer>) {
  const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED });
  sims.push(sim);
  sim.addPlayer(
    1,
    { netId: 1, x: 0, y: 0, z: 0, facingYaw: 0, hunger: 100, health: 100, items: [], ...saved },
    'cook',
  );
  sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0);
  return sim;
}
describe('one meal benefit at a time', () => {
  it('allows intentional preparation at full hunger and replaces, rather than stacks, meals', () => {
    const sim = world();
    Object.assign(sim.inventoryOf(1), {
      trailRation: 2,
      forestStew: 1,
      berryTea: 1,
      roastedMeat: 1,
    });
    expect(sim.useItem(1, 'trailRation')).toBe(true);
    expect(sim.mealStateOf(1)).toEqual(startMeal('trailRation'));
    expect(sim.inventoryOf(1).trailRation).toBe(1);
    expect(sim.hungerOf(1)).toBe(100);
    sim.useItem(1, 'forestStew');
    expect(sim.mealStateOf(1).item).toBe('forestStew');
    sim.useItem(1, 'berryTea');
    expect(sim.mealStateOf(1).item).toBe('berryTea');
    sim.useItem(1, 'roastedMeat');
    expect(sim.inventoryOf(1).roastedMeat).toBe(1);
    expect(sim.mealStateOf(1).item).toBe('berryTea');
  });
  it('saves remaining active ticks and pauses a disconnected character while others play', () => {
    const sim = world();
    sim.inventoryOf(1).trailRation = 1;
    sim.useItem(1, 'trailRation');
    sim.step(1000);
    const saved = sim.persistablePlayers()[0]!;
    expect(saved.meal?.ticksLeft).toBe(MAX_MEAL_TICKS - 1);
    sim.removePlayer(1);
    sim.addPlayer(2);
    for (let i = 0; i < 25; i++) sim.step(1050 + i * 50);
    sim.addPlayer(1, saved, 'cook');
    expect(sim.mealStateOf(1)).toEqual(saved.meal);
    sim.step(3000);
    expect(sim.mealStateOf(1).ticksLeft).toBe(MAX_MEAL_TICKS - 2);
  });
  it('reduces recovery in actual dodge actions', () => {
    const sim = world({ meal: startMeal('trailRation') });
    sim.queueInput(1, createInput(1, 0, 1, 0, PlayerButton.Dodge));
    sim.step(1000);
    expect(sim.actionOf(1)?.dodgeCooldown).toBe(Math.round(DODGE.cooldown * 0.75));
  });
  it('shortens hand gathering recovery in the authoritative simulation', () => {
    function gathered(withTea: boolean) {
      const sim = world({ meal: withTea ? startMeal('berryTea') : NO_MEAL });
      const patch = sim.gatherPatchesList().find((patch) => patch.item === 'stick')!;
      sim.placePlayer(1, { x: patch.x, y: 0, z: patch.z }, 0);
      for (let i = 0; i < 8; i++) {
        sim.requestLoot(1, { kind: 'patch', id: patch.id });
        sim.step(1000 + i * 50);
      }
      return sim.inventoryOf(1).stick ?? 0;
    }
    expect(gathered(true)).toBe(2);
    expect(gathered(false)).toBe(1);
  });
  it('heals gently on the saved cadence and never passes full health', () => {
    const sim = world({ health: 60, meal: { item: 'forestStew', ticksLeft: 201 } });
    sim.step(1000);
    expect(sim.healthOf(1)).toBe(62);
    expect(sim.drainHealthEvents().at(-1)?.health).toBe(62);
    const full = world({ health: 99, meal: { item: 'forestStew', ticksLeft: 1 } });
    full.step(1000);
    expect(full.healthOf(1)).toBe(100);
    expect(full.mealStateOf(1)).toEqual(NO_MEAL);
    expect(advanceMeal(startMeal('forestStew')).healing).toBe(0);
  });
  it('expires at ten active minutes without extending ordinary food effects', () => {
    let state = startMeal('trailRation');
    for (let i = 0; i < 10 * 60 * TICK_HZ; i++) state = advanceMeal(state).state;
    expect(state).toEqual(NO_MEAL);
    expect(mealCooldown(state, 24, 'trailRation')).toBe(24);
  });
  it('rejects malformed or unknown saved benefits', () => {
    for (const row of [
      null,
      { item: 'axe', ticksLeft: 1 },
      { item: 'trailRation', ticksLeft: 0 },
      { item: 'trailRation', ticksLeft: Infinity },
      { item: 'berryTea', ticksLeft: MAX_MEAL_TICKS + 1 },
      { item: 'forestStew', ticksLeft: 1.5 },
    ])
      expect(mealFromSaved(row)).toEqual(NO_MEAL);
  });
  it('round-trips private meal messages and rejects inconsistent timers', () => {
    for (const item of MEAL_ITEMS)
      expect(decodeServerMessage(encodeMeal(startMeal(item)))).toEqual({
        type: 'meal',
        ...startMeal(item),
      });
    expect(decodeServerMessage(encodeMeal(NO_MEAL))).toEqual({ type: 'meal', ...NO_MEAL });
    const data = encodeMeal(startMeal('berryTea'));
    expect(decodeServerMessage(data.slice(0, -1))).toBeNull();
    new DataView(data).setUint8(1, 4);
    expect(decodeServerMessage(data)).toBeNull();
    new DataView(data).setUint8(1, 0);
    expect(decodeServerMessage(data)).toBeNull();
    expect(decodeServerMessage(encodeMeal({ item: 'berryTea', ticksLeft: 0 }))).toBeNull();
    expect(
      decodeServerMessage(encodeMeal({ item: 'berryTea', ticksLeft: MAX_MEAL_TICKS + 1 })),
    ).toBeNull();
  });
});
