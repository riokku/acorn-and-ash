import { describe, expect, it } from 'vitest';
import { equipmentComparison, equipmentDetail } from '../src/hud/equipment-stats';
describe('equipment explanations', () => {
  it('shows the active weapon comparison and describes the main-hand requirement', () => {
    expect(equipmentComparison('ironSword', {}, 'axe')).toBe('Power 100% → 150% (+50%).');
    expect(equipmentDetail('huntingKnife')).toContain('main hand');
    expect(equipmentComparison('huntingKnife', { mainHand: 'ironSword' }, 'ironSword')).toBe(
      'No change to your current equipment stats.',
    );
    expect(equipmentComparison('flower', {}, null)).toBeNull();
  });
});

it('compares the protection lost when replacing a helmet', () => {
  expect(equipmentComparison('knightHelmet', {}, null)).toBe('Protection 0% → 8% (+8%).');
  expect(equipmentComparison('mageHat', { helm: 'knightHelmet' }, null)).toBe(
    'Protection 8% → 0% (-8%). Vitality 100 → 110 (+10). Warmth 0 → 15 (+15).',
  );
});
