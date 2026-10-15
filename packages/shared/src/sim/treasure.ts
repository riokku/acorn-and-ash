import { PLAYABLE_HALF_EXTENT } from '../constants';
import { ITEM_KINDS, type ItemId } from '../data/items';
import { TREASURE_LOOT } from '../data/treasure';
import { createRng, hashSeed } from '../rng';
import type { Vec3 } from '../math/vec3';
import { nearestBuriedCache } from './burying';

export const TREASURE_COUNT = 24;
export interface TreasureSpot {
  readonly id: number;
  readonly x: number;
  readonly z: number;
}
export interface BuriedTreasure extends TreasureSpot {
  readonly items: readonly { item: ItemId; count: number }[];
}

/** Separate streams keep a placement retry from changing what a mound contains. */
export function treasureLoot(seed: number, id: number): BuriedTreasure['items'] {
  const rng = createRng(hashSeed(seed, 'treasure-loot', id));
  const total = TREASURE_LOOT.reduce((sum, entry) => sum + entry.weight, 0);
  const items = new Map<ItemId, number>();
  const rolls = 3 + rng.nextInt(3);
  for (let roll = 0; roll < rolls; roll++) {
    let ticket = rng.nextFloat() * total;
    for (const entry of TREASURE_LOOT) {
      ticket -= entry.weight;
      if (ticket >= 0) continue;
      const count = entry.min + rng.nextInt(entry.max - entry.min + 1);
      items.set(entry.item, (items.get(entry.item) ?? 0) + count);
      break;
    }
  }
  return [...items].map(([item, count]) => ({ item, count }));
}

/** Spread a bounded set of mounds through the clearing and wilderness. No fallback into blocked ground. */
export function createTreasures(
  seed: number,
  clear: (x: number, z: number) => boolean,
): BuriedTreasure[] {
  const rng = createRng(hashSeed(seed, 'buried-treasure'));
  const treasures: BuriedTreasure[] = [];
  for (let id = 1; id <= TREASURE_COUNT; id++) {
    // A few nearer home make the mechanic discoverable without crowding the landing.
    const extent = id <= 4 ? 65 : PLAYABLE_HALF_EXTENT - 12;
    for (let attempt = 0; attempt < 256; attempt++) {
      const x = rng.nextRange(-extent, extent),
        z = rng.nextRange(-extent, extent);
      if (Math.hypot(x, z) < 18 || !clear(x, z)) continue;
      if (treasures.some((spot) => Math.hypot(x - spot.x, z - spot.z) < 16)) continue;
      treasures.push({ id, x, z, items: treasureLoot(seed, id) });
      break;
    }
  }
  return treasures;
}

export function nearestTreasure<T extends TreasureSpot>(
  position: Readonly<Vec3>,
  treasures: readonly T[],
  reachable: (spot: T) => boolean,
): T | null {
  return nearestBuriedCache(position, treasures, reachable);
}

/** Reject corrupt saves without making a whole world impossible to join. Empty saves stay empty. */
export function treasuresFromSaved(saved: unknown): BuriedTreasure[] | null {
  if (!Array.isArray(saved)) return null;
  const result: BuriedTreasure[] = [];
  const ids = new Set<number>();
  for (const entry of saved) {
    if (entry === null || typeof entry !== 'object') continue;
    const row = entry as Partial<BuriedTreasure>;
    if (!Number.isInteger(row.id) || row.id! < 1 || row.id! > TREASURE_COUNT || ids.has(row.id!))
      continue;
    if (
      !Number.isFinite(row.x) ||
      !Number.isFinite(row.z) ||
      Math.abs(row.x!) > PLAYABLE_HALF_EXTENT ||
      Math.abs(row.z!) > PLAYABLE_HALF_EXTENT
    )
      continue;
    if (!Array.isArray(row.items)) continue;
    const items = row.items.filter(
      (item) =>
        item !== null &&
        typeof item === 'object' &&
        Object.hasOwn(ITEM_KINDS, item.item) &&
        Number.isInteger(item.count) &&
        item.count > 0 &&
        item.count <= 100,
    );
    if (items.length === 0) continue;
    ids.add(row.id!);
    result.push({ id: row.id!, x: row.x!, z: row.z!, items });
  }
  return result;
}
