/**
 * Placing something in the world.
 *
 * A piece goes wherever the player points the mouse, within `BUILD_REACH` of
 * where they stand, turned whichever way they chose (see decision 0052). Only
 * the server ever decides whether a spot actually counts; the client runs this
 * same check to colour the preview green or red and say why.
 *
 * Everything here thinks about the ground as seen from above: a footprint is
 * either a circle, or a line with some width to it for a long, thin piece like
 * a fence.
 */

import {
  BUILD_SPACING,
  CLEARING_TREE_LINE_INNER,
  FENCE_JOIN_TOLERANCE,
  FENCE_SNAP_RADIUS,
  PICKUP_REACH,
  PLAYER_RADIUS,
  PLAYABLE_HALF_EXTENT,
} from '../constants';
import { BUILDABLE_KINDS, type BuildableKindId } from '../data/buildables';
import type { Vec3 } from '../math/vec3';
import { BOAT_BERTH_MAX_DEPTH, BOAT_HULL_MIN_DEPTH } from '../world/boat';
import { LAKE, lakeDepthAt } from '../world/lake';
import { REED_PATCHES } from '../world/reeds';
import { overlapsWater, type WaterCircle } from '../world/water';

/** Something on the ground, or about to be, as far as fitting pieces together goes. */
export interface Footprint {
  readonly x: number;
  readonly z: number;
  /** How far it reaches either side of its middle line; its radius, if it is round. */
  readonly radius: number;
  /** Half the length of its middle line, along its own heading. Zero for anything round. */
  readonly halfLength: number;
  /** Which way it is turned, the same way a model's `rotation.y` reads. */
  readonly yaw: number;
  /** Which buildable kind it is, or null for a tree, a rock or a stump. */
  readonly kind: BuildableKindId | null;
  /** What to call it when it is in the way: "oak", "fence". */
  readonly name: string;
}

/** Why a piece cannot go where it is pointed, or null if it can. */
export type BuildRefusal =
  | { readonly reason: 'tooFar' }
  | { readonly reason: 'onPlayer' }
  | { readonly reason: 'pastTreeLine' }
  | { readonly reason: 'worldEdge' }
  | { readonly reason: 'water' }
  /** A boat that is not floating: on the bank, or too near the shore for water under it. */
  | { readonly reason: 'needsWater' }
  /** A boat built so far out that it could never have been reached from the bank. */
  | { readonly reason: 'tooFarOut' }
  | { readonly reason: 'tooClose'; readonly what: string };

interface Point {
  readonly x: number;
  readonly z: number;
}

/** A piece of this kind, placed here and turned this way. */
export function buildableFootprint(
  kind: BuildableKindId,
  x: number,
  z: number,
  yaw: number,
): Footprint {
  const buildable = BUILDABLE_KINDS[kind];
  return {
    x,
    z,
    radius: buildable.footprintRadius,
    halfLength: 'footprintHalfLength' in buildable ? buildable.footprintHalfLength : 0,
    yaw,
    kind,
    name: buildable.displayName.toLowerCase(),
  };
}

/** How much room a clump of lake reeds keeps clear of anything built beside it, in metres. */
const REED_CLEAR_RADIUS = 0.7;

/** The lake's cuttable reeds, as things a boat must not be moored on top of. */
export function reedFootprints(): Footprint[] {
  return REED_PATCHES.map((spot) => roundFootprint(spot.x, spot.z, REED_CLEAR_RADIUS, 'reeds'));
}

/** A tree, rock or stump, which is always round. */
export function roundFootprint(x: number, z: number, radius: number, name: string): Footprint {
  return { x, z, radius, halfLength: 0, yaw: 0, kind: null, name };
}

/**
 * The two ends of a footprint's middle line - the same point twice for
 * anything round. A model's own length runs along its local X axis, which a
 * turn of `yaw` about the vertical carries to (cos yaw, -sin yaw).
 */
export function footprintEnds(footprint: Footprint): readonly [Point, Point] {
  const dx = Math.cos(footprint.yaw) * footprint.halfLength;
  const dz = -Math.sin(footprint.yaw) * footprint.halfLength;
  return [
    { x: footprint.x - dx, z: footprint.z - dz },
    { x: footprint.x + dx, z: footprint.z + dz },
  ];
}

/**
 * Whether a piece can go here, and if not, why - the first reason found, in
 * the order a player would most want to hear it.
 *
 * `reach` is measured from the player to the piece's middle: the client
 * passes `BUILD_REACH`, and the server a little more (see
 * `BUILD_REACH_SLACK`).
 */
