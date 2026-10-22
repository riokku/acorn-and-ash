import * as THREE from 'three/webgpu';
import { expect, it, vi } from 'vitest';
import { rehearseEffects } from '../src/scene/effect-rehearsal';
import { createPropMeshes, expandFallingTreeBounds, placeInstance } from '../src/scene/props';
import { PROP_KINDS } from '@acorn/shared';
it('prepares hidden and zero-count effects, then restores them even when rendering fails', () => {
  const root = new THREE.Group();
  root.visible = false;
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 8);
  mesh.visible = false;
  mesh.count = 0;
  root.add(mesh);
  const draw = () => {
    expect(root.visible).toBe(true);
    expect(mesh.visible).toBe(true);
    expect(mesh.count).toBe(1);
    expect(mesh.frustumCulled).toBe(false);
  };
  rehearseEffects([root, mesh], draw);
  expect(root.visible).toBe(false);
  expect(mesh.visible).toBe(false);
  expect(mesh.count).toBe(0);
  expect(mesh.frustumCulled).toBe(true);
  expect(() =>
    rehearseEffects([root], () => {
      draw();
      throw new Error('device');
    }),
  ).toThrow('device');
  expect(root.visible).toBe(false);
  expect(mesh.count).toBe(0);
  mesh.geometry.dispose();
  (mesh.material as THREE.Material).dispose();
  mesh.dispose();
});
it('covers the entire fall without rescanning the instance batch each animation frame', () => {
  const parts = createPropMeshes(PROP_KINDS.pine, 2);
  const tree = { id: 1, kind: 'pine' as const, x: 10, y: 4, z: 20, scale: 2, rotationY: 0 };
  placeInstance(parts, 0, tree);
  placeInstance(parts, 1, { ...tree, x: 100 });
  try {
    for (const part of parts) {
      part.mesh.computeBoundingSphere();
      const far = part.mesh.boundingSphere!.clone();
      const scan = vi.spyOn(part.mesh, 'computeBoundingSphere');
      for (let frame = 0; frame < 120; frame++) expandFallingTreeBounds(part, tree);
      expect(scan).not.toHaveBeenCalled();
      expect(part.mesh.boundingSphere!.containsPoint(far.center)).toBe(true);
      for (const offset of [
        new THREE.Vector3(0, 20, 0),
        new THREE.Vector3(20, 0, 0),
        new THREE.Vector3(0, 0, -20),
      ])
        expect(
          part.mesh.boundingSphere!.containsPoint(
            offset.add(new THREE.Vector3(tree.x, tree.y, tree.z)),
          ),
        ).toBe(true);
      scan.mockRestore();
    }
  } finally {
    parts.forEach((part) => part.dispose());
  }
});
