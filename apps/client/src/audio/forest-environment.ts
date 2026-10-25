import {
  LAKE,
  STREAM,
  navigableWaterDepthAt,
  PROP_KINDS,
  SPAWN_POSITION,
  type PlacedProp,
  type Terrain,
  type WaterCircle,
} from '@acorn/shared';
import { createGroundShader } from '../art/ground-shading';

export type FootstepSurface =
  'grass' | 'forestFloor' | 'soil' | 'wood' | 'water' | 'snow' | 'ice' | 'stone' | 'sand';
export interface ForestPoint {
  readonly x: number;
  readonly z: number;
}
export interface ForestEnvironment {
  surfaceAt(x: number, z: number, feetY?: number): FootstepSurface;
  treesNear(x: number, z: number): readonly ForestPoint[];
  /**
   * Which trees are standing now. Trees come down and grow back all through
   * the forest, so this is called often; it only re-sorts the trees, and
   * leaves the ground as it was.
   */
  setStandingProps(standingProps: readonly PlacedProp[]): void;
}

/** Reuses the painted ground's classification, including terrain slope. */
export function createForestEnvironment(
  props: readonly PlacedProp[],
  water: readonly WaterCircle[],
  terrain: Terrain,
  standingProps: readonly PlacedProp[] = props,
): ForestEnvironment {
  const ground = createGroundShader({ props, water, lake: LAKE, stream: STREAM });
  const solids = new Map<string, PlacedProp[]>();
  for (const prop of props) {
    const key = `${Math.floor(prop.x / 16)},${Math.floor(prop.z / 16)}`;
    const bucket = solids.get(key) ?? [];
    bucket.push(prop);
    solids.set(key, bucket);
  }
  let standingIds = new Set<number>();
  let cells = new Map<string, ForestPoint[]>();
  const sortTrees = (standing: readonly PlacedProp[]): void => {
    standingIds = new Set(standing.map((prop) => prop.id));
    cells = new Map<string, ForestPoint[]>();
    for (const prop of standing) {
      if (PROP_KINDS[prop.kind].shape.family !== 'tree') continue;
      const key = `${Math.floor(prop.x / 16)},${Math.floor(prop.z / 16)}`;
      const bucket = cells.get(key) ?? [];
      bucket.push(prop);
      cells.set(key, bucket);
    }
  };
  sortTrees(standingProps);
  return {
    setStandingProps: sortTrees,
    surfaceAt(x, z, feetY) {
      const height = terrain.heightAt(x, z);
      // A grounded listener standing above the terrain is on a prop, not the
      // grass/water beneath it. Only inspect nearby authored bases at contact.
      if (feetY !== undefined && feetY > height + 0.15) {
        const cx = Math.floor(x / 16),
          cz = Math.floor(z / 16);
        for (let dx = -1; dx <= 1; dx++)
          for (let dz = -1; dz <= 1; dz++)
            for (const prop of solids.get(`${cx + dx},${cz + dz}`) ?? []) {
              const kind = PROP_KINDS[prop.kind];
              if (Math.hypot(x - prop.x, z - prop.z) > kind.colliderRadius * prop.scale + 0.25)
                continue;
              if (kind.shape.family === 'rock') return 'stone';
              if (
                prop.kind === 'stump' ||
                (kind.shape.family === 'tree' && !standingIds.has(prop.id))
              )
                return 'wood';
            }
      }
      if (
        navigableWaterDepthAt(x, z) > 0.02 ||
        water.some((pond) => Math.hypot(x - pond.x, z - pond.z) < pond.radius)
      )
        return 'water';
      if (Math.hypot(x - SPAWN_POSITION.x, z - SPAWN_POSITION.z) < 3) return 'soil';
      const dx = terrain.heightAt(x + 0.5, z) - terrain.heightAt(x - 0.5, z);
      const dz = terrain.heightAt(x, z + 0.5) - terrain.heightAt(x, z - 0.5);
      const shade = ground.shadeAt(x, z, Math.hypot(dx, dz), height);
      if (shade.rock >= 0.55) return 'stone';
      if (shade.bank[0] >= 0.55) return 'sand';
      return shade.floor >= 0.45 ? 'forestFloor' : 'grass';
    },
    treesNear(x, z) {
      const nearby: ForestPoint[] = [];
      const cx = Math.floor(x / 16),
        cz = Math.floor(z / 16);
      for (let ox = -2; ox <= 2; ox++)
        for (let oz = -2; oz <= 2; oz++) {
          for (const tree of cells.get(`${cx + ox},${cz + oz}`) ?? []) {
            if (Math.hypot(tree.x - x, tree.z - z) <= 32) nearby.push(tree);
          }
        }
      return nearby;
    },
  };
}
