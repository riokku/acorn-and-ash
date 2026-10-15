/** Wooded benches and contour trails, shared by the ground, scenery and walking. */
import { lerp, smoothstep } from '../math/vec3';
import { fractalNoise2D } from './noise';
import { PROP_KINDS } from '../data/props';
import type { PlacedProp } from './clearing';

interface ForestTerrace {
  readonly name: string;
  readonly x: number;
  readonly z: number;
  readonly radiusX: number;
  readonly radiusZ: number;
  readonly height: number;
  readonly slopeX?: number;
  readonly slopeZ?: number;
}

export const FOREST_TERRACES: readonly ForestTerrace[] = [
  { name: 'Cedar bench', x: 146, z: 42, radiusX: 42, radiusZ: 34, height: 15 },
  { name: 'Lake overlook', x: 176, z: -84, radiusX: 36, radiusZ: 48, height: 17 },
  { name: 'Fir saddle', x: 10, z: 135, radiusX: 48, radiusZ: 38, height: 18 },
  {
    name: 'Fir foothills',
    x: -24,
    z: 189,
    radiusX: 45,
    radiusZ: 60,
    height: 27,
    slopeX: -0.08,
    slopeZ: 0.08,
  },
  { name: 'Mountain shoulder', x: -86, z: 245, radiusX: 28, radiusZ: 24, height: 40 },
  { name: 'Snowy overlook', x: -139, z: 226, radiusX: 30, radiusZ: 28, height: 51 },
] as const;

/** Broad irregular aprons rise to gently uneven shelves, rather than round hilltops. */
export function forestReliefHeightAt(seed: number, x: number, z: number, ground: number): number {
  for (const bench of FOREST_TERRACES) {
    const dx = (x - bench.x) / bench.radiusX;
    const dz = (z - bench.z) / bench.radiusZ;
    if (Math.abs(dx) > 1.8 || Math.abs(dz) > 1.8) continue;
    const wobble = (fractalNoise2D(seed + 48371, x / 30, z / 30, 2) - 0.5) * 0.3;
    const radius = Math.hypot(dx, dz) + wobble;
    const weight = 1 - smoothstep(radius, 0.5, 1.65);
    if (weight <= 0) continue;
    const duff = (fractalNoise2D(seed + 57283, x / 24, z / 24, 2) - 0.5) * 0.65;
    const incline = (x - bench.x) * (bench.slopeX ?? 0) + (z - bench.z) * (bench.slopeZ ?? 0);
    ground = lerp(ground, bench.height + incline + duff, weight);
  }
  return ground;
}

export interface ForestTrailPoint {
  readonly x: number;
  readonly z: number;
  readonly y: number;
}

/** Elevations are authored too: every route has a gentle way up, in every seed. */
const ROUTES = [
  {
    name: 'Cedar trail',
    points: [
      [25, 12, 0],
      [48, 16, 1],
      [64, 39, 4],
      [92, 58, 8],
      [115, 40, 12],
      [146, 42, 15],
    ],
  },
  {
    name: 'Overlook trail',
    points: [
      [64, 39, 4],
      [78, 12, 6],
      [115, -2, 8],
      [145, -24, 12],
      [170, -57, 16],
      [176, -84, 17],
    ],
  },
  {
    name: 'Mountain switchbacks',
    points: [
      [10, 28, 0],
      [28, 52, 2],
      [40, 78, 6],
      [8, 104, 12],
      [10, 135, 18],
      [-18, 153, 19],
      [-33, 185, 24],
      [-31, 215, 29],
      [-62, 230, 35],
      [-86, 245, 40],
      [-111, 224, 46],
      [-139, 226, 51],
    ],
  },
] as const;

function curve(a: number, b: number, c: number, d: number, t: number): number {
  return (
    0.5 *
    (2 * b +
      (-a + c) * t +
      (2 * a - 5 * b + 4 * c - d) * t * t +
      (-a + 3 * b - 3 * c + d) * t * t * t)
  );
}

