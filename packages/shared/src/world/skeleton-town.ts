/** Bonehollow: a ruined settlement beyond the southeast forest, away from home. */
import { smoothstep } from '../math/vec3';
import { box, type Collider } from './colliders';
import type { Terrain } from './terrain';
import type { RaiderKindId } from '../data/raiders';
import solids from '../data/skeleton-town-solids.json' with { type: 'json' };

export const SKELETON_TOWN = { name: 'Bonehollow', x: 176, z: 140, radius: 34 } as const;
export const TOWN_DISTRICTS = [
  { name: 'gate', x: 0, z: 17, lineup: ['minion', 'warrior', 'minion'] },
  { name: 'market', x: -14, z: -1, lineup: ['rogue', 'minion', 'rogue'] },
  { name: 'graveyard', x: 14, z: -2, lineup: ['minion', 'mage', 'minion'] },
  { name: 'hall', x: 0, z: -18, lineup: ['warrior', 'sentinel', 'mage', 'warrior'] },
] as const satisfies readonly {
  name: string;
  x: number;
  z: number;
  lineup: readonly RaiderKindId[];
}[];
export type TownDistrict = (typeof TOWN_DISTRICTS)[number]['name'];

/** A broad level shelf, easing into the original forest over twelve metres. */
export function townGroundHeight(x: number, z: number, ground: number, level: number): number {
  const distance = Math.max(Math.abs(x - SKELETON_TOWN.x), Math.abs(z - SKELETON_TOWN.z));
  return ground + (level - ground) * (1 - smoothstep(distance, 30, 44));
}
export function inSkeletonTown(x: number, z: number, margin = 0): boolean {
  return (
    Math.abs(x - SKELETON_TOWN.x) < SKELETON_TOWN.radius + margin &&
    Math.abs(z - SKELETON_TOWN.z) < SKELETON_TOWN.radius + margin
  );
}
export function townColliders(terrain: Terrain): Collider[] {
  const y = terrain.heightAt(SKELETON_TOWN.x, SKELETON_TOWN.z);
  return solids.map((s) => ({
    ...box(SKELETON_TOWN.x + s.x, y + s.y, SKELETON_TOWN.z + s.z, s.halfX, s.halfY, s.halfZ, s.yaw),
    standable: true,
  }));
}

/** Worn dirt between the cobbles, with softly broken edges. */
export function townPathCoverage(x: number, z: number): number {
  if (!inSkeletonTown(x, z, -5)) return 0;
  const dx = x - SKELETON_TOWN.x,
    dz = z - SKELETON_TOWN.z;
  const edge = Math.min(
    Math.abs(dx) - 2.2,
    Math.abs(dz - 12) - 1.5,
    Math.abs(dz + 13) - 1.5,
    Math.abs(dz + 1) - 1.6,
    Math.hypot(dx, dz + 3) - 6,
  );
  const boundary = 1 - smoothstep(Math.max(Math.abs(dx), Math.abs(dz)), 26, 29);
  return (1 - smoothstep(edge + Math.sin(x * 1.7 + z) * 0.12, 0, 1.1)) * boundary;
}
