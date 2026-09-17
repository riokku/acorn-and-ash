import {
  SnapshotFlag,
  TICK_SECONDS,
  cloneVec3,
  createInput,
  createPlayerMotion,
  distance,
  stepPlayer,
  type CollisionWorld,
  type PlayerInput,
  type PlayerMotion,
  type SnapshotEntity,
  type Vec3,
} from '@acorn/shared';

/** Corrections smaller than this are ignored: they are just rounding. */
const IGNORE_CORRECTION = 0.02;
/** Above this the player is put straight where the server says, with no easing. */
const HARD_SNAP_CORRECTION = 2.5;
/** How quickly a small correction is smoothed away, per second. */
const SMOOTHING_RATE = 9;

export interface PredictionStats {
  /** How far the last correction moved the player, in metres. */
  readonly lastCorrection: number;
  /** Inputs sent but not yet acknowledged. */
  readonly pendingInputs: number;
}

/**
 * The player this browser controls.
 *
 * It moves the instant a key goes down instead of waiting for the server, and
 * quietly corrects itself when the server disagrees. The movement code is the
 * very same function the server runs, which is why the two usually agree.
 */
export class LocalPlayer {
  readonly motion: PlayerMotion;

  private readonly collision: CollisionWorld;
  private readonly pending: PlayerInput[] = [];
  private sequence = 0;
  private accumulator = 0;

  /** The state at the start and end of the tick being drawn, for smooth rendering. */
  private previous: Vec3;
  private previousYaw: number;

  /** A visual nudge that hides small corrections, decaying back to nothing. */
  private readonly smoothing: Vec3 = { x: 0, y: 0, z: 0 };

  private lastCorrection = 0;

  constructor(spawn: Readonly<Vec3>, collision: CollisionWorld) {
    this.motion = createPlayerMotion(spawn);
    this.collision = collision;
    this.previous = cloneVec3(spawn);
    this.previousYaw = 0;
  }

  get stats(): PredictionStats {
    return { lastCorrection: this.lastCorrection, pendingInputs: this.pending.length };
  }

  /**
   * Run however many fixed ticks fit into the frame that just passed.
   *
   * Returns the inputs produced, so the caller can send them.
   */
  advance(
    deltaSeconds: number,
    moveX: number,
    moveZ: number,
    cameraYaw: number,
  ): PlayerInput[] {
    // A long pause (a background tab) must not make the player sprint to catch up.
    this.accumulator = Math.min(this.accumulator + deltaSeconds, TICK_SECONDS * 5);

    const produced: PlayerInput[] = [];
    while (this.accumulator >= TICK_SECONDS) {
      this.accumulator -= TICK_SECONDS;
      this.previous = cloneVec3(this.motion.position);
      this.previousYaw = this.motion.facingYaw;

      const input = createInput(++this.sequence, moveX, moveZ, cameraYaw);
      stepPlayer(this.motion, input, TICK_SECONDS, this.collision);
      this.pending.push(input);
      produced.push(input);
    }

    this.decaySmoothing(deltaSeconds);
    return produced;
  }

  /**
   * Take the server's answer and fold it in.
   *
   * Everything the server has already simulated is dropped, then the inputs it
   * has not seen yet are replayed on top of its position. If the result is close
   * to where we already were, nothing visible happens.
   */
  reconcile(serverState: SnapshotEntity, ackSeq: number): void {
    while (this.pending.length > 0 && (this.pending[0]?.seq ?? 0) <= ackSeq) {
      this.pending.shift();
    }

    const replayed: PlayerMotion = {
      position: { x: serverState.x, y: serverState.y, z: serverState.z },
      velocity: { x: serverState.vx, y: serverState.vy, z: serverState.vz },
      facingYaw: serverState.yaw,
      grounded: (serverState.flags & SnapshotFlag.Airborne) === 0,
    };
    for (const input of this.pending) {
      stepPlayer(replayed, input, TICK_SECONDS, this.collision);
    }

    const error = distance(replayed.position, this.motion.position);
    this.lastCorrection = error;
    if (error < IGNORE_CORRECTION) return;

    if (error < HARD_SNAP_CORRECTION) {
      // Keep the player where they appear to be for a moment, and slide the
      // difference away over the next few frames.
      this.smoothing.x += this.motion.position.x - replayed.position.x;
      this.smoothing.y += this.motion.position.y - replayed.position.y;
      this.smoothing.z += this.motion.position.z - replayed.position.z;
    } else {
      // Too far out to hide. Put them where the server says.
      this.smoothing.x = 0;
      this.smoothing.y = 0;
      this.smoothing.z = 0;
    }

    this.motion.position = replayed.position;
    this.motion.velocity = replayed.velocity;
    this.motion.facingYaw = replayed.facingYaw;
    this.motion.grounded = replayed.grounded;
    this.previous = cloneVec3(this.motion.position);
  }

  /** Where to draw the player right now, part way between two ticks. */
  renderPosition(into: Vec3): Vec3 {
    const alpha = Math.min(1, this.accumulator / TICK_SECONDS);
    into.x = this.previous.x + (this.motion.position.x - this.previous.x) * alpha + this.smoothing.x;
    into.y = this.previous.y + (this.motion.position.y - this.previous.y) * alpha + this.smoothing.y;
    into.z = this.previous.z + (this.motion.position.z - this.previous.z) * alpha + this.smoothing.z;
    return into;
  }

  renderYaw(): number {
    const alpha = Math.min(1, this.accumulator / TICK_SECONDS);
    const delta = shortestTurn(this.previousYaw, this.motion.facingYaw);
    return this.previousYaw + delta * alpha;
  }

  private decaySmoothing(deltaSeconds: number): void {
    const keep = Math.exp(-SMOOTHING_RATE * deltaSeconds);
    this.smoothing.x *= keep;
    this.smoothing.y *= keep;
    this.smoothing.z *= keep;
  }
}

function shortestTurn(from: number, to: number): number {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}
