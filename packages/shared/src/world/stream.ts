/**
 * The stream: a winding, shallow stream that runs from a spring high on the
 * mountain, down through a few small waterfalls, across the lowland and into
 * the west shore of the lake (see decision 0114).
 *
 * Like the lake it is hand-placed, the same in every world. Its path is a
 * handful of waypoints smoothed into a curve with a gentle meander. Along
 * that path three things are worked out from the distance travelled `s`:
 *
 * - the bed, which only ever goes down, in a few short steps (the falls),
 * - how wide the water is, which grows toward the lake, and
 * - how deep it is, never more than knee deep so players can wade it.
 *
 * The ground round the stream is shaped to suit: a shallow bowl for the water,
 * a soft bank, and a valley floor that eases back into the hills (or, on the
 * mountain, cuts a gorge into the slope). Plain numbers in and out, so the
 * server, every browser and the tests agree and nothing travels over the wire.
 */

import { lerp, smoothstep } from '../math/vec3';
import { basinDepthAt, LAKE, type Lake } from './lake';
import type { WaterCircle } from './water';

/** A waterfall: the bed drops `drop` metres at `at` metres down the stream. */
export interface StreamFall {
  readonly at: number;
  readonly drop: number;
}

/** The path, by hand: from the spring on the mountain's east flank to the lake's west shore. */
const ROUTE: readonly (readonly [number, number])[] = [
  [-126, 170],
  [-104, 146],
  [-86, 122],
  [-74, 96],
  [-80, 56],
  [-70, 16],
  [-73, -30],
  [-60, -75],
  [-30, -104],
  [5, -112],
  [35, -100],
  [57, -91],
];

/** Where the falls are, as a share of the stream's length, and how far each drops, in metres. */
const FALLS: readonly { readonly share: number; readonly drop: number }[] = [
  { share: 0.08, drop: 2.2 },
  { share: 0.17, drop: 2 },
  { share: 0.27, drop: 2.6 },
  { share: 0.37, drop: 1.8 },
  { share: 0.5, drop: 2 },
];

/** Height of the water's surface at the spring, in metres. */
const SPRING_SURFACE = 36;
/** How far a fall's drop is spread along the stream, in metres: short, so it reads as a step. */
const FALL_RUN = 2.4;
/** The bank beside a fall eases down over this many metres, so it can be walked round. */
const BANK_FALL_RUN = 60;
/** Metres between samples along the path. */
const SAMPLE_SPACING = 1.5;
/** The meander swings this far either side of the route's line, in metres, and repeats this often. */
const MEANDER_AMPLITUDE = 8;
const MEANDER_WAVELENGTH = 110;

/** Half the width of the bowl the water sits in, at the spring and at the lake. */
const HALF_WIDTH_SPRING = 1.6;
const HALF_WIDTH_MOUTH = 5;
/** Depth of the water along the middle, at the spring and at the lake, in metres. */
const DEPTH_SPRING = 0.3;
const DEPTH_MOUTH = 0.5;
/** The rim of the bowl stands this far above the water's surface. */
const RIM_LIP = 0.05;
/** The water ends at this share of the bowl's half width. */
const WATER_SHARE = 0.94;
/** The banks climb this steeply out of the bowl: gentle enough to walk. */
const BANK_SLOPE = 0.5;
/** The valley floor stands this far above the water's surface. */
const FLOOR_ABOVE_WATER = 0.55;
/** The soft bank beside the bowl before the valley begins to ease back into the hills, in metres. */
const BANK_WIDTH = 3;
/** How steep the sides of the valley are allowed to run (rise over run before smoothing). */
const VALLEY_RUN_PER_METRE = 2.2;
const VALLEY_RUN_MIN = 22;
const VALLEY_RUN_MAX = 70;
/** The valley and the spring's bowl fade in over this many metres from the spring. */
const SPRING_FADE = 25;
/** Trees, rocks and building keep this far from the water's edge, in metres. */
export const STREAM_PROP_CLEARANCE = 1.2;
/** The stream's keep-out circles overlap this much along the path. */
const KEEP_OUT_STEP = 4;
/** Stones sit along the banks; how many per hundred metres of stream. */
export const STREAM_STONES_PER_100M = 22;

