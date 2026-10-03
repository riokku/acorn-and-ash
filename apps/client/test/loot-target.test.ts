import * as THREE from 'three/webgpu';
import { afterEach, describe, expect, it } from 'vitest';
import { lootUnderRay, type LootTarget } from '../src/input/loot-target';

const meshes: THREE.Mesh[] = [];
function box(z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  mesh.position.z = z;
  meshes.push(mesh);
  return mesh;
}
function loot(id: number, z: number): LootTarget {
  return { request: { kind: 'pile', id }, item: 'log', count: 3, object: box(z), x: 0, z };
}
function ray(): THREE.Raycaster {
  return new THREE.Raycaster(new THREE.Vector3(0, 0, 5), new THREE.Vector3(0, 0, -1));
}
afterEach(() => {
  for (const mesh of meshes.splice(0)) {
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  }
});

describe('loot under the cursor', () => {
  it('selects the first visible object along the ray, regardless of list order', () => {
    const near = loot(1, 2);
    const far = loot(2, 0);
    expect(lootUnderRay(ray(), [far, near], [])).toBe(near);
  });
  it('ignores loot hidden by a parent or a depleted piece', () => {
    const hidden = loot(1, 2);
    const visible = loot(2, 0);
    const parent = new THREE.Group();
    parent.visible = false;
    parent.add(hidden.object);
    expect(lootUnderRay(ray(), [hidden, visible], [])).toBe(visible);
    visible.object.visible = false;
    expect(lootUnderRay(ray(), [hidden, visible], [])).toBeNull();
  });
  it('blocks loot behind a solid collision proxy even though that proxy is invisible', () => {
    const target = loot(1, 0);
    const blocker = box(2);
    blocker.visible = false;
    expect(lootUnderRay(ray(), [target], [blocker])).toBeNull();
  });
  it('ignores scenery behind the loot and restores the ray range', () => {
    const target = loot(1, 2);
    const blocker = box(0);
    const cursor = ray();
    cursor.far = 20;
    expect(lootUnderRay(cursor, [target], [blocker])).toBe(target);
    expect(cursor.far).toBe(20);
  });
  it('finds loot nested inside a model group', () => {
    const target = loot(1, 0);
    const group = new THREE.Group();
    group.add(target.object);
    const nested = { ...target, object: group };
    expect(lootUnderRay(ray(), [nested], [])).toBe(nested);
  });
});
