import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';

import { ActionKind } from '@acorn/shared';

import { CharacterAnimator } from '../src/scene/character-animator';
import type { MoveClip, MoveView } from '../src/scene/character-moves';

const idle: MoveView = {
  kind: ActionKind.Idle,
  step: 0,
  age: 0,
  atTree: false,
  flinchVariant: 0,
  roll: 'forward',
};

/** Each clip holds a distinct hand position so we can observe the rendered pose. */
function fishingAnimator(): { animator: CharacterAnimator; hand: THREE.Object3D } {
  const root = new THREE.Object3D();
  const hand = new THREE.Object3D();
  hand.name = 'hand';
  root.add(hand);
  const upper = new Map<MoveClip, THREE.AnimationClip>();
  for (const [name, position] of [
    ['cast', 1],
    ['fishIdle', 2],
    ['fishBite', 3],
    ['fishCatch', 4],
  ] as const) {
    upper.set(
      name,
      new THREE.AnimationClip(name, 2, [
        new THREE.NumberKeyframeTrack('hand.position[x]', [0, 2], [position, position]),
      ]),
    );
  }
  return {
    animator: new CharacterAnimator(root, { whole: new Map(), upper, lower: new Map() }),
    hand,
  };
}

describe('fishing animation', () => {
  it('casts once and stays waiting while the game repeats the cast state each frame', () => {
    const { animator, hand } = fishingAnimator();
    for (let frame = 0; frame < 300; frame++) {
      animator.setFishing('casting');
      animator.update(1 / 60, idle, { speed: 0, airborne: false });
      if (frame > 120) expect(hand.position.x).toBeCloseTo(2);
    }
    animator.setFishing('biting');
    for (let frame = 0; frame < 30; frame++) {
      animator.update(1 / 60, idle, { speed: 0, airborne: false });
    }
    expect(hand.position.x).toBeCloseTo(3);
    animator.dispose();
  });

  it('can cast again after the previous line is cleared', () => {
    const { animator, hand } = fishingAnimator();
    animator.setFishing('casting');
    for (let frame = 0; frame < 120; frame++) {
      animator.update(1 / 60, idle, { speed: 0, airborne: false });
    }
    animator.setFishing(null);
    for (let frame = 0; frame < 30; frame++) {
      animator.update(1 / 60, idle, { speed: 0, airborne: false });
    }
    animator.setFishing('casting');
    for (let frame = 0; frame < 30; frame++) {
      animator.update(1 / 60, idle, { speed: 0, airborne: false });
    }
    expect(hand.position.x).toBeCloseTo(1);
    animator.dispose();
  });
});

describe('moving swift attacks', () => {
  it('keeps the walking pose on the legs while the hands finish a swing', () => {
    const root = new THREE.Object3D();
    const hand = new THREE.Object3D();
    hand.name = 'hand';
    const foot = new THREE.Object3D();
    foot.name = 'foot';
    root.add(hand, foot);
    const track = (bone: string, value: number) =>
      new THREE.NumberKeyframeTrack(`${bone}.position[x]`, [0, 2], [value, value]);
    const animator = new CharacterAnimator(root, {
      whole: new Map([
        ['attack1', new THREE.AnimationClip('attack1', 2, [track('hand', 5), track('foot', 9)])],
      ]),
      upper: new Map([
        ['attack1', new THREE.AnimationClip('attack1-upper', 2, [track('hand', 5)])],
      ]),
      lower: new Map([['walk', new THREE.AnimationClip('walk-lower', 2, [track('foot', 2)])]]),
    });
    for (let frame = 0; frame < 30; frame++) {
      animator.update(
        1 / 60,
        { ...idle, kind: ActionKind.Swing, step: 1, age: frame / 3 },
        { speed: 3, airborne: false },
      );
    }
    expect(hand.position.x).toBeCloseTo(5);
    // The gait blends in smoothly, rather than snapping to the attack’s foot pose.
    expect(foot.position.x).toBeCloseTo(2, 1);
    animator.dispose();
  });
});
