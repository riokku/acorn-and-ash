import { PLAYABLE_HALF_EXTENT } from '../constants';
import { isHomeKind, type HomeKind } from '../data/housing';
import type { Terrain } from '../world/terrain';
import type { BuildableKindId } from '../data/buildables';
import { footprintEnds, footprintGap, roundFootprint, type Footprint } from './building';

export const HOME_BUILD_RADII: Readonly<Record<HomeKind, number>> = {
  tent: 12,
  teepee: 18,
  cabin: 26,
  largeCabin: 36,
};
export interface BuildArea {
  readonly x: number;
  readonly z: number;
  readonly radius: number;
}
export interface AreaHome {
  readonly id: number;
  readonly x: number;
  readonly z: number;
  readonly kind: BuildableKindId;
}
export interface ProtectedBuildSite extends BuildArea {
  readonly name: string;
}
export type BuildAreaRefusal =
  'needHome' | 'outsideArea' | 'privateArea' | 'areaOverlap' | 'worldEdge' | 'protectedSite';

export function homeBuildArea(home: AreaHome): BuildArea | null {
  return isHomeKind(home.kind)
    ? { x: home.x, z: home.z, radius: HOME_BUILD_RADII[home.kind] }
    : null;
}
/** Both ends of the entire capsule footprint must fit, including its width. */
export function footprintInBuildArea(piece: Footprint, area: BuildArea): boolean {
  return footprintEnds(piece).every(
    (end) => Math.hypot(end.x - area.x, end.z - area.z) + piece.radius <= area.radius + 1e-6,
  );
}
export function buildAreasOverlap(a: BuildArea, b: BuildArea): boolean {
  return Math.hypot(a.x - b.x, a.z - b.z) < a.radius + b.radius - 1e-6;
}
export function checkHomeBuildArea(
  area: BuildArea,
  otherHomes: readonly AreaHome[],
  protectedSites: readonly ProtectedBuildSite[],
): BuildAreaRefusal | null {
  if (
    Math.abs(area.x) + area.radius > PLAYABLE_HALF_EXTENT ||
    Math.abs(area.z) + area.radius > PLAYABLE_HALF_EXTENT
  )
    return 'worldEdge';
  if (
    otherHomes.some((home) => {
      const other = homeBuildArea(home);
      return other !== null && buildAreasOverlap(area, other);
    })
  )
    return 'areaOverlap';
  if (protectedSites.some((site) => buildAreasOverlap(area, site))) return 'protectedSite';
  return null;
}
export function checkPieceBuildArea(
  piece: Footprint,
  home: AreaHome | null,
  otherHomes: readonly AreaHome[],
  protectedSites: readonly ProtectedBuildSite[],
): BuildAreaRefusal | null {
  const area = home === null ? null : homeBuildArea(home);
  if (area === null) return 'needHome';
  if (!footprintInBuildArea(piece, area)) return 'outsideArea';
  // Legacy homes and placed objects remain intact even if their old areas overlap.
  // New construction still respects everybody else's boundary.
  if (
    otherHomes.some((other) => {
      const boundary = homeBuildArea(other);
      return (
        boundary !== null &&
        footprintGap(piece, roundFootprint(boundary.x, boundary.z, boundary.radius, 'home area')) <
          0
      );
    })
  )
    return 'privateArea';
  if (
    protectedSites.some(
      (site) => footprintGap(piece, roundFootprint(site.x, site.z, site.radius, site.name)) < 0,
    )
  )
    return 'protectedSite';
  return null;
}
/** New foundations need level ground; the rest of a plot may follow the hills. */
export function buildGroundIsLevel(piece: Footprint, terrain: Terrain): boolean {
  const heights: number[] = [];
  for (const end of [{ x: piece.x, z: piece.z }, ...footprintEnds(piece)]) {
    heights.push(terrain.heightAt(end.x, end.z));
    for (let side = 0; side < 8; side++) {
      const angle = (side * Math.PI) / 4;
      heights.push(
        terrain.heightAt(
          end.x + Math.cos(angle) * piece.radius,
          end.z + Math.sin(angle) * piece.radius,
        ),
      );
    }
  }
  return Math.max(...heights) - Math.min(...heights) <= 0.4;
}
export function describeBuildAreaRefusal(reason: BuildAreaRefusal): string {
  switch (reason) {
    case 'needHome':
      return 'Place your first tent to establish a building area';
    case 'outsideArea':
      return 'Keep the whole piece inside your home boundary';
    case 'privateArea':
      return "Inside another player's private building area";
    case 'areaOverlap':
      return "This home boundary overlaps another player's area";
    case 'worldEdge':
      return 'Your home boundary must fit inside the world';
    case 'protectedSite':
      return 'Keep discoveries and encounter sites clear';
  }
}
