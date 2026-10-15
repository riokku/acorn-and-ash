import type { ItemId } from './items';

export const BASIC_CLOTHING = [
  'woolCap',
  'linenShirt',
  'workTrousers',
] as const satisfies readonly ItemId[];
export const CLOTHING_DROP_CHANCE = {
  prey: 0.15,
  threat: 0.3,
  boss: 0.5,
} as const;
