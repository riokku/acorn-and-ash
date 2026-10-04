/**
 * The world, painted as a page of a field journal (see decision 0054).
 *
 * Built from the same seed the 3D world is, with the same painting kit as
 * the textures: a parchment page, soft watercolour washes for the grass and
 * the forest floor (coloured by the very same ground shading the 3D ground
 * uses, so the map and the world agree), a pond with a darker rim where the
 * paint pooled, faint ink contour lines on the hills, a painted blob for
 * every tree and rock, and a dashed line where the world ends.
 *
 * No DOM and no Three.js, so it can be tested on its own and painted in a
 * worker while the game carries on.
 */

import {
  LAKE,
  PLAYABLE_HALF_EXTENT,
  PROP_KINDS,
  buildTestClearing,
  buildWilderness,
  createWildernessTerrain,
  lakeDepthAt,
  type Lake,
  type PlacedProp,
  type Terrain,
  type WaterCircle,
} from '@acorn/shared';

import { createGroundShader } from '../art/ground-shading';
import { seededRandom, smoothstep, tileableFbm, worldNoise } from '../art/noise';
import { Raster, hex, mixRgb, scaleRgb, type Rgb } from '../art/raster';

/** How far from the middle the map reaches, a little past the wall so the edge of the world has somewhere to fade. */
export const MAP_HALF_EXTENT = PLAYABLE_HALF_EXTENT + 12;
/** Pixels along each side of the painted map. About a third of a metre each. */
export const MAP_IMAGE_SIZE = 1024;

/** The bare page, as 0xRRGGBB - also what the unexplored parts of the map are covered in. */
export const PARCHMENT = 0xefe4c9;

const PAPER = hex(PARCHMENT);
const PAPER_DARK = hex(0xdccba5);
const GRASS = hex(0xb0c78f);
const GRASS_LUSH = hex(0x92b97c);
const FLOOR = hex(0xc2a46f);
const WATER_SHALLOW = hex(0x9fc6cb);
const WATER_DEEP = hex(0x6795ad);
const WATER_RIM = hex(0x4c7890);
const INK = hex(0x5b4631);
const TREE_COLOURS: Record<string, Rgb> = {
  pine: hex(0x4b775c),
  birch: hex(0x8db06a),
  oak: hex(0x648f50),
};
const TREE_SHADOW = hex(0x55603f);
const ROCK = hex(0x9d998e);
const MOSS = hex(0x8c9a70);

/** Metres between two samples of the ground's height and shading, blended smoothly in between. */
const SAMPLE_SPACING = 2;
/**
 * Trees and rocks are drawn a little larger than life, the way map symbols
 * always are, so they still read on the small minimap.
 */
const SYMBOL_SCALE = 1.35;
/** Height between two ink contour lines on the hills, in metres. */
const CONTOUR_INTERVAL = 1.25;

/** Everything about the world the map needs, built from the seed the same way the game builds it. */
export interface MapWorld {
  readonly terrain: Terrain;
  readonly water: readonly WaterCircle[];
  /** The lake, with its islands, if the world has one. */
  readonly lake?: Lake | null;
  readonly props: readonly PlacedProp[];
}

export function mapWorldFromSeed(seed: number): MapWorld {
  const clearing = buildTestClearing(seed);
  const terrain = createWildernessTerrain(seed);
  const wilderness = buildWilderness(seed, terrain);
  return {
    terrain,
    water: clearing.water,
    lake: LAKE,
    props: [...clearing.props, ...wilderness.props],
  };
}