export interface Stream {
  /** Height of the water's surface where the stream meets the lake, in metres. */
  readonly mouthLevel: number;
  /** The path as x, z pairs, `SAMPLE_SPACING` metres apart. */
  readonly points: Float64Array;
  /** How many samples there are. */
  readonly count: number;
  /** Length of the whole path in metres. */
  readonly length: number;
  readonly falls: readonly StreamFall[];
  /** The box that holds the path with room for every bit of shaped ground. */
  readonly reach: {
    readonly minX: number;
    readonly maxX: number;
    readonly minZ: number;
    readonly maxZ: number;
  };
  /** Each sample's bed height: sharp steps at the falls. */
  readonly bed: Float64Array;
  /** Each sample's bank height: the bed with the falls spread out. */
  readonly bank: Float64Array;
}

/** A point on the stream: where, how far down it, and how far the question was from it. */
export interface StreamSpot {
  /** Metres from the path's middle. */
  readonly distance: number;
  /** Metres travelled down the stream to the nearest point of the path. */
  readonly along: number;
  /** Where on the path that is. */
  readonly x: number;
  readonly z: number;
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

/** The route as a smooth curve, a metre or so between points. */
function smoothRoute(): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [];
  const last = ROUTE.length - 1;
  for (let index = 0; index < last; index++) {
    const p0 = ROUTE[Math.max(0, index - 1)]!;
    const p1 = ROUTE[index]!;
    const p2 = ROUTE[index + 1]!;
    const p3 = ROUTE[Math.min(last, index + 2)]!;
    const steps = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1])));
    for (let step = 0; step < steps; step++) {
      const t = step / steps;
      out.push({
        x: catmullRom(p0[0], p1[0], p2[0], p3[0], t),
        z: catmullRom(p0[1], p1[1], p2[1], p3[1], t),
      });
    }
  }
  const end = ROUTE[last]!;
  out.push({ x: end[0], z: end[1] });
  return out;
}

/** Walk a polyline and drop a point every `spacing` metres. */
function resample(
  line: readonly { x: number; z: number }[],
  spacing: number,
): { x: number; z: number }[] {
  const out = [line[0]!];
  let carried = 0;
  for (let index = 1; index < line.length; index++) {
    const from = line[index - 1]!;
    const to = line[index]!;
    const segment = Math.hypot(to.x - from.x, to.z - from.z);
    let at = spacing - carried;
    while (at <= segment) {
      const t = at / segment;
      out.push({ x: lerp(from.x, to.x, t), z: lerp(from.z, to.z, t) });
      at += spacing;
    }
    carried = segment - (at - spacing);
  }
  return out;
}

function lengthOf(line: readonly { x: number; z: number }[]): number {
  let total = 0;
  for (let index = 1; index < line.length; index++) {
    total += Math.hypot(line[index]!.x - line[index - 1]!.x, line[index]!.z - line[index - 1]!.z);
  }
  return total;
}

/** Sway the line gently from side to side, less so at both ends where it has to meet the spring and the lake. */
function meander(line: readonly { x: number; z: number }[]): { x: number; z: number }[] {
  const total = lengthOf(line);
  let travelled = 0;
  return line.map((point, index) => {
    if (index > 0) {
      travelled += Math.hypot(point.x - line[index - 1]!.x, point.z - line[index - 1]!.z);
    }
    const before = line[Math.max(0, index - 1)]!;
    const after = line[Math.min(line.length - 1, index + 1)]!;
    const dx = after.x - before.x;
    const dz = after.z - before.z;
    const size = Math.hypot(dx, dz) || 1;
    const calm = smoothstep(travelled, 0, 40) * (1 - smoothstep(travelled, total - 40, total));
    const sway =
      Math.sin((travelled / MEANDER_WAVELENGTH) * Math.PI * 2) * MEANDER_AMPLITUDE * calm;
    return { x: point.x - (dz / size) * sway, z: point.z + (dx / size) * sway };
  });
}

/** The falls' share of the length turned into metres down the stream. */
function fallsFor(length: number): StreamFall[] {
  return FALLS.map((fall) => ({ at: fall.share * length, drop: fall.drop }));
}

/** How deep the water runs along the middle at this distance down a stream of this length. */
function middleDepth(along: number, length: number): number {
  const t = Math.min(Math.max(along / length, 0), 1);
  return lerp(DEPTH_SPRING, DEPTH_MOUTH, t) * smoothstep(along, 0, 12);
}

