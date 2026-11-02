import { PLAYABLE_HALF_EXTENT, WILDERNESS } from '../constants';
import { PROP_KINDS } from '../data/props';
import { WOODLAND_ENCOUNTERS } from '../data/tracking';
import { createRng, hashSeed } from '../rng';
import { forestTrailAt } from './forest-relief';
import { PLAINS_DENS, plainsPassAt } from './high-plains';
import { inKingsHold } from './hollow-king';
import { blocksKingsRoad } from './kings-road';
import { basinDepthAt, LAKE, LAKE_PROP_CLEARANCE, type Lake } from './lake';
import { inSkeletonTown } from './skeleton-town';
import { nearStream, STREAM, STREAM_PROP_CLEARANCE, type Stream } from './stream';
import { nearSurveySite } from './sunreach-survey';
import type { Terrain } from './terrain';
import type { Wilderness } from './wilderness';

/**
 * Dead wood lying about the forest: standing dead trees, fallen logs and the
 * roots of trees long gone.
 *
 * Scenery only. The player walks through it and the server never hears of it.
 * It is still built from the seed in shared code, the way the wilderness is,
 * so every player sees the same pieces in the same places.
 */
export type DeadwoodKind = 'deadTree' | 'fallenLog' | 'treeRoots';

export interface DeadwoodPiece {
  readonly kind: DeadwoodKind;
  readonly x: number;
  readonly z: number;
  /** Ground height under the piece's middle. */
  readonly y: number;
  readonly rotationY: number;
  readonly scale: number;
}

/** A place dead wood keeps away from, such as a discovery site. */
export interface DeadwoodKeepClear {
  readonly x: number;
  readonly z: number;
  readonly radius: number;
}

/** One candidate spot in each square this wide. */
const CELL = 12;
/** The share of squares that get a piece, before the spot is checked. */
const CHANCE = 0.14;
/** How far the jitter can move a candidate from its square's middle. */
const JITTER = 4.5;
/** Dead wood lies in the woods: a living tree must stand this close. */
const NEAR_FOREST = 7;
/** How far each piece reaches from its middle, at its own size, in metres. */
const REACH: Record<DeadwoodKind, number> = { deadTree: 1, fallenLog: 1.6, treeRoots: 1.3 };
/** A log is long and flat, so it needs gentler ground than the others. */
const MAX_SLOPE: Record<DeadwoodKind, number> = {
  deadTree: 0.45,
  fallenLog: 0.22,
  treeRoots: 0.35,
};
const SLOPE_PROBE = 1.5;
/** Kept out of the clearing and the first stretch of trees past it. */
const CLEARING_MARGIN = 6;
const KINDS: readonly DeadwoodKind[] = ['deadTree', 'fallenLog', 'fallenLog', 'treeRoots'];

/** Scatters dead wood through the wilderness's woods, clear of every trunk, rock, path and site. */
export function buildDeadwood(
  seed: number,
  terrain: Terrain,
  wilderness: Wilderness,
  keepClear: readonly DeadwoodKeepClear[] = [],
  lake: Lake = LAKE,
  stream: Stream = STREAM,
): DeadwoodPiece[] {
  const trunks = new SpotGrid(wilderness);
  const steps = Math.floor(PLAYABLE_HALF_EXTENT / CELL);
  const pieces: DeadwoodPiece[] = [];
  for (let ix = -steps; ix <= steps; ix++) {
    for (let iz = -steps; iz <= steps; iz++) {
      const rng = createRng(hashSeed(seed, 'deadwood', ix, iz));
      if (rng.nextFloat() > CHANCE) continue;
      const x = ix * CELL + rng.nextRange(-JITTER, JITTER);
      const z = iz * CELL + rng.nextRange(-JITTER, JITTER);
      const kind = rng.pick(KINDS);
      const scale = rng.nextRange(0.8, 1.15);
      const rotationY = rng.nextRange(0, Math.PI * 2);
      const reach = REACH[kind] * scale;
      if (Math.hypot(x, z) < WILDERNESS.flatRadius + CLEARING_MARGIN) continue;
      if (Math.max(Math.abs(x), Math.abs(z)) > PLAYABLE_HALF_EXTENT - reach) continue;
      if (!trunks.treeWithin(x, z, NEAR_FOREST) || trunks.blocked(x, z, reach)) continue;
      if (steepness(terrain, x, z) > MAX_SLOPE[kind]) continue;
      if (!openGround(x, z, reach, lake, stream, keepClear)) continue;
      pieces.push({ kind, x, z, y: terrain.heightAt(x, z), rotationY, scale });
    }
  }
  return pieces;
}

