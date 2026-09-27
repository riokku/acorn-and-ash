import { describe, expect, it } from 'vitest';

import {
  BUILD_REACH,
  BUILD_ROTATION_STEP,
  BUILD_SPACING,
  CLEARING_TREE_LINE_INNER,
  FENCE_SNAP_RADIUS,
} from '../src/constants';
import { BUILDABLE_KINDS } from '../src/data/buildables';
import {
  buildableFootprint,
  checkBuildSpot,
  footprintEnds,
  footprintGap,
  roundFootprint,
  snapFence,
  type Footprint,
} from '../src/sim/building';
import type { WaterCircle } from '../src/world/water';

const PLAYER = { x: 0, y: 0, z: 0 };
const FENCE_HALF = BUILDABLE_KINDS.fence.footprintHalfLength;

/** A campfire, the plain round piece most of these use. */
function campfireAt(x: number, z: number): Footprint {
  return buildableFootprint('campfire', x, z, 0);
}

function fenceAt(x: number, z: number, yaw: number): Footprint {
  return buildableFootprint('fence', x, z, yaw);
}

describe('where a piece can go', () => {
  it('fits on open ground within reach', () => {
    expect(checkBuildSpot(campfireAt(0, -3), PLAYER, BUILD_REACH, [], [])).toBeNull();
  });

  it('is too far past the reach', () => {
    expect(
      checkBuildSpot(campfireAt(0, -(BUILD_REACH + 0.5)), PLAYER, BUILD_REACH, [], []),
    ).toEqual({ reason: 'tooFar' });
  });

  it('never goes up around the player building it', () => {
    expect(checkBuildSpot(campfireAt(0, -0.5), PLAYER, BUILD_REACH, [], [])).toEqual({
      reason: 'onPlayer',
    });
    expect(
      checkBuildSpot(buildableFootprint('cabin', 0, -3, 0), PLAYER, BUILD_REACH, [], []),
    ).toEqual({ reason: 'onPlayer' });
    // Stepped back far enough, the same cabin is fine.
    expect(
      checkBuildSpot(buildableFootprint('cabin', 0, -3.5, 0), PLAYER, BUILD_REACH, [], []),
    ).toBeNull();
  });

  it('stays inside the clearing', () => {
    const edge = { x: 0, y: 0, z: -(CLEARING_TREE_LINE_INNER - 2) };
    const piece = campfireAt(0, -(CLEARING_TREE_LINE_INNER - 0.2));
    expect(checkBuildSpot(piece, edge, BUILD_REACH, [], [])).toEqual({ reason: 'pastTreeLine' });
  });

  it('counts a fence as past the tree line if either end is', () => {
    // Its middle is well inside, but it runs out across the line.
    const edge = { x: 0, y: 0, z: -(CLEARING_TREE_LINE_INNER - 2) };
    const piece = fenceAt(0, -(CLEARING_TREE_LINE_INNER - 0.5), Math.PI / 2);
    expect(checkBuildSpot(piece, edge, BUILD_REACH, [], [])).toEqual({ reason: 'pastTreeLine' });
  });

  it('keeps out of the water, with room to spare', () => {
    const water: WaterCircle[] = [{ x: 0, z: -3, radius: 1 }];
    const onTheBank = campfireAt(0, -3 + 1 + BUILDABLE_KINDS.campfire.footprintRadius + 0.1);
    expect(checkBuildSpot(onTheBank, PLAYER, BUILD_REACH, water, [])).toEqual({ reason: 'water' });
    const backFromIt = campfireAt(
      0,
      -3 + 1 + BUILDABLE_KINDS.campfire.footprintRadius + BUILD_SPACING + 0.05,
    );
    expect(checkBuildSpot(backFromIt, PLAYER, BUILD_REACH, water, [])).toBeNull();
  });

  it('keeps a little room from a tree, and says which one is in the way', () => {
    const oak = roundFootprint(1, -3, 0.5, 'oak');
    const radius = BUILDABLE_KINDS.campfire.footprintRadius;
    const touching = campfireAt(1 - 0.5 - radius - 0.1, -3);
    expect(checkBuildSpot(touching, PLAYER, BUILD_REACH, [], [oak])).toEqual({
      reason: 'tooClose',
      what: 'oak',
    });
    const roomToBreathe = campfireAt(1 - 0.5 - radius - BUILD_SPACING - 0.05, -3);
    expect(checkBuildSpot(roomToBreathe, PLAYER, BUILD_REACH, [], [oak])).toBeNull();
  });

  it('names the nearest thing in the way when several are', () => {
    const near = roundFootprint(0, -3.2, 0.4, 'boulder');
    const further = roundFootprint(0.9, -3, 0.3, 'birch');
    expect(checkBuildSpot(campfireAt(0, -3), PLAYER, BUILD_REACH, [], [further, near])).toEqual({
      reason: 'tooClose',
      what: 'boulder',
    });
  });

  it('lets garden path stones sit right beside each other, but not on top', () => {
    const radius = BUILDABLE_KINDS.gardenPath.footprintRadius;
    const laid = buildableFootprint('gardenPath', 0, -3, 0);
    const beside = buildableFootprint('gardenPath', radius * 2 + 0.01, -3, 0);
    const onTop = buildableFootprint('gardenPath', radius, -3, 0);
    expect(checkBuildSpot(beside, PLAYER, BUILD_REACH, [], [laid])).toBeNull();
    expect(checkBuildSpot(onTop, PLAYER, BUILD_REACH, [], [laid])).toEqual({
      reason: 'tooClose',
      what: 'garden path',
    });
  });
});