/** The smooth part of the water's surface: it falls fast near the spring and slowly near the lake. */
function slopeSurface(
  along: number,
  length: number,
  mouth: number,
  falls: readonly StreamFall[],
): number {
  const total = falls.reduce((sum, fall) => sum + fall.drop, 0);
  const remaining = 1 - along / length;
  return mouth + (SPRING_SURFACE - mouth - total) * remaining * remaining;
}

export function createStream(lake: Lake = LAKE): Stream {
  const smooth = resample(meander(resample(smoothRoute(), 1)), SAMPLE_SPACING);
  const count = smooth.length;
  const points = new Float64Array(count * 2);
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let index = 0; index < count; index++) {
    const point = smooth[index]!;
    points[index * 2] = point.x;
    points[index * 2 + 1] = point.z;
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minZ = Math.min(minZ, point.z);
    maxZ = Math.max(maxZ, point.z);
  }
  const length = (count - 1) * SAMPLE_SPACING;
  const falls = fallsFor(length);
  const mouthSurface = lake.level + 0.02;
  const reach = VALLEY_RUN_MAX + HALF_WIDTH_MOUTH + BANK_WIDTH;

  const bed = new Float64Array(count);
  const bank = new Float64Array(count);
  for (let index = 0; index < count; index++) {
    const along = index * SAMPLE_SPACING;
    const base = slopeSurface(along, length, mouthSurface, falls);
    const depth = middleDepth(along, length);
    let sharp = 0;
    let soft = 0;
    for (const fall of falls) {
      sharp += fall.drop * (1 - smoothstep(along, fall.at - FALL_RUN / 2, fall.at + FALL_RUN / 2));
      // The bank lets go of its height after the fall, never before, so it is never lower than the bed.
      soft += fall.drop * (1 - smoothstep(along, fall.at - FALL_RUN / 2, fall.at + BANK_FALL_RUN));
    }
    bed[index] = base + sharp - depth;
    bank[index] = base + soft - depth;
  }

  return {
    mouthLevel: lake.level,
    points,
    count,
    length,
    falls,
    reach: { minX: minX - reach, maxX: maxX + reach, minZ: minZ - reach, maxZ: maxZ + reach },
    bed,
    bank,
  };
}

/** The stream as built. */
export const STREAM: Stream = createStream();

function sampleAt(values: Float64Array, along: number): number {
  const position = Math.min(Math.max(along / SAMPLE_SPACING, 0), values.length - 1);
  const low = Math.floor(position);
  const high = Math.min(low + 1, values.length - 1);
  return lerp(values[low]!, values[high]!, position - low);
}

/** Height of the bed along the middle of the stream, `along` metres down it. */
export function streamBedAt(stream: Stream, along: number): number {
  return sampleAt(stream.bed, along);
}

/** How deep the water runs along the middle, `along` metres down. */
export function streamDepthMiddle(stream: Stream, along: number): number {
  return middleDepth(along, stream.length);
}

/** Half the width of the bowl the water sits in, `along` metres down. */
export function streamHalfWidthAt(stream: Stream, along: number): number {
  const t = Math.min(Math.max(along / stream.length, 0), 1);
  return lerp(HALF_WIDTH_SPRING, HALF_WIDTH_MOUTH, Math.pow(t, 0.75));
}

/** Height of the water's surface along the middle, `along` metres down. */
export function streamSurfaceAt(stream: Stream, along: number): number {
  return streamBedAt(stream, along) + streamDepthMiddle(stream, along);
}

/** Half the width of the water itself (the bowl's rim is a hair wider), `along` metres down. */
export function streamWaterHalfWidthAt(stream: Stream, along: number): number {
  return streamHalfWidthAt(stream, along) * WATER_SHARE;
}

/** Where on the path a sample is. */
export function streamPointAt(stream: Stream, index: number): { x: number; z: number } {
  return { x: stream.points[index * 2]!, z: stream.points[index * 2 + 1]! };
}

/** How steep the bed drops here: 0 on the flat, large at a fall. Rise over run, along the stream. */
export function streamFallGradientAt(stream: Stream, along: number): number {
  const before = streamBedAt(stream, along - SAMPLE_SPACING);
  const after = streamBedAt(stream, along + SAMPLE_SPACING);
  return Math.max(0, (before - after) / (SAMPLE_SPACING * 2));
}