/** Everything the wilderness keeps its own trees and rocks off, for a piece of this reach. */
function openGround(
  x: number,
  z: number,
  reach: number,
  lake: Lake,
  stream: Stream,
  keepClear: readonly DeadwoodKeepClear[],
): boolean {
  const trail = forestTrailAt(x, z);
  return (
    basinDepthAt(lake, x, z) <= -(LAKE_PROP_CLEARANCE + reach) &&
    !nearStream(stream, x, z, STREAM_PROP_CLEARANCE + reach) &&
    !(trail !== null && trail.distance < trail.halfWidth + reach + 0.7) &&
    !blocksKingsRoad(x, z, reach) &&
    !inKingsHold(x, z, 4 + reach) &&
    !nearSurveySite(x, z, reach + 1) &&
    !inSkeletonTown(x, z, 2 + reach) &&
    !PLAINS_DENS.some((den) => Math.hypot(x - den.x, z - den.z) < 7 + reach) &&
    plainsPassAt(x, z).distance > 3.5 + reach &&
    !WOODLAND_ENCOUNTERS.some((site) => Math.hypot(x - site.x, z - site.z) < site.radius + reach) &&
    !keepClear.some((site) => Math.hypot(x - site.x, z - site.z) < site.radius + reach)
  );
}

/** The steepest rise over run in any direction a few metres either side of a spot. */
function steepness(terrain: Terrain, x: number, z: number): number {
  const here = terrain.heightAt(x, z);
  return Math.max(
    ...[
      terrain.heightAt(x + SLOPE_PROBE, z),
      terrain.heightAt(x - SLOPE_PROBE, z),
      terrain.heightAt(x, z + SLOPE_PROBE),
      terrain.heightAt(x, z - SLOPE_PROBE),
    ].map((height) => Math.abs(height - here) / SLOPE_PROBE),
  );
}

/** The wilderness's trunks and rocks, bucketed so a spot only checks its neighbours. */
class SpotGrid {
  private static readonly SIZE = 8;
  private readonly cells = new Map<
    string,
    { x: number; z: number; radius: number; tree: boolean }[]
  >();

  constructor(wilderness: Wilderness) {
    for (const prop of wilderness.props) {
      const kind = PROP_KINDS[prop.kind];
      const key = this.key(Math.floor(prop.x / SpotGrid.SIZE), Math.floor(prop.z / SpotGrid.SIZE));
      const list = this.cells.get(key) ?? [];
      list.push({
        x: prop.x,
        z: prop.z,
        radius: kind.colliderRadius * prop.scale,
        tree: kind.shape.family === 'tree',
      });
      this.cells.set(key, list);
    }
  }

  /** True when a trunk or rock is closer than `reach` plus its own width, with a little room to spare. */
  blocked(x: number, z: number, reach: number): boolean {
    return this.near(
      x,
      z,
      reach + 2,
      (spot) => Math.hypot(x - spot.x, z - spot.z) < reach + spot.radius + 0.4,
    );
  }

  treeWithin(x: number, z: number, distance: number): boolean {
    return this.near(
      x,
      z,
      distance,
      (spot) => spot.tree && Math.hypot(x - spot.x, z - spot.z) < distance,
    );
  }

  private near(
    x: number,
    z: number,
    distance: number,
    test: (spot: { x: number; z: number; radius: number; tree: boolean }) => boolean,
  ): boolean {
    const span = Math.ceil(distance / SpotGrid.SIZE);
    const cx = Math.floor(x / SpotGrid.SIZE);
    const cz = Math.floor(z / SpotGrid.SIZE);
    for (let dx = -span; dx <= span; dx++)
      for (let dz = -span; dz <= span; dz++)
        if (this.cells.get(this.key(cx + dx, cz + dz))?.some(test)) return true;
    return false;
  }

  private key(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }
}
