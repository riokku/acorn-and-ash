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
  roll: 'forward',
  flinchVariant: 0,
};
const wave = (phase: number) => 1 - 4 * Math.abs((((phase % 1) + 1) % 1) - 0.5);
function setup() {
  const root = new THREE.Object3D(),
    foot = new THREE.Object3D();
  foot.name = 'foot';
  root.add(foot);
  const clip = (name: string, duration: number, offset: number) =>
    new THREE.AnimationClip(name, duration, [
      new THREE.NumberKeyframeTrack(
        'foot.position[x]',
        Array.from({ length: 9 }, (_, i) => (duration * i) / 8),
        Array.from({ length: 9 }, (_, i) => wave(i / 8 - offset)),
      ),
    ]);
  const animator = new CharacterAnimator(root, {
    whole: new Map([['jumpStart', new THREE.AnimationClip('jumpStart', 2, [])]]),
    upper: new Map(),
    lower: new Map([
      ['walk', clip('walk', 2, 0)],
      ['run', clip('run', 1, 0.125)],
    ]),
  });
  return { animator, foot };
}
describe('shared stride phase', () => {
  it('aligns the authored contact offsets throughout walking/running blends', () => {
    const { animator, foot } = setup();
    for (const speed of [4.5, 5.5, 7, 5.5, 3]) {
      for (let i = 0; i < 120; i++) animator.update(1 / 60, idle, { speed, airborne: false });
      expect(foot.position.x).toBeCloseTo(wave(animator.stridePhase!), 4);
    }
    animator.dispose();
  });
  it.each([30, 60, 144])('keeps steady cadence at %s FPS', (fps) => {
    const { animator } = setup();
    for (let i = 0; i < fps; i++) animator.update(1 / fps, idle, { speed: 4.5, airborne: false });
    expect(animator.stridePhase).toBeCloseTo(0.5, 10);
    animator.dispose();
  });
  it('stops the stride through a block, airborne pose or full-body move and resumes without resetting', () => {
    const { animator } = setup();
    animator.update(0.4, idle, { speed: 4.5, airborne: false });
    const phase = animator.stridePhase;
    animator.update(0.1, idle, { speed: 0, airborne: false });
    expect(animator.stridePhase).toBeNull();
    animator.update(0.1, idle, { speed: 4.5, airborne: true });
    expect(animator.stridePhase).toBeNull();
    animator.update(
      0.2,
      { ...idle, kind: ActionKind.Dodge, age: 2 },
      { speed: 7, airborne: false },
    );
    expect(animator.stridePhase).toBeNull();
    animator.update(0, idle, { speed: 4.5, airborne: false });
    for (let i = 0; i < 60; i++) animator.update(1 / 60, idle, { speed: 4.5, airborne: false });
    expect(animator.stridePhase).not.toBe(phase);
    animator.dispose();
  });
  it('advances only the unpaused part of a hit frame', () => {
    const { animator } = setup();
    animator.update(0.5, idle, { speed: 4.5, airborne: false });
    animator.hitStop(0.025);
    animator.update(0.1, idle, { speed: 4.5, airborne: false });
    expect(animator.stridePhase).toBeCloseTo(0.2875, 10);
    animator.dispose();
  });
});
