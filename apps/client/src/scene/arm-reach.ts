import * as THREE from 'three/webgpu';

/**
 * Bends an arm so its hand reaches a point, over whatever pose the animation
 * already gave it: the shoulder turns the upper arm, the elbow the forearm,
 * and the wrist and hand ride along as they were. Used where the pack has
 * no clip that gets a hand where it needs to be - food up to the mouth.
 */
export class ArmReach {
  private readonly shoulder = new THREE.Vector3();
  private readonly elbow = new THREE.Vector3();
  private readonly end = new THREE.Vector3();
  private readonly along = new THREE.Vector3();
  private readonly side = new THREE.Vector3();
  private readonly wantedElbow = new THREE.Vector3();
  private readonly wantedEnd = new THREE.Vector3();
  private readonly upperBefore = new THREE.Quaternion();
  private readonly lowerBefore = new THREE.Quaternion();
  private readonly solved = new THREE.Quaternion();

  /**
   * `upper` is the upper arm's bone, `lower` the forearm's, and `hand` the
   * point that is to reach - somewhere below the forearm, however far down.
   */
  constructor(
    private readonly upper: THREE.Object3D,
    private readonly lower: THREE.Object3D,
    private readonly hand: THREE.Object3D,
  ) {}

  /**
   * Reach for `target`, the elbow bending out towards `pole`, both in the
   * world. `weight` fades it in over the pose already there: 0 leaves the
   * arm be, 1 reaches all the way. Too far to reach, the arm points at it.
   */
  reach(target: THREE.Vector3, pole: THREE.Vector3, weight: number): void {
    if (weight <= 0) return;
    this.upper.updateWorldMatrix(true, true);
    this.shoulder.setFromMatrixPosition(this.upper.matrixWorld);
    this.elbow.setFromMatrixPosition(this.lower.matrixWorld);
    this.end.setFromMatrixPosition(this.hand.matrixWorld);
    const upperLength = this.shoulder.distanceTo(this.elbow);
    const lowerLength = this.elbow.distanceTo(this.end);
    this.along.subVectors(target, this.shoulder);
    const distance = clamp(
      this.along.length(),
      Math.abs(upperLength - lowerLength) + 1e-4,
      (upperLength + lowerLength) * 0.999,
    );
    this.along.normalize();

    // The elbow sits where both lengths meet, out on the pole's side.
    const toElbow =
      (upperLength * upperLength - lowerLength * lowerLength + distance * distance) /
      (2 * distance);
    const outward = Math.sqrt(Math.max(0, upperLength * upperLength - toElbow * toElbow));
    this.side.subVectors(pole, this.shoulder);
    this.side.addScaledVector(this.along, -this.side.dot(this.along));
    if (this.side.lengthSq() < 1e-10) this.side.set(0, -1, 0).cross(this.along);
    this.side.normalize();
    this.wantedElbow
      .copy(this.shoulder)
      .addScaledVector(this.along, toElbow)
      .addScaledVector(this.side, outward);
    this.wantedEnd.copy(this.shoulder).addScaledVector(this.along, distance);

    this.upperBefore.copy(this.upper.quaternion);
    this.lowerBefore.copy(this.lower.quaternion);
    turnToward(this.upper, this.shoulder, this.elbow, this.wantedElbow);
    this.upper.updateWorldMatrix(false, true);
    this.elbow.setFromMatrixPosition(this.lower.matrixWorld);
    this.end.setFromMatrixPosition(this.hand.matrixWorld);
    turnToward(this.lower, this.elbow, this.end, this.wantedEnd);

    if (weight < 1) {
      blendFrom(this.upper, this.upperBefore, weight, this.solved);
      blendFrom(this.lower, this.lowerBefore, weight, this.solved);
    }
    this.upper.updateWorldMatrix(false, true);
  }
}

const turn = new THREE.Quaternion();
const parentTurn = new THREE.Quaternion();
const ownTurn = new THREE.Quaternion();
const from = new THREE.Vector3();
const to = new THREE.Vector3();

/**
 * Turn `bone` about its own origin, so a point it carries along at `carried`
 * swings round to lie the same way from `origin` as `wanted` does.
 */
function turnToward(
  bone: THREE.Object3D,
  origin: THREE.Vector3,
  carried: THREE.Vector3,
  wanted: THREE.Vector3,
): void {
  from.subVectors(carried, origin).normalize();
  to.subVectors(wanted, origin).normalize();
  turn.setFromUnitVectors(from, to);
  turnInWorld(bone, turn);
}

/**
 * Turn `bone` by `worldTurn`, a turn given the world's way round rather than
 * its own: a nod forward is about the character's own side-to-side, whichever
 * way the bone itself happens to lie.
 */
export function turnInWorld(bone: THREE.Object3D, worldTurn: THREE.Quaternion): void {
  if (bone.parent === null) {
    bone.quaternion.premultiply(worldTurn);
    return;
  }
  bone.parent.getWorldQuaternion(parentTurn);
  // parent⁻¹ · turn · parent: the same turn, in the frame the bone's own
  // rotation is kept in.
  ownTurn.copy(parentTurn).invert().multiply(worldTurn).multiply(parentTurn);
  bone.quaternion.premultiply(ownTurn);
}

function blendFrom(
  bone: THREE.Object3D,
  before: THREE.Quaternion,
  weight: number,
  scratch: THREE.Quaternion,
): void {
  scratch.copy(bone.quaternion);
  bone.quaternion.slerpQuaternions(before, scratch, weight);
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}
