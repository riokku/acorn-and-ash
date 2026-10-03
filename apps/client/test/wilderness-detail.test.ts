import * as THREE from 'three/webgpu';
import { expect, it } from 'vitest';
import { buildTestClearing, createFlatTerrain } from '@acorn/shared';
import { installBvhRaycasting } from '../src/scene/bvh';
import { buildWildernessScene } from '../src/scene/wilderness';

installBvhRaycasting();

it('keeps each wilderness tree in exactly one detail level as the player moves', () => {
  const props = [10, 200].map((x, i) => ({
    id: i + 1,
    kind: 'pine' as const,
    x,
    z: 0,
    rotationY: 0,
    scale: 1,
  }));
  const scene = buildWildernessScene(
    { props, colliders: [], siteColliders: [] },
    createFlatTerrain(),
    buildTestClearing(1),
  );
  const meshes = scene.group.children.filter(
    (child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh,
  );
  scene.update(1, { x: 0, z: 0 });
  expect(meshes.map((m) => m.count)).toEqual([1, 1, 1, 1]);
  scene.update(1, { x: 100, z: 0 });
  expect(meshes.map((m) => m.count)).toEqual([0, 0, 2, 2]);
  scene.update(1, { x: 200, z: 0 });
  expect(meshes.map((m) => m.count)).toEqual([1, 1, 1, 1]);
  expect(meshes[0]!.boundingSphere!.center.x).toBeCloseTo(200);
  expect(meshes[2]!.boundingSphere!.center.x).toBeCloseTo(10);
  scene.dispose();
});
