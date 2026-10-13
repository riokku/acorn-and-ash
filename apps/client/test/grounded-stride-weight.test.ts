import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { ActionKind } from '@acorn/shared';
import { CharacterAnimator } from '../src/scene/character-animator';
import type { MoveClip, MoveView } from '../src/scene/character-moves';

const idle: MoveView = {
  kind: ActionKind.Idle,
  age: 0,
  step: 0,
  atTree: false,
  roll: 'forward',
  flinchVariant: 0,
};
function animator() {
  const clips = (names: MoveClip[]) =>
    new Map(names.map((name) => [name, new THREE.AnimationClip(name, 2, [])]));
  return new CharacterAnimator(new THREE.Object3D(), {
    whole: clips(['attack1', 'jumpStart']),
    upper: clips(['idle', 'walk', 'run', 'jumpAir', 'attack1', 'fishIdle']),
    lower: clips(['idle', 'walk', 'run', 'jumpAir', 'fishIdle']),
  });
}

describe('grounded stride contact weight', () => {
  it.each([4.5, 7])(
    'retains terrain contact throughout a grounded gait at %s metres per second',
    (speed) => {
      const model = animator();
      for (let i = 0; i < 60; i++) model.update(1 / 60, idle, { speed, airborne: false });
      expect(model.standingWeight).toBeLessThan(0.001);
      expect(model.groundedWeight).toBeCloseTo(1);
      model.dispose();
    },
  );
  it('gives whole-body moves and airborne poses their own footing', () => {
    const model = animator();
    model.update(0.2, { ...idle, kind: ActionKind.Dodge, age: 2 }, { speed: 7, airborne: false });
    expect(model.groundedWeight).toBe(0);
    for (let i = 0; i < 60; i++) model.update(1 / 60, idle, { speed: 4.5, airborne: true });
    expect(model.groundedWeight).toBeLessThan(0.001);
    model.dispose();
  });
  it('keeps free walking legs fitted during an attack but yields to whole-body fishing', () => {
    const model = animator();
    model.update(
      0.2,
      { ...idle, kind: ActionKind.Swing, step: 1, age: 4 },
      { speed: 3, airborne: false },
    );
    expect(model.groundedWeight).toBeCloseTo(1);
    model.setFishing('waiting');
    for (let i = 0; i < 60; i++) model.update(1 / 60, idle, { speed: 0, airborne: false });
    expect(model.groundedWeight).toBe(0);
    model.dispose();
  });
});
