import type { AnimalKindId } from '../data/animals';
import type { RaiderKindId } from '../data/raiders';
import {
  BASIC_CLOTHING,
  CLOTHING_DROP_CHANCE,
  SKELETON_BAG_DROP_CHANCE,
} from '../data/creature-loot';
import { createRng, hashSeed } from '../rng';

/** Roll once on a validated defeat; the client never chooses or rerolls a reward. */
export function creatureClothingDrop(
  seed: number,
  source: 'animal' | 'raider',
  kind: AnimalKindId | RaiderKindId,
  id: number,
  tick: number,
): (typeof BASIC_CLOTHING)[number] | null {
  if (kind === 'curiousRaccoon') return null;
  const tier =
    kind === 'sentinel' || kind === 'captain' || kind === 'woodlandGuardian'
      ? 'boss'
      : source === 'raider' || kind === 'maskedRaccoon'
        ? 'threat'
        : 'prey';
  const rng = createRng(hashSeed(seed, 'creature-clothing', source, kind, id, tick));
  return rng.nextFloat() < CLOTHING_DROP_CHANCE[tier] ? rng.pick(BASIC_CLOTHING) : null;
}

/** Inventory bags are an independent, deterministic bonus on a skeleton's defeat. */
export function skeletonBagDrop(
  seed: number,
  kind: RaiderKindId,
  id: number,
  tick: number,
): 'bag' | null {
  const rng = createRng(hashSeed(seed, 'skeleton-bag', kind, id, tick));
  return rng.nextFloat() < SKELETON_BAG_DROP_CHANCE ? 'bag' : null;
}
