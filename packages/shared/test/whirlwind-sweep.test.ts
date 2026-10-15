import { describe, expect, it } from 'vitest';
import { CHOP_REACH } from '../src/constants';
import { STRIKE } from '../src/data/moves';
import { whirlwindTargets, type WhirlwindCandidate } from '../src/sim/hunting';
import { treesInWhirlwind } from '../src/sim/chopping';
import type { PlacedProp } from '../src/world/clearing';

const origin = { x: 0, y: 0, z: 0 };
const around = [
  { id: 1, x: 0, y: 0, z: -1.5 },
  { id: 2, x: -1.5, y: 0, z: 0 },
  { id: 3, x: 0, y: 0, z: 1.5 },
  { id: 4, x: 1.5, y: 0, z: 0 },
];

function sweep(candidates: readonly WhirlwindCandidate[], yaw = 0) {
  const hit = new Set<number>();
  const contacts: { id: number; age: number }[] = [];
  for (let age = STRIKE.spinStart + 1; age <= STRIKE.spinEnd; age++)
    for (const target of whirlwindTargets(origin, candidates, { age, yaw }, hit)) {
      hit.add(target.id);
      contacts.push({ id: target.id, age });
    }
  return contacts;
}

describe('weapon contacts during a full whirlwind', () => {
  it('hits right, front, left and behind in weapon order, once across both turns', () => {
    const contacts = sweep(around);
    expect(contacts.map(({ id }) => id)).toEqual([4, 1, 2, 3]);
    expect(contacts[0]!.age).toBeLessThan(contacts[1]!.age);
    expect(contacts[1]!.age).toBeLessThan(contacts[2]!.age);
    expect(contacts[2]!.age).toBeLessThan(contacts[3]!.age);
    expect(sweep(around)).toEqual(contacts); // A new attack can hit the same targets again.
  });

  it('does not hit a target behind the player before the axe reaches it', () => {
    expect(whirlwindTargets(origin, [around[2]!], { age: STRIKE.spinStart + 1, yaw: 0 })).toEqual(
      [],
    );
    expect(sweep([around[2]!])).toHaveLength(1);
  });

  it('sweeps narrow targets between ticks instead of skipping them at high speed', () => {
    const targets = Array.from({ length: 360 }, (_, id) => {
      const angle = (id * Math.PI) / 180;
      return { id, x: Math.sin(angle) * CHOP_REACH, y: 0, z: Math.cos(angle) * CHOP_REACH };
    });
    expect(sweep(targets)).toHaveLength(360);
    expect(sweep(targets, Math.PI - 0.01)).toHaveLength(360);
  });

  it('hits a new target reached while moving during the second turn', () => {
    const target = { id: 9, x: 3, y: 0, z: 0 };
    const hit = new Set<number>();
    const contacts: number[] = [];
    for (let age = STRIKE.spinStart + 1; age <= STRIKE.spinEnd; age++) {
      const position = { ...origin, x: age > STRIKE.impact ? 1 : 0 };
      for (const reached of whirlwindTargets(position, [target], { age, yaw: 0 }, hit)) {
        hit.add(reached.id);
        contacts.push(age);
      }
    }
    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toBeGreaterThan(STRIKE.impact);
  });

  it('respects reach and height while allowing a trunk surface within reach', () => {
    const contacts = sweep([
      { id: 1, x: CHOP_REACH + 0.01, y: 0, z: 0 },
      { id: 2, x: 1, y: STRIKE.height + 0.01, z: 0 },
      { id: 3, x: CHOP_REACH + 0.5, y: 0, z: 0, radius: 0.6 },
    ]);
    expect(contacts.map(({ id }) => id)).toEqual([3]);
  });

  it('covers body turns across the yaw boundary and a brief reverse sweep', () => {
    for (const [previousYaw, yaw, bearing] of [
      [Math.PI - 0.2, -Math.PI + 0.2, Math.PI / 2 + 0.1],
      [0, -0.5, -Math.PI / 2 - 0.2],
    ]) {
      const target = { id: 1, x: -Math.sin(bearing!) * 1.5, y: 0, z: -Math.cos(bearing!) * 1.5 };
      expect(
        whirlwindTargets(origin, [target], {
          age: STRIKE.spinStart + 1,
          yaw: yaw!,
          previousYaw: previousYaw!,
        }),
      ).toHaveLength(1);
    }
  });

  it('reaches every eligible tree, skips felled trunks and non-trees, and counts a trunk once', () => {
    const props: PlacedProp[] = around.map((at) => ({
      ...at,
      kind: 'birch',
      scale: 0.5,
      rotationY: 0,
    }));
    props.push({ ...props[0]!, id: 7, kind: 'boulder' });
    const hit = new Set<number>();
    const contacts: number[] = [];
    for (let age = STRIKE.spinStart + 1; age <= STRIKE.spinEnd; age++)
      for (const target of treesInWhirlwind(origin, 0, age, props, (id) => id === 2, hit)) {
        hit.add(target.prop.id);
        contacts.push(target.prop.id);
      }
    expect(contacts).toEqual([4, 1, 3]);
  });
});
