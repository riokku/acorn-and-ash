import { createFlatTerrain } from '@acorn/shared';
import { createAnimalTracks } from '../src/scene/animal-tracks';
import { createGuardianTrophy } from '../src/scene/guardian-trophy';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three/webgpu';
import { triangleCount } from '../src/art/shapes';
import { createWoodlandCreature } from '../src/scene/woodland-creatures';

for (const kind of ['elk', 'curiousRaccoon', 'woodlandGuardian'] as const) {
  describe(kind, () => {
    it('has a full model within the animal budget, articulated feet and grounded proportions', () => {
      const model = createWoodlandCreature(kind);
      expect(triangleCount(model.group)).toBeGreaterThan(500);
      expect(triangleCount(model.group)).toBeLessThanOrEqual(5000);
      expect(model.group.getObjectByName('leg-lower')).toBeDefined();
      const bounds = new THREE.Box3().setFromObject(model.group);
      expect(bounds.min.y).toBeGreaterThan(-0.12);
      expect(bounds.max.y).toBeGreaterThan(kind === 'curiousRaccoon' ? 0.45 : 2.4);
      model.dispose();
    });
    it('changes limb poses while moving, blends into idle and reacts to defeat', () => {
      const model = createWoodlandCreature(kind),
        leg = model.group.getObjectByName('leg-upper')!;
      model.update(0.1, { speed: 3 });
      const first = leg.rotation.x;
      model.update(0.1, { speed: 3 });
      expect(leg.rotation.x).not.toBe(first);
      for (let i = 0; i < 30; i++) model.update(0.1, { speed: 0 });
      expect(Math.abs(leg.rotation.x)).toBeLessThan(0.01);
      for (let i = 0; i < 20; i++) model.update(0.1, { speed: 0, defeated: true });
      expect(leg.rotation.x).toBeGreaterThan(0.8);
      model.dispose();
    });
  });
}

it('keeps the guardian trophy within its prop budget and tracks within three trail budgets', () => {
  const trophy = createGuardianTrophy();
  expect(triangleCount(trophy.group)).toBeGreaterThan(100);
  expect(triangleCount(trophy.group)).toBeLessThanOrEqual(2000);
  trophy.dispose();
  const trails = createAnimalTracks(42, createFlatTerrain());
  expect(triangleCount(trails.group)).toBeLessThanOrEqual(6000);
  expect(triangleCount(trails.group)).toBeGreaterThan(500);
  trails.dispose();
});

it('gives an elk a distinct braced warning, then settles back without moving its world root', () => {
  const model = createWoodlandCreature('elk');
  const leg = model.group.getObjectByName('leg-upper')!;
  const neck = model.group.getObjectByName('neck')!;
  model.group.position.set(12, 3, -8);
  for (let i = 0; i < 90; i++) model.update(1 / 60, { speed: 0, alert: true });
  const listening = neck.rotation.x;
  for (let i = 0; i < 90; i++) model.update(1 / 60, { speed: 0, alert: true, tense: true });
  expect(neck.rotation.x).toBeLessThan(listening - 0.1);
  expect(leg.rotation.x).toBeLessThan(-0.06);
  expect(model.group.position.toArray()).toEqual([12, 3, -8]);
  for (let i = 0; i < 150; i++) model.update(1 / 60, { speed: 0 });
  expect(Math.abs(leg.rotation.x)).toBeLessThan(0.00001);
  model.dispose();
});

it('keeps wildlife poses independent of frame rate and grazing phases independent by animal identity', () => {
  const rotations = [30, 60, 144].map((fps) => {
    const model = createWoodlandCreature('elk', undefined, 8);
    for (let frame = 0; frame < fps * 2; frame++)
      model.update(
        1 / fps,
        frame < fps
          ? { speed: 0, alert: true, tense: true }
          : { speed: 6, alert: true, fleeing: true },
      );
    const result = [
      model.group.getObjectByName('neck')!.rotation.x,
      model.group.getObjectByName('leg-upper')!.rotation.x,
    ];
    model.dispose();
    return result;
  });
  for (const result of rotations)
    result.forEach((angle, i) => expect(angle).toBeCloseTo(rotations[1]![i]!, 4));
  const a = createWoodlandCreature('elk', undefined, 1),
    b = createWoodlandCreature('elk', undefined, 50);
  for (let frame = 0; frame < 60; frame++) {
    a.update(1 / 60, { speed: 0 });
    b.update(1 / 60, { speed: 0 });
  }
  expect(a.group.getObjectByName('head')!.rotation.y).not.toBeCloseTo(
    b.group.getObjectByName('head')!.rotation.y,
    3,
  );
  a.dispose();
  b.dispose();
});
