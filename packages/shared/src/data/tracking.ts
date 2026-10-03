import { colliderFootprintRadius, type Collider } from '../world/colliders';
import { createRng, hashSeed } from '../rng';
/** Stable woodland encounter clearings, reserved before homes can settle there. */
export const WOODLAND_ENCOUNTERS = [
  { id: 1008, kind: 'elk', x: -92, z: -74, radius: 8, name: 'Elk grove' },
  { id: 1009, kind: 'curiousRaccoon', x: 105, z: 75, radius: 6, name: 'Raccoon hollow' },
  { id: 1010, kind: 'woodlandGuardian', x: -104, z: 90, radius: 10, name: 'Guardian hollow' },
] as const;
export type WoodlandKind = (typeof WOODLAND_ENCOUNTERS)[number]['kind'];

export interface WoodlandTrack {
  readonly kind: WoodlandKind;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
}
/** Fixed paired spoor gives each encounter an approachable lead from the inner woods. */
export function buildWoodlandTracks(
  seed: number,
  colliders: readonly Collider[] = [],
): WoodlandTrack[] {
  return WOODLAND_ENCOUNTERS.flatMap((site) => {
    const rng = createRng(hashSeed(seed, 'woodland-spoor', site.id));
    const length = Math.hypot(site.x, site.z) * 0.48;
    const steps = Math.floor(length / 1.65);
    const forwardX = site.x / Math.hypot(site.x, site.z),
      forwardZ = site.z / Math.hypot(site.x, site.z);
    return Array.from({ length: steps }, (_, index) => {
      const progress = 0.52 + (0.48 * index) / (steps - 1);
      const bend = Math.sin(index * 0.2) * 1.8 + rng.nextRange(-0.1, 0.1);
      const x = site.x * progress - forwardZ * bend,
        z = site.z * progress + forwardX * bend;
      for (const offset of [0, 0.7, -0.7, 1.4, -1.4, 2.1, -2.1, 2.8, -2.8]) {
        const atX = x - forwardZ * offset,
          atZ = z + forwardX * offset;
        if (
          colliders.some(
            (collider) =>
              Math.hypot(collider.x - atX, collider.z - atZ) <
              colliderFootprintRadius(collider) + 0.6,
          )
        )
          continue;
        return { kind: site.kind, x: atX, z: atZ, yaw: Math.atan2(-forwardX, -forwardZ) };
      }
      return null;
    }).filter((track): track is WoodlandTrack => track !== null);
  });
}
export function woodlandTrackHint(kind: WoodlandKind): string {
  return kind === 'elk'
    ? 'Split hoofprints lead toward an elk grove · approach quietly'
    : kind === 'curiousRaccoon'
      ? 'Tiny pawprints lead toward a hidden raccoon cache'
      : 'Heavy root-shaped furrows lead toward the guardian hollow';
}
