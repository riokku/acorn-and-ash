import type * as THREE from 'three/webgpu';
import { expect, it } from 'vitest';
import { createWoodlandCreature, type WoodlandCreatureKind } from '../src/scene/woodland-creatures';

function poseAt(kind: WoodlandCreatureKind, fps: number) {
  const model = createWoodlandCreature(kind);
  for (let frame = 0; frame < fps * 2; frame++) {
    model.update(1 / fps, { speed: frame < fps ? 2.9 : 3.1, alert: true });
  }
  model.group.updateMatrixWorld(true);
  const matrices: number[] = [];
  model.group.traverse((child) => matrices.push(...child.matrixWorld.elements));
  model.dispose();
  return matrices;
}

it.each(['elk', 'curiousRaccoon', 'woodlandGuardian'] as const)(
  'keeps %s gait and action blending consistent at 30, 60 and 144 FPS',
  (kind) => {
    const reference = poseAt(kind, 60);
    for (const fps of [30, 144])
      poseAt(kind, fps).forEach((value, i) => expect(value).toBeCloseTo(reference[i]!, 5));
  },
);

it.each(['elk', 'curiousRaccoon', 'woodlandGuardian'] as const)(
  'keeps %s limb poses continuous across the old 3m/s run boundary',
  (kind) => {
    const models = [2.999, 3.001].map((speed) => {
      const model = createWoodlandCreature(kind);
      for (let frame = 0; frame < 120; frame++) model.update(1 / 60, { speed });
      return model;
    });
    const angles = models.map(
      (model) => (model.group.getObjectByName('leg-upper') as THREE.Group).rotation.x,
    );
    expect(Math.abs(angles[0]! - angles[1]!)).toBeLessThan(0.02);
    models.forEach((model) => model.dispose());
  },
);