function insideReach(stream: Stream, x: number, z: number, extra: number): boolean {
  const box = stream.reach;
  return (
    x >= box.minX - extra && x <= box.maxX + extra && z >= box.minZ - extra && z <= box.maxZ + extra
  );
}

/** How many samples apart the first, coarse look for the nearest bit of path is. */
const COARSE = 8;

/**
 * The nearest point on the stream's path to a spot, or null when the spot is
 * further than `within` metres from all of it.
 */
export function nearestOnStream(
  stream: Stream,
  x: number,
  z: number,
  within: number,
): StreamSpot | null {
  if (!insideReach(stream, x, z, within - (VALLEY_RUN_MAX + HALF_WIDTH_MOUTH + BANK_WIDTH)))
    return null;
  const { points, count } = stream;
  let bestCoarse = 0;
  let bestSquared = Infinity;
  for (let index = 0; index < count; index += COARSE) {
    const dx = x - points[index * 2]!;
    const dz = z - points[index * 2 + 1]!;
    const squared = dx * dx + dz * dz;
    if (squared < bestSquared) {
      bestSquared = squared;
      bestCoarse = index;
    }
  }
  // The coarse look can be off by half a step, so check the samples round it properly.
  const first = Math.max(0, bestCoarse - COARSE);
  const last = Math.min(count - 2, bestCoarse + COARSE);
  let bestDistance = Infinity;
  let bestAlong = 0;
  let bestX = 0;
  let bestZ = 0;
  for (let index = first; index <= last; index++) {
    const ax = points[index * 2]!;
    const az = points[index * 2 + 1]!;
    const bx = points[index * 2 + 2]!;
    const bz = points[index * 2 + 3]!;
    const sx = bx - ax;
    const sz = bz - az;
    const t = Math.min(Math.max(((x - ax) * sx + (z - az) * sz) / (sx * sx + sz * sz), 0), 1);
    const px = ax + sx * t;
    const pz = az + sz * t;
    const distance = Math.hypot(x - px, z - pz);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestAlong = (index + t) * SAMPLE_SPACING;
      bestX = px;
      bestZ = pz;
    }
  }
  if (bestDistance > within) return null;
  return { distance: bestDistance, along: bestAlong, x: bestX, z: bestZ };
}

/** How far, in metres, a spot "listens" along the path when it averages the stream's height nearby. */
const PROFILE_REACH = 20;

/**
 * The stream's bed and bank heights and distance travelled, averaged over the
 * stretch of path near a spot, nearer bits counting for more.
 *
 * The very nearest point of a winding path jumps about from one side of a bend
 * to the other, which would leave creases in the ground a long way from the
 * water. Spots well away from it use this smoother answer instead.
 */
function averageProfile(
  stream: Stream,
  x: number,
  z: number,
): { bed: number; bank: number; along: number } {
  const { points, count, bed, bank } = stream;
  let nearest = Infinity;
  for (let index = 0; index < count; index += COARSE) {
    const dx = x - points[index * 2]!;
    const dz = z - points[index * 2 + 1]!;
    nearest = Math.min(nearest, dx * dx + dz * dz);
  }
  let total = 0;
  let sumBed = 0;
  let sumBank = 0;
  let sumAlong = 0;
  for (let index = 0; index < count; index += COARSE) {
    const dx = x - points[index * 2]!;
    const dz = z - points[index * 2 + 1]!;
    const weight = Math.exp(-(dx * dx + dz * dz - nearest) / (2 * PROFILE_REACH * PROFILE_REACH));
    total += weight;
    sumBed += weight * bed[index]!;
    sumBank += weight * bank[index]!;
    sumAlong += weight * index * SAMPLE_SPACING;
  }
  return { bed: sumBed / total, bank: sumBank / total, along: sumAlong / total };
}

/** A softened minimum: the lower of two heights, with the corner between them rounded off. */
function softMin(a: number, b: number, softness: number): number {
  const blend = Math.max(softness - Math.abs(a - b), 0) / softness;
  return Math.min(a, b) - (blend * blend * softness) / 4;
}

/** How soft the join between the water's bowl and the valley is, in metres of height. */
const BANK_SOFTNESS = 0.5;

/**
 * The height of the ground at a spot, given what the hills, mountain and lake
 * alone would make it: a bowl for the water, a soft bank beside it, and a
 * valley that eases back into the surroundings.
 *
 * Far from the stream it hands back `ground` untouched.
 */
