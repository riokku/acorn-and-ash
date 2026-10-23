import { afterEach, expect, it } from 'vitest';
import {
  WorldSimulation,
  DEFAULT_WORLD_SEED,
  equipmentDodgeCooldown,
  equipmentOpeningPower,
  DODGE,
  createInput,
  PlayerButton,
  startMeal,
  NO_MEAL,
  mealCooldown,
  withEquipmentSpecialty,
} from '../src/index';
const worlds: WorldSimulation[] = [];
afterEach(() => worlds.splice(0).forEach((sim) => sim.dispose()));
it.each([
  [false, false],
  [true, false],
  [false, true],
  [true, true],
])('keeps real dodge prediction consistent: boots=%s, meal=%s', (worn, fed) => {
  const meal = fed ? startMeal('trailRation') : NO_MEAL;
  const sim = new WorldSimulation({
    seed: DEFAULT_WORLD_SEED,
    hungerEmptyAfterSeconds: Infinity,
  });
  worlds.push(sim);
  sim.addPlayer(1, {
    netId: 1,
    x: 0,
    y: 0,
    z: 0,
    facingYaw: 0,
    hunger: 100,
    items: [{ item: 'leatherBoots', count: 1 }],
    meal,
  });
  sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0);
  if (worn) expect(sim.wearGear(1, 'leatherBoots', 'feet').ok).toBe(true);
  sim.queueInput(1, createInput(1, 0, 1, 0, PlayerButton.Dodge));
  sim.step(1000);
  const normal = mealCooldown(meal, DODGE.cooldown, 'trailRation');
  expect(sim.actionOf(1)?.dodgeCooldown).toBe(worn ? Math.round(normal * 0.85) : normal);
  expect(sim.actionOf(1)?.age).toBe(0);
});
it('requires the effective slot and active weapon; ordinary damage stays the same', () => {
  expect(equipmentDodgeCooldown({ hands: 'leatherBoots' }, 40)).toBe(40);
  expect(equipmentOpeningPower('ironSword', true)).toBe(1.2);
  expect(equipmentOpeningPower('ironSword', false)).toBe(1);
  expect(equipmentOpeningPower('axe', true)).toBe(1);
  expect(equipmentOpeningPower(null, true)).toBe(1);
});
it('keeps both mechanical traits visible even with custom admin descriptions', () => {
  const boots = withEquipmentSpecialty('leatherBoots', 'Old ranger boots.');
  const sword = withEquipmentSpecialty('ironSword', 'My sword.');
  expect(boots).toContain('15%');
  expect(sword).toContain('20%');
  expect(withEquipmentSpecialty('ironSword', sword)).toBe(sword);
});
