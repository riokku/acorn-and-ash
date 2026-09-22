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
