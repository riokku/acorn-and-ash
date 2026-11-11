/**
 * Where the salmon are during the run (decision 0294).
 *
 * Three sorts, all worked out from the shared clock so that everyone standing
 * at the river sees the same fish do the same thing:
 *
 * - swimmers, spaced up the whole of the Alderwash, working their way upstream
 *   just under the surface;
 * - leapers, throwing themselves at each waterfall, some clearing it and some
 *   falling back;
 * - a shoal turning at the river's mouth in Mirrormere, waiting to go up.
 *
 * Plain numbers in and out, no Three.js, so it can be tested on its own.
 */

import {
  LAKE,
  STREAM,
  streamPointAt,
  streamSurfaceAt,
  streamWaterHalfWidthAt,
} from '@acorn/shared';

export interface SalmonPose {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Which way it heads, as a turn about the upright, and how far its nose is tipped up. */
  readonly yaw: number;
  readonly pitch: number;
}

/** Metres between one swimmer and the next up the river. */
export const SWIMMER_SPACING = 6.5;
/** How fast a swimmer gains ground against the current, in metres a second. */
const SWIMMER_SPEED = 0.85;
/** How far under the surface a swimmer's middle is: its red back rides clear of the water. */
const SWIMMER_DEPTH = 0.015;
/** Swimmers keep this far from a waterfall; the leapers have that water. */
const FALL_GAP = 3.4;

/** Seconds from one chance of a leap to the next at each waterfall. */
const LEAP_EVERY = 1.9;
/** Seconds a leap takes. */
const LEAP_SECONDS = 1.25;
/** How many of those chances are taken. */
const LEAP_SHARE = 0.6;
/** How many leaps clear the fall. */
const LEAP_CLEARS = 0.6;

export const SHOAL_SIZE = 10;

const STEP = STREAM.length / (STREAM.count - 1);

function hash01(a: number, b: number): number {
  let h = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul((b | 0) + 0x7f4a7c15, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 0x1_0000_0000;
}

/** A point on the middle of the river this far down it, and the way downstream from there. */
export function riverAt(along: number): { x: number; z: number; dx: number; dz: number } {
  const clamped = Math.min(Math.max(along, 0), STREAM.length - 1e-3);
  const index = Math.floor(clamped / STEP);
  const share = clamped / STEP - index;
  const a = streamPointAt(STREAM, index);
  const b = streamPointAt(STREAM, Math.min(index + 1, STREAM.count - 1));
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const size = Math.hypot(dx, dz) || 1;
  return { x: a.x + dx * share, z: a.z + dz * share, dx: dx / size, dz: dz / size };
}

/** The turn about the upright that faces a model (nose along +Z) this way. */
function yawFor(dx: number, dz: number): number {
  return Math.atan2(dx, dz);
}

export function swimmerCount(): number {
  return Math.floor(STREAM.length / SWIMMER_SPACING);
}

/** Swimmer `index` at this moment, or null while it is passing a waterfall. */
export function swimmerAt(index: number, seconds: number): SalmonPose | null {
  const own = hash01(index, 11);
  const travelled = index * SWIMMER_SPACING + own * 3 + seconds * SWIMMER_SPEED * (0.8 + own * 0.4);
  // Upstream is towards the spring, where `along` is small.
  const along = STREAM.length - (travelled % STREAM.length);
  for (const fall of STREAM.falls) if (Math.abs(along - fall.at) < FALL_GAP) return null;
  const here = riverAt(along);
  const half = Math.max(0, streamWaterHalfWidthAt(STREAM, along) - 0.45);
  const weave = Math.sin(seconds * 0.35 + own * 40) * 0.25;
  const across = ((hash01(index, 29) - 0.5) * 1.6 + weave) * half * 0.55;
  const wiggle = Math.sin(seconds * 5.5 + index * 1.7) * 0.2;
  return {
    x: here.x + -here.dz * across,
    y: streamSurfaceAt(STREAM, along) - SWIMMER_DEPTH,
    z: here.z + here.dx * across,
    yaw: yawFor(-here.dx, -here.dz) + wiggle,
    pitch: 0,
  };
}

/** The salmon in the air at waterfall `fallIndex` at this moment, if one is. */
export function leaperAt(fallIndex: number, seconds: number): SalmonPose | null {
  const fall = STREAM.falls[fallIndex];
  if (fall === undefined) return null;
  // Each fall keeps its own time, so they do not all go at once.
  const clock = seconds / LEAP_EVERY + hash01(fallIndex, 3);
  const slot = Math.floor(clock);
  const into = (clock - slot) * LEAP_EVERY;
  if (into > LEAP_SECONDS || hash01(slot, fallIndex + 101) > LEAP_SHARE) return null;
  const clears = hash01(slot, fallIndex + 211) < LEAP_CLEARS;
  const u = into / LEAP_SECONDS;
  // A fall is a short steep chute; a leap goes from the pool at its foot to the lip above.
  const from = fall.at + 3.2;
  const to = fall.at - 3;
  // One that falls back turns in the air and comes down where it started.
  const reach = clears ? u : 0.5 * Math.sin(Math.PI * u);
  const along = from + (to - from) * reach;
  const here = riverAt(along);
  const half = Math.max(0, streamWaterHalfWidthAt(STREAM, fall.at) - 0.5);
  const across = (hash01(slot, fallIndex + 307) - 0.5) * half * 0.7;
  const foot = streamSurfaceAt(STREAM, from);
  const head = streamSurfaceAt(STREAM, to);
  const rise = (clears ? 0.6 : 0.4) + fall.drop * 0.35;
  const base = clears ? foot + (head - foot) * u : foot;
  const arc = 4 * rise * u * (1 - u) + (clears ? 0 : fall.drop * 0.5 * Math.sin(Math.PI * u));
  // Nose up on the way up, down on the way down.
  const climbing = Math.cos(Math.PI * u);
  const heading = clears || u < 0.5 ? 1 : -1;
  return {
    x: here.x + -here.dz * across,
    y: base + arc - 0.05,
    z: here.z + here.dx * across,
    yaw: yawFor(-here.dx * heading, -here.dz * heading),
    pitch: climbing * (clears ? 0.95 : 1.15) * heading,
  };
}

/** One of the shoal turning at the river's mouth, out in the lake. */
export function shoalAt(index: number, seconds: number): SalmonPose {
  const mouth = riverAt(STREAM.length);
  // A few metres out past the mouth, where the water is deep enough to turn in.
  const cx = mouth.x + mouth.dx * 7;
  const cz = mouth.z + mouth.dz * 7;
  const own = hash01(index, 53);
  const radius = 2.2 + own * 3.4;
  const turn = (index % 2 === 0 ? 1 : -1) * (0.22 + own * 0.12);
  const angle = seconds * turn + own * Math.PI * 2;
  const wiggle = Math.sin(seconds * 5 + index * 2.1) * 0.18;
  return {
    x: cx + Math.cos(angle) * radius,
    y: LAKE.level - SWIMMER_DEPTH - own * 0.05,
    z: cz + Math.sin(angle) * radius * 0.8,
    yaw: yawFor(-Math.sin(angle) * turn, Math.cos(angle) * 0.8 * turn) + wiggle,
    pitch: 0,
  };
}
