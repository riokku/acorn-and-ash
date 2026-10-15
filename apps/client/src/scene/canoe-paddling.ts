import * as THREE from 'three/webgpu';
import { BOAT_ROW_SPEED } from '@acorn/shared';
import { ArmReach } from './arm-reach';
import { createCanoePaddle } from './rowboat';

/** Distance from the lower shaft grip to the top handle on the existing paddle. */
const GRIP_SPAN = 0.43;
const UP = new THREE.Vector3(0, 1, 0);

/** A two-handed stroke on the existing rig, with the paddle parented to its lower hand. */
export class CanoePaddling {
  readonly paddle = createCanoePaddle();
  private readonly rightArm: ArmReach;
  private readonly leftArm: ArmReach;
  private readonly saved: THREE.Quaternion[];
  private changed = false;
  private phase = 0;
  private effort = 0;
  private readonly lower = new THREE.Vector3();
  private readonly upper = new THREE.Vector3();
  private readonly axis = new THREE.Vector3();
  private readonly pole = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly across = new THREE.Vector3();
  private readonly basis = new THREE.Matrix4();
  private readonly feather = new THREE.Quaternion();
  private readonly wristTurn = new THREE.Quaternion();
  private readonly paddleTurn = new THREE.Quaternion();

  static forRig(root: THREE.Object3D): CanoePaddling | null {
    const names = ['upperarmr', 'lowerarmr', 'handslotr', 'upperarml', 'lowerarml', 'handslotl'];
    const bones = names.map((name) => root.getObjectByName(name));
    if (bones.some((bone) => bone === undefined)) return null;
    return new CanoePaddling(
      root,
      bones as [
        THREE.Object3D,
        THREE.Object3D,
        THREE.Object3D,
        THREE.Object3D,
        THREE.Object3D,
        THREE.Object3D,
      ],
    );
  }

  private constructor(
    private readonly root: THREE.Object3D,
    private readonly bones: readonly [
      THREE.Object3D,
      THREE.Object3D,
      THREE.Object3D,
      THREE.Object3D,
      THREE.Object3D,
      THREE.Object3D,
    ],
  ) {
    this.rightArm = new ArmReach(bones[0], bones[1], bones[2]);
    this.leftArm = new ArmReach(bones[3], bones[4], bones[5]);
    this.saved = bones.map((bone) => bone.quaternion.clone());
    bones[2].add(this.paddle.group);
    this.paddle.group.visible = false;
  }

  /** Undo the previous solve before the animation mixer samples the next base pose. */
  restore(): void {
    if (this.changed) this.bones.forEach((bone, index) => bone.quaternion.copy(this.saved[index]!));
    this.changed = false;
    this.paddle.group.visible = false;
  }

  /** `phase` freezes a gallery/inspection pose; normal play integrates one continuous stroke clock. */
  update(delta: number, speed: number, weight: number, phase?: number): void {
    if (weight <= 0) return;
    this.bones.forEach((bone, index) => this.saved[index]!.copy(bone.quaternion));
    this.changed = true;
    const desired = speed < 0.4 ? 0 : Math.min(1.5, speed / BOAT_ROW_SPEED);
    if (phase === undefined) {
      const decay = Math.exp(-8 * delta);
      const integratedEffort = desired * delta + ((this.effort - desired) * (1 - decay)) / 8;
      this.effort = desired + (this.effort - desired) * decay;
      this.phase = (this.phase + integratedEffort * 0.85) % 1;
    } else {
      this.effort = desired;
      this.phase = phase;
    }
    const turn = this.phase * Math.PI * 2;
    const recovery = Math.max(0, -Math.sin(turn));
    const pulling = Math.min(1, this.effort);
    // In the model's own metres, facing +Z. Catch ahead, draw back, then
    // lift and feather the blade clear for recovery. Coast with it raised.
    this.lower.set(-0.45 + 0.08 * recovery, 0.7 + 0.12 * recovery, -0.18 + 0.08 * Math.cos(turn));
    this.lower.lerp(this.pole.set(-0.3, 0.78, -0.1), 1 - pulling);
    this.axis.set(0.55 + 0.1 * recovery, 0.4 - 0.18 * recovery, 0.08 - 0.03 * Math.cos(turn));
    this.axis.lerp(this.pole.set(0.6, 0.25, 0.12), 1 - pulling).normalize();
    this.root.updateWorldMatrix(true, false);
    this.root.getWorldScale(this.scale);
    this.root.localToWorld(this.lower);
    this.root.localToWorld(this.pole.set(-0.9, 0.9, -0.5));
    this.rightArm.reach(this.lower, this.pole, weight);
    // The upper grip follows the actual lower hand, including entry blends.
    this.bones[2].getWorldPosition(this.lower);
    this.axis.transformDirection(this.root.matrixWorld);
    this.upper.copy(this.lower).addScaledVector(this.axis, GRIP_SPAN);
    this.root.localToWorld(this.pole.set(0.6, 1.1, -0.55));
    this.leftArm.reach(this.upper, this.pole, weight);
    this.bones[2].getWorldQuaternion(this.wristTurn);
    // Keep the blade facing the bow through turns, then feather it about
    // its own shaft during recovery. A direction alone would leave its roll
    // tied to the world rather than the rider.
    this.forward.set(0, 0, 1).transformDirection(this.root.matrixWorld);
    this.across.crossVectors(this.axis, this.forward).normalize();
    this.forward.crossVectors(this.across, this.axis).normalize();
    this.paddleTurn.setFromRotationMatrix(
      this.basis.makeBasis(this.across, this.axis, this.forward),
    );
    this.feather.setFromAxisAngle(UP, Math.PI * 0.5 * Math.max(recovery, 1 - pulling));
    this.paddleTurn.multiply(this.feather);
    this.paddle.group.quaternion.copy(this.wristTurn).invert().multiply(this.paddleTurn);
    this.paddle.group.scale.setScalar(1 / this.scale.y);
    this.paddle.group.visible = true;
  }

  dispose(): void {
    this.restore();
    this.paddle.group.removeFromParent();
    this.paddle.dispose();
  }
}
