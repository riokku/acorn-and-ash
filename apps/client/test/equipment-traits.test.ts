import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { activeEquipmentTraits } from '@acorn/shared';
import { EquipmentTraits } from '../src/hud/EquipmentTraits';
import { equipmentTraitComparison } from '../src/hud/equipment-stats';
it('explains only actual clothing and active-weapon traits, excluding off-hand and invalid slots', () => {
  const worn = {
    upperBody: 'travelerTunic',
    feet: 'leatherBoots',
    offHand: 'huntingKnife',
    mainHand: 'ironSword',
  } as const;
  expect(activeEquipmentTraits(worn, 'ironSword').map((t) => t.trait.name)).toEqual([
    'Trail comfort',
    'Sure footing',
    'Duelist',
  ]);
  expect(activeEquipmentTraits(worn, 'perch').map((t) => t.trait.name)).not.toContain('Duelist');
  expect(activeEquipmentTraits({ hands: 'travelerTunic' }, null)).toEqual([]);
});
it('explains both sides of a clothing tradeoff and a primary-hand weapon swap', () => {
  const coat = equipmentTraitComparison('winterJacket', { upperBody: 'travelerTunic' }, 'axe')!;
  expect(coat).toContain('Gain Heat keeper');
  expect(coat).toContain('Give up Trail comfort');
  const knife = equipmentTraitComparison('huntingKnife', { mainHand: 'ironSword' }, 'ironSword')!;
  expect(knife).toContain('Gain Careful harvest');
  expect(knife).toContain('Give up Duelist');
  expect(equipmentTraitComparison('axe', { mainHand: 'ironSword' }, 'ironSword')).toContain(
    'Give up Duelist',
  );
  expect(
    equipmentTraitComparison('travelerTunic', { upperBody: 'travelerTunic' }, null),
  ).toBeNull();
  expect(equipmentTraitComparison('flower', {}, null)).toBeNull();
});
it('makes the kit discoverable without adding height until the player expands it', () => {
  const html = renderToStaticMarkup(
    createElement(EquipmentTraits, { worn: { upperBody: 'travelerTunic' }, held: 'ironSword' }),
  );
  expect(html).toContain('2 active specialties');
  expect(html).toContain('Trail comfort');
  expect(html).toContain('Duelist');
  expect(html).not.toContain(' open=');
  const empty = renderToStaticMarkup(createElement(EquipmentTraits, { worn: {}, held: null }));
  expect(empty).toContain('0 active specialties');
  expect(empty).toContain('found clothing and weapons');
});
