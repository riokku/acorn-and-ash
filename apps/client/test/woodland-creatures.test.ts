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
