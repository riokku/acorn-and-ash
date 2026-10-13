import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';

import { ActionKind } from '@acorn/shared';

import { CharacterAnimator } from '../src/scene/character-animator';
import type { MoveView } from '../src/scene/character-moves';

const idle: MoveView = {
  kind: ActionKind.Idle,
  step: 0,
  age: 0,
  atTree: false,
  flinchVariant: 0,
  roll: 'forward',
};

describe('consecutive uses of the same move clip', () => {
  function choppingAnimator() {
    const root = new THREE.Object3D();
    const hand = new THREE.Object3D();
    hand.name = 'hand';
    root.add(hand);
    const track = () => new THREE.NumberKeyframeTrack('hand.position[x]', [0, 2], [0, 20]);
    const animator = new CharacterAnimator(root, {
      whole: new Map([['chop', new THREE.AnimationClip('chop', 2, [track()])]]),
      upper: new Map([['chop', new THREE.AnimationClip('chop-upper', 2, [track()])]]),
      lower: new Map(),
    });
    return { animator, hand };
  }
  const chop = (age: number, step = 1): MoveView => ({
    ...idle,
    kind: ActionKind.Swing,
    atTree: true,
    age,
    step,
  });

  it.each([0, 3])('blends a restarted chop while travelling at %s metres per second', (speed) => {
    const { animator, hand } = choppingAnimator();
    const locomotion = { speed, airborne: false };
    animator.update(0.1, chop(6), locomotion);
    const previous = hand.position.x;
    const nextTime = animator.update(0.01, chop(0), locomotion).time * 10;
    expect(hand.position.x).toBeGreaterThan(nextTime + 0.5);
    expect(hand.position.x).toBeLessThan(previous);
    animator.update(0.1, chop(2), locomotion);
    const settled = animator.update(0, chop(2), locomotion).time * 10;
    expect(hand.position.x).toBeCloseTo(settled, 5);
    animator.dispose();
  });

  it('crossfades the same chopping clip when the combo step changes', () => {
    const { animator, hand } = choppingAnimator();
    animator.update(0.1, chop(6, 1), { speed: 3, airborne: false });
    const before = hand.position.x;
    const next = animator.update(0.01, chop(6.2, 2), { speed: 3, airborne: false }).time * 10;
    expect(hand.position.x).toBeGreaterThan(Math.min(before, next));
    expect(hand.position.x).toBeLessThan(Math.max(before, next));
    animator.dispose();
  });

  it('does not restart the clip for a sub-tick clock correction', () => {
    const { animator, hand } = choppingAnimator();
    animator.update(0.1, chop(6), { speed: 0, airborne: false });
    const corrected = animator.update(0.01, chop(5.8), { speed: 0, airborne: false }).time * 10;
    expect(hand.position.x).toBeCloseTo(corrected, 5);
    animator.dispose();
  });
});
