import * as THREE from 'three/webgpu';
import { ArmReach } from './arm-reach';
import { HARVEST_SECONDS } from './harvesting-motion';

/** A short, interruptible correction over the existing pickup clip. Never moves the player root. */
export class HarvestingReach {
  private age = HARVEST_SECONDS;
  private readonly point = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private readonly pole = new THREE.Vector3();
  private readonly upperBefore = new THREE.Quaternion();
  private readonly lowerBefore = new THREE.Quaternion();
  private corrected = false;
  private readonly arm: ArmReach;

  private constructor(
    private readonly root: THREE.Object3D,
    private readonly upper: THREE.Object3D,
    private readonly lower: THREE.Object3D,
    hand: THREE.Object3D,
  ) {
    this.arm = new ArmReach(upper, lower, hand);
  }
  static forRig(root: THREE.Object3D): HarvestingReach | null {
    const upper = root.getObjectByName('upperarmr');
    const lower = root.getObjectByName('lowerarmr');
    const hand = root.getObjectByName('handslotr');
    return upper && lower && hand ? new HarvestingReach(root, upper, lower, hand) : null;
  }
  get active(): boolean {
    return this.age < HARVEST_SECONDS;
  }
  start(point: THREE.Vector3): void {
    this.point.copy(point);
    this.age = 0;
  }
  cancel(): void {
    this.age = HARVEST_SECONDS;
  }
  restore(): void {
    if (!this.corrected) return;
    this.upper.quaternion.copy(this.upperBefore);
    this.lower.quaternion.copy(this.lowerBefore);
    this.corrected = false;
  }
  update(seconds: number, allowed: boolean): void {
    if (!allowed) this.cancel();
    this.age += Math.max(0, Math.min(seconds, 0.1));
    if (!this.active) return;
    this.root.updateWorldMatrix(true, true);
    this.target.copy(this.point);
    // Lift the hand back toward the body as the picked piece comes away.
    this.root.localToWorld(this.pole.set(-0.28, 1.05, 0.45));
    const lift = smooth((this.age - 0.18) / 0.28);
    this.target.lerp(this.pole, lift);
    this.root.localToWorld(this.pole.set(-0.9, 0.7, 0.3));
    const weight = smooth(this.age / 0.16) * (1 - smooth((this.age - 0.42) / 0.23));
    this.upperBefore.copy(this.upper.quaternion);
    this.lowerBefore.copy(this.lower.quaternion);
    this.corrected = true;
    this.arm.reach(this.target, this.pole, weight);
  }
}
function smooth(value: number): number {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}
