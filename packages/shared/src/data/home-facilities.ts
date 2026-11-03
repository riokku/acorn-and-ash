import type { HomeKind } from './housing';
import type { BuildableKindId } from './buildables';
import type { Vec3 } from '../math/vec3';
import { furnitureSpot, homeFire, type HomePlacement } from '../world/home';

/**
 * A home's stations: cooking at its fire, which every home has, and the
 * workbench and garden, which are the desk and the indoor garden once built
 * (see decision 0285).
 */
export type HomeFacility = 'cooking' | 'workbench' | 'garden';

/** The pieces furnishing one home, as far as its stations care. */
type Furnishings = readonly (HomePlacement & { readonly kind: BuildableKindId })[];

/** Where a home's station is used from, and how far it reaches, or null when it has none. */
export function homeFacilitySpot(
  kind: HomeKind,
  facility: HomeFacility,
  pieces: Furnishings = [],
): { readonly x: number; readonly z: number; readonly reach: number } | null {
  if (facility === 'cooking') return homeFire(kind).cooking;
  return furnitureSpot(facility === 'workbench' ? 'desk' : 'indoorGarden', pieces);
}

export function homeHasFacility(
  kind: HomeKind,
  facility: HomeFacility,
  pieces: Furnishings = [],
): boolean {
  return homeFacilitySpot(kind, facility, pieces) !== null;
}

export function homeFacilityInReach(
  kind: HomeKind,
  facility: HomeFacility,
  position: Pick<Vec3, 'x' | 'z'>,
  pieces: Furnishings = [],
): boolean {
  const spot = homeFacilitySpot(kind, facility, pieces);
  return spot !== null && Math.hypot(position.x - spot.x, position.z - spot.z) <= spot.reach;
}
