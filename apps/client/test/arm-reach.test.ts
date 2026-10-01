import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';

import { ArmReach, turnInWorld } from '../src/scene/arm-reach';

/** A shoulder with an arm hanging straight down: 0.3 m upper arm, 0.3 m forearm and hand. */
function hangingArm(): {
  body: THREE.Object3D;
  upper: THREE.Object3D;
  lower: THREE.Object3D;
  hand: THREE.Object3D;
} {
  const body = new THREE.Object3D();
  // Turned and moved, so nothing only works lined up with the world.
  body.position.set(2, 1, -1);
  body.rotation.set(0.2, 1.1, 0);
  const upper = new THREE.Object3D();
  upper.position.set(0, 1.2, 0);
  const lower = new THREE.Object3D();
  lower.position.set(0, -0.3, 0);
  const hand = new THREE.Object3D();
  hand.position.set(0, -0.3, 0);
  body.add(upper);
  upper.add(lower);
  lower.add(hand);
  body.updateWorldMatrix(true, true);
  return { body, upper, lower, hand };
}

function worldPosition(object: THREE.Object3D): THREE.Vector3 {
  object.updateWorldMatrix(true, false);
  return new THREE.Vector3().setFromMatrixPosition(object.matrixWorld);
}

describe('reaching an arm to a point', () => {
  it('puts the hand right on a point within reach', () => {
    const { body, upper, lower, hand } = hangingArm();
    const target = body.localToWorld(new THREE.Vector3(0.1, 1.1, 0.35));
    const pole = body.localToWorld(new THREE.Vector3(-1, 0.8, 0));
    new ArmReach(upper, lower, hand).reach(target, pole, 1);
    expect(worldPosition(hand).distanceTo(target)).toBeLessThan(1e-4);
  });

  it('keeps both lengths of the arm as they were', () => {
    const { body, upper, lower, hand } = hangingArm();
    const target = body.localToWorld(new THREE.Vector3(0.2, 1.3, 0.3));
    new ArmReach(upper, lower, hand).reach(
      target,
      body.localToWorld(new THREE.Vector3(-1, 0, 0)),
      1,
    );
    expect(worldPosition(upper).distanceTo(worldPosition(lower))).toBeCloseTo(0.3, 4);
    expect(worldPosition(lower).distanceTo(worldPosition(hand))).toBeCloseTo(0.3, 4);
  });

  it('bends the elbow out towards the pole', () => {
    const { body, upper, lower, hand } = hangingArm();
    const target = body.localToWorld(new THREE.Vector3(0, 1.3, 0.3));
    const pole = body.localToWorld(new THREE.Vector3(-1, 1.2, 0));
    new ArmReach(upper, lower, hand).reach(target, pole, 1);
    const elbow = body.worldToLocal(worldPosition(lower));
    expect(elbow.x).toBeLessThan(-0.1);
  });

  it('points straight at a point too far to reach', () => {
    const { body, upper, lower, hand } = hangingArm();
    const target = body.localToWorld(new THREE.Vector3(0, 1.2, 3));
    new ArmReach(upper, lower, hand).reach(
      target,
      body.localToWorld(new THREE.Vector3(0, 0, 0)),
      1,
    );
    const reached = body.worldToLocal(worldPosition(hand));
    expect(reached.x).toBeCloseTo(0, 3);
    expect(reached.y).toBeCloseTo(1.2, 3);
    expect(reached.z).toBeCloseTo(0.6, 2);
  });

  it('leaves the arm be at no weight, and goes part way at some', () => {
    const { body, upper, lower, hand } = hangingArm();
    const before = worldPosition(hand);
    const target = body.localToWorld(new THREE.Vector3(0.1, 1.1, 0.35));
    const pole = body.localToWorld(new THREE.Vector3(-1, 0.8, 0));
    const reach = new ArmReach(upper, lower, hand);
    reach.reach(target, pole, 0);
    expect(worldPosition(hand).distanceTo(before)).toBeLessThan(1e-9);
    reach.reach(target, pole, 0.5);
    const halfway = worldPosition(hand);
    expect(halfway.distanceTo(before)).toBeGreaterThan(0.05);
    expect(halfway.distanceTo(target)).toBeGreaterThan(0.05);
  });
});

describe('turning a bone the world’s way round', () => {
  it('turns it by the same amount in the world, however its parent lies', () => {
    const { upper, lower } = hangingArm();
    const before = new THREE.Quaternion();
    lower.getWorldQuaternion(before);
    const quarter = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      Math.PI / 2,
    );
    turnInWorld(lower, quarter);
    upper.updateWorldMatrix(false, true);
    const after = new THREE.Quaternion();
    lower.getWorldQuaternion(after);
    const expected = quarter.clone().multiply(before);
    expect(Math.abs(after.dot(expected))).toBeCloseTo(1, 6);
  });
});
