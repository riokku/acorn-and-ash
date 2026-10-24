import { createRng, hashSeed } from '../rng';
import { towardDirection, type Point2D, type Direction2D } from './animals';

export interface ShelterRock extends Point2D {
  readonly radius: number;
}
/** Shelter is a clear spot beside existing rock, never a point inside its footprint. */
export function wildlifeCover(
  den: Point2D,
  rocks: readonly ShelterRock[],
  clear: (x: number, z: number) => boolean,
): Point2D | null {
  const nearby = rocks
    .filter((rock) => Math.hypot(rock.x - den.x, rock.z - den.z) < 13)
    .sort((a, b) => Math.hypot(a.x - den.x, a.z - den.z) - Math.hypot(b.x - den.x, b.z - den.z));
  for (const rock of nearby) {
    const angle = Math.atan2(den.z - rock.z, den.x - rock.x);
    for (const turn of [0, -0.55, 0.55, -1.1, 1.1]) {
      const x = rock.x + Math.cos(angle + turn) * (rock.radius + 0.75);
      const z = rock.z + Math.sin(angle + turn) * (rock.radius + 0.75);
      if (clear(x, z)) return { x, z };
    }
  }
  return null;
}
export function wildlifePauseMs(
  seed: number,
  id: number,
  decision: number,
  range: readonly [number, number],
): number {
  return (
    createRng(hashSeed(seed, 'wildlife-pause', id, decision)).nextRange(range[0], range[1]) * 1000
  );
}
/** Cover is useful only when it is in the escape direction; never turn back into danger. */
export function fleePastCover(
  position: Point2D,
  away: Direction2D,
  cover: Point2D | null,
): Direction2D {
  if (cover === null || Math.hypot(position.x - cover.x, position.z - cover.z) > 13) return away;
  const toward = towardDirection(position.x, position.z, cover.x, cover.z);
  if (toward.x * away.x + toward.z * away.z < 0.35) return away;
  const x = away.x * 0.7 + toward.x * 0.3,
    z = away.z * 0.7 + toward.z * 0.3;
  const length = Math.hypot(x, z);
  return { x: x / length, z: z / length };
}
