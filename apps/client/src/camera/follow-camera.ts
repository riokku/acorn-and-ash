import * as THREE from 'three/webgpu';

import { PLAYER_HEIGHT, clamp, type Vec3 } from '@acorn/shared';

/** How far behind the player the camera sits when nothing is in the way. */
const RESTING_DISTANCE = 6;
const MIN_DISTANCE = 1.1;
/** Where the camera looks: roughly the player's shoulders. */
const TARGET_HEIGHT = PLAYER_HEIGHT * 0.78;
const MIN_PITCH = -0.55;
const MAX_PITCH = 1.15;
/** How fast the camera closes the gap when it has been pushed in and released. */
const PULL_OUT_RATE = 6;
/** Keep the camera this far off whatever it bumped into. */
const BLOCKER_PADDING = 0.3;

export interface CameraLook {
  /** Which way the camera is pointing. Movement is relative to this. */
  yaw: number;
  pitch: number;
}

/**
 * The third-person follow camera.
 *
 * It orbits behind the player and pulls in when a tree gets between the two, so
 * the view never ends up inside a trunk.
 */
export class FollowCamera {
  readonly camera: THREE.PerspectiveCamera;
  readonly look: CameraLook = { yaw: 0, pitch: 0.32 };

  private currentDistance = RESTING_DISTANCE;
  private readonly target = new THREE.Vector3();
  private readonly desired = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();
  private readonly raycaster = new THREE.Raycaster();

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(58, aspect, 0.1, 400);
    this.raycaster.far = RESTING_DISTANCE;
    // three-mesh-bvh only needs the first hit, which is much faster.
    this.raycaster.firstHitOnly = true;
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /** Turn the camera in response to the mouse. */
  turn(deltaX: number, deltaY: number, sensitivity: number): void {
    this.look.yaw -= deltaX * sensitivity;
    this.look.pitch = clamp(this.look.pitch + deltaY * sensitivity, MIN_PITCH, MAX_PITCH);
  }

  update(playerPosition: Readonly<Vec3>, deltaSeconds: number, blockers: THREE.Object3D): void {
    this.target.set(playerPosition.x, playerPosition.y + TARGET_HEIGHT, playerPosition.z);

    // Yaw 0 puts the camera behind a player facing -Z.
    const cosPitch = Math.cos(this.look.pitch);
    this.direction.set(
      Math.sin(this.look.yaw) * cosPitch,
      Math.sin(this.look.pitch),
      Math.cos(this.look.yaw) * cosPitch,
    );

    const blocked = this.distanceToBlocker(blockers);
    if (blocked < this.currentDistance) {
      // Snap in immediately, so the view never ends up inside a tree.
      this.currentDistance = blocked;
    } else {
      // Ease back out once the way is clear again.
      const room = Math.min(blocked, RESTING_DISTANCE);
      this.currentDistance +=
        (room - this.currentDistance) * Math.min(1, PULL_OUT_RATE * deltaSeconds);
    }

    this.desired.copy(this.direction).multiplyScalar(this.currentDistance).add(this.target);
    this.camera.position.copy(this.desired);
    this.camera.lookAt(this.target);
  }

  /** How far the camera can go before it hits something. */
  private distanceToBlocker(blockers: THREE.Object3D): number {
    this.raycaster.set(this.target, this.direction);
    this.raycaster.far = RESTING_DISTANCE;
    const hits = this.raycaster.intersectObject(blockers, false);
    const nearest = hits[0];
    if (nearest === undefined) return RESTING_DISTANCE;
    return clamp(nearest.distance - BLOCKER_PADDING, MIN_DISTANCE, RESTING_DISTANCE);
  }
}