export const FOREST_TRAILS: readonly {
  readonly name: string;
  readonly points: readonly ForestTrailPoint[];
}[] = ROUTES.map((route) => {
  const points: ForestTrailPoint[] = [];
  for (let i = 0; i < route.points.length - 1; i++) {
    const a = route.points[Math.max(0, i - 1)]!;
    const b = route.points[i]!;
    const c = route.points[i + 1]!;
    const d = route.points[Math.min(route.points.length - 1, i + 2)]!;
    const steps = Math.ceil(Math.hypot(c[0] - b[0], c[1] - b[1]));
    for (let step = 0; step < steps; step++) {
      const t = step / steps;
      points.push({
        x: curve(a[0], b[0], c[0], d[0], t),
        z: curve(a[1], b[1], c[1], d[1], t),
        y: lerp(b[2], c[2], smoothstep(t, 0, 1)),
      });
    }
  }
  const last = route.points.at(-1)!;
  points.push({ x: last[0], z: last[1], y: last[2] });
  return { name: route.name, points };
});

interface Segment {
  readonly a: ForestTrailPoint;
  readonly b: ForestTrailPoint;
}
const CELL = 16;
const WIDEST_TREE_RADIUS = Math.max(
  ...Object.values(PROP_KINDS)
    .filter((kind) => kind.shape.family === 'tree')
    .map((kind) => kind.colliderRadius),
);
/** Farther from the tread, a cut bank blends back into the hillside. */
const APRON = 12;
const segments = new Map<string, Segment[]>();
for (const trail of FOREST_TRAILS) {
  for (let i = 1; i < trail.points.length; i++) {
    const a = trail.points[i - 1]!,
      b = trail.points[i]!;
    for (
      let ix = Math.floor((Math.min(a.x, b.x) - APRON) / CELL);
      ix <= Math.floor((Math.max(a.x, b.x) + APRON) / CELL);
      ix++
    )
      for (
        let iz = Math.floor((Math.min(a.z, b.z) - APRON) / CELL);
        iz <= Math.floor((Math.max(a.z, b.z) + APRON) / CELL);
        iz++
      ) {
        const key = `${ix},${iz}`;
        const bucket = segments.get(key);
        if (bucket) bucket.push({ a, b });
        else segments.set(key, [{ a, b }]);
      }
  }
}

export interface ForestTrailSpot {
  readonly distance: number;
  readonly height: number;
  readonly halfWidth: number;
}

/** Only nearby segments are visited, including during server movement ticks. */
export function forestTrailAt(x: number, z: number): ForestTrailSpot | null {
  const nearby = segments.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`);
  if (!nearby) return null;
  let best = APRON * APRON;
  let height = 0;
  for (const { a, b } of nearby) {
    const dx = b.x - a.x,
      dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
    const distance = (x - a.x - dx * t) ** 2 + (z - a.z - dz * t) ** 2;
    if (distance < best) {
      best = distance;
      height = lerp(a.y, b.y, t);
    }
  }
  if (best >= APRON * APRON) return null;
  return {
    distance: Math.sqrt(best),
    height,
    halfWidth: 1.2 + Math.sin(x * 0.09 + z * 0.06) * 0.15,
  };
}

export function forestTrailCoverage(x: number, z: number): number {
  const trail = forestTrailAt(x, z);
  return trail ? 1 - smoothstep(trail.distance, trail.halfWidth - 0.5, trail.halfWidth + 0.9) : 0;
}

export function forestTrailHeightAt(x: number, z: number, ground: number): number {
  const trail = forestTrailAt(x, z);
  return trail
    ? lerp(ground, trail.height, 1 - smoothstep(trail.distance, trail.halfWidth + 0.8, APRON))
    : ground;
}

/** Filter after numbering: existing chopped trees keep their identity. */
export function blocksForestTrail(prop: PlacedProp): boolean {
  const trail = forestTrailAt(prop.x, prop.z);
  // Reserve the widest trunk even if altitude changes a broadleaf to pine.
  const radius =
    PROP_KINDS[prop.kind].shape.family === 'tree'
      ? WIDEST_TREE_RADIUS
      : PROP_KINDS[prop.kind].colliderRadius;
  return trail !== null && trail.distance < trail.halfWidth + radius * prop.scale + 0.7;
}
