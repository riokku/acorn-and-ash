import { expect, it } from 'vitest';
import { activeEquipmentTraits, EQUIPMENT_SPECIALTIES, withEquipmentSpecialty } from '../src/index';
it('uses the same specialty wording in item descriptions and kit explanations', () => {
  const active = activeEquipmentTraits(
    { upperBody: 'winterJacket', feet: 'leatherBoots' },
    'huntingKnife',
  );
  for (const { item, trait } of active) {
    expect(EQUIPMENT_SPECIALTIES[item]).toContain(trait.name);
    expect(withEquipmentSpecialty(item, 'Handmade.')).toContain(trait.detail);
    expect(withEquipmentSpecialty(item, withEquipmentSpecialty(item, 'Handmade.'))).toBe(
      withEquipmentSpecialty(item, 'Handmade.'),
    );
  }
});
it('preserves the published specialty text and reports no bonus for stowed or malformed-slot gear', () => {
  expect(EQUIPMENT_SPECIALTIES.travelerTunic).toBe(
    'Trail comfort: hunger drains 15% more slowly while worn. Find it at the forgotten camp.',
  );
  expect(activeEquipmentTraits({ offHand: 'ironSword' }, null)).toEqual([]);
  expect(activeEquipmentTraits({ helm: 'winterJacket' }, null)).toEqual([]);
  expect(activeEquipmentTraits({ mainHand: 'ironSword' }).map((t) => t.item)).toEqual([
    'ironSword',
  ]);
});
