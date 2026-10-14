import { describe, expect, it } from 'vitest';
import { equipmentComparison, equipmentDetail } from '../src/hud/equipment-stats';
describe('equipment explanations', () => {
  it('shows the active weapon comparison and describes the main-hand requirement', () => {
    expect(equipmentComparison('ironSword', {}, 'axe')).toBe('Power 100% → 150% (+50%).');
    expect(equipmentDetail('huntingKnife')).toContain('main hand');
    expect(equipmentComparison('huntingKnife', { mainHand: 'ironSword' }, 'ironSword')).toBe(
      'No change to your current Power.',
    );
    expect(equipmentComparison('flower', {}, null)).toBeNull();
  });
});
