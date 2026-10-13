import { surfaceCollider } from '../collision/solid-surface';
import { stonePositions } from './stone-shape';
import { ORIGINAL_HALF_EXTENT } from '../constants';
import { colliderFootprintRadius, box, cylinder, type Collider } from './colliders';
import type { Terrain } from './terrain';
import { overlapsWater, type WaterCircle } from './water';
import { basinDepthAt, LAKE_SHORE_WIDTH, type Lake } from './lake';
import { nearStream, STREAM } from './stream';
import { createRng, hashSeed } from '../rng';
import type { RaiderKindId } from '../data/raiders';

export type EncounterKind = 'wanderer' | 'ruins' | 'patrol';
export interface EncounterSite {
  readonly id: number;
  readonly kind: EncounterKind;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
}
export const ENCOUNTER_RULES = {
  noticeRadius: 10,
  leashRadius: 28,
  wakeRadius: 65,
  restSeconds: 600,
  maxActive: 3,
  nearbyContributorRadius: 24,
} as const;
export const ENCOUNTER_LINEUPS: Record<EncounterKind, readonly RaiderKindId[]> = {
  wanderer: ['minion'],
  ruins: ['sentinel'],
  patrol: ['rogue', 'minion', 'warrior'],
};

/**
 * Find existing glades without changing any saved tree or scenery placement.
 *
 * A glade that would have landed in the lake, or on the bank that slopes down
 * to it, is skipped and the next try is used instead, so every other glade
 * stays exactly where it was.
 */
export function buildEncounterSites(
  seed: number,
  terrain: Terrain,
  colliders: readonly Collider[],
  water: readonly WaterCircle[],
  lake: Lake | null = null,
): EncounterSite[] {
  const sites: EncounterSite[] = [];
  const kinds: readonly EncounterKind[] = [
    'wanderer',
    'ruins',
    'patrol',
    'wanderer',
    'ruins',
    'patrol',
  ];
  for (let index = 0; index < kinds.length; index++) {
    const rng = createRng(hashSeed(seed, 'encounter-site', index));
    for (let attempt = 0; attempt < 400; attempt++) {
      const angle = rng.nextRange(0, Math.PI * 2);
      const distance = rng.nextRange(62, ORIGINAL_HALF_EXTENT - 18);
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      if (overlapsWater(water, x, z, 4)) continue;
      if (nearStream(STREAM, x, z, 6)) continue;
      if (lake !== null && basinDepthAt(lake, x, z) > -(LAKE_SHORE_WIDTH + 4)) continue;
      if (sites.some((site) => Math.hypot(site.x - x, site.z - z) < 30)) continue;
      if (colliders.some((c) => Math.hypot(c.x - x, c.z - z) < colliderFootprintRadius(c) + 3.3))
        continue;
      const y = terrain.heightAt(x, z);
      if (
        Math.abs(terrain.heightAt(x + 3, z) - y) > 1 ||
        Math.abs(terrain.heightAt(x, z + 3) - y) > 1
      )
        continue;
      const kind = kinds[index];
      if (kind === undefined) break;
      sites.push({ id: index + 1, kind, x, z, yaw: rng.nextRange(0, Math.PI * 2) });
      break;
    }
  }
  return sites;
}

/** Broken corner pillars leave the entire center and entrances walkable. */
export function encounterColliders(sites: readonly EncounterSite[], terrain: Terrain): Collider[] {
  return sites.flatMap<Collider>((site) => {
    const y = terrain.heightAt(site.x, site.z);
    if (site.kind !== 'ruins') {
      const dx = site.kind === 'patrol' ? 2.8 : -2.8;
      const rocks = Array.from({ length: 3 }, (_, i) =>
        surfaceCollider(
          site.x + dx,
          y + 0.105 + i * 0.19,
          site.z + 2.7,
          stonePositions(0.34 - i * 0.075, 0.21, site.id * 10 + i),
        ),
      );
      return site.kind === 'patrol'
        ? [...rocks, cylinder(site.x + dx, site.z + 2.7, 0.07, 1.3, y + 0.2)]
        : rocks;
    }
    return [
      ...[-2.1, 2.1].flatMap((dx) =>
        [-2.1, 2.1].map((dz) => ({
          ...box(site.x + dx, y + 0.6, site.z + dz, 0.31, 0.6, 0.29),
          standable: true,
        })),
      ),
      ...[-1.77, 1.77].map((dx) => box(site.x + dx, y + 1.29, site.z - 2.1, 0.31, 0.15, 0.22)),
      ...[-1.5, -0.9, 0.9, 1.5].map((dx) => ({
        ...box(site.x + dx, y + 0.14, site.z + 2.1, 0.275, 0.14, 0.24),
        standable: true,
      })),
      ...Array.from({ length: 4 }, (_, i) => ({
        ...box(site.x - 2.8 + i * 0.8, y + 0.11, site.z - 2.7, 0.26, 0.11, 0.2, i * 0.7),
        standable: true,
      })),
    ];
  });
}
