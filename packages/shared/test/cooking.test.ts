import { describe, expect, it } from 'vitest';

import { ITEM_KINDS } from '../src/data/items';
import {
  canCook,
  cookOne,
  cookedItemFor,
  isCookedFood,
  rawItemForCooked,
} from '../src/sim/cooking';
import {
  addItem,
  countOf,
  createInventory,
  slotsUsed,
} from '../src/sim/inventory';

describe('campfire cooking', () => {
  it('maps every raw food to its roasted counterpart', () => {
    expect(cookedItemFor('perch')).toBe('roastedPerch');
    expect(cookedItemFor('trout')).toBe('roastedTrout');
    expect(cookedItemFor('goldenCarp')).toBe('roastedGoldenCarp');
    expect(cookedItemFor('meat')).toBe('roastedMeat');
    expect(cookedItemFor('stick')).toBeNull();
  });

  it('knows cooked foods in both directions', () => {
    expect(isCookedFood('roastedMeat')).toBe(true);
    expect(rawItemForCooked('roastedGoldenCarp')).toBe('goldenCarp');
    expect(isCookedFood('meat')).toBe(false);
    expect(rawItemForCooked('axe')).toBeNull();
  });

  it('turns exactly one raw item into exactly one cooked item', () => {
    const pack = createInventory();
    addItem(pack, 'perch', 3);

    expect(cookOne(pack, 'perch')).toBe('roastedPerch');
    expect(countOf(pack, 'perch')).toBe(2);
    expect(countOf(pack, 'roastedPerch')).toBe(1);
  });

  it('can use the slot freed by the last raw item for the cooked result', () => {
    const pack = createInventory();
    addItem(pack, 'perch');
    addItem(pack, 'log', 10);
    addItem(pack, 'stick', 10);
    addItem(pack, 'flower', 10);
    addItem(pack, 'trout', 10);
    addItem(pack, 'meat', 10);
    expect(slotsUsed(pack)).toBe(6);

    expect(canCook(pack, 'perch')).toBe(true);
    expect(cookOne(pack, 'perch')).toBe('roastedPerch');
    expect(slotsUsed(pack)).toBe(6);
  });

  it('refuses when the raw stack remains and every slot is occupied', () => {
    const pack = createInventory();
    addItem(pack, 'perch', 2);
    addItem(pack, 'log', 10);
    addItem(pack, 'stick', 10);
    addItem(pack, 'flower', 10);
    addItem(pack, 'trout', 10);
    addItem(pack, 'meat', 10);
    expect(slotsUsed(pack)).toBe(6);

    expect(canCook(pack, 'perch')).toBe(false);
    expect(cookOne(pack, 'perch')).toBeNull();
    expect(countOf(pack, 'perch')).toBe(2);
    expect(countOf(pack, 'roastedPerch')).toBe(0);
  });

  it('makes cooking a reward rather than a requirement', () => {
    expect(ITEM_KINDS.roastedPerch.restoresHunger).toBeGreaterThan(
      ITEM_KINDS.perch.restoresHunger ?? 0,
    );
    expect(ITEM_KINDS.roastedMeat.restoresHunger).toBeGreaterThan(
      ITEM_KINDS.meat.restoresHunger ?? 0,
    );
  });
});
