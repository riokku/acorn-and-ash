import * as THREE from 'three/webgpu';

import { ArmReach, turnInWorld } from './arm-reach';

export type FootGroundHeight = (x: number, z: number, referenceY: number) => number;

const MAX_HEIGHT_CHANGE = 0.18;
const MAX_PELVIS_DROP = 0.12;
const NORMAL_SAMPLE = 0.08;
const MAX_TILT = Math.PI / 6;
const FOLLOW = 14;
const UP = new THREE.Vector3(0, 1, 0);

interface Leg {
  readonly upper: THREE.Object3D;
  readonly lower: THREE.Object3D;
  readonly foot: THREE.Object3D;
  /** The same two-bone solve as an arm, with a forward knee pole. */
  readonly reach: ArmReach;
  readonly target: THREE.Vector3;
  readonly normal: THREE.Vector3;
  readonly footTurn: THREE.Quaternion;
  height: number;
}

/** Small, reversible pose corrections for idle feet on gentle terrain. */
export class StandingFootContact {
  private readonly saved = new Map<
    THREE.Object3D,
    { position: THREE.Vector3; turn: THREE.Quaternion; active: boolean }
  >();
  private readonly pole = new THREE.Vector3();
  private readonly offset = new THREE.Vector3();
  private readonly parentTurn = new THREE.Quaternion();
  private readonly tilt = new THREE.Quaternion();
  private readonly identity = new THREE.Quaternion();
  private readonly inverse = new THREE.Matrix4();
  private readonly origin = new THREE.Vector3();
  private pelvisDrop = 0;

  private constructor(
    private readonly root: THREE.Object3D,
    private readonly hips: THREE.Object3D,
    private readonly footing: THREE.Object3D,
    private readonly legs: readonly Leg[],
  ) {}

  static forRig(root: THREE.Object3D, footing: THREE.Object3D = root): StandingFootContact | null {
    const hips = root.getObjectByName('hips');
    const legs: Leg[] = [];
    for (const side of ['l', 'r']) {
      const upper = root.getObjectByName(`upperleg${side}`);
      const lower = root.getObjectByName(`lowerleg${side}`);
      const foot = root.getObjectByName(`foot${side}`);
      if (!upper || !lower || !foot) return null;
      legs.push({
        upper,
        lower,
        foot,
        reach: new ArmReach(upper, lower, foot),
        target: new THREE.Vector3(),
        normal: new THREE.Vector3(),
        footTurn: new THREE.Quaternion(),
        height: 0,
      });
    }
    return hips ? new StandingFootContact(root, hips, footing, legs) : null;
  }

  /** Call before the mixer: never feed yesterday's correction into today's pose. */
  restore(): void {
    for (const [bone, pose] of this.saved) {
      if (!pose.active) continue;
      bone.position.copy(pose.position);
      bone.quaternion.copy(pose.turn);
      pose.active = false;
    }
  }

  apply(deltaSeconds: number, ground: FootGroundHeight | undefined, weight: number): void {
    if (!ground || weight <= 0.001) {
      this.pelvisDrop = 0;
      for (const leg of this.legs) leg.height = 0;
      return;
    }
    this.root.updateWorldMatrix(true, true);
    this.footing.getWorldPosition(this.offset);
    const centerY = ground(this.offset.x, this.offset.z, this.offset.y);
    const heights: number[] = [];
    for (const leg of this.legs) {
      leg.foot.getWorldPosition(leg.target);
      leg.foot.getWorldQuaternion(leg.footTurn);
      const { x, z } = leg.target;
      const y = ground(x, z, centerY);
      const dx = ground(x + NORMAL_SAMPLE, z, centerY) - ground(x - NORMAL_SAMPLE, z, centerY);
      const dz = ground(x, z + NORMAL_SAMPLE, centerY) - ground(x, z - NORMAL_SAMPLE, centerY);
      // A ledge or dug opening must not stretch the character to reach a distant floor.
      if (
        ![centerY, y, dx, dz].every(Number.isFinite) ||
        Math.abs(y - centerY) > MAX_HEIGHT_CHANGE
      ) {
        this.pelvisDrop = 0;
        for (const other of this.legs) other.height = 0;
        return;
      }
      heights.push(y - centerY);
      leg.normal.set(-dx / (2 * NORMAL_SAMPLE), 1, -dz / (2 * NORMAL_SAMPLE)).normalize();
    }
    if (
      heights.every((height) => Math.abs(height) < 1e-6) &&
      this.legs.every((leg) => Math.abs(leg.height) < 1e-6 && leg.normal.dot(UP) > 0.999999) &&
      Math.abs(this.pelvisDrop) < 1e-6
    )
      return;
    const follow = 1 - Math.exp(-FOLLOW * Math.max(0, deltaSeconds));
    const drop = Math.max(-MAX_PELVIS_DROP, Math.min(0, ...heights));
    this.pelvisDrop += (drop - this.pelvisDrop) * follow;
    this.remember(this.hips);
    // Move the pelvis in world Y, regardless of the rig's imported axes or scale.
    this.offset.set(0, this.pelvisDrop * weight, 0);
    if (this.hips.parent) {
      this.inverse.copy(this.hips.parent.matrixWorld).invert();
      this.origin.set(0, 0, 0).applyMatrix4(this.inverse);
      this.offset.applyMatrix4(this.inverse).sub(this.origin);
    }
    this.hips.position.add(this.offset);
    this.root.updateWorldMatrix(true, true);
    this.root.localToWorld(this.pole.set(0, 0, 2));
    this.legs.forEach((leg, index) => {
      leg.height += ((heights[index] ?? 0) - leg.height) * follow;
      leg.target.y += leg.height * weight;
      this.remember(leg.upper);
      this.remember(leg.lower);
      this.remember(leg.foot);
      leg.reach.reach(leg.target, this.pole, weight);
      // Keep the animated foot's world orientation, then add a restrained slope tilt.
      this.tilt.setFromUnitVectors(UP, leg.normal);
      const angle = UP.angleTo(leg.normal);
      if (angle > MAX_TILT) this.tilt.slerp(this.identity, 1 - MAX_TILT / angle);
      this.tilt.slerp(this.identity, 1 - weight);
      if (leg.foot.parent) {
        leg.foot.parent.getWorldQuaternion(this.parentTurn);
        leg.foot.quaternion.copy(this.parentTurn.invert().multiply(leg.footTurn));
      }
      turnInWorld(leg.foot, this.tilt);
    });
  }

  private remember(bone: THREE.Object3D): void {
    const pose = this.saved.get(bone);
    if (pose) {
      pose.position.copy(bone.position);
      pose.turn.copy(bone.quaternion);
      pose.active = true;
    } else {
      this.saved.set(bone, {
        position: bone.position.clone(),
        turn: bone.quaternion.clone(),
        active: true,
      });
    }
  }
}
