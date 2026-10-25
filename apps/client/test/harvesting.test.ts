import * as THREE from 'three/webgpu';
import { expect, it, vi } from 'vitest';
import { createGroundItems } from '../src/scene/ground-items';
import { HarvestingReach } from '../src/scene/harvesting-reach';

const patch = { id: 7, item: 'flower' as const, remaining: 3, x: 4, z: 5 };
const event = { netId: 1, item: patch.item, count: 1, x: patch.x, z: patch.z, depleted: false };
it.each([true, false])(
  'moves a removed plant toward the hand regardless of message ordering (%s)',
  (receiptFirst) => {
    const items = createGroundItems(() => 2);
    items.setGatherPatches([patch]);
    const old = items.target('patch', patch.id)!;
    const hand = (into: THREE.Vector3) => into.set(4, 2.7, 5);
    let contact: THREE.Vector3 | null = null;
    if (receiptFirst) contact = items.collect(event, hand);
    items.setGatherPatches([{ ...patch, remaining: 2 }]);
    if (!receiptFirst) contact = items.collect(event, hand);
    expect(contact!.y).toBeGreaterThan(2);
    expect(Math.abs(contact!.x - patch.x)).toBeLessThan(1);
    expect(items.target('patch', patch.id)).not.toBe(old);
    const piece = items.group.getObjectByName('picked-plant')!;
    const initial = piece.position.clone();
    for (let i = 0; i < 5; i++) items.update(0.1);
    expect(piece.position.distanceTo(hand(new THREE.Vector3()))).toBeLessThan(
      initial.distanceTo(hand(new THREE.Vector3())),
    );
    expect(piece.scale.length()).toBeGreaterThan(0);
    for (let i = 0; i < 3; i++) items.update(0.1);
    expect(items.group.getObjectByName('picked-plant')).toBeUndefined();
    items.dispose();
  },
);
it('owns temporary materials, never the source geometry, and clears on replacement or reduced motion', () => {
  const items = createGroundItems(() => 0);
  items.setGatherPatches([patch]);
  const mesh = items.target('patch', patch.id)!.children[0] as THREE.Mesh;
  const disposed = vi.spyOn(mesh.geometry, 'dispose');
  items.setGatherPatches([{ ...patch, remaining: 2 }]);
  const picked = items.group.getObjectByName('picked-plant')!.children[0] as THREE.Mesh;
  expect(picked.material).not.toBe(mesh.material);
  expect(picked.geometry).toBe(mesh.geometry);
  const ownDispose = vi.spyOn(picked.material as THREE.Material, 'dispose');
  items.update(0.01, true);
  expect(ownDispose).toHaveBeenCalledOnce();
  expect(disposed).not.toHaveBeenCalled();
  items.setGatherPatches([{ ...patch, remaining: 1 }]);
  items.setGatherPatches([]);
  expect(items.group.getObjectByName('picked-plant')).toBeUndefined();
  items.dispose();
});
it('does not animate initial counts, count increases or rocks as plucked plants', () => {
  const items = createGroundItems(() => 0);
  items.setGatherPatches([patch]);
  items.setGatherPatches([{ ...patch, remaining: 4 }]);
  items.setGatherPatches([{ ...patch, item: 'stone', remaining: 3 }]);
  items.setGatherPatches([{ ...patch, item: 'stone', remaining: 2 }]);
  expect(items.group.getObjectByName('picked-plant')).toBeUndefined();
  items.dispose();
});
it('reaches without moving the character root, restores the pose and yields to other actions', () => {
  const root = new THREE.Group(),
    upper = new THREE.Object3D(),
    lower = new THREE.Object3D(),
    hand = new THREE.Object3D();
  upper.name = 'upperarmr';
  lower.name = 'lowerarmr';
  hand.name = 'handslotr';
  upper.position.set(0, 1.2, 0);
  lower.position.y = hand.position.y = -0.3;
  root.add(upper);
  upper.add(lower);
  lower.add(hand);
  root.position.set(3, 1, 2);
  root.rotation.y = 0.7;
  const reach = HarvestingReach.forRig(root)!;
  const target = root.localToWorld(new THREE.Vector3(0.1, 0.9, 0.3));
  const before = hand.getWorldPosition(new THREE.Vector3());
  reach.start(target);
  reach.update(0.1, true);
  expect(hand.getWorldPosition(new THREE.Vector3()).distanceTo(target)).toBeLessThan(
    before.distanceTo(target),
  );
  expect(root.position.toArray()).toEqual([3, 1, 2]);
  reach.restore();
  expect(upper.quaternion.toArray()).toEqual([0, 0, 0, 1]);
  expect(lower.quaternion.toArray()).toEqual([0, 0, 0, 1]);
  reach.update(0.1, false);
  expect(reach.active).toBe(false);
  expect(HarvestingReach.forRig(new THREE.Group())).toBeNull();
});

it.each([true, false])(
  'keeps two players picking the same patch attached to their own piece (%s)',
  (receiptsFirst) => {
    const items = createGroundItems(() => 0);
    items.setGatherPatches([patch]);
    const firstHand = (into: THREE.Vector3) => into.set(4.7, 0.6, 5);
    const secondHand = (into: THREE.Vector3) => into.set(3.3, 0.6, 5);
    const receipts = () => {
      const first = items.collect(event, firstHand);
      const second = items.collect({ ...event, netId: 2 }, secondHand);
      expect(first).not.toBeNull();
      expect(second).not.toBeNull();
      expect(first!.distanceTo(second!)).toBeGreaterThan(0.05);
    };
    if (receiptsFirst) receipts();
    items.setGatherPatches([{ ...patch, remaining: 1 }]);
    if (!receiptsFirst) receipts();
    for (let i = 0; i < 6; i++) items.update(0.09);
    const pieces: THREE.Object3D[] = [];
    items.group.traverse((object) => {
      if (object.name === 'picked-plant') pieces.push(object);
    });
    expect(pieces).toHaveLength(2);
    expect(pieces[0]!.position.x).toBeCloseTo(4.7);
    expect(pieces[1]!.position.x).toBeCloseTo(3.3);
    items.dispose();
  },
);
