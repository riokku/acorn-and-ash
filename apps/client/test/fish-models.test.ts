import { expect, it } from 'vitest';
import * as THREE from 'three/webgpu';
import { createFishParts } from '../src/scene/fish-models';

it('keeps all six fish finite, within the held-food size and below the creature triangle budget', () => {
  for (const species of ['perch', 'trout', 'goldenCarp'] as const) {
    for (const roasted of [false, true]) {
      const parts = createFishParts(species, roasted);
      const bounds = new THREE.Box3();
      let triangles = 0;
      for (const part of parts) {
        const p = part.geometry.getAttribute('position');
        for (const value of p.array) expect(Number.isFinite(value)).toBe(true);
        part.geometry.computeBoundingBox();
        bounds.union(part.geometry.boundingBox!);
        triangles += (part.geometry.index?.count ?? p.count) / 3;
      }
      const size = bounds.getSize(new THREE.Vector3());
      expect(size.z).toBeGreaterThan(0.3);
      expect(size.z).toBeLessThan(0.42);
      expect(size.x).toBeLessThan(0.18);
      expect(size.y).toBeLessThan(0.24);
      expect(triangles).toBeLessThan(5000);
      for (const part of parts) part.geometry.dispose();
      for (const material of new Set(parts.map((part) => part.material))) material.dispose();
    }
  }
});
