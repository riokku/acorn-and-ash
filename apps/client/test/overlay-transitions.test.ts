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
const stationary = { speed: 0, airborne: false };
function setup() {
  const root = new THREE.Object3D(),
    hand = new THREE.Object3D(),
    foot = new THREE.Object3D();
  hand.name = 'hand';
  foot.name = 'foot';
  root.add(hand, foot);
  const clips = (bone: string) =>
    new Map<MoveClip, THREE.AnimationClip>(
      [
        ['cast', 1],
        ['fishIdle', 2],
        ['fishCatch', 3],
      ].map(([name, value]) => [
        name as MoveClip,
        new THREE.AnimationClip(String(name) + bone, 3, [
          new THREE.NumberKeyframeTrack(
            bone + '.position[x]',
            [0, 3],
            [Number(value), Number(value)],
          ),
        ]),
      ]),
    );
  const animator = new CharacterAnimator(root, {
    whole: new Map(),
    upper: clips('hand'),
    lower: clips('foot'),
  });
  return { animator, hand, foot };
}
describe('timed overlay transitions', () => {
  it('crosses casting into waiting without an idle frame even when one slow frame crosses the overlap', () => {
    const { animator, hand, foot } = setup();
    animator.setFishing('casting');
    animator.update(1.25, idle, stationary);
    expect(hand.position.x).toBeGreaterThan(1);
    expect(hand.position.x).toBeLessThan(2);
    expect(foot.position.x).toBeCloseTo(hand.position.x);
    animator.update(0.3, idle, stationary);
    expect(hand.position.x).toBeCloseTo(2);
    animator.dispose();
  });
  it.each([30, 60, 144])('matches the same cast overlap at %s FPS', (fps) => {
    const fine = setup(),
      coarse = setup();
    fine.animator.setFishing('casting');
    coarse.animator.setFishing('casting');
    const seconds = 1.25;
    let left = seconds;
    while (left > 1e-9) {
      const delta = Math.min(left, 1 / fps);
      fine.animator.update(delta, idle, stationary);
      left -= delta;
    }
    coarse.animator.update(seconds, idle, stationary);
    expect(fine.hand.position.x).toBeCloseTo(coarse.hand.position.x, 6);
    fine.animator.dispose();
    coarse.animator.dispose();
  });
  it('returns from a landing overlay cleanly and can cast again', () => {
    const { animator, hand } = setup();
    animator.setFishing('landing');
    animator.update(0.2, idle, stationary);
    expect(hand.position.x).toBeCloseTo(3);
    animator.update(3, idle, stationary);
    expect(hand.position.x).toBeCloseTo(0);
    animator.setFishing(null);
    animator.setFishing('casting');
    animator.update(0.2, idle, stationary);
    expect(hand.position.x).toBeCloseTo(1);
    animator.dispose();
  });
});