describe('a fence footprint', () => {
  it('runs along its own length, turned with the piece', () => {
    const [left, right] = footprintEnds(fenceAt(0, 0, 0));
    expect(left.x).toBeCloseTo(-FENCE_HALF, 6);
    expect(right.x).toBeCloseTo(FENCE_HALF, 6);

    // A quarter turn the way a model turns: its length now runs along Z.
    const [a, b] = footprintEnds(fenceAt(0, 0, Math.PI / 2));
    expect(Math.abs(a.z)).toBeCloseTo(FENCE_HALF, 6);
    expect(Math.abs(b.z)).toBeCloseTo(FENCE_HALF, 6);
    expect(a.x).toBeCloseTo(0, 6);
  });

  it('is only as wide as a post, so something can stand just off its middle', () => {
    const fence = fenceAt(0, -3, 0);
    const radius = BUILDABLE_KINDS.campfire.footprintRadius;
    const beside = campfireAt(
      0,
      -3 + BUILDABLE_KINDS.fence.footprintRadius + radius + BUILD_SPACING + 0.05,
    );
    expect(footprintGap(fence, beside)).toBeGreaterThan(BUILD_SPACING);
    expect(checkBuildSpot(beside, PLAYER, BUILD_REACH, [], [fence])).toBeNull();
  });

  it('joins another fence end to end, in a straight line', () => {
    const first = fenceAt(0, -3, 0);
    const next = fenceAt(FENCE_HALF * 2, -3, 0);
    expect(checkBuildSpot(next, PLAYER, BUILD_REACH, [], [first])).toBeNull();
  });

  it('joins another fence at a square corner', () => {
    const first = fenceAt(0, -3, 0);
    // Starting at the first one's right-hand end and running away from the player.
    const corner = fenceAt(FENCE_HALF, -3 - FENCE_HALF, Math.PI / 2);
    expect(checkBuildSpot(corner, PLAYER, BUILD_REACH, [], [first])).toBeNull();
  });

  it('will not fold back sharply over the fence it joins', () => {
    const first = fenceAt(0, -3, 0);
    // Sharing the right-hand end, but doubling back at 30 degrees.
    const heading = Math.PI - Math.PI / 6;
    const end = { x: FENCE_HALF, z: -3 };
    const folded = fenceAt(
      end.x + Math.cos(heading) * FENCE_HALF,
      end.z + Math.sin(heading) * FENCE_HALF,
      -heading,
    );
    expect(checkBuildSpot(folded, PLAYER, BUILD_REACH, [], [first])).toEqual({
      reason: 'tooClose',
      what: 'fence',
    });
  });

  it('keeps the usual room from a fence it does not join', () => {
    const first = fenceAt(0, -3, 0);
    const parallel = fenceAt(0, -3 - 0.35, 0);
    expect(checkBuildSpot(parallel, PLAYER, BUILD_REACH, [], [first])).toEqual({
      reason: 'tooClose',
      what: 'fence',
    });
  });

  it('cannot cross another fence', () => {
    const first = fenceAt(0, -3, 0);
    const across = fenceAt(0, -3, Math.PI / 2);
    expect(checkBuildSpot(across, PLAYER, BUILD_REACH, [], [first])).not.toBeNull();
  });
});