export function checkBuildSpot(
  piece: Footprint,
  player: Readonly<Vec3>,
  reach: number,
  water: readonly WaterCircle[],
  others: readonly Footprint[],
  allowWilderness = false,
): BuildRefusal | null {
  if (Math.hypot(piece.x - player.x, piece.z - player.z) > reach) return { reason: 'tooFar' };
  // Nothing built stops anybody walking yet, but a cabin going up around
  // its own builder is still no way to build one.
  if (footprintGap(piece, roundFootprint(player.x, player.z, PLAYER_RADIUS, 'you')) < 0) {
    return { reason: 'onPlayer' };
  }

  // Building is a clearing thing, not a wilderness one - except a boat, which
  // goes wherever the lake is.
  const ends = footprintEnds(piece);
  const isBoat = piece.kind === 'rowboat';
  for (const end of ends) {
    if (allowWilderness || isBoat) {
      if (
        Math.abs(end.x) + piece.radius > PLAYABLE_HALF_EXTENT ||
        Math.abs(end.z) + piece.radius > PLAYABLE_HALF_EXTENT
      )
        return { reason: 'worldEdge' };
    } else if (Math.hypot(end.x, end.z) + piece.radius >= CLEARING_TREE_LINE_INNER) {
      return { reason: 'pastTreeLine' };
    }
  }

  if (isBoat) {
    const berth = boatBerthRefusal(piece, ends);
    if (berth !== null) return berth;
  } else {
    const waterReach = piece.radius + BUILD_SPACING;
    for (const point of pointsAlong(ends[0], ends[1])) {
      if (overlapsWater(water, point.x, point.z, waterReach)) return { reason: 'water' };
    }
  }

  let nearest: Footprint | null = null;
  let nearestGap = Number.POSITIVE_INFINITY;
  for (const other of others) {
    if (fitsBeside(piece, other)) continue;
    const gap = footprintGap(piece, other);
    if (gap < nearestGap) {
      nearest = other;
      nearestGap = gap;
    }
  }
  if (nearest !== null) return { reason: 'tooClose', what: nearest.name };

  return null;
}

/**
 * Whether a boat floats where it would go: every point of its hull, along its
 * middle line and round its edge, has water under it (see `BOAT_HULL_MIN_DEPTH`),
 * and its middle is near enough the bank to have been built from it.
 */
function boatBerthRefusal(piece: Footprint, ends: readonly [Point, Point]): BuildRefusal | null {
  for (const point of pointsAlong(ends[0], ends[1])) {
    if (lakeDepthAt(LAKE, point.x, point.z) < BOAT_HULL_MIN_DEPTH) return { reason: 'needsWater' };
    for (let side = 0; side < 8; side++) {
      const angle = (side * Math.PI) / 4;
      const x = point.x + Math.cos(angle) * piece.radius;
      const z = point.z + Math.sin(angle) * piece.radius;
      if (lakeDepthAt(LAKE, x, z) < BOAT_HULL_MIN_DEPTH) return { reason: 'needsWater' };
    }
  }
  if (lakeDepthAt(LAKE, piece.x, piece.z) > BOAT_BERTH_MAX_DEPTH) return { reason: 'tooFarOut' };
  return null;
}

/** How far apart two footprints are at their closest, edge to edge. Negative if they overlap. */
export function footprintGap(a: Footprint, b: Footprint): number {
  const [a0, a1] = footprintEnds(a);
  const [b0, b1] = footprintEnds(b);
  return segmentDistance(a0, a1, b0, b1) - a.radius - b.radius;
}

/**
 * Whether two pieces are far enough apart to stand side by side.
 *
 * Everything keeps `BUILD_SPACING` of breathing room, with two exceptions
 * that only make sense when placed tight: garden path stones may touch, as
 * long as they do not overlap, and two fence pieces may share an end - the
 * way a fence line joins up - as long as they do not fold back over each
 * other.
 */
function fitsBeside(piece: Footprint, other: Footprint): boolean {
  if (piece.kind === 'gardenPath' && other.kind === 'gardenPath') {
    return footprintGap(piece, other) >= 0;
  }
  if (piece.kind === 'fence' && other.kind === 'fence' && sharesAnEnd(piece, other)) {
    return fenceJoinIsClean(piece, other);
  }
  return footprintGap(piece, other) >= BUILD_SPACING;
}

/** Whether an end of one lands on an end of the other. */
function sharesAnEnd(a: Footprint, b: Footprint): boolean {
  for (const endA of footprintEnds(a)) {
    for (const endB of footprintEnds(b)) {
      if (Math.hypot(endA.x - endB.x, endA.z - endB.z) <= FENCE_JOIN_TOLERANCE) return true;
    }
  }
  return false;
}

/**
 * How much of each end is left out when checking a join, so that the shared
 * post does not count as the two pieces running into each other. Chosen so a
 * square corner is clean but a join sharper than about 60 degrees is not -
 * any sharper and the rails would cut through each other.
 */
const FENCE_JOIN_TRIM = 0.25;

