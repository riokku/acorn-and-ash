import * as THREE from 'three/webgpu';
import { expect, it } from 'vitest';
import { createGroundItems } from '../src/scene/ground-items';
it('uses the existing forage models as a broader colony while keeping pieces individually harvestable', () => {
  const items = createGroundItems(() => 2);
  const patch = { item: 'mushroom' as const, x: 4, z: 5, remaining: 5 };
  items.setGatherPatches([
    { ...patch, id: 205 },
    { ...patch, id: 243, x: 8 },
  ]);
  const regular = new THREE.Box3().setFromObject(items.patchObject(205)!);
  const colony = new THREE.Box3().setFromObject(items.patchObject(243)!);
  expect(colony.getSize(new THREE.Vector3()).x).toBeGreaterThan(
    regular.getSize(new THREE.Vector3()).x * 1.5,
  );
  const last = items.target('patch', 243)!;
  expect(last.getWorldPosition(new THREE.Vector3()).y).toBe(2);
  items.setGatherPatches([
    { ...patch, id: 205 },
    { ...patch, id: 243, x: 8, remaining: 4 },
  ]);
  expect(items.target('patch', 243)).not.toBe(last);
  items.clearHarvesting();
  items.dispose();
});
