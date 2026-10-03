import {
  buildTestClearing,
  treeFallTimes,
  TREE_BREAK_SECONDS,
  TREE_FALL_SECONDS,
} from '@acorn/shared';
import * as THREE from 'three/webgpu';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { installBvhRaycasting } from '../src/scene/bvh';
import { buildClearingScene } from '../src/scene/clearing';

installBvhRaycasting();

function oneTree(scale?: number) {
  const clearing = buildTestClearing(123);
  const original = clearing.props.find((prop) => prop.kind === 'oak');
  if (original === undefined) throw new Error('missing spruce');
  const tree = scale === undefined ? original : { ...original, scale };
  const scene = buildClearingScene({ ...clearing, props: [tree], pickups: [] });
  const trunk = scene.group.children.find((child) => child instanceof THREE.InstancedMesh);
  if (!(trunk instanceof THREE.InstancedMesh)) throw new Error('missing trunk');
  const up = () => {
    const matrix = new THREE.Matrix4();
    trunk.getMatrixAt(0, matrix);
    return new THREE.Vector3().setFromMatrixColumn(matrix, 1);
  };
  return { scene, tree, up };
}

afterEach(() => vi.restoreAllMocks());

describe('a falling tree', () => {
  it('gives a mature crown its full fall before breaking into loot', () => {
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const { scene, tree, up } = oneTree(2);
    const timing = treeFallTimes(tree);
    scene.setTreeStates(
      new Map([[tree.id, { generation: 0, felled: true, fall: { yaw: 0, startedAtMs: 1000 } }]]),
      1000,
    );
    now = TREE_FALL_SECONDS * 1000;
    scene.update(1.4);
    expect(up().normalize().y).toBeGreaterThan(0);
    expect(scene.drainLandings()).toEqual([]);
    now = timing.fall * 1000 + 1;
    scene.update(0.4);
    expect(scene.drainLandings()).toEqual([{ tree, yaw: 0 }]);
    now = timing.break * 1000 + 1;
    scene.update(0.4);
    expect(up().length()).toBe(0);
    scene.dispose();
  });

  it.each([0, Math.PI / 2, Math.PI, -Math.PI / 2])(
    'tips along yaw %s, then disappears into its logs',
    (yaw) => {
      let now = 0;
      vi.spyOn(performance, 'now').mockImplementation(() => now);
      const { scene, tree, up } = oneTree();
      scene.setTreeStates(
        new Map([[tree.id, { generation: 0, felled: true, fall: { yaw, startedAtMs: 1000 } }]]),
        1000,
      );
      expect(up().normalize().y).toBeCloseTo(1);
      now = TREE_FALL_SECONDS * 500;
      scene.update(0.7);
      expect(up().normalize().y).toBeGreaterThan(0);
      expect(up().normalize().y).toBeLessThan(1);
      now = TREE_FALL_SECONDS * 1000;
      scene.update(0.7);
      expect(scene.drainLandings()).toEqual([{ tree, yaw }]);
      scene.update(0);
      expect(scene.drainLandings()).toEqual([]);
      const flat = up().normalize();
      expect(flat.y).toBeCloseTo(0);
      expect(flat.x).toBeCloseTo(Math.sin(yaw));
      expect(flat.z).toBeCloseTo(Math.cos(yaw));
      now = (TREE_FALL_SECONDS + 0.1) * 1000;
      scene.update(0.1);
      expect(up().normalize().y).toBeGreaterThan(0);
      expect(up().normalize().y).toBeLessThan(0.06);
      expect(scene.drainLandings()).toEqual([]);
      now = TREE_BREAK_SECONDS * 1000;
      scene.update(0.4);
      expect(up().length()).toBe(0);
      scene.dispose();
    },
  );

  it('joins a fall already in progress without restarting it, then restores a regrown tree', () => {
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const { scene, tree, up } = oneTree();
    const states = new Map([
      [tree.id, { generation: 0, felled: true, fall: { yaw: 0, startedAtMs: 1000 } }],
    ]);
    scene.setTreeStates(states, 2000);
    expect(up().normalize().y).toBeLessThan(1);
    now = 400;
    scene.setTreeStates(states, 2400);
    scene.update(0.4);
    expect(up().normalize().y).toBeCloseTo(0);
    now = 800;
    scene.update(0.4);
    expect(up().length()).toBe(0);
    scene.setTreeStates(new Map([[tree.id, { generation: 1, felled: false }]]));
    expect(up().normalize().y).toBeCloseTo(1);
    scene.dispose();
  });

  it('does not replay an old fall when joining after the logs have landed', () => {
    const { scene, tree, up } = oneTree();
    scene.setTreeStates(
      new Map([[tree.id, { generation: 0, felled: true, fall: { yaw: 0, startedAtMs: 1000 } }]]),
      10_000,
    );
    expect(up().length()).toBe(0);
    expect(scene.drainLandings()).toEqual([]);
    scene.dispose();
  });
});
