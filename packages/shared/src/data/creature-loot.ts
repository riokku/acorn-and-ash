import { RAIDER_KIND_ORDER, type RaiderKindId } from './raiders';
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

/** A separate roll, so finding a bag never replaces bones or clothing. */
export const SKELETON_BAG_DROP_CHANCE = 0.25;

/** The exact carried model becomes wearable loot. The king awards his sword through personal rewards. */
export const SKELETON_WEAPON_DROPS = {
  minion: { item: 'rustySword', chance: 0.05 },
  rogue: { item: 'raiderDagger', chance: 0.05 },
  warrior: { item: 'raiderGreatsword', chance: 0.03 },
  mage: { item: 'boneStaff', chance: 0.03 },
  sentinel: { item: 'watchGreatsword', chance: 0.02 },
  captain: { item: 'watchGreatsword', chance: 0.02 },
  hollowKing: { item: 'kingsRequiem', chance: 1 },
} as const satisfies Record<RaiderKindId, { item: ItemId; chance: number }>;

export function skeletonWeaponKind(item: ItemId): RaiderKindId | null {
  return RAIDER_KIND_ORDER.find((kind) => SKELETON_WEAPON_DROPS[kind].item === item) ?? null;
}
