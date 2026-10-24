import { logStorageCapacity, logStorageSpot } from '../sim/fire-fuel';
import type { BuildableKindId } from '../data/buildables';
import { isHomeKind } from '../data/housing';
import { box, cylinder, type Collider } from './colliders';
import { navigableWaterSurfaceAt } from './navigable-water';

export interface PlacedSolidProp {
  readonly kind: BuildableKindId;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly storedLogs?: number;
  readonly occupied?: boolean;
  readonly rower?: number;
}

/** Solid parts only: foliage, flames, rugs and inset path stones stay walkable. */
export function placedPropColliders(prop: PlacedSolidProp, groundY: number): Collider[] {
  const { x, z, yaw, kind } = prop;
  if (logStorageCapacity(kind) > 0) {
    const spot = logStorageSpot(prop),
      columns = kind === 'largeCabin' ? 10 : 5,
      scale = kind === 'largeCabin' ? 1.2 : 1;
    const count = Math.min(logStorageCapacity(kind), prop.storedLogs ?? 0);
    const shelf = {
      ...box(spot.x, groundY + 0.21, spot.z, 0.49 * scale, 0.21, columns * 0.14 * scale, -yaw),
      standable: true,
    };
    return [
      shelf,
      ...Array.from({ length: Math.ceil(count / columns) }, (_, row) => {
        const filled = Math.min(columns, count - row * columns);
        const localZ = (((filled - columns) * 0.28) / 2) * scale;
        return {
          ...box(
            spot.x + Math.sin(yaw) * localZ,
            groundY + 0.59 + row * 0.26,
            spot.z + Math.cos(yaw) * localZ,
            0.42 * scale,
            0.17,
            ((filled - 1) * 0.14 + 0.17) * scale,
            -yaw,
          ),
          standable: true,
        };
      }),
    ];
  }
  if (isHomeKind(kind) || kind === 'gardenPath' || kind === 'wovenRug') return [];
  const slab = (
    halfX: number,
    halfZ: number,
    height: number,
    base = groundY,
    standable = false,
  ) => ({ ...box(x, base + height / 2, z, halfX, height / 2, halfZ, yaw), standable });
  const post = (radius: number, height: number, base = groundY) =>
    cylinder(x, z, radius, height, base);
  switch (kind) {
    case 'fence':
      return [slab(0.78, 0.09, 0.8, groundY - 0.02)];
    case 'flowerBed':
      return [
        slab(0.56, 0.36, 0.23, groundY, true),
        ...[-1, 1].flatMap((side) => [
          {
            ...box(
              x - Math.sin(yaw) * side * 0.38,
              groundY + 0.125,
              z - Math.cos(yaw) * side * 0.38,
              0.6,
              0.125,
              0.02,
              yaw,
            ),
            standable: true,
          },
          {
            ...box(
              x + Math.cos(yaw) * side * 0.58,
              groundY + 0.125,
              z - Math.sin(yaw) * side * 0.58,
              0.02,
              0.125,
              0.4,
              yaw,
            ),
            standable: true,
          },
        ]),
      ];
    case 'campfire':
      return [{ ...post(0.46, 0.34), standable: true }];
    case 'lantern':
    case 'fernLantern':
    case 'moonLantern':
      return [
        post(0.065, 1.42),
        box(
          x + Math.cos(yaw) * 0.16,
          groundY + 1.29,
          z - Math.sin(yaw) * 0.16,
          0.18,
          0.04,
          0.05,
          yaw,
        ),
        box(
          x + Math.cos(yaw) * 0.28,
          groundY + 1.11,
          z - Math.sin(yaw) * 0.28,
          0.075,
          0.14,
          0.075,
          yaw,
        ),
      ];
    case 'flowerPlanter':
      return [{ ...post(0.32, 0.38), standable: true }];
    case 'sunreachPennant':
    case 'trailPennant':
      return [post(0.05, 1.45)];
    case 'cedarBench':
      return [slab(0.85, 0.23, 0.4825, groundY, true)];
    case 'timberTable':
      return [slab(0.575, 0.475, 0.7825, groundY, true)];
    case 'rowboat': {
      // A rower uses the rowing simulation; their hull is hidden as a placed prop.
      if (prop.occupied === true || prop.rower !== undefined) return [];
      const water = navigableWaterSurfaceAt(x, z);
      // A pointed bow and narrower stern, rather than a full rectangular berth.
      const c = Math.cos(yaw),
        s = Math.sin(yaw);
      return [
        slab(1.05, 0.54, 0.5, water - 0.2),
        { ...box(x + 1.24 * c, water + 0.05, z - 1.24 * s, 0.34, 0.25, 0.29, yaw) },
        { ...box(x - 1.24 * c, water + 0.05, z + 1.24 * s, 0.34, 0.25, 0.38, yaw) },
      ];
    }
    case 'guardianTrophy':
      return [post(0.4, 1.3)];
    case 'firstBellRelic':
    case 'lastBellTrophy':
    case 'sentinelTrophy':
      return [post(0.36, 0.8)];
    case 'fishDisplay':
    case 'goldenFishDisplay':
      return [post(0.35, 0.14), slab(0.51, 0.1, 0.38, groundY + 0.49), post(0.065, 0.55)];
  }
  const exhaustive: never = kind;
  return exhaustive;
}
