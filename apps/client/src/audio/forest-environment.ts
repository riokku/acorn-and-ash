import {
  LAKE,
  PROP_KINDS,
  SPAWN_POSITION,
  type PlacedProp,
  type Terrain,
  type WaterCircle,
} from '@acorn/shared';
import { createGroundShader } from '../art/ground-shading';

export type FootstepSurface = 'grass' | 'forestFloor' | 'soil' | 'wood';
export interface ForestPoint {
  readonly x: number;
  readonly z: number;
}
export interface ForestEnvironment {
  surfaceAt(x: number, z: number): FootstepSurface;
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
  const ground = createGroundShader({ props, water, lake: LAKE });
  let cells = new Map<string, ForestPoint[]>();
  const sortTrees = (standing: readonly PlacedProp[]): void => {
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
    surfaceAt(x, z) {
      if (Math.hypot(x - SPAWN_POSITION.x, z - SPAWN_POSITION.z) < 3) return 'soil';
      const dx = terrain.heightAt(x + 0.5, z) - terrain.heightAt(x - 0.5, z);
      const dz = terrain.heightAt(x, z + 0.5) - terrain.heightAt(x, z - 0.5);
      return ground.shadeAt(x, z, Math.hypot(dx, dz)).floor >= 0.45 ? 'forestFloor' : 'grass';
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
