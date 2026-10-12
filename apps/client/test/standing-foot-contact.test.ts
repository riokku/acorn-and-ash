import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';

import { StandingFootContact, type FootGroundHeight } from '../src/scene/standing-foot-contact';

function rig(scale = 1, yaw = 0) {
  const group = new THREE.Group();
  const root = new THREE.Group();
  root.scale.setScalar(scale);
  root.rotation.y = yaw;
  group.add(root);
  const hips = new THREE.Bone();
  hips.name = 'hips';
  hips.position.y = 0.8;
  root.add(hips);
  const feet: THREE.Bone[] = [];
  for (const [side, x] of [
    ['l', 0.18],
    ['r', -0.18],
  ] as const) {
    const upper = new THREE.Bone();
    upper.name = `upperleg${side}`;
    upper.position.x = x;
    const lower = new THREE.Bone();
    lower.name = `lowerleg${side}`;
    lower.position.y = -0.38;
    const foot = new THREE.Bone();
    foot.name = `foot${side}`;
    foot.position.y = -0.38;
    hips.add(upper);
    upper.add(lower);
    lower.add(foot);
    feet.push(foot);
  }
  const contact = StandingFootContact.forRig(root, group)!;
  const pose = () => feet.map((foot) => foot.getWorldPosition(new THREE.Vector3()));
  function settle(ground: FootGroundHeight, frames = 120, weight = 1) {
    for (let frame = 0; frame < frames; frame++) {
      contact.restore();
      contact.apply(1 / 60, ground, weight);
    }
  }
  return { group, root, hips, feet, contact, pose, settle };
}

describe('standing foot contact', () => {
  it.each([0, Math.PI / 2, Math.PI])('plants both feet on a slope at facing %s', (yaw) => {
    const model = rig(1, yaw);
    const ground: FootGroundHeight = (x, z) => 0.3 * x + 0.2 * z;
    model.settle(ground);
    for (const foot of model.pose())
      expect(Math.abs(foot.y - ground(foot.x, foot.z, 0) - 0.04)).toBeLessThan(0.0015);
    expect(model.hips.position.y).toBeLessThan(0.8);
  });

  it('keeps the authored flat-ground pose unchanged', () => {
    const model = rig();
    const original = model.pose();
    model.settle(() => 0);
    model
      .pose()
      .forEach((foot, index) => expect(foot.distanceTo(original[index]!)).toBeLessThan(1e-8));
    expect(model.hips.position.y).toBe(0.8);
  });

  it('uses world metres even when the imported rig is scaled and flipped', () => {
    const model = rig(0.6, Math.PI);
    model.group.position.set(10, 2, -10);
    const ground: FootGroundHeight = (x) => 2 + 0.3 * (x - 10);
    model.settle(ground);
    for (const foot of model.pose())
      expect(foot.y - ground(foot.x, foot.z, 2)).toBeCloseTo(0.024, 3);
  });

  it('restores the animation pose without accumulating bone corrections over time', () => {
    const model = rig();
    const original = model.pose();
    model.settle((x) => x * 0.4, 600);
    model.contact.restore();
    expect(model.hips.position.y).toBe(0.8);
    model
      .pose()
      .forEach((foot, index) => expect(foot.distanceTo(original[index]!)).toBeLessThan(1e-8));
    for (const foot of model.feet)
      expect(foot.quaternion.equals(new THREE.Quaternion())).toBe(true);
  });

  it('leaves jumps, movement and seated poses untouched when their contact weight is zero', () => {
    const model = rig();
    const original = model.pose();
    model.settle((x) => x * 0.3);
    model.contact.restore();
    model.contact.apply(1 / 60, (x) => x * 0.3, 0);
    model
      .pose()
      .forEach((foot, index) => expect(foot.distanceTo(original[index]!)).toBeLessThan(1e-8));
  });

  it('does not stretch a leg across a cliff or dug opening', () => {
    const model = rig();
    const original = model.pose();
    model.settle((x) => (x < -0.1 ? -2 : 0));
    model
      .pose()
      .forEach((foot, index) => expect(foot.distanceTo(original[index]!)).toBeLessThan(1e-8));
  });

  it('ignores unavailable or invalid terrain samples', () => {
    const model = rig();
    const original = model.pose();
    model.contact.apply(1 / 60, undefined, 1);
    model.settle(() => NaN);
    model
      .pose()
      .forEach((foot, index) => expect(foot.distanceTo(original[index]!)).toBeLessThan(1e-8));
    expect(StandingFootContact.forRig(new THREE.Group())).toBeNull();
  });

  it('tilts soles towards the slope with a bounded angle', () => {
    const model = rig();
    model.settle((_x, z) => z * 0.3);
    for (const foot of model.feet) {
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(
        foot.getWorldQuaternion(new THREE.Quaternion()),
      );
      expect(up.angleTo(new THREE.Vector3(0, 1, -0.3).normalize())).toBeLessThan(1e-6);
    }
    const steep = rig();
    steep.settle((_x, z) => z * 4);
    for (const foot of steep.feet) {
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(
        foot.getWorldQuaternion(new THREE.Quaternion()),
      );
      expect(up.angleTo(new THREE.Vector3(0, 1, 0))).toBeLessThanOrEqual(Math.PI / 6 + 1e-6);
    }
  });
});
