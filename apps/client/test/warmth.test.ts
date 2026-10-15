import { expect, it } from 'vitest';
import { warmthExplanation } from '../src/hud/WarmthBar';
import { equipmentComparison } from '../src/hud/equipment-stats';
it('explains cold recovery and distinguishes campfire and indoor shelter', () => {
  expect(
    warmthExplanation({ value: 0, status: 'freezing', heat: null, secondsToDamage: 12 }),
  ).toContain('health loss in 12s');
  expect(
    warmthExplanation({ value: 10, status: 'warming', heat: 'fire', secondsToDamage: null }),
  ).toBe('Warming by the campfire');
  expect(
    warmthExplanation({ value: 10, status: 'warming', heat: 'indoors', secondsToDamage: null }),
  ).toBe('Warming by the indoor fire');
});
it('compares the jacket replacing a tunic in health points and insulation ratings', () => {
  expect(equipmentComparison('winterJacket', { upperBody: 'travelerTunic' }, null)).toBe(
    'Vitality 110 → 100 (-10). Warmth 10 → 60 (+50).',
  );
});
