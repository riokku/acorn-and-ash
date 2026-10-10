/**
 * Where the broadleaf trees grow: red alders along the water, big-leaf maples
 * on the damp low ground a little further back.
 *
 * It never draws from the scatter's own random stream, so no conifer moves or
 * changes number. A spot that would have held a conifer simply swaps it for a
 * broadleaf tree when the water is close enough.
 */

import { hashSeed, createRng } from '../rng';
import type { PropKindId } from '../data/props';
import { basinDepthAt, type Lake } from './lake';
import { nearestOnStream, type Stream } from './stream';

/** Alders crowd the bank: this close to the water (metres) most conifers give way to them. */
const ALDER_REACH = 14;
const ALDER_SHARE = 0.75;
/** Maples fill the damp ground behind the alders, out to this far from the water. */
const MAPLE_REACH = 48;
const MAPLE_SHARE = 0.5;
/** Ground higher than this is too dry and exposed for either. */
const BROADLEAF_MAX_HEIGHT = 8;

/** Metres from the nearest water, or Infinity when none is within the maple reach. */
export function distanceToWater(lake: Lake, stream: Stream, x: number, z: number): number {
  const fromLake = -basinDepthAt(lake, x, z);
  const spot = nearestOnStream(stream, x, z, MAPLE_REACH);
  return Math.min(fromLake, spot?.distance ?? Infinity);
}

/** The kind a tree spot grows: the conifer it was given, or an alder or maple near water. */
export function broadleafOrConifer(
  seed: number,
  lake: Lake,
  stream: Stream,
  conifer: PropKindId,
  x: number,
  y: number,
  z: number,
): PropKindId {
  if (y > BROADLEAF_MAX_HEIGHT) return conifer;
  const water = distanceToWater(lake, stream, x, z);
  if (water > MAPLE_REACH) return conifer;
  const roll = createRng(
    hashSeed(seed, 'broadleaf', Math.round(x * 4), Math.round(z * 4)),
  ).nextFloat();
  if (water <= ALDER_REACH) return roll < ALDER_SHARE ? 'alder' : conifer;
  return roll < MAPLE_SHARE ? 'maple' : conifer;
}
