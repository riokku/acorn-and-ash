import { describe, expect, it } from 'vitest';

import {
  REGROWN_SCALE_MAX,
  REGROWN_SCALE_MIN,
  REGROW_CLEARANCE,
  REGROW_MAX_SECONDS,
  REGROW_MIN_SECONDS,
} from '../src/constants';
import {
  regrowDelayMs,
  regrowDueAtMs,
  regrownScale,
  spotIsClear,
  treeAtGeneration,
} from '../src/sim/regrowth';
import type { PlacedProp } from '../src/world/clearing';

const SEED = 0x4143_4f52;
const oak: PlacedProp = { id: 12, kind: 'oak', x: 3, z: -4, rotationY: 0.5, scale: 1.25 };

describe('how long a tree takes to come back', () => {
  it('is never less than the half hour Chris asked for', () => {
    for (let treeId = 1; treeId <= 200; treeId++) {
      const delay = regrowDelayMs(SEED, treeId, 0);
      expect(delay).toBeGreaterThanOrEqual(REGROW_MIN_SECONDS * 1000);
      expect(delay).toBeLessThanOrEqual(REGROW_MAX_SECONDS * 1000);
    }
  });

  it('is the same answer every time, so the server and the browser agree', () => {
    expect(regrowDelayMs(SEED, 12, 3)).toBe(regrowDelayMs(SEED, 12, 3));
  });

  it('differs between trees, so a chopped clearing does not come back all at once', () => {
    const delays = new Set(
      Array.from({ length: 40 }, (_, i) => Math.round(regrowDelayMs(SEED, i + 1, 0))),
    );
    expect(delays.size).toBeGreaterThan(30);
  });

  it('differs each time the same spot is chopped', () => {
    const first = regrowDelayMs(SEED, 12, 0);
    const second = regrowDelayMs(SEED, 12, 1);
    expect(first).not.toBe(second);
  });

  it('differs between worlds', () => {
    expect(regrowDelayMs(SEED, 12, 0)).not.toBe(regrowDelayMs(SEED + 1, 12, 0));
  });

  it('counts from when the tree fell', () => {
    const felledAt = 1_700_000_000_000;
    const due = regrowDueAtMs(SEED, 12, 0, felledAt);
    expect(due - felledAt).toBe(regrowDelayMs(SEED, 12, 0));
    expect(due).toBeGreaterThan(felledAt + REGROW_MIN_SECONDS * 1000 - 1);
  });
});

describe('how big it is when it comes back', () => {
  it('leaves the tree the clearing built alone', () => {
    expect(regrownScale(SEED, oak.id, 0, oak.scale)).toBe(oak.scale);
    expect(treeAtGeneration(SEED, oak, 0)).toBe(oak);
  });

  it('comes back somewhere in the range we allow', () => {
    for (let generation = 1; generation <= 50; generation++) {
      const scale = regrownScale(SEED, oak.id, generation, oak.scale);
      expect(scale).toBeGreaterThanOrEqual(REGROWN_SCALE_MIN);
      expect(scale).toBeLessThanOrEqual(REGROWN_SCALE_MAX);
    }
  });

  it('is the same answer every time', () => {
    expect(regrownScale(SEED, 12, 2, 1)).toBe(regrownScale(SEED, 12, 2, 1));
  });

  it('is a different tree each time the spot grows back', () => {
    const sizes = new Set(
      Array.from({ length: 20 }, (_, i) => regrownScale(SEED, 12, i + 1, 1).toFixed(6)),
    );
    expect(sizes.size).toBeGreaterThan(15);
  });

  it('keeps everything about the tree except its size', () => {
    const grown = treeAtGeneration(SEED, oak, 1);
    expect(grown.id).toBe(oak.id);
    expect(grown.kind).toBe(oak.kind);
    expect(grown.x).toBe(oak.x);
    expect(grown.z).toBe(oak.z);
    expect(grown.rotationY).toBe(oak.rotationY);
    expect(grown.scale).not.toBe(oak.scale);
  });

  it('does not make the size track the waiting time', () => {
    // Both come from the same seed, so a tree that waited longest must not
    // always be the biggest. Compare the orderings across many trees.
    const rows = Array.from({ length: 60 }, (_, i) => ({
      delay: regrowDelayMs(SEED, i + 1, 1),
      scale: regrownScale(SEED, i + 1, 1, 1),
    }));
    const byDelay = [...rows].sort((a, b) => a.delay - b.delay).map((row) => row.scale);
    const sortedScales = [...byDelay].sort((a, b) => a - b);
    expect(byDelay).not.toEqual(sortedScales);
  });
});

describe('making room before it grows', () => {
  const footprint = 0.9;

  it('is clear when nobody is about', () => {
    expect(spotIsClear(0, 0, footprint, [])).toBe(true);
  });

  it('is clear when everybody is well away', () => {
    const players = [{ x: 20, y: 0, z: 0 }];
    expect(spotIsClear(0, 0, footprint, players)).toBe(true);
  });

  it('is not clear with somebody standing on the spot', () => {
    expect(spotIsClear(0, 0, footprint, [{ x: 0, y: 0, z: 0 }])).toBe(false);
  });

  it('keeps a margin beyond the trunk itself', () => {
    const justOutsideTheTrunk = { x: footprint + 0.1, y: 0, z: 0 };
    const wellClear = { x: footprint + REGROW_CLEARANCE + 0.1, y: 0, z: 0 };
    expect(spotIsClear(0, 0, footprint, [justOutsideTheTrunk])).toBe(false);
    expect(spotIsClear(0, 0, footprint, [wellClear])).toBe(true);
  });

  it('ignores how high up they are: a hop is not an escape', () => {
    expect(spotIsClear(0, 0, footprint, [{ x: 0, y: 6, z: 0 }])).toBe(false);
  });

  it('is blocked by any one of several players', () => {
    const players = [
      { x: 30, y: 0, z: 0 },
      { x: 0.2, y: 0, z: 0.2 },
    ];
    expect(spotIsClear(0, 0, footprint, players)).toBe(false);
  });
});
