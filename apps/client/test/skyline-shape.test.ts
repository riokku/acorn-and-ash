import { describe, expect, it } from 'vitest';

import { DEFAULT_WORLD_SEED, PLAYABLE_HALF_EXTENT } from '@acorn/shared';

import {
  ASH_PEAK,
  RIDGE_LAYERS,
  SKYLINE_VIEW_DISTANCE,
  alpenglow,
  bearingTo,
  ridgeCrest,
  showingThrough,
  skylineClarity,
} from '../src/art/skyline-shape';

const CLEAR = { daylight: 1, cloud: 0, whiteout: 0, underground: 0 };

describe('the far ridges', () => {
  it('stand beyond where the ground ends, each further and taller than the last', () => {
    const groundEnds = PLAYABLE_HALF_EXTENT + 170;
    let previous = { radius: groundEnds, high: 0 };
    for (const layer of RIDGE_LAYERS) {
      expect(layer.radius).toBeGreaterThan(previous.radius);
      expect(layer.high).toBeGreaterThan(previous.high);
      previous = layer;
    }
  });

  it('are the same for everyone in a world, and different in another world', () => {
    const layer = RIDGE_LAYERS[2]!;
    expect(ridgeCrest(DEFAULT_WORLD_SEED, layer)).toEqual(ridgeCrest(DEFAULT_WORLD_SEED, layer));
    expect(ridgeCrest(DEFAULT_WORLD_SEED + 1, layer)).not.toEqual(
      ridgeCrest(DEFAULT_WORLD_SEED, layer),
    );
  });

  it('keep every crest above the ground and within its layer, tree tops included', () => {
    for (const layer of RIDGE_LAYERS) {
      const crest = ridgeCrest(DEFAULT_WORLD_SEED, layer);
      expect(crest).toHaveLength(layer.segments);
      for (const height of crest) {
        expect(height).toBeGreaterThan(10);
        expect(height).toBeLessThanOrEqual(layer.high + layer.treeTops);
      }
    }
  });

  it('close the ring without a step where the last slice meets the first', () => {
    // The far ridge has no ragged tree tops, so neighbours should be close all the way round.
    const layer = RIDGE_LAYERS[2]!;
    const crest = ridgeCrest(DEFAULT_WORLD_SEED, layer);
    let steepest = 0;
    for (let i = 1; i < crest.length; i++)
      steepest = Math.max(steepest, Math.abs(crest[i]! - crest[i - 1]!));
    expect(Math.abs(crest[0]! - crest[crest.length - 1]!)).toBeLessThanOrEqual(steepest + 1);
  });

  it('dip in front of Ash Peak so the mountain stands clear', () => {
    const layer = RIDGE_LAYERS[2]!;
    const crest = ridgeCrest(DEFAULT_WORLD_SEED, layer);
    const turn = (bearingTo(ASH_PEAK.x, ASH_PEAK.z) + Math.PI * 2) % (Math.PI * 2);
    const towardsPeak = crest[Math.round((turn / (Math.PI * 2)) * layer.segments)]!;
    expect(towardsPeak).toBeLessThan(layer.high * 0.45);
    expect(towardsPeak).toBeLessThan(ASH_PEAK.height * 0.3);
  });
});

describe('Ash Peak', () => {
  it('stands north-east, out across the lake, inside what the camera can see', () => {
    expect(ASH_PEAK.x).toBeGreaterThan(0);
    expect(ASH_PEAK.z).toBeLessThan(0);
    const furthestCorner = Math.hypot(PLAYABLE_HALF_EXTENT, PLAYABLE_HALF_EXTENT);
    const base = 9 * ASH_PEAK.scale;
    expect(Math.hypot(ASH_PEAK.x, ASH_PEAK.z) + base + furthestCorner).toBeLessThan(
      SKYLINE_VIEW_DISTANCE,
    );
  });
});

describe('how weather shows the skyline', () => {
  it('is fully clear on a fine day and gone in a blizzard or underground', () => {
    expect(skylineClarity(CLEAR)).toBe(1);
    expect(skylineClarity({ ...CLEAR, whiteout: 1 })).toBe(0);
    expect(skylineClarity({ ...CLEAR, underground: 1 })).toBe(0);
  });

  it('closes in with rain, but never quite to nothing', () => {
    const drizzle = skylineClarity({ ...CLEAR, cloud: 0.3 });
    const downpour = skylineClarity({ ...CLEAR, cloud: 1 });
    expect(drizzle).toBeLessThan(1);
    expect(downpour).toBeLessThan(drizzle);
    expect(downpour).toBeGreaterThan(0);
  });

  it('hides the furthest things first', () => {
    const clarity = skylineClarity({ ...CLEAR, cloud: 0.6 });
    expect(showingThrough(clarity, 1)).toBeLessThan(showingThrough(clarity, 0));
    expect(showingThrough(1, 1)).toBe(1);
    expect(showingThrough(0, 0)).toBe(0);
  });

  it('lights the high snow pink around sunset and sunrise, not at noon or midnight', () => {
    expect(alpenglow(0.36)).toBeCloseTo(1);
    expect(alpenglow(1)).toBeLessThan(0.01);
    expect(alpenglow(0)).toBeLessThan(0.05);
  });
});