export function streamGroundHeight(
  stream: Stream,
  lake: Lake,
  x: number,
  z: number,
  ground: number,
): number {
  const spot = nearestOnStream(stream, x, z, VALLEY_RUN_MAX + HALF_WIDTH_MOUTH + BANK_WIDTH);
  if (spot === null) return ground;
  const { distance, along } = spot;
  const half = streamHalfWidthAt(stream, along);
  const depth = streamDepthMiddle(stream, along);
  const nearby = averageProfile(stream, x, z);
  // Close to the water the exact bed matters; further out the smoother average does.
  const bed = lerp(
    streamBedAt(stream, along),
    nearby.bed,
    smoothstep(distance, half * 2, half * 2 + 8),
  );
  const springFade = smoothstep(nearby.along, 0, SPRING_FADE);

  // The valley floor, and how far the surroundings are blended into it.
  const floor = nearby.bank + depth + FLOOR_ABOVE_WATER;
  const run = Math.min(
    Math.max(Math.abs(ground - floor) * VALLEY_RUN_PER_METRE, VALLEY_RUN_MIN),
    VALLEY_RUN_MAX,
  );
  const edge = half + BANK_WIDTH;
  const inValley = 1 - smoothstep(distance, edge, edge + run);
  // The lake keeps its own shore and floor; the valley fades out as it meets the water.
  const lakeFade = 1 - smoothstep(basinDepthAt(lake, x, z), -8, 0);
  const weight = inValley * springFade * lakeFade;
  const valley = lerp(ground, floor, weight);

  // The bowl for the water: low in the middle, rising to the rim, then up the bank.
  const across = Math.min(distance / half, 1);
  const rim = bed + depth + RIM_LIP;
  const bowl = bed + (rim - bed) * across * across;
  const channel = distance <= half ? bowl : rim + (distance - half) * BANK_SLOPE;
  const fade = smoothstep(along, 0, 8);
  return softMin(valley, lerp(valley, channel, fade), BANK_SOFTNESS);
}

/**
 * How deep the water is at a spot, in metres, or 0 where it is dry.
 * Never more than knee deep in the middle.
 */
export function streamWaterDepthAt(stream: Stream, x: number, z: number): number {
  const spot = nearestOnStream(stream, x, z, HALF_WIDTH_MOUTH + 1);
  if (spot === null) return 0;
  const half = streamHalfWidthAt(stream, spot.along);
  if (spot.distance >= half) return 0;
  const surface = streamSurfaceAt(stream, spot.along);
  const across = spot.distance / half;
  const rim = streamBedAt(stream, spot.along) + streamDepthMiddle(stream, spot.along) + RIM_LIP;
  const ground =
    streamBedAt(stream, spot.along) + (rim - streamBedAt(stream, spot.along)) * across * across;
  return Math.max(0, surface - ground);
}

/** Is this spot in the water, at least `margin` metres in from its edge? */
export function isInStream(stream: Stream, x: number, z: number, margin = 0): boolean {
  const spot = nearestOnStream(stream, x, z, HALF_WIDTH_MOUTH + 1);
  if (spot === null) return false;
  return spot.distance <= streamWaterHalfWidthAt(stream, spot.along) - margin;
}

/**
 * Circles along the stream that keep things out of the water and off its
 * banks: building, patches and spawns treat them like any other water, but
 * players can still wade through (they are not walls).
 */
export function streamKeepOut(stream: Stream): WaterCircle[] {
  const circles: WaterCircle[] = [];
  const step = Math.max(1, Math.round(KEEP_OUT_STEP / SAMPLE_SPACING));
  for (let index = 0; index < stream.count; index += step) {
    const along = index * SAMPLE_SPACING;
    const at = streamPointAt(stream, index);
    circles.push({ x: at.x, z: at.z, radius: streamWaterHalfWidthAt(stream, along) + 0.5 });
  }
  return circles;
}

/** The keep-out circles for the stream as built. */
export const STREAM_KEEP_OUT: readonly WaterCircle[] = streamKeepOut(STREAM);

/** Is the spot on a bank or in the water of the stream, with `footprint` metres to spare? */
export function nearStream(stream: Stream, x: number, z: number, footprint: number): boolean {
  const spot = nearestOnStream(stream, x, z, HALF_WIDTH_MOUTH + footprint + 1);
  if (spot === null) return false;
  return spot.distance < streamHalfWidthAt(stream, spot.along) + footprint;
}
