import { describe, expect, it } from 'vitest';

import { PICKUP_REACH } from '../src/constants';
import { gatherSpotInReach } from '../src/sim/gathering';
import { FLOWER_PATCHES, STICK_PATCHES, type GatherSpot } from '../src/world/clearing';

const spotA: GatherSpot = { x: 4, z: 0, item: 'stick' };
const spotB: GatherSpot = { x: -4, z: 0, item: 'stick' };

describe('reaching for a gather spot', () => {
  it('finds nothing when there is nothing near', () => {
    expect(gatherSpotInReach({ x: 0, y: 0, z: 0 }, [spotA, spotB])).toBeNull();
  });

  it('finds what you are standing next to', () => {
    const found = gatherSpotInReach({ x: 4, y: 0, z: 0.5 }, [spotA, spotB]);
    expect(found).toEqual(spotA);
  });

  it('ignores height, so a hop does not put it out of reach', () => {
    const found = gatherSpotInReach({ x: 4, y: 1.2, z: 0 }, [spotA, spotB]);
    expect(found).toEqual(spotA);
  });

  it('reaches exactly as far as it says and no further', () => {
    const atOrigin: GatherSpot = { x: 0, z: 0, item: 'stick' };
    const inside = { x: PICKUP_REACH - 0.01, y: 0, z: 0 };
    const outside = { x: PICKUP_REACH + 0.01, y: 0, z: 0 };
    expect(gatherSpotInReach(inside, [atOrigin])).toEqual(atOrigin);
    expect(gatherSpotInReach(outside, [atOrigin])).toBeNull();
  });

  it('takes the nearer of two', () => {
    const near: GatherSpot = { x: 0.4, z: 0, item: 'stick' };
    const far: GatherSpot = { x: 1.6, z: 0, item: 'stick' };
    expect(gatherSpotInReach({ x: 0, y: 0, z: 0 }, [far, near])).toEqual(near);
  });

  it('is never used up: the same spot can be reached again and again', () => {
    // Unlike a pickup there is no "taken" set to consult.
    for (let i = 0; i < 5; i++) {
      expect(gatherSpotInReach({ x: 4, y: 0, z: 0 }, [spotA])).toEqual(spotA);
    }
  });
});

describe('the clearing patches', () => {
  it('places at least one within an easy walk of a couple of open spots', () => {
    expect(STICK_PATCHES.length).toBeGreaterThan(0);
    expect(FLOWER_PATCHES.length).toBeGreaterThan(0);
  });

  it('is in the same place for every seed, so it can always be found', () => {
    for (const spot of [...STICK_PATCHES, ...FLOWER_PATCHES]) {
      expect(Number.isFinite(spot.x)).toBe(true);
      expect(Number.isFinite(spot.z)).toBe(true);
    }
  });
});
