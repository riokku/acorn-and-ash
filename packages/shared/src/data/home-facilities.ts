import { homeRoomScale, type HomeKind } from './housing';
import type { Vec3 } from '../math/vec3';

export type HomeFacility = 'cooking' | 'workbench' | 'garden';
export const HOME_FACILITIES = {
  cooking: { x: 2.25, z: -0.9, reach: 1.2 },
  workbench: { x: -2.9, z: 1.1, reach: 1.2 },
  garden: { x: 1.4, z: 2.15, reach: 1.65 },
} as const;

/**
 * The garden's three growing trays (Polyfork's Seedling Tray, its long side
 * front to back), this far apart along X. Both the cabin's indoor garden and
 * the campsite kitchen garden are solid to this size.
 */
export const GARDEN_TRAY = { spacing: 0.65, halfX: 0.2, halfZ: 0.3, height: 0.15 } as const;

export function homeHasFacility(kind: HomeKind, facility: HomeFacility): boolean {
  if (facility === 'cooking') return kind !== 'tent';
  if (facility === 'workbench') return kind === 'cabin' || kind === 'largeCabin';
  return kind === 'largeCabin';
}

export function homeFacilityInReach(
  kind: HomeKind,
  facility: HomeFacility,
  position: Pick<Vec3, 'x' | 'z'>,
): boolean {
  if (!homeHasFacility(kind, facility)) return false;
  const spot = HOME_FACILITIES[facility],
    scale = homeRoomScale(kind);
  return Math.hypot(position.x - spot.x * scale, position.z - spot.z * scale) <= spot.reach;
}
