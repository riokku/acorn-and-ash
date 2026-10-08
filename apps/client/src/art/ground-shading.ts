/**
 * How the ground looks at any spot, worked out once from the world itself
 * rather than painted by hand (see decision 0053).
 *
 * Two things per spot, stored on each corner of the ground mesh:
 * - `floor`, from 0 (lawn grass) to 1 (bare forest floor): leaf litter
 *   gathers under trees and on steep slopes, the ground is worn bare around
 *   where everybody arrives, and patches of it come and go across the
 *   wilderness.
 * - `tint`, a colour the painted texture is multiplied by, close to white:
 *   big soft patches of sunnier and shadier ground so no two stretches look
 *   alike, shade under the trees, and lusher green by the water.
 *
 * Plain numbers in and out, no Three.js, so it can be tested on its own.
 */

import {
  CLEARING_TREE_LINE_INNER,
  MOUNTAINS,
  PROP_KINDS,
  SPAWN_POSITION,
  isNearLake,
  lakeDepthAt,
  type Lake,
  type PlacedProp,
  type WaterCircle,
} from '@acorn/shared';

import { smoothstep, worldFbm } from './noise';

export interface GroundShade {
  /** 0 is lawn grass, 1 is bare forest floor. */
  readonly floor: number;
  /** 0 is soil and grass, 1 is bare grey rock: steep faces and the high ground above the trees. */
  readonly rock: number;
  /** 0 is clear, 1 is snow: the mountain tops, which keep it all year. */
  readonly snow: number;
  readonly tint: readonly [number, number, number];
}

/** Everything the ground takes its looks from. */
export interface GroundContext {
  readonly water: readonly WaterCircle[];
  /** The lake, if there is one: its bank stays lush like the pond's. */
  readonly lake?: Lake | null;
  /** Every tree and rock anywhere, the clearing's and the wilderness's alike. */
  readonly props: readonly PlacedProp[];
}

/** How big a square of the lookup grid is, so a spot only checks the props near it. */
const GRID_CELL = 6;

/** The world, sorted into grid squares, ready to ask about any spot. */
export interface GroundShader {
  /**
   * How the ground looks here. `slope` is how steep it is - rise over run,
   * 0 for flat - which the caller already knows from the ground's own shape.
   * `height` is the ground's height there, which decides where the rock and
   * the snow begin on the mountain; flat ground at sea level by default.
   */
  shadeAt(x: number, z: number, slope: number, height?: number): GroundShade;
}

export function createGroundShader(context: GroundContext): GroundShader {
  const grid = new Map<string, { x: number; z: number; reach: number; tree: boolean }[]>();
  for (const prop of context.props) {
    const kind = PROP_KINDS[prop.kind];
    const tree = kind.shape.family === 'tree';
    // A tree's litter reaches about as far as its canopy; a rock only
    // scuffs the grass right around its foot.
    const reach =
      kind.shape.family === 'tree'
        ? kind.shape.canopyRadius * prop.scale * 1.25
        : kind.colliderRadius * prop.scale * 1.6;
    const cx = Math.floor(prop.x / GRID_CELL);
    const cz = Math.floor(prop.z / GRID_CELL);
    const key = `${cx},${cz}`;
    const bucket = grid.get(key);
    const entry = { x: prop.x, z: prop.z, reach, tree };
    if (bucket === undefined) grid.set(key, [entry]);
    else bucket.push(entry);
  }

  return {
    shadeAt(x, z, slope, height = 0) {
      // How much the trees and rocks nearby cover this spot.
      let cover = 0;
      let shade = 0;
      const cx = Math.floor(x / GRID_CELL);
      const cz = Math.floor(z / GRID_CELL);
      for (let ox = -1; ox <= 1; ox++) {
        for (let oz = -1; oz <= 1; oz++) {
          const bucket = grid.get(`${cx + ox},${cz + oz}`);
          if (bucket === undefined) continue;
          for (const prop of bucket) {
            const distance = Math.hypot(prop.x - x, prop.z - z);
            if (distance >= prop.reach) continue;
            const closeness = 1 - distance / prop.reach;
            cover += closeness * (prop.tree ? 1 : 0.6);
            if (prop.tree) shade += closeness;
          }
        }
      }

      const fromMiddle = Math.hypot(x, z);
      const inWilderness = smoothstep(
        CLEARING_TREE_LINE_INNER - 4,
        CLEARING_TREE_LINE_INNER + 10,
        fromMiddle,
      );

      // Big, soft patches that come and go across the whole world.
      const patches = worldFbm(x * 0.045, z * 0.045, 4, 71) * 0.5 + 0.5;
      const sunny = worldFbm(x * 0.03 + 40, z * 0.03 - 17, 3, 72) * 0.5 + 0.5;

      // The ground worn bare where everybody arrives.
      const spawnDistance = Math.hypot(x - SPAWN_POSITION.x, z - SPAWN_POSITION.z);
      const worn = (1 - smoothstep(1.5, 4.5, spawnDistance)) * 0.55;

      // Right by the water it stays lush, never bare.
      let shore = 0;
      for (const circle of context.water) {
        const gap = Math.hypot(circle.x - x, circle.z - z) - circle.radius;
        shore = Math.max(shore, 1 - smoothstep(0, 3, gap));
      }
      if (context.lake != null && isNearLake(context.lake, x, z, 3)) {
        // Negative depth is dry land, so the distance to the shore is its opposite.
        shore = Math.max(shore, 1 - smoothstep(0, 3, -lakeDepthAt(context.lake, x, z)));
      }

      const wildPatches = smoothstep(0.4, 0.7, patches) * inWilderness * 0.6;
      const underTrees = smoothstep(0.1, 0.9, cover) * (0.55 + inWilderness * 0.45);
      // Up the mountain: bare rock where it is steep or above the trees, and
      // snow on the tops. The lines wander a few metres so they are not level.
      const wander = worldFbm(x * 0.05 + 9, z * 0.05 - 31, 3, 73) * 6;
      const rock = Math.max(
        smoothstep(0.7, 1.15, slope),
        smoothstep(MOUNTAINS.treeLine - 6 + wander, MOUNTAINS.treeLine + 4 + wander, height),
      );
      const snow =
        smoothstep(MOUNTAINS.snowLine - 2 + wander, MOUNTAINS.snowLine + 5 + wander, height) *
        (1 - smoothstep(1.4, 2.4, slope));
      // Steep hillsides lose their grass too, and rock and snow have none.
      const floor = clamp01(
        Math.max(wildPatches + underTrees, worn, smoothstep(0.35, 0.8, slope), rock) *
          (1 - shore * 0.8),
      );

      // Warmer and brighter where it catches the sun, cooler and darker in
      // the shade of the trees and deeper in the woods, greener by the pond.
      const light = 0.93 + sunny * 0.14 - smoothstep(0, 1.4, shade) * 0.2 - inWilderness * 0.05;
      const warmth = (sunny - 0.5) * 0.12;
      const tint: [number, number, number] = [
        light * (1 + warmth) * (1 - shore * 0.06),
        light * (1 + warmth * 0.4) * (1 + shore * 0.05),
        light * (1 - warmth) * (1 - shore * 0.04),
      ];
      return { floor, rock, snow, tint };
    },
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
