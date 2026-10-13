import * as THREE from 'three/webgpu';
import { buildTestClearing, stumpFor, treeAtGeneration } from '@acorn/shared';
import { expect, it } from 'vitest';
import { installBvhRaycasting } from '../src/scene/bvh';
import { buildClearingScene } from '../src/scene/clearing';

installBvhRaycasting();

it('keeps newly felled clearing stumps visible from every direction after culling was cached', () => {
  const clearing = buildTestClearing(123);
  const source = clearing.props.find((prop) => prop.kind === 'oak')!;
  const trees = [
    { ...source, id: 1, x: 35, z: 35 },
    { ...source, id: 2, x: -35, z: -35 },
  ];
  const scene = buildClearingScene({ ...clearing, props: trees, pickups: [] });
  const stumpMeshes = scene.group.children
    .filter((child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh)
    .slice(-2);
  expect(stumpMeshes).toHaveLength(2);
  // The renderer initially caches the bounds of hidden spare stump slots.
  stumpMeshes.forEach((mesh) => mesh.computeBoundingSphere());
  const states = new Map([[1, { felled: true, generation: 0 }]]);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 12);
  const frustum = new THREE.Frustum();
  const matrix = new THREE.Matrix4();
  for (const [id, generation] of [
    [1, 0],
    [2, 0],
    [1, 1],
  ] as const) {
    if (id === 1 && generation === 1) {
      states.delete(1);
      scene.setTreeStates(states);
    }
    states.set(id, { felled: true, generation });
    scene.setTreeStates(states);
    scene.group.updateMatrixWorld(true);
    const tree = trees.find((tree) => tree.id === id)!;
    const stump = stumpFor(treeAtGeneration(clearing.seed, tree, generation));
    for (let step = 0; step < 8; step++) {
      const angle = (step * Math.PI) / 4;
      camera.position.set(tree.x + Math.sin(angle) * 4, 2, tree.z + Math.cos(angle) * 4);
      camera.lookAt(tree.x, 0.3, tree.z);
      camera.updateMatrixWorld(true);
      frustum.setFromProjectionMatrix(
        matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
      );
      for (const mesh of stumpMeshes) {
        expect(frustum.intersectsObject(mesh)).toBe(true);
        const index = trees.findIndex((tree) => tree.id === id);
        mesh.getMatrixAt(index, matrix);
        const worldBounds = mesh.geometry.boundingSphere!.clone().applyMatrix4(matrix);
        expect(mesh.boundingSphere!.containsPoint(worldBounds.center)).toBe(true);
        expect(worldBounds.radius).toBeGreaterThan(0);
        expect(matrix.elements[12]).toBeCloseTo(stump.x);
      }
    }
  }
  scene.dispose();
});
