import {
  BUILDABLE_KINDS,
  BUILD_REACH,
  roundFootprint,
  type BuildRequest,
  type BuiltPropView,
} from '@acorn/shared';
import { describe, expect, it } from 'vitest';

import {
  describeRefusal,
  missingCosts,
  planPlacement,
  type PlacementInputs,
} from '../src/building/placement';

const FENCE_HALF = BUILDABLE_KINDS.fence.footprintHalfLength;

const BASE: PlacementInputs = {
  kind: 'campfire',
  yaw: 0.3,
  mouse: { x: 0, z: -3 },
  player: { x: 0, y: 0, z: 0 },
  snap: true,
  carrying: [{ item: 'log', count: 10 }],
  built: [],
  pending: [],
  scenery: [],
  water: [],
};

function built(prop: Partial<BuiltPropView> & Pick<BuiltPropView, 'kind'>): BuiltPropView {
  return { id: 1, x: 0, z: 0, yaw: 0, lit: false, yours: false, ...prop };
}

describe('where a piece being placed goes', () => {
  it('stands right under the mouse, turned the way the wheel left it', () => {
    const plan = planPlacement(BASE);
    expect(plan.spot).toEqual({ x: 0, z: -3, yaw: 0.3 });
    expect(plan.refusal).toBeNull();
  });

  it('is nowhere at all while the mouse points at the sky', () => {
    expect(planPlacement({ ...BASE, mouse: null }).spot).toBeNull();
  });

  it('stays at the edge of reach when the mouse points further away', () => {
    const plan = planPlacement({ ...BASE, mouse: { x: 0, z: -20 } });
    expect(plan.spot?.z).toBeCloseTo(-BUILD_REACH, 6);
    expect(plan.refusal).toBeNull();
  });

  it('snaps a fence onto the end of one already standing', () => {
    const plan = planPlacement({
      ...BASE,
      kind: 'fence',
      mouse: { x: FENCE_HALF + 0.7, z: -3 },
      built: [built({ kind: 'fence', x: 0, z: -3 })],
    });
    expect(plan.snapped).toBe(true);
    expect(plan.spot?.x).toBeCloseTo(FENCE_HALF * 2, 6);
    expect(plan.spot?.z).toBeCloseTo(-3, 6);
    expect(plan.refusal).toBeNull();
  });

  it('snaps onto a fence placed a moment ago, before the server has said so', () => {
    const pending: BuildRequest[] = [{ kind: 'fence', x: 0, z: -3, yaw: 0 }];
    const plan = planPlacement({
      ...BASE,
      kind: 'fence',
      mouse: { x: FENCE_HALF + 0.7, z: -3 },
      pending,
    });
    expect(plan.snapped).toBe(true);
  });

  it('places a fence freely with Shift held, however close another end is', () => {
    const plan = planPlacement({
      ...BASE,
      kind: 'fence',
      mouse: { x: FENCE_HALF + 0.7, z: -3 },
      snap: false,
      built: [built({ kind: 'fence', x: 0, z: -3 })],
    });
    expect(plan.snapped).toBe(false);
    expect(plan.spot).toEqual({ x: FENCE_HALF + 0.7, z: -3, yaw: 0.3 });
  });
});

describe('why a piece will not go where it is pointed', () => {
  it('says what is still needed to pay for it', () => {
    const plan = planPlacement({ ...BASE, carrying: [{ item: 'log', count: 1 }] });
    expect(plan.refusal).toBe('Need 3 more logs');
    expect(plan.affordable).toBe(false);
    expect(planPlacement(BASE).affordable).toBe(true);
  });

  it('says so when a one-per-player piece of this kind is already yours', () => {
    const plan = planPlacement({
      ...BASE,
      kind: 'cabin',
      mouse: { x: 0, z: -4 },
      built: [built({ kind: 'cabin', x: 20, z: 20, yours: true })],
    });
    expect(plan.refusal).toBe('Upgrade your home one tier at a time');
  });

  it("does not count somebody else's cabin as yours", () => {
    const plan = planPlacement({
      ...BASE,
      kind: 'tent',
      carrying: [{ item: 'stick', count: 6 }],
      mouse: { x: 0, z: -4 },
      built: [built({ kind: 'cabin', x: 20, z: 20, yours: false })],
    });
    expect(plan.refusal).toBeNull();
  });

  it('names whatever is in the way', () => {
    const plan = planPlacement({ ...BASE, scenery: [roundFootprint(0.5, -3, 0.5, 'oak')] });
    expect(plan.refusal).toBe('Too close to the oak');
  });

  it('turns red on a spot just placed, before the server has said so', () => {
    const pending: BuildRequest[] = [{ kind: 'campfire', x: 0, z: -3, yaw: 0.3 }];
    expect(planPlacement({ ...BASE, pending }).refusal).toBe('Too close to the campfire');
  });

  it('keeps out of the water', () => {
    const plan = planPlacement({ ...BASE, water: [{ x: 0, z: -4, radius: 1 }] });
    expect(plan.refusal).toBe('Too close to the water');
  });
});

describe('what is still needed', () => {
  it('is nothing when there is enough of everything', () => {
    expect(missingCosts('fence', [{ item: 'log', count: 2 }])).toBeNull();
  });

  it('counts one of something in the singular', () => {
    expect(missingCosts('fence', [{ item: 'log', count: 1 }])).toBe('1 more log');
  });
});

describe('describing a refusal', () => {
  it('reads like something a player would say', () => {
    expect(describeRefusal({ reason: 'pastTreeLine' })).toBe('Only inside the clearing');
    expect(describeRefusal({ reason: 'tooFar' })).toBe('Too far away');
  });
});
