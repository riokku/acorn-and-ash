import * as THREE from 'three/webgpu';
import { expect, it, vi } from 'vitest';
import {
  WILDERNESS_PROP_FIRST_ID,
  buildTestClearing,
  createFlatTerrain,
  treeFallTimes,
  treeAtGeneration,
} from '@acorn/shared';
import { installBvhRaycasting } from '../src/scene/bvh';
import { buildWildernessScene, type WildernessScene } from '../src/scene/wilderness';

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
    { props, colliders: [], indexById: new Map(), siteColliders: [] },
    createFlatTerrain(),
    buildTestClearing(1),
  );
  // The trees' own meshes come first: two near, two distant. Stumps follow, and stay empty.
  const meshes = scene.group.children
    .filter((child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh)
    .slice(0, 4);
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

function forestOfTwoPines() {
  const props = [10, 200].map((x, i) => ({
    id: WILDERNESS_PROP_FIRST_ID + i,
    kind: 'pine' as const,
    x,
    z: 0,
    rotationY: 0,
    scale: 1,
  }));
  const clearing = buildTestClearing(1);
  const scene = buildWildernessScene(
    { props, colliders: [], indexById: new Map(), siteColliders: [] },
    createFlatTerrain(),
    clearing,
  );
  const meshes = scene.group.children.filter(
    (child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh,
  );
  return { props, scene, meshes };
}

/** How tall what the camera feels is at `x`, or 0 where it feels nothing. */
function blockerHeightAt(scene: WildernessScene, x: number): number {
  let height = 0;
  for (const mesh of scene.cameraBlockers) {
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox!;
    if (box.min.x <= x && x <= box.max.x) height = Math.max(height, box.max.y);
  }
  return height;
}

it('draws a forest tree that has been chopped down as a stump, and the camera stops feeling its trunk', () => {
  const { props, scene, meshes } = forestOfTwoPines();
  scene.update(1, { x: 0, z: 0 });
  const trunkHeight = blockerHeightAt(scene, 10);
  expect(trunkHeight).toBeGreaterThan(2);

  scene.setTreeStates(new Map([[props[0]!.id, { generation: 0, felled: true }]]));
  scene.update(1, { x: 0, z: 0 });
  // The near pine is gone from the trees' meshes (one tree left, the far one) and a stump is out.
  expect(meshes.slice(0, 4).map((m) => m.count)).toEqual([0, 0, 1, 1]);
  expect(meshes.slice(4).some((m) => m.count === 1)).toBe(true);
  expect(blockerHeightAt(scene, 10)).toBeLessThan(1);
  // Nothing else was touched: the far pine is still felt.
  expect(blockerHeightAt(scene, 200)).toBeGreaterThan(2);

  // And back again once it has grown back.
  scene.setTreeStates(new Map([[props[0]!.id, { generation: 1, felled: false }]]));
  scene.update(1, { x: 0, z: 0 });
  expect(meshes.slice(0, 4).map((m) => m.count)).toEqual([1, 1, 1, 1]);
  expect(meshes.slice(4).every((m) => m.count === 0)).toBe(true);
  expect(blockerHeightAt(scene, 10)).toBeGreaterThan(2);
  scene.dispose();
});

it('lets a felled forest tree land with a thump the moment it hits the ground', () => {
  const { props, scene } = forestOfTwoPines();
  const now = 1_000_000;
  const began = performance.now();
  scene.setTreeStates(
    new Map([[props[0]!.id, { generation: 0, felled: true, fall: { yaw: 0, startedAtMs: now } }]]),
    now,
  );
  scene.update(0.1, { x: 0, z: 0 });
  expect(scene.drainLandings()).toEqual([]);

  // Just after it hits the ground, not before.
  const timing = treeFallTimes(props[0]!);
  const clock = vi.spyOn(performance, 'now').mockReturnValue(began + (timing.fall + 0.05) * 1000);
  scene.update(0.1, { x: 0, z: 0 });
  clock.mockRestore();
  const landings = scene.drainLandings();
  expect(landings).toHaveLength(1);
  expect(landings[0]!.tree.id).toBe(props[0]!.id);
  expect(scene.drainLandings()).toEqual([]);
  scene.dispose();
});

it('ignores a shake for a tree that is not in the forest', () => {
  const { scene } = forestOfTwoPines();
  expect(() => scene.shakeTree(5, 1, 0)).not.toThrow();
  scene.dispose();
});

it('does not rewrite or upload unchanged tree slots while walking within the same detail levels', () => {
  const { scene, meshes } = forestOfTwoPines();
  try {
    scene.update(1, { x: 0, z: 0 });
    const treeMeshes = meshes.slice(0, 4);
    const versions = treeMeshes.map((mesh) => mesh.instanceMatrix.version);
    const bounds = treeMeshes.map((mesh) => vi.spyOn(mesh, 'computeBoundingSphere'));
    const before = treeMeshes.map((mesh) => Array.from(mesh.instanceMatrix.array));
    scene.update(1, { x: 4.1, z: 0 });
    expect(treeMeshes.map((mesh) => mesh.instanceMatrix.version)).toEqual(versions);
    expect(treeMeshes.map((mesh) => Array.from(mesh.instanceMatrix.array))).toEqual(before);
    for (const check of bounds) expect(check).not.toHaveBeenCalled();
    // Crossing a real detail boundary must still change the packed geometry.
    scene.update(1, { x: 100, z: 0 });
    expect(treeMeshes.map((mesh) => mesh.count)).toEqual([0, 0, 2, 2]);
    expect(treeMeshes.some((mesh, index) => mesh.instanceMatrix.version > versions[index]!)).toBe(
      true,
    );
  } finally {
    scene.dispose();
  }
});

it('keeps soot with its forest tree when detail slots are repacked and when it falls', () => {
  let now = 0;
  const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
  const { props, scene, meshes } = forestOfTwoPines();
  const fire = {
    id: props[0]!.id,
    kind: 'tree' as const,
    x: 10,
    y: 0,
    z: 0,
    height: 14,
    radius: 1,
    startedAt: 1000,
    generation: 0,
    spread: true,
  };
  scene.setWildfire({ fires: [fire], lightning: null, now: 23_500 });
  scene.update(0, { x: 0, z: 0 });
  expect(meshes[0]!.geometry.getAttribute('treeBurn').getX(0)).toBeCloseTo(0.5, 1);
  scene.update(1, { x: 100, z: 0 });
  expect(meshes[2]!.geometry.getAttribute('treeBurn').getX(0)).toBeCloseTo(0.5, 1);
  expect(meshes[2]!.geometry.getAttribute('treeBurn').getX(1)).toBe(0);
  scene.setTreeStates(
    new Map([
      [
        fire.id,
        {
          generation: 0,
          felled: true,
          burned: true,
          fall: { yaw: 0, startedAtMs: 46_000 },
        },
      ],
    ]),
    46_000,
  );
  scene.setWildfire({ fires: [], lightning: null, now: 46_000 });
  scene.update(0, { x: 100, z: 0 });
  expect(meshes[2]!.geometry.getAttribute('treeBurn').getX(0)).toBe(1);
  for (const stump of meshes.slice(4))
    expect(stump.geometry.getAttribute('treeBurn').getX(0)).toBe(1);
  now = 3000;
  scene.update(0, { x: 100, z: 0 });
  // The settled tree gives up its old slot; its soot must not tint a different tree using it.
  scene.update(1, { x: 200, z: 0 });
  expect(meshes[0]!.count).toBe(1);
  expect(meshes[0]!.geometry.getAttribute('treeBurn').getX(0)).toBe(0);
  scene.dispose();
  clock.mockRestore();
});

it('keeps unaffected distant GPU batches unchanged when a nearby tree falls and settles', () => {
  let now = 0;
  const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
  const { props, scene, meshes } = forestOfTwoPines();
  try {
    scene.update(1, { x: 0, z: 0 });
    const distant = meshes.slice(2, 4);
    const versions = distant.map((mesh) => mesh.instanceMatrix.version);
    const tree = props[0]!;
    scene.setTreeStates(
      new Map([[tree.id, { generation: 0, felled: true, fall: { yaw: 0, startedAtMs: 1000 } }]]),
      1000,
    );
    scene.update(0.1, { x: 0, z: 0 });
    now = treeFallTimes(tree).break * 1000 + 1;
    scene.update(0.1, { x: 0, z: 0 });
    scene.update(0.1, { x: 0, z: 0 });
    expect(distant.map((mesh) => mesh.instanceMatrix.version)).toEqual(versions);
    expect(distant.map((mesh) => mesh.count)).toEqual([1, 1]);
  } finally {
    scene.dispose();
    clock.mockRestore();
  }
});

it('still updates a regrown tree when it keeps the same detail slot', () => {
  const { props, scene, meshes } = forestOfTwoPines();
  try {
    scene.update(1, { x: 0, z: 0 });
    scene.setTreeStates(new Map([[props[0]!.id, { generation: 1, felled: false }]]));
    scene.update(0.1, { x: 0, z: 0 });
    const matrix = new THREE.Matrix4();
    meshes[0]!.getMatrixAt(0, matrix);
    const scale = new THREE.Vector3().setFromMatrixColumn(matrix, 0).length();
    expect(scale).toBeCloseTo(treeAtGeneration(1, props[0]!, 1).scale);
  } finally {
    scene.dispose();
  }
});