describe('snapping a fence piece onto another', () => {
  const standing = fenceAt(0, -3, 0);

  it('does nothing with no fence end nearby', () => {
    expect(snapFence({ x: 5, z: -8 }, [standing], BUILD_ROTATION_STEP)).toBeNull();
    expect(
      snapFence(
        { x: FENCE_HALF + FENCE_SNAP_RADIUS + 0.1, z: -3 },
        [standing],
        BUILD_ROTATION_STEP,
      ),
    ).toBeNull();
  });

  it('carries straight on from the end nearest the mouse', () => {
    const snap = snapFence({ x: FENCE_HALF + 0.7, z: -3 }, [standing], BUILD_ROTATION_STEP);
    expect(snap).not.toBeNull();
    expect(snap?.x).toBeCloseTo(FENCE_HALF * 2, 6);
    expect(snap?.z).toBeCloseTo(-3, 6);
    const [start] = footprintEnds(fenceAt(snap?.x ?? 0, snap?.z ?? 0, snap?.yaw ?? 0));
    expect(Math.abs(start.x - FENCE_HALF) + Math.abs(start.z + 3)).toBeLessThan(1e-6);
  });

  it('turns a square corner towards the mouse', () => {
    const snap = snapFence({ x: FENCE_HALF + 0.05, z: -3 - 0.8 }, [standing], BUILD_ROTATION_STEP);
    expect(snap?.x).toBeCloseTo(FENCE_HALF, 6);
    expect(snap?.z).toBeCloseTo(-3 - FENCE_HALF, 6);
  });

  it('keeps its turn to whole steps from the piece it joins', () => {
    // Somewhere between straight on and a square corner.
    const snap = snapFence({ x: FENCE_HALF + 0.6, z: -3 - 0.37 }, [standing], BUILD_ROTATION_STEP);
    if (snap === null) throw new Error('expected a snap');
    const heading = Math.atan2(snap.z - -3, snap.x - FENCE_HALF);
    const steps = heading / BUILD_ROTATION_STEP;
    expect(Math.abs(steps - Math.round(steps))).toBeLessThan(1e-6);
  });

  it('comes out somewhere a fence can actually go', () => {
    const snap = snapFence({ x: FENCE_HALF + 0.7, z: -3.4 }, [standing], BUILD_ROTATION_STEP);
    if (snap === null) throw new Error('expected a snap');
    const piece = fenceAt(snap.x, snap.z, snap.yaw);
    expect(checkBuildSpot(piece, PLAYER, BUILD_REACH, [], [standing])).toBeNull();
  });

  it('ignores anything that is not a fence', () => {
    const campfire = campfireAt(0, -3);
    expect(snapFence({ x: 0.2, z: -3 }, [campfire], BUILD_ROTATION_STEP)).toBeNull();
  });
});
