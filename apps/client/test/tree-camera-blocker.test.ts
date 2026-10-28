import { expect, it, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import { PROP_KINDS } from '@acorn/shared';
import { blockerGeometry } from '../src/scene/props';

const modelParts = vi.hoisted(() => vi.fn(() => undefined as unknown));
vi.mock('../src/scene/prop-models', () => ({
  realModelPartsFor: modelParts,
  treeVariant: () => 0,
}));

it('blocks the camera at a tree canopy while leaving space below the branches', () => {
  const geometry = blockerGeometry(PROP_KINDS.pine, {
    id: 1,
    kind: 'pine',
    x: 0,
    z: 0,
    rotationY: 0,
    scale: 1,
  });
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  mesh.updateMatrixWorld();
  // The ray misses the trunk by more than a metre but crosses the canopy.
  const ray = new THREE.Raycaster(new THREE.Vector3(1.2, 5, 6), new THREE.Vector3(0, 0, -1));
  expect(ray.intersectObject(mesh).length).toBeGreaterThan(0);
  // A camera beneath the branches can still use the space beside the trunk.
  ray.set(new THREE.Vector3(1.2, 1, 6), new THREE.Vector3(0, 0, -1));
  expect(ray.intersectObject(mesh)).toHaveLength(0);
  geometry.dispose();
  mesh.material.dispose();
});

it('uses loaded evergreen foliage bounds, including low branches and placement scale', () => {
  const leaves = new THREE.BoxGeometry(6, 4, 6);
  leaves.translate(0, 3, 0); // Crown begins at y=1, below the fallback crown.
  const leafMaterial = new THREE.MeshBasicMaterial();
  leafMaterial.name = 'leaves';
  modelParts.mockReturnValueOnce([{ geometry: leaves, material: leafMaterial }]);
  const geometry = blockerGeometry(PROP_KINDS.birch, {
    id: 2,
    kind: 'birch',
    x: 10,
    y: 4,
    z: 20,
    rotationY: 0,
    scale: 2,
  });
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  mesh.updateMatrixWorld();
  const ray = new THREE.Raycaster(new THREE.Vector3(12, 8, 32), new THREE.Vector3(0, 0, -1));
  expect(ray.intersectObject(mesh).length).toBeGreaterThan(0);
  ray.set(new THREE.Vector3(12, 5, 32), new THREE.Vector3(0, 0, -1));
  expect(ray.intersectObject(mesh)).toHaveLength(0);
  geometry.dispose();
  mesh.material.dispose();
  leaves.dispose();
  leafMaterial.dispose();
});

it('does not add an invisible canopy for deciduous trees in winter', () => {
  const geometry = blockerGeometry(PROP_KINDS.maple, {
    id: 3,
    kind: 'maple',
    x: 0,
    z: 0,
    rotationY: 0,
    scale: 1,
  });
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  mesh.updateMatrixWorld();
  const ray = new THREE.Raycaster(new THREE.Vector3(2, 5, 10), new THREE.Vector3(0, 0, -1));
  expect(ray.intersectObject(mesh)).toHaveLength(0);
  geometry.dispose();
  mesh.material.dispose();
});
