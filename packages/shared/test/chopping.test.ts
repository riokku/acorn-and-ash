import { describe, expect, it } from 'vitest';

import { colliderTopAt } from '../src/collision/solid-surface';
import { CHOP_REACH } from '../src/constants';
import { PROP_KINDS, choppingRuleFor } from '../src/data/props';
import { treeInReach } from '../src/sim/chopping';
import { stumpColliderFor, type PlacedProp } from '../src/world/clearing';

const oak: PlacedProp = { id: 1, kind: 'oak', x: 0, z: -5, rotationY: 0, scale: 1 };
const birch: PlacedProp = { id: 2, kind: 'birch', x: 6, z: 0, rotationY: 0, scale: 1 };
const boulder: PlacedProp = { id: 3, kind: 'boulder', x: 0, z: -2, rotationY: 0, scale: 1 };

const standing = (): boolean => false;
/** Yaw zero looks down -Z, so this is "facing the oak". */
const NORTH = 0;

describe('what a swing reaches', () => {
  it('finds the tree you are facing', () => {
    const target = treeInReach({ x: 0, y: 0, z: -3.5 }, NORTH, [oak, birch], standing);
    expect(target?.prop.id).toBe(oak.id);
  });

  it('finds nothing when you are too far away', () => {
    const target = treeInReach({ x: 0, y: 0, z: 0 }, NORTH, [oak], standing);
    expect(target).toBeNull();
  });

  it('finds nothing when the tree is behind you', () => {
    // Facing the other way, with the oak at the same distance.
    const target = treeInReach({ x: 0, y: 0, z: -3.5 }, Math.PI, [oak], standing);
    expect(target).toBeNull();
  });

  it('refuses a tree off to the side', () => {
    // Standing next to the oak but looking along the clearing, not at it.
    const target = treeInReach({ x: 0, y: 0, z: -3.5 }, Math.PI / 2, [oak], standing);
    expect(target).toBeNull();
  });

  it('is not fussy about being perfectly squared up', () => {
    const target = treeInReach({ x: 0, y: 0, z: -3.5 }, 0.5, [oak], standing);
    expect(target?.prop.id).toBe(oak.id);
  });

  it('measures reach to the trunk, not its middle', () => {
    // A fat oak and a slender birch, each exactly CHOP_REACH from the bark.
    const oakRadius = PROP_KINDS.oak.colliderRadius;
    const birchRadius = PROP_KINDS.birch.colliderRadius;
    const atOak = { x: 0, y: 0, z: -5 + oakRadius + CHOP_REACH - 0.01 };
    const facingBirch = Math.atan2(-1, 0);
    const atBirch = { x: 6 - birchRadius - CHOP_REACH + 0.01, y: 0, z: 0 };

    expect(treeInReach(atOak, NORTH, [oak], standing)?.prop.id).toBe(oak.id);
    expect(treeInReach(atBirch, facingBirch, [birch], standing)?.prop.id).toBe(birch.id);
  });

  it('will not let you chop a rock', () => {
    expect(treeInReach({ x: 0, y: 0, z: -0.5 }, NORTH, [boulder], standing)).toBeNull();
  });

  it('skips a tree that is already down', () => {
    const felled = (id: number): boolean => id === oak.id;
    expect(treeInReach({ x: 0, y: 0, z: -3.5 }, NORTH, [oak], felled)).toBeNull();
  });

  it('takes the nearer of two trees in front of you', () => {
    const near: PlacedProp = { id: 7, kind: 'birch', x: 0, z: -1.5, rotationY: 0, scale: 1 };
    const far: PlacedProp = { id: 8, kind: 'birch', x: 0, z: -3, rotationY: 0, scale: 1 };
    expect(treeInReach({ x: 0, y: 0, z: 0 }, NORTH, [far, near], standing)?.prop.id).toBe(near.id);
  });

  it('carries the rule for what it takes to fell it', () => {
    const target = treeInReach({ x: 0, y: 0, z: -3.5 }, NORTH, [oak], standing);
    expect(target?.rule).toEqual(choppingRuleFor(PROP_KINDS.oak));
    expect(target?.rule.swingsToFell).toBeGreaterThan(0);
  });
});

describe('what the trees are worth', () => {
  it('gives every tree a few swings and some logs', () => {
    for (const kind of [PROP_KINDS.pine, PROP_KINDS.birch, PROP_KINDS.oak]) {
      const rule = choppingRuleFor(kind);
      expect(rule).not.toBeNull();
      // "A few swings", not a chore and not a tap.
      expect(rule?.swingsToFell).toBeGreaterThanOrEqual(3);
      expect(rule?.swingsToFell).toBeLessThanOrEqual(6);
      expect(rule?.logs).toBeGreaterThan(0);
    }
  });

  it('makes the big tree the slow one, and the generous one', () => {
    const birchRule = choppingRuleFor(PROP_KINDS.birch);
    const oakRule = choppingRuleFor(PROP_KINDS.oak);
    expect(oakRule?.swingsToFell).toBeGreaterThan(birchRule?.swingsToFell ?? 0);
    expect(oakRule?.logs).toBeGreaterThan(birchRule?.logs ?? 0);
  });

  it('gives rocks no rule at all', () => {
    expect(choppingRuleFor(PROP_KINDS.boulder)).toBeNull();
    expect(choppingRuleFor(PROP_KINDS.mossyRock)).toBeNull();
  });
});

describe('what a felled tree leaves behind', () => {
  it('leaves a stump you can walk around instead of a trunk you cannot', () => {
    const stump = stumpColliderFor(oak);
    expect(stump.shape).toBe('cylinder');
    if (stump.shape !== 'cylinder') throw new Error('expected a cylinder');

    expect(stump.x).toBe(oak.x);
    expect(stump.z).toBe(oak.z);
    // Low enough to read as remains rather than as a post, and something to
    // climb onto rather than a wall. Its roots spread wider than the trunk did.
    expect(stump.height).toBeLessThan(1);
    expect(stump.standable).toBe(true);
  });

  it('leaves a stump as wide as the trunk was where it was cut', () => {
    for (const kind of ['pine', 'birch', 'oak', 'maple', 'alder'] as const) {
      const tree = { ...oak, kind, scale: 1.2 };
      const trunk = PROP_KINDS[kind].shape.trunkRadius * tree.scale;
      const stump = stumpColliderFor(tree);
      if (stump.shape !== 'cylinder') throw new Error('expected a cylinder');
      const sawnTop = stump.baseY + stump.height;
      // Just inside where the bark was, you are standing on the sawn top...
      expect(colliderTopAt(stump, tree.x + trunk * 0.9, tree.z)).toBeCloseTo(sawnTop, 1);
      // ...and a little outside it, you are down among the roots.
      expect(colliderTopAt(stump, tree.x + trunk * 1.15, tree.z) ?? 0).toBeLessThan(sawnTop * 0.8);
    }
  });

  it('leaves a bigger stump where a bigger tree stood', () => {
    const small = stumpColliderFor({ ...oak, scale: 0.8 });
    const large = stumpColliderFor({ ...oak, scale: 1.4 });
    if (small.shape !== 'cylinder' || large.shape !== 'cylinder') {
      throw new Error('expected cylinders');
    }
    expect(large.radius).toBeGreaterThan(small.radius);
  });
});
