import { describe, expect, it } from 'vitest';

import { BUILD_DISTANCE, CLEARING_TREE_LINE_INNER } from '../src/constants';
import { buildSpotFor, type BuildBlocker } from '../src/sim/building';
import type { WaterCircle } from '../src/world/water';

/** Yaw zero looks down -Z, so this faces straight out from the origin. */
const NORTH = 0;
const FOOTPRINT = 0.6;

describe('where a build in front of you would land', () => {
  it('lands the fixed build distance straight ahead', () => {
    const spot = buildSpotFor({ x: 0, y: 0, z: 0 }, NORTH, FOOTPRINT, [], []);
    expect(spot).toEqual({ x: 0, z: -BUILD_DISTANCE });
  });

  it('turns with whichever way you are facing', () => {
    const spot = buildSpotFor({ x: 0, y: 0, z: 0 }, Math.PI / 2, FOOTPRINT, [], []);
    expect(spot?.x).toBeCloseTo(-BUILD_DISTANCE, 5);
    expect(spot?.z).toBeCloseTo(0, 5);
  });

  it('refuses a spot past the tree line', () => {
    // Standing right at the tree line, facing further out: the spot in front
    // lands past it, and building is a clearing thing, not a wilderness one.
    const position = { x: 0, y: 0, z: -(CLEARING_TREE_LINE_INNER - 1) };
    expect(buildSpotFor(position, NORTH, FOOTPRINT, [], [])).toBeNull();
  });

  it('allows a spot well inside the tree line', () => {
    const position = { x: 0, y: 0, z: -(CLEARING_TREE_LINE_INNER - 10) };
    expect(buildSpotFor(position, NORTH, FOOTPRINT, [], [])).not.toBeNull();
  });

  it('refuses a spot on the water', () => {
    const water: WaterCircle[] = [{ x: 0, z: -BUILD_DISTANCE, radius: 3 }];
    expect(buildSpotFor({ x: 0, y: 0, z: 0 }, NORTH, FOOTPRINT, water, [])).toBeNull();
  });

  it('allows a spot on the bank, clear of the water', () => {
    const water: WaterCircle[] = [{ x: 0, z: -20, radius: 3 }];
    expect(buildSpotFor({ x: 0, y: 0, z: 0 }, NORTH, FOOTPRINT, water, [])).not.toBeNull();
  });

  it('refuses a spot already sat on top of something', () => {
    const blockers: BuildBlocker[] = [{ x: 0, z: -BUILD_DISTANCE, footprintRadius: 1 }];
    expect(buildSpotFor({ x: 0, y: 0, z: 0 }, NORTH, FOOTPRINT, [], blockers)).toBeNull();
  });

  it('allows a spot just clear of something else nearby', () => {
    // A tree well off to the side of where this one would land.
    const blockers: BuildBlocker[] = [{ x: 4, z: -BUILD_DISTANCE, footprintRadius: 1 }];
    expect(buildSpotFor({ x: 0, y: 0, z: 0 }, NORTH, FOOTPRINT, [], blockers)).not.toBeNull();
  });

  it('measures the gap between footprints, not just their centres', () => {
    // Centres 1 m apart: two footprints of 0.6 need 1.2 m to clear each
    // other, so this is blocked...
    const tooClose: BuildBlocker[] = [{ x: 1, z: -BUILD_DISTANCE, footprintRadius: FOOTPRINT }];
    expect(buildSpotFor({ x: 0, y: 0, z: 0 }, NORTH, FOOTPRINT, [], tooClose)).toBeNull();

    // ...and this, a little further off, is not.
    const clear: BuildBlocker[] = [{ x: 2, z: -BUILD_DISTANCE, footprintRadius: FOOTPRINT }];
    expect(buildSpotFor({ x: 0, y: 0, z: 0 }, NORTH, FOOTPRINT, [], clear)).not.toBeNull();
  });
});
