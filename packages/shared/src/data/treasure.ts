import type { ItemId } from './items';

/** Ordinary supplies are common; useful clothing and tools are occasional finds. */
export const TREASURE_LOOT: readonly {
  item: ItemId;
  weight: number;
  min: number;
  max: number;
}[] = [
  { item: 'log', weight: 12, min: 2, max: 5 },
  { item: 'stick', weight: 10, min: 3, max: 7 },
  { item: 'stone', weight: 12, min: 2, max: 5 },
  { item: 'berry', weight: 10, min: 3, max: 6 },
  { item: 'mushroom', weight: 10, min: 2, max: 5 },
  { item: 'trailRation', weight: 8, min: 1, max: 3 },
  { item: 'roastedMeat', weight: 6, min: 1, max: 3 },
  { item: 'flower', weight: 6, min: 2, max: 4 },
  { item: 'travelerTunic', weight: 3, min: 1, max: 1 },
  { item: 'travelerTrousers', weight: 3, min: 1, max: 1 },
  { item: 'leatherBoots', weight: 3, min: 1, max: 1 },
  { item: 'leatherGloves', weight: 3, min: 1, max: 1 },
  { item: 'mageHat', weight: 2, min: 1, max: 1 },
  { item: 'bearHat', weight: 2, min: 1, max: 1 },
  { item: 'ironSword', weight: 1, min: 1, max: 1 },
  { item: 'huntingKnife', weight: 2, min: 1, max: 1 },
  { item: 'winterJacket', weight: 1, min: 1, max: 1 },
];
