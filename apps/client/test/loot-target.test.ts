import * as THREE from 'three/webgpu';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { lootUnderCursor, lootUnderRay, type LootTarget } from '../src/input/loot-target';

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

it('blocks loot behind the visible ground but allows it through an excavated opening', () => {
  const target = loot(4, 0);
  const geometry = new THREE.PlaneGeometry(5, 5);
  const ground = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  ground.position.z = 2;
  meshes.push(ground);
  expect(lootUnderRay(ray(), [target], [ground])).toBeNull();
  const indices = geometry.getIndex()!;
  for (let i = 0; i < indices.count; i++) indices.setX(i, 0);
  expect(lootUnderRay(ray(), [target], [ground])).toBe(target);
});

describe('cursor tolerance for thin loot', () => {
  function view() {
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const item = loot(40, 0);
    (item.object as THREE.Mesh).scale.x = 0.025;
    return { camera, item, viewport: { width: 800, height: 800 }, caster: new THREE.Raycaster() };
  }
  it('keeps a thin visible item selectable a few CSS pixels from its center', () => {
    const { camera, item, viewport, caster } = view();
    expect(lootUnderCursor(caster, { x: 403, y: 400 }, viewport, camera, [item], [])).toBe(item);
    expect(lootUnderRay(caster, [item], [])).toBeNull(); // The actual pointer ray was restored.
    expect(lootUnderCursor(caster, { x: 410, y: 400 }, viewport, camera, [item], [])).toBeNull();
  });
  it('always prefers the object directly under the cursor over an offset candidate', () => {
    const { camera, item, viewport, caster } = view();
    const direct = loot(41, 0);
    direct.object.position.x = 0.05;
    (direct.object as THREE.Mesh).scale.x = 0.025;
    const projected = new THREE.Vector3(0.05, 0, 0).project(camera);
    expect(
      lootUnderCursor(
        caster,
        { x: (projected.x + 1) * 400, y: 400 },
        viewport,
        camera,
        [item, direct],
        [],
      ),
    ).toBe(direct);
  });
  it('never enlarges through scenery or invisible parents', () => {
    const { camera, item, viewport, caster } = view();
    const blocker = box(2);
    expect(
      lootUnderCursor(caster, { x: 403, y: 400 }, viewport, camera, [item], [blocker]),
    ).toBeNull();
    const parent = new THREE.Group();
    parent.visible = false;
    parent.add(item.object);
    expect(lootUnderCursor(caster, { x: 403, y: 400 }, viewport, camera, [item], [])).toBeNull();
  });
});

it('updates moved targets and blockers once per pointer query while preserving every occlusion probe', () => {
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const target = loot(11, 0),
    blocker = box(2);
  const targetUpdates = vi.spyOn(target.object, 'updateWorldMatrix');
  const blockerUpdates = vi.spyOn(blocker, 'updateWorldMatrix');
  const query = () =>
    lootUnderCursor(
      ray(),
      { x: 300, y: 300 },
      { width: 600, height: 600 },
      camera,
      [target],
      [blocker],
    );
  expect(query()).toBeNull();
  expect(targetUpdates).toHaveBeenCalledTimes(1);
  expect(blockerUpdates).toHaveBeenCalledTimes(1);
  blocker.position.x = 5;
  expect(query()).toBe(target);
  expect(targetUpdates).toHaveBeenCalledTimes(2);
  target.object.position.x = 5;
  expect(query()).toBeNull();
  expect(targetUpdates).toHaveBeenCalledTimes(3);
  targetUpdates.mockRestore();
  blockerUpdates.mockRestore();
});

it('preserves candidate priority when a visible child belongs to overlapping target roots', () => {
  const child = loot(12, 0);
  const group = new THREE.Group();
  group.add(child.object);
  const parent = { ...child, request: { kind: 'pile' as const, id: 13 }, object: group };
  expect(lootUnderRay(ray(), [parent, child], [])).toBe(parent);
  expect(lootUnderRay(ray(), [child, parent], [])).toBe(child);
});

it('retains nearly coincident hover targets but releases removed, hidden or clearly farther items', () => {
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const near = loot(71, 0),
    previous = loot(72, -0.02),
    caster = new THREE.Raycaster();
  const query = (targets = [near, previous], blockers: THREE.Object3D[] = []) =>
    lootUnderCursor(
      caster,
      { x: 400, y: 400 },
      { width: 800, height: 800 },
      camera,
      targets,
      blockers,
      previous.request,
    );
  expect(query()).toBe(previous);
  expect(query([previous, near])).toBe(previous);
  expect(query([near])).toBe(near);
  previous.object.visible = false;
  expect(query()).toBe(near);
  previous.object.visible = true;
  previous.object.position.z = -0.3;
  expect(query()).toBe(near);
  previous.object.position.z = -0.02;
  const blocker = box(2);
  blocker.visible = false;
  expect(query(undefined, [blocker])).toBeNull();
  expect(caster.far).toBe(Infinity);
  previous.object.position.x = 5;
  expect(query()).toBe(near);
});