/** Paint the whole world onto a square page `size` pixels across. */
export function paintWorldMap(world: MapWorld, size: number = MAP_IMAGE_SIZE): Raster {
  const raster = new Raster(size);
  const metresPerPixel = (MAP_HALF_EXTENT * 2) / size;
  const samples = sampleGround(world);
  const paper = paintPaper();

  raster.fill((u, v, out) => {
    const x = u * MAP_HALF_EXTENT * 2 - MAP_HALF_EXTENT;
    const z = v * MAP_HALF_EXTENT * 2 - MAP_HALF_EXTENT;
    const grain = paper.at(u * size, v * size);
    let colour: Rgb = mixRgb(PAPER, PAPER_DARK, grain * 0.35);

    const ground = samples.at(x, z);
    // The land is a wash laid over the page, fading out raggedly past the
    // wall into bare paper: the edge of what anybody has ever mapped.
    const beyond = Math.max(Math.abs(x), Math.abs(z)) - PLAYABLE_HALF_EXTENT;
    const edge = 1 - smoothstep(-2, 9, beyond + worldNoise(x * 0.08, z * 0.08, 91) * 5);
    if (edge > 0) {
      const lush = 1 - smoothstep(0, 5, ground.waterGap);
      const grass = mixRgb(GRASS, GRASS_LUSH, lush * 0.6);
      let land = mixRgb(grass, FLOOR, ground.floor);
      // Sunny and shady patches, from the same tint the 3D ground uses.
      land = scaleRgb(land, 0.9 + (ground.light - 0.9) * 0.9);
      // Hills lit from the top left of the page, as maps usually are.
      land = scaleRgb(land, 1 + ground.hillShade);
      // Pigment settling into the paper's grain.
      land = scaleRgb(land, 0.95 + grain * 0.08);
      colour = mixRgb(colour, land, 0.88 * edge);

      if (ground.waterGap < 0) {
        const depth = smoothstep(0, 4, -ground.waterGap);
        let water = mixRgb(WATER_SHALLOW, WATER_DEEP, depth);
        // Watercolour pools and dries darker right at the edge of a wash.
        const rim = 1 - smoothstep(0, 0.7 + grain * 0.3, -ground.waterGap);
        water = mixRgb(water, WATER_RIM, rim * 0.55);
        colour = mixRgb(colour, water, 0.92);
      } else {
        // Faint sepia contour lines, about a pixel wide whatever the slope.
        const level = ground.height / CONTOUR_INTERVAL - 0.5;
        const heightToLine = Math.abs(level - Math.round(level)) * CONTOUR_INTERVAL;
        const metresToLine = heightToLine / Math.max(ground.slope, 1e-3);
        const line =
          (1 - smoothstep(0.2, 0.9, metresToLine / metresPerPixel)) *
          smoothstep(0.03, 0.08, ground.slope);
        colour = mixRgb(colour, INK, line * 0.3 * edge);
      }
    }

    out[0] = colour[0];
    out[1] = colour[1];
    out[2] = colour[2];
  });

  const toPixel = (metres: number): number => (metres + MAP_HALF_EXTENT) / metresPerPixel;
  paintScenery(raster, world.props, toPixel, metresPerPixel);
  paintWorldEdge(raster, toPixel, metresPerPixel);
  return raster;
}

interface GroundSample {
  readonly height: number;
  /** Rise over run. */
  readonly slope: number;
  /** 0 lawn to 1 forest floor, from `ground-shading.ts`. */
  readonly floor: number;
  /** How brightly lit the ground is there, from `ground-shading.ts`'s tint. */
  readonly light: number;
  /** A small lighter-or-darker from the hill's slope facing the light. */
  readonly hillShade: number;
  /** Metres to the nearest water's edge, negative inside it. */
  readonly waterGap: number;
}

/**
 * The ground's height and shading on a coarse grid, blended smoothly in
 * between: asking the ground shader about every one of a million pixels
 * would take seconds, and a wash has no business being any sharper than this.
 */
function sampleGround(world: MapWorld): { at(x: number, z: number): GroundSample } {
  const count = Math.ceil((MAP_HALF_EXTENT * 2) / SAMPLE_SPACING) + 1;
  const fields = 6;
  const grid = new Float32Array(count * count * fields);
  const shader = createGroundShader({ water: world.water, lake: world.lake, props: world.props });
  const step = SAMPLE_SPACING;

  for (let row = 0; row < count; row++) {
    const z = row * step - MAP_HALF_EXTENT;
    for (let column = 0; column < count; column++) {
      const x = column * step - MAP_HALF_EXTENT;
      const height = world.terrain.heightAt(x, z);
      const dx = (world.terrain.heightAt(x + 1, z) - world.terrain.heightAt(x - 1, z)) / 2;
      const dz = (world.terrain.heightAt(x, z + 1) - world.terrain.heightAt(x, z - 1)) / 2;
      const slope = Math.hypot(dx, dz);
      const shade = shader.shadeAt(x, z, slope);
      let waterGap = Infinity;
      for (const circle of world.water) {
        waterGap = Math.min(waterGap, Math.hypot(circle.x - x, circle.z - z) - circle.radius);
      }
      // Depth is positive on the water, so the gap to the water's edge is its opposite.
      if (world.lake != null) waterGap = Math.min(waterGap, -lakeDepthAt(world.lake, x, z));
      const index = (row * count + column) * fields;
      grid[index] = height;
      grid[index + 1] = slope;
      grid[index + 2] = shade.floor;
      grid[index + 3] = (shade.tint[0] + shade.tint[1] + shade.tint[2]) / 3;
      // Light from the top left of the page: slopes facing up and left
      // brighten, slopes facing down and right darken.
      grid[index + 4] = Math.max(-0.14, Math.min(0.14, (dx + dz) * -0.35));
      grid[index + 5] = Math.min(waterGap, 50);
    }
  }

  return {
    at(x, z) {
      const fx = Math.min(count - 1.001, Math.max(0, (x + MAP_HALF_EXTENT) / step));
      const fz = Math.min(count - 1.001, Math.max(0, (z + MAP_HALF_EXTENT) / step));
      const column = Math.floor(fx);
      const row = Math.floor(fz);
      const tx = fx - column;
      const tz = fz - row;
      const read = (field: number): number => {
        const a = grid[(row * count + column) * fields + field] ?? 0;
        const b = grid[(row * count + column + 1) * fields + field] ?? 0;
        const c = grid[((row + 1) * count + column) * fields + field] ?? 0;
        const d = grid[((row + 1) * count + column + 1) * fields + field] ?? 0;
        return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;
      };
      return {
        height: read(0),
        slope: read(1),
        floor: read(2),
        light: read(3),
        hillShade: read(4),
        waterGap: read(5),
      };
    },
  };
}

