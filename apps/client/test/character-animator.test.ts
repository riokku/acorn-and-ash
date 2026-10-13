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

describe('standing terrain correction share', () => {
  it('follows the idle leg blend and yields to walking, airborne poses and fishing', () => {
    const { animator } = fishingAnimator();
    animator.update(1 / 60, idle, { speed: 0, airborne: false });
    expect(animator.standingWeight).toBe(1);
    for (let i = 0; i < 60; i++) animator.update(1 / 60, idle, { speed: 4.5, airborne: false });
    expect(animator.standingWeight).toBeLessThan(0.001);
    for (let i = 0; i < 60; i++) animator.update(1 / 60, idle, { speed: 0, airborne: true });
    expect(animator.standingWeight).toBeLessThan(0.001);
    for (let i = 0; i < 60; i++) animator.update(1 / 60, idle, { speed: 0, airborne: false });
    expect(animator.standingWeight).toBeGreaterThan(0.999);
    animator.dispose();
    const fishing = new CharacterAnimator(new THREE.Object3D(), {
      whole: new Map(),
      upper: new Map([['fishIdle', new THREE.AnimationClip('fish-upper', 2, [])]]),
      lower: new Map([['fishIdle', new THREE.AnimationClip('fish-lower', 2, [])]]),
    });
    fishing.setFishing('waiting');
    for (let i = 0; i < 30; i++) fishing.update(1 / 60, idle, { speed: 0, airborne: false });
    expect(fishing.standingWeight).toBe(0);
    fishing.setFishing(null);
    for (let i = 0; i < 30; i++) fishing.update(1 / 60, idle, { speed: 0, airborne: false });
    expect(fishing.standingWeight).toBe(1);
    fishing.dispose();
  });
});

/** A steadily advancing foot exposes the gait's actual animation clock. */
function walkingAnimator() {
  const root = new THREE.Object3D();
  const foot = new THREE.Object3D();
  foot.name = 'foot';
  root.add(foot);
  const animator = new CharacterAnimator(root, {
    whole: new Map(),
    upper: new Map(),
    lower: new Map([
      [
        'idle',
        new THREE.AnimationClip('idle', 2, [
          new THREE.NumberKeyframeTrack('foot.position[x]', [0, 2], [0, 0]),
        ]),
      ],
      [
        'walk',
        new THREE.AnimationClip('walk', 2, [
          new THREE.NumberKeyframeTrack('foot.position[x]', [0, 2], [0, 2]),
        ]),
      ],
    ]),
  });
  animator.update(0.5, idle, { speed: 4.5, airborne: false });
  return { animator, foot };
}

describe('impact pause timing', () => {
  it('uses the remaining part of a slow frame instead of freezing the whole frame', () => {
    const stopped = walkingAnimator();
    const reference = walkingAnimator();
    stopped.animator.hitStop(0.025);
    stopped.animator.update(0.1, idle, { speed: 4.5, airborne: false });
    reference.animator.update(0.075, idle, { speed: 4.5, airborne: false });
    expect(stopped.foot.position.x).toBeCloseTo(reference.foot.position.x, 6);
    expect(stopped.animator.stopped).toBe(false);
    stopped.animator.dispose();
    reference.animator.dispose();
  });

  it.each([30, 60, 120])('matches the same rendered gait at %s frames per second', (fps) => {
    const fine = walkingAnimator();
    const coarse = walkingAnimator();
    fine.animator.hitStop(0.025);
    coarse.animator.hitStop(0.025);
    for (let i = 0; i < fps / 10; i++)
      fine.animator.update(1 / fps, idle, { speed: 4.5, airborne: false });
    coarse.animator.update(0.1, idle, { speed: 4.5, airborne: false });
    expect(fine.foot.position.x).toBeCloseTo(coarse.foot.position.x, 6);
    fine.animator.dispose();
    coarse.animator.dispose();
  });

  it('holds the pose through a full pause, including a zero-duration update', () => {
    const { animator, foot } = walkingAnimator();
    const before = foot.position.x;
    animator.hitStop(0.04);
    animator.update(0, idle, { speed: 0, airborne: false });
    animator.update(0.02, idle, { speed: 0, airborne: false });
    expect(foot.position.x).toBeCloseTo(before, 6);
    expect(animator.stopped).toBe(true);
    animator.update(0.02, idle, { speed: 0, airborne: false });
    expect(animator.stopped).toBe(false);
    expect(foot.position.x).toBeCloseTo(before, 6);
    animator.dispose();
  });
});
