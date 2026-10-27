import { describe, expect, it } from 'vitest';
import { equipmentComparison, equipmentDetail } from '../src/hud/equipment-stats';
describe('equipment explanations', () => {
  it('shows the active weapon comparison and describes the main-hand requirement', () => {
    expect(equipmentComparison('ironSword', {}, 'axe')).toBe('Attack power 110% → 150% (+40%).');
    expect(equipmentDetail('huntingKnife')).toContain('main hand');
    expect(equipmentComparison('huntingKnife', { mainHand: 'ironSword' }, 'ironSword')).toBe(
      'Attack power 150% → 125% (-25%).',
    );
    expect(equipmentComparison('flower', {}, null)).toBeNull();
  });
});

it('compares the protection lost when replacing a helmet', () => {
  expect(equipmentComparison('knightHelmet', {}, null)).toBe(
    'Protection 0% → 8% (+8%). Warmth 0 → 5 (+5).',
  );
  expect(equipmentComparison('mageHat', { helm: 'knightHelmet' }, null)).toBe(
    'Protection 8% → 1% (-7%). Vitality 100 → 110 (+10). Warmth 5 → 15 (+10).',
  );
});