/** The page's own grain: a small tileable patch of fibres and blotches, looked up rather than worked out per pixel. */
function paintPaper(): { at(x: number, y: number): number } {
  const size = 256;
  const values = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const blotch = tileableFbm(x / 64, y / 64, 4, 3, 501) * 0.5 + 0.5;
      const fibre = tileableFbm(x / 8, y / 32, 32, 2, 502, 8) * 0.5 + 0.5;
      values[y * size + x] = Math.min(1, Math.max(0, blotch * 0.7 + fibre * 0.3));
    }
  }
  return {
    at(x, y) {
      const px = ((Math.floor(x) % size) + size) % size;
      const py = ((Math.floor(y) % size) + size) % size;
      return values[py * size + px] ?? 0.5;
    },
  };
}

/** A painted blob for every tree and rock, back to front so the nearer ones overlap. */
function paintScenery(
  raster: Raster,
  props: readonly PlacedProp[],
  toPixel: (metres: number) => number,
  metresPerPixel: number,
): void {
  const ordered = [...props].sort((a, b) => a.z - b.z);
  for (const prop of ordered) {
    const kind = PROP_KINDS[prop.kind];
    const x = toPixel(prop.x);
    const y = toPixel(prop.z);
    const random = seededRandom(prop.id * 7919 + 13);
    const vary = 0.92 + random() * 0.16;

    if (kind.shape.family === 'tree') {
      const radius = Math.max(
        2,
        (kind.shape.canopyRadius * prop.scale * SYMBOL_SCALE) / metresPerPixel,
      );
      const colour = scaleRgb(TREE_COLOURS[prop.kind] ?? TREE_COLOURS.oak ?? GRASS, vary);
      raster.dab(x + radius * 0.35, y + radius * 0.45, radius * 1.05, TREE_SHADOW, 0.28, 0.3);
      raster.dab(x, y, radius, colour, 0.9, 0.55);
      raster.dab(
        x - radius * 0.3,
        y - radius * 0.3,
        radius * 0.5,
        scaleRgb(colour, 1.18),
        0.35,
        0.2,
      );
      // A tiny dark centre where the trunk is, the way a map-maker dots one in.
      raster.dab(x, y, Math.max(0.6, radius * 0.18), INK, 0.35, 0.8);
    } else if (kind.shape.family === 'rock') {
      const radius = Math.max(
        1.5,
        (kind.shape.radius * prop.scale * SYMBOL_SCALE) / metresPerPixel,
      );
      const colour = prop.kind === 'mossyRock' ? MOSS : ROCK;
      raster.dab(x + radius * 0.3, y + radius * 0.35, radius, INK, 0.25, 0.4);
      raster.dab(x, y, radius, scaleRgb(colour, vary), 0.95, 0.75);
      raster.dab(
        x - radius * 0.25,
        y - radius * 0.3,
        radius * 0.45,
        scaleRgb(colour, 1.2),
        0.4,
        0.3,
      );
    }
  }
}

/** A dashed ink line round the edge of the world, where the invisible wall stands. */
function paintWorldEdge(
  raster: Raster,
  toPixel: (metres: number) => number,
  metresPerPixel: number,
): void {
  const dash = 3;
  const gap = 2.5;
  const width = Math.max(2, 0.7 / metresPerPixel);
  const side = PLAYABLE_HALF_EXTENT;
  const lines: [number, number, number, number][] = [
    [-side, -side, side, -side],
    [side, -side, side, side],
    [side, side, -side, side],
    [-side, side, -side, -side],
  ];
  for (const [ax, az, bx, bz] of lines) {
    const length = Math.hypot(bx - ax, bz - az);
    for (let along = 0; along < length; along += dash + gap) {
      const start = along / length;
      const end = Math.min(length, along + dash) / length;
      raster.stroke(
        [toPixel(ax + (bx - ax) * start), toPixel(az + (bz - az) * start)],
        [
          toPixel(ax + (bx - ax) * ((start + end) / 2)),
          toPixel(az + (bz - az) * ((start + end) / 2)),
        ],
        [toPixel(ax + (bx - ax) * end), toPixel(az + (bz - az) * end)],
        width,
        width,
        INK,
        0.55,
        0.7,
      );
    }
  }
}
