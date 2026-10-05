import {
  BUILDABLE_KINDS,
  BUILD_REACH,
  LAKE,
  REED_PATCHES,
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

describe('moored boats', () => {
  // A boat on the water beside the first clump of reeds, lying along the bank,
  // and a place on the bank to have built it from.
  const spot = REED_PATCHES[0]!;
  const circle = LAKE.basin.reduce((best, c) => {
    const gap = (c: { x: number; z: number; radius: number }) =>
      Math.abs(Math.hypot(spot.x - c.x, spot.z - c.z) - c.radius);
    return gap(c) < gap(best) ? c : best;
  });
  const away = Math.hypot(circle.x - spot.x, circle.z - spot.z);
  const inward = { x: (circle.x - spot.x) / away, z: (circle.z - spot.z) / away };
  const onWater = { x: spot.x + inward.x * 2.05, z: spot.z + inward.z * 2.05 };
  const yaw = Math.atan2(-inward.x, -inward.z);
  const bank = { x: onWater.x - inward.x * 2.9, y: 0, z: onWater.z - inward.z * 2.9 };
  const BOAT: PlacementInputs = {
    ...BASE,
    kind: 'rowboat',
    // Outside any home area, the way the real game asks.
    enforceHomeArea: true,
    yaw,
    mouse: onWater,
    player: bank,
    carrying: [
      { item: 'log', count: 6 },
      { item: 'rope', count: 2 },
    ],
    water: [...LAKE.basin],
  };

  it('goes on the water beside the bank, with no home and no clear ground to ask for', () => {
    const plan = planPlacement(BOAT);
    expect(plan.refusal).toBeNull();
    expect(plan.spot?.x).toBeCloseTo(onWater.x, 6);
  });

  it('says a boat floats, when pointed at dry ground', () => {
    // A few steps inland from where the player stands on the bank.
    const inland = { x: bank.x - inward.x * 2.5, z: bank.z - inward.z * 2.5 };
    const plan = planPlacement({ ...BOAT, mouse: inland });
    expect(plan.refusal).toBe(
      'Rowboats float in the lake · moor it a step or two out from the bank',
    );
  });

  it('asks for rope and logs like any other piece', () => {
    const plan = planPlacement({ ...BOAT, carrying: [{ item: 'log', count: 6 }] });
    expect(plan.refusal).toBe('Need 2 more rope');
    expect(plan.affordable).toBe(false);
  });

  it('allows one each', () => {
    const plan = planPlacement({
      ...BOAT,
      built: [built({ kind: 'rowboat', x: 400, z: 400, yours: true })],
    });
    expect(plan.refusal).toBe('You already have a rowboat');
  });

  it('describes a boat that is too far out in the deep', () => {
    expect(describeRefusal({ reason: 'tooFarOut' })).toBe(
      'Too far out · moor it closer to the bank',
    );
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

it('uses private chest supplies for upgrades only', () => {
  const inputs: PlacementInputs = {
    ...BASE,
    kind: 'teepee',
    homeSkills: 1,
    carrying: [{ item: 'stick', count: 16 }],
    storedSupplies: [{ item: 'log', count: 12 }],
    built: [built({ kind: 'tent', x: 0, z: -4.2, yours: true })],
  };
  expect(planPlacement(inputs).refusal).toBeNull();
  expect(planPlacement(inputs).affordable).toBe(true);
  expect(planPlacement({ ...inputs, kind: 'campfire' }).affordable).toBe(false);
  expect(planPlacement({ ...inputs, kind: 'tent', built: [] }).affordable).toBe(true);
  expect(
    planPlacement({
      ...inputs,
      kind: 'tent',
      built: [],
      carrying: [],
      storedSupplies: [{ item: 'stick', count: 6 }],
    }).affordable,
  ).toBe(false);
});
