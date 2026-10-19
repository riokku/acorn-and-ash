import { afterEach, expect, it } from 'vitest';
import { ITEM_KINDS as DEFAULT_ITEMS, EMPTY_CATALOG } from '@acorn/shared';
import { applyItemCatalog, ITEM_KINDS, characterStats, itemDescription } from '../src/item-catalog';
import { equipmentDetail, equipmentComparison } from '../src/hud/equipment-stats';
afterEach(() => applyItemCatalog(EMPTY_CATALOG));
it('updates game names, descriptions, rarity, tooltips and comparisons from authoritative content', () => {
  applyItemCatalog({
    revision: 1,
    overrides: {
      axe: {
        displayName: 'Spring axe',
        pluralName: 'Spring axes',
        description: 'A balanced axe.',
        rarity: 'rare',
        bonuses: { power: 60 },
      },
    },
  });
  expect(ITEM_KINDS.axe.displayName).toBe('Spring axe');
  expect(DEFAULT_ITEMS.axe.displayName).toBe('Axe');
  expect(itemDescription('axe')).toContain('Rarity: rare.');
  expect(equipmentDetail('axe')).toContain('Attack power +60%');
  expect(equipmentComparison('axe', {}, null)).toContain('160%');
  expect(characterStats({}, 'axe').power).toBe(160);
  applyItemCatalog(EMPTY_CATALOG);
  expect(ITEM_KINDS.axe.displayName).toBe(DEFAULT_ITEMS.axe.displayName);
  expect(characterStats({}, 'axe').power).toBe(110);
});
it('preserves specialty rules alongside custom flavor text and edited base stats', () => {
  applyItemCatalog({
    revision: 2,
    overrides: {
      travelerTunic: {
        displayName: 'Old trail shirt',
        description: 'A family keepsake.',
        bonuses: { protection: 7 },
      },
    },
  });
  const description = itemDescription('travelerTunic');
  expect(description).toContain('A family keepsake.');
  expect(description).toContain('15%');
  expect(description).toContain('forgotten camp');
  expect(characterStats({ upperBody: 'travelerTunic' }).protection).toBe(7);
});
