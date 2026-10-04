import { PLAYABLE_HALF_EXTENT } from '../constants';
import { colliderFootprintRadius, cylinder, type Collider } from './colliders';
import type { Terrain } from './terrain';
import { overlapsWater, type WaterCircle } from './water';
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

/** Find existing glades without changing any saved tree or scenery placement. */
export function buildEncounterSites(
  seed: number,
  terrain: Terrain,
  colliders: readonly Collider[],
  water: readonly WaterCircle[],
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
      const distance = rng.nextRange(62, PLAYABLE_HALF_EXTENT - 18);
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      if (overlapsWater(water, x, z, 4)) continue;
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
  return sites
    .filter((s) => s.kind === 'ruins')
    .flatMap((site) =>
      [-2.1, 2.1].flatMap((dx) =>
        [-2.1, 2.1].map((dz) =>
          cylinder(site.x + dx, site.z + dz, 0.33, 1.15, terrain.heightAt(site.x, site.z)),
        ),
      ),
    );
}
