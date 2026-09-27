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
/** How quickly a nudge from the game tilts the camera, per second. */
const NUDGE_RATE = 4;
/**
 * How far up the player has to look, in one go, to wave a nudge away. Enough
 * to tell a deliberate look upwards from the wobble of a click.
 */
const NUDGE_CANCEL_PITCH = 0.02;
/** How fast a shake settles back to nothing, in strength per second. */
const SHAKE_DECAY_RATE = 9;
/** How far a shake at full strength can nudge the camera, in meters. */
const SHAKE_MAX_OFFSET = 0.12;

/**
 * Inside a home (see decision 0055) the camera looks into the room like a
 * dollhouse: from the door side, high and fairly steep, never swinging round
 * so far that the room turns side on. The walls it looks in through are cut
 * away rather than pulling the camera in.
 */
const ROOM_DISTANCE = 8.6;
const ROOM_YAW_LIMIT = 0.85;
const ROOM_MIN_PITCH = 0.6;
const ROOM_MAX_PITCH = 1.05;
/** How much of the way from you to the middle of the room the camera looks: keeps the whole room framed. */
const ROOM_FRAMING = 0.6;
const ROOM_CENTRE = { x: 0, y: 0.7, z: -0.3 };

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
  /** A pitch the game has asked the camera to ease towards, until the mouse moves. */
  private pitchNudge: number | null = null;
  /** 0 to 1: how hard the camera is currently shaking, decaying back to 0. */
  private shakeStrength = 0;
  private readonly target = new THREE.Vector3();
  private readonly desired = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();
  private readonly raycaster = new THREE.Raycaster();
  /** Inside a home, the look from outside to go back to on leaving; null outdoors. */
  private outdoorLook: CameraLook | null = null;

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

  /**
   * Ease the camera round to look at least this far down.
   *
   * Only a nudge: looking up with the mouse cancels it, so the camera never
   * fights the player for the view. Looking further down already, nothing
   * happens.
   */
  lookDownTo(pitch: number): void {
    if (this.look.pitch >= pitch) return;
    this.pitchNudge = clamp(pitch, MIN_PITCH, MAX_PITCH);
  }

  /**
   * A brief kick, for a swing or a hit landing. Stacks up to full strength
   * rather than resetting, so a flurry of hits reads as more than one would.
   */
  shake(strength: number): void {
    this.shakeStrength = Math.min(1, this.shakeStrength + strength);
  }

  /** Turn the camera in response to the mouse. */
  turn(deltaX: number, deltaY: number, sensitivity: number): void {
    // Moving the mouse up looks up; that is the player saying no thanks.
    if (deltaY * sensitivity < -NUDGE_CANCEL_PITCH) this.pitchNudge = null;
    this.look.yaw -= deltaX * sensitivity;
    this.look.pitch = clamp(this.look.pitch + deltaY * sensitivity, MIN_PITCH, MAX_PITCH);
    if (this.outdoorLook !== null) this.keepInRoomView();
  }

  /**
   * Step inside a home, or back out (see decision 0055). Going in looks into
   * the room from the door side; coming out puts the view back how it was.
   */
  setIndoors(indoors: boolean, facingYaw?: number): void {
    if (indoors && this.outdoorLook === null) {
      this.outdoorLook = { ...this.look };
      this.look.yaw = 0.2;
      this.look.pitch = 0.82;
      this.pitchNudge = null;
    } else if (!indoors && this.outdoorLook !== null) {
      // Out through the door, facing away from it: the camera swings round
      // behind them, so walking on carries them out into the world.
      if (facingYaw !== undefined) this.look.yaw = facingYaw;
      this.look.pitch = this.outdoorLook.pitch;
      this.outdoorLook = null;
      this.currentDistance = RESTING_DISTANCE;
    }
  }

  /** Whether the camera is inside a home right now. */
  get indoors(): boolean {
    return this.outdoorLook !== null;
  }

  private keepInRoomView(): void {
    this.look.yaw = clamp(this.look.yaw, -ROOM_YAW_LIMIT, ROOM_YAW_LIMIT);
    this.look.pitch = clamp(this.look.pitch, ROOM_MIN_PITCH, ROOM_MAX_PITCH);
  }

  update(
    playerPosition: Readonly<Vec3>,
    deltaSeconds: number,
    blockers: readonly THREE.Object3D[],
  ): void {
    this.target.set(playerPosition.x, playerPosition.y + TARGET_HEIGHT, playerPosition.z);
    if (this.outdoorLook !== null) {
      this.keepInRoomView();
      this.target.lerp(ROOM_CENTRE_VECTOR, ROOM_FRAMING);
    }

    if (this.pitchNudge !== null) {
      const remaining = this.pitchNudge - this.look.pitch;
      this.look.pitch += remaining * Math.min(1, NUDGE_RATE * deltaSeconds);
      if (Math.abs(remaining) < 0.01) this.pitchNudge = null;
    }

    // Yaw 0 puts the camera behind a player facing -Z.
    const cosPitch = Math.cos(this.look.pitch);
    this.direction.set(
      Math.sin(this.look.yaw) * cosPitch,
      Math.sin(this.look.pitch),
      Math.cos(this.look.yaw) * cosPitch,
    );

    const blocked = this.outdoorLook !== null ? ROOM_DISTANCE : this.distanceToBlocker(blockers);
    if (this.outdoorLook !== null) {
      this.currentDistance = ROOM_DISTANCE;
    } else if (blocked < this.currentDistance) {
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

    if (this.shakeStrength > 0) {
      const offset = this.shakeStrength * SHAKE_MAX_OFFSET;
      this.camera.position.x += (Math.random() * 2 - 1) * offset;
      this.camera.position.y += (Math.random() * 2 - 1) * offset;
      this.shakeStrength = Math.max(0, this.shakeStrength - SHAKE_DECAY_RATE * deltaSeconds);
    }
  }

  /** How far the camera can go before it hits something, across every blocker mesh. */
  private distanceToBlocker(blockers: readonly THREE.Object3D[]): number {
    this.raycaster.set(this.target, this.direction);
    this.raycaster.far = RESTING_DISTANCE;

    let nearestDistance: number | undefined;
    for (const blocker of blockers) {
      const hit = this.raycaster.intersectObject(blocker, false)[0];
      if (hit !== undefined && (nearestDistance === undefined || hit.distance < nearestDistance)) {
        nearestDistance = hit.distance;
      }
    }
    if (nearestDistance === undefined) return RESTING_DISTANCE;
    return clamp(nearestDistance - BLOCKER_PADDING, MIN_DISTANCE, RESTING_DISTANCE);
  }
}

const ROOM_CENTRE_VECTOR = new THREE.Vector3(ROOM_CENTRE.x, ROOM_CENTRE.y, ROOM_CENTRE.z);
