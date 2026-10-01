import { describe, expect, it } from 'vitest';

import {
  GATHER_PATCH_MAX_COUNT,
  GATHER_PATCH_MIN_COUNT,
  PATCH_REGROW_MIN_SECONDS,
  PATCH_REGROW_RADIUS,
  PICKUP_REACH,
} from '../src/constants';
import {
  freshPatch,
  gatherSpotInReach,
  patchCount,
  patchIsDue,
  patchRegrowDelayMs,
  patchRegrowSpot,
  type GatherPatch,
} from '../src/sim/gathering';
import { FLOWER_PATCHES, STICK_PATCHES } from '../src/world/clearing';

function patch(x: number, z: number, remaining = 3): GatherPatch {
  return { id: 1, item: 'stick', x, z, remaining, generation: 0, emptiedAtMs: 0 };
}

const spotA = patch(4, 0);
const spotB = patch(-4, 0);

describe('reaching for a patch', () => {
  it('finds nothing when there is nothing near', () => {
    expect(gatherSpotInReach({ x: 0, y: 0, z: 0 }, [spotA, spotB])).toBeNull();
  });

  it('finds what you are standing next to', () => {
    const found = gatherSpotInReach({ x: 4, y: 0, z: 0.5 }, [spotA, spotB]);
    expect(found).toBe(spotA);
  });

  it('ignores height, so a hop does not put it out of reach', () => {
    const found = gatherSpotInReach({ x: 4, y: 1.2, z: 0 }, [spotA, spotB]);
    expect(found).toBe(spotA);
  });

  it('reaches exactly as far as it says and no further', () => {
    const atOrigin = patch(0, 0);
    const inside = { x: PICKUP_REACH - 0.01, y: 0, z: 0 };
    const outside = { x: PICKUP_REACH + 0.01, y: 0, z: 0 };
    expect(gatherSpotInReach(inside, [atOrigin])).toBe(atOrigin);
    expect(gatherSpotInReach(outside, [atOrigin])).toBeNull();
  });

  it('takes the nearer of two', () => {
    const near = patch(0.4, 0);
    const far = patch(1.6, 0);
    expect(gatherSpotInReach({ x: 0, y: 0, z: 0 }, [far, near])).toBe(near);
  });

  it('passes over a patch that has been picked clean', () => {
    const empty = patch(0.4, 0, 0);
    const full = patch(1.6, 0);
    expect(gatherSpotInReach({ x: 0, y: 0, z: 0 }, [empty])).toBeNull();
    expect(gatherSpotInReach({ x: 0, y: 0, z: 0 }, [empty, full])).toBe(full);
  });
});

describe('how much a patch holds', () => {
  it('is always somewhere from the least to the most, both included', () => {
    const seen = new Set<number>();
    for (let generation = 0; generation < 400; generation++) {
      const count = patchCount(1234, 1, generation);
      expect(Number.isInteger(count)).toBe(true);
      expect(count).toBeGreaterThanOrEqual(GATHER_PATCH_MIN_COUNT);
      expect(count).toBeLessThanOrEqual(GATHER_PATCH_MAX_COUNT);
      seen.add(count);
    }
    // Every count in the range actually turns up, not just one or two of them.
    expect(seen.size).toBe(GATHER_PATCH_MAX_COUNT - GATHER_PATCH_MIN_COUNT + 1);
  });

  it('is the same every time for the same world, patch and generation', () => {
    expect(patchCount(99, 3, 7)).toBe(patchCount(99, 3, 7));
  });

  it('starts every patch off with its generation-zero count', () => {
    const spot = { id: 2, x: 1, z: 2, item: 'flower' as const };
    expect(freshPatch(55, spot)).toEqual({
      id: 2,
      item: 'flower',
      x: 1,
      z: 2,
      remaining: patchCount(55, 2, 0),
      generation: 0,
      emptiedAtMs: 0,
    });
  });
});

describe('a patch growing back', () => {
  it('takes between the shortest wait and twice it, in whole milliseconds', () => {
    for (let generation = 0; generation < 50; generation++) {
      const delay = patchRegrowDelayMs(1234, 1, generation);
      expect(Number.isInteger(delay)).toBe(true);
      expect(delay).toBeGreaterThanOrEqual(PATCH_REGROW_MIN_SECONDS * 1000);
      expect(delay).toBeLessThanOrEqual(PATCH_REGROW_MIN_SECONDS * 2000);
    }
  });

  it('is only ever due once it is picked clean and its wait is over', () => {
    const empty: GatherPatch = { ...patch(0, 0, 0), emptiedAtMs: 1_000_000 };
    const delay = patchRegrowDelayMs(7, empty.id, empty.generation);
    expect(patchIsDue(7, empty, 1_000_000 + delay - 1)).toBe(false);
    expect(patchIsDue(7, empty, 1_000_000 + delay)).toBe(true);
    expect(patchIsDue(7, { ...empty, remaining: 1 }, Number.MAX_SAFE_INTEGER)).toBe(false);
  });

  it('honours a shorter wait for previews', () => {
    const empty: GatherPatch = { ...patch(0, 0, 0), emptiedAtMs: 0 };
    expect(patchIsDue(7, empty, 20_000, 10)).toBe(true);
    expect(patchIsDue(7, empty, 20_000)).toBe(false);
  });

  it('lands somewhere in the open middle of the clearing', () => {
    for (let generation = 1; generation < 100; generation++) {
      const spot = patchRegrowSpot(1234, 1, generation, () => true);
      if (spot === null) throw new Error('every spot was clear, so one should have been taken');
      expect(Math.hypot(spot.x, spot.z)).toBeLessThanOrEqual(PATCH_REGROW_RADIUS);
    }
  });

  it('moves: two generations of the same patch grow in different places', () => {
    const first = patchRegrowSpot(1234, 1, 1, () => true);
    const second = patchRegrowSpot(1234, 1, 2, () => true);
    expect(first).not.toEqual(second);
  });

  it('skips any spot it is told is not clear', () => {
    const eastOnly = patchRegrowSpot(1234, 1, 1, (x) => x > 0);
    expect(eastOnly?.x).toBeGreaterThan(0);
  });

  it('gives up rather than looping forever when nowhere is clear', () => {
    expect(patchRegrowSpot(1234, 1, 1, () => false)).toBeNull();
  });
});

describe('the clearing patches', () => {
  it('places at least one of each to start with', () => {
    expect(STICK_PATCHES.length).toBeGreaterThan(0);
    expect(FLOWER_PATCHES.length).toBeGreaterThan(0);
  });

  it('starts in the same place for every seed, so it can always be found', () => {
    for (const spot of [...STICK_PATCHES, ...FLOWER_PATCHES]) {
      expect(Number.isFinite(spot.x)).toBe(true);
      expect(Number.isFinite(spot.z)).toBe(true);
    }
  });
});
