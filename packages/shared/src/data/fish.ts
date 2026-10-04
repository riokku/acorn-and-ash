/**
 * What the pond gives up.
 *
 * Content as data: which fish there are and how likely each one is lives here,
 * so tuning the odds or adding a fish is a change to this table and nothing else.
 */

import type { ItemId } from './items';

export interface FishRow {
  readonly item: ItemId;
  /**
   * How often this one bites compared with the others. The weights are shares
   * of the whole, so 60, 30 and 10 are six in ten, three in ten and one in ten.
   */
  readonly weight: number;
}

export const POND_FISH: readonly FishRow[] = [
  { item: 'perch', weight: 60 },
  { item: 'trout', weight: 30 },
  // The rare one: about one catch in ten.
  { item: 'goldenCarp', weight: 10 },
];

/**
 * Which fish a roll lands on.
 *
 * `roll` is a number from zero up to but not including one, drawn by whoever
 * decides the catch. Taking it as an argument keeps this file free of any
 * randomness of its own.
 */
export function fishForRoll(table: readonly FishRow[], roll: number): ItemId {
  const total = table.reduce((sum, row) => sum + row.weight, 0);
  let remaining = roll * total;
  for (const row of table) {
    if (remaining < row.weight) return row.item;
    remaining -= row.weight;
  }
  // Only reachable with a roll of one or more, which a generator never gives.
  const last = table[table.length - 1];
  if (last === undefined) throw new Error('A fish table needs at least one fish');
  return last.item;
}

export const FISH_SPECIES = [
  {
    item: 'perch',
    name: 'Yellow perch',
    note: 'Striped flashes in the quiet shallows.',
    minCm: 12,
    maxCm: 38,
    color: '#a58b39',
  },
  {
    item: 'trout',
    name: 'Rainbow trout',
    note: 'Silver scales and a rose-colored ribbon.',
    minCm: 20,
    maxCm: 65,
    color: '#8eabb1',
  },
  {
    item: 'goldenCarp',
    name: 'Golden carp',
    note: 'A rare glimmer beneath the lily pads.',
    minCm: 25,
    maxCm: 80,
    color: '#d4a444',
  },
] as const;