/** Two fence pieces sharing an end, checked everywhere but right at that end. */
function fenceJoinIsClean(a: Footprint, b: Footprint): boolean {
  const trim = (footprint: Footprint): Footprint => ({
    ...footprint,
    halfLength: Math.max(0, footprint.halfLength - FENCE_JOIN_TRIM),
  });
  return footprintGap(trim(a), trim(b)) >= 0;
}

/** Points no more than a quarter metre apart from one end of a line to the other. */
function pointsAlong(from: Point, to: Point): Point[] {
  const length = Math.hypot(to.x - from.x, to.z - from.z);
  const steps = Math.max(1, Math.ceil(length / 0.25));
  const points: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    points.push({ x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t });
  }
  return points;
}

/** The closest two lines on the ground come to each other. */
function segmentDistance(a0: Point, a1: Point, b0: Point, b1: Point): number {
  if (segmentsCross(a0, a1, b0, b1)) return 0;
  return Math.min(
    pointToSegment(a0, b0, b1),
    pointToSegment(a1, b0, b1),
    pointToSegment(b0, a0, a1),
    pointToSegment(b1, a0, a1),
  );
}

function pointToSegment(point: Point, from: Point, to: Point): number {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const lengthSquared = dx * dx + dz * dz;
  const along =
    lengthSquared < 1e-12 ? 0 : ((point.x - from.x) * dx + (point.z - from.z) * dz) / lengthSquared;
  const t = Math.max(0, Math.min(1, along));
  return Math.hypot(point.x - (from.x + dx * t), point.z - (from.z + dz * t));
}

function segmentsCross(a0: Point, a1: Point, b0: Point, b1: Point): boolean {
  const side = (p: Point, q: Point, r: Point): number =>
    (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
  const d1 = side(b0, b1, a0);
  const d2 = side(b0, b1, a1);
  const d3 = side(a0, a1, b0);
  const d4 = side(a0, a1, b1);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** Where a fence piece goes when it snaps onto the end of one already standing. */
export interface FenceSnap {
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
}

/**
 * A fence piece joined onto whichever fence end is nearest the mouse, or null
 * if none is within `FENCE_SNAP_RADIUS`.
 *
 * The new piece starts at that end and runs towards the mouse, so laying a
 * fence line is a matter of pointing where it should go next. Its turn is
 * kept to steps of `step` from the piece it joins, so a straight run stays
 * straight and a corner comes out square. With the mouse right on top of the
 * end there is no direction to run in yet, so it carries straight on.
 */
export function snapFence(
  mouse: Readonly<Point>,
  fences: readonly Footprint[],
  step: number,
): FenceSnap | null {
  let best: { end: Point; outward: number } | null = null;
  let bestDistance = FENCE_SNAP_RADIUS;
  for (const fence of fences) {
    if (fence.kind !== 'fence') continue;
    for (const end of footprintEnds(fence)) {
      const distance = Math.hypot(mouse.x - end.x, mouse.z - end.z);
      if (distance > bestDistance) continue;
      bestDistance = distance;
      // Pointing out from the fence's middle through this end.
      best = { end, outward: Math.atan2(end.z - fence.z, end.x - fence.x) };
    }
  }
  if (best === null) return null;

  const toMouse = Math.atan2(mouse.z - best.end.z, mouse.x - best.end.x);
  const turn = bestDistance < 0.15 ? 0 : Math.round(wrap(toMouse - best.outward) / step) * step;
  const heading = best.outward + turn;

  const halfLength = BUILDABLE_KINDS.fence.footprintHalfLength;
  return {
    x: best.end.x + Math.cos(heading) * halfLength,
    z: best.end.z + Math.sin(heading) * halfLength,
    // Back from a heading on the ground to a model's turn: see `footprintEnds`.
    yaw: wrap(-heading),
  };
}

/** An angle brought into [-pi, pi]. */
function wrap(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

/** A built prop, as far as finding the nearest campfire to light or put out needs to know. */
export interface CampfireSpot {
  readonly id: number;
  readonly kind: BuildableKindId;
  readonly x: number;
  readonly z: number;
}

/**
 * The nearest campfire this player could light or put out, or null.
 *
 * Anyone can toggle any campfire - unlike a buried cache, nothing here is
 * owned - so there is no `isMine`-style filter to pass in.
 */
export function nearestCampfire<T extends CampfireSpot>(
  position: Readonly<Vec3>,
  builtProps: readonly T[],
): T | null {
  let best: T | null = null;
  let bestDistanceSquared = PICKUP_REACH * PICKUP_REACH;

  for (const prop of builtProps) {
    if (prop.kind !== 'campfire') continue;
    const dx = prop.x - position.x;
    const dz = prop.z - position.z;
    const distanceSquared = dx * dx + dz * dz;
    if (distanceSquared <= bestDistanceSquared) {
      best = prop;
      bestDistanceSquared = distanceSquared;
    }
  }

  return best;
}
