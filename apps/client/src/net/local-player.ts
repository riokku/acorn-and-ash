import {
  ActionKind,
  SnapshotFlag,
  TICK_SECONDS,
  advanceAction,
  cloneVec3,
  copyActionState,
  createActionState,
  createInput,
  createPlayerMotion,
  distance,
  footedInput,
  stepDodge,
  stepPlayer,
  unpackActionByte,
  type ActionContext,
  type ActionState,
  type CollisionWorld,
  type Footing,
  type Impact,
  type PlayerInput,
  type PlayerMotion,
  type SnapshotEntity,
  type Vec3,
} from '@acorn/shared';

/**
 * What the situation is for deciding a move - anything in hand, whether a
 * click would cast - as best this browser can tell, at a position and aim.
 */
export type ActionContextFor = (position: Readonly<Vec3>, aimYaw: number) => ActionContext;

/** Something this browser's own player just did, on its own say-so, for drawing straight away. */
export type PredictedEvent =
  | { readonly kind: 'impact'; readonly impact: Impact; readonly seq: number }
  | { readonly kind: 'cast'; readonly seq: number }
  | {
      readonly kind: 'began';
      readonly action: ActionKind;
      readonly step: number;
      readonly seq: number;
    };

const NO_CONTEXT: ActionContextFor = () => ({ canAttack: false, castInstead: false });

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

  private collision: CollisionWorld;
  private readonly pending: PlayerInput[] = [];
  private sequence = 0;
  private accumulator = 0;

  /** The state at the start and end of the tick being drawn, for smooth rendering. */
  private previous: Vec3;
  private previousYaw: number;

  /** A visual nudge that hides small corrections, decaying back to nothing. */
  private readonly smoothing: Vec3 = { x: 0, y: 0, z: 0 };

  private lastCorrection = 0;

  /**
   * What they are in the middle of - a swing, a roll - predicted here the
   * moment it starts, the same way walking is, by the very rules the server
   * runs (see `sim/actions.ts`).
   */
  readonly action: ActionState = createActionState();
  /** The buttons on the newest input the server has seen, so a replay can tell a fresh press. */
  private ackedButtons = 0;
  /** The buttons on the newest input made here. */
  private previousButtons = 0;
  private contextFor: ActionContextFor = NO_CONTEXT;
  private readonly events: PredictedEvent[] = [];
  private readonly scratchAction: ActionState = createActionState();

  constructor(spawn: Readonly<Vec3>, collision: CollisionWorld) {
    this.motion = createPlayerMotion(spawn);
    this.collision = collision;
    this.previous = cloneVec3(spawn);
    this.previousYaw = 0;
  }

  /** How this browser works out what a click would do: see `ActionContextFor`. */
  setActionContext(contextFor: ActionContextFor): void {
    this.contextFor = contextFor;
  }

  /** Everything predicted since this was last asked. */
  drainEvents(): PredictedEvent[] {
    return this.events.splice(0);
  }

  /** How far into the move under way, in ticks, including the part-tick being drawn. */
  actionAge(): number {
    const alpha = Math.min(1, this.accumulator / TICK_SECONDS);
    return this.action.kind === ActionKind.Idle ? 0 : this.action.age + alpha;
  }

  /**
   * Somewhere else entirely, straight away: through a door into a home's own
   * room, or back out (see decision 0055). Walks on against `collision` from
   * here on, and nothing eases the jump.
   */
  moveToSpace(collision: CollisionWorld, position: Readonly<Vec3>, facingYaw: number): void {
    this.collision = collision;
    this.motion.position = cloneVec3(position);
    this.motion.velocity = { x: 0, y: 0, z: 0 };
    this.motion.facingYaw = facingYaw;
    this.motion.grounded = true;
    this.previous = cloneVec3(position);
    this.previousYaw = facingYaw;
    this.smoothing.x = 0;
    this.smoothing.y = 0;
    this.smoothing.z = 0;
  }

  get stats(): PredictionStats {
    return { lastCorrection: this.lastCorrection, pendingInputs: this.pending.length };
  }

  /**
   * Run however many fixed ticks fit into the frame that just passed.
   *
   * `aimYaw` is which way a swing or a cast goes, and which way a standing
   * character turns to face; null means "wherever the character already
   * faces", read fresh every tick so it keeps up with a walk that is still
   * turning the character round.
   *
   * Returns the inputs produced, so the caller can send them.
   */
  advance(
    deltaSeconds: number,
    moveX: number,
    moveZ: number,
    cameraYaw: number,
    buttons = 0,
    aimYaw: number | null = null,
  ): PlayerInput[] {
    // A long pause (a background tab) must not make the player sprint to catch up.
    this.accumulator = Math.min(this.accumulator + deltaSeconds, TICK_SECONDS * 5);

    const produced: PlayerInput[] = [];
    while (this.accumulator >= TICK_SECONDS) {
      this.accumulator -= TICK_SECONDS;
      this.previous = cloneVec3(this.motion.position);
      this.previousYaw = this.motion.facingYaw;

      const input = createInput(
        ++this.sequence,
        moveX,
        moveZ,
        cameraYaw,
        buttons,
        aimYaw ?? this.motion.facingYaw,
      );
      const before = this.action.kind;
      const beforeAge = this.action.age;
      const tick = advanceAction(
        this.action,
        input,
        this.previousButtons,
        this.contextFor(this.motion.position, input.aimYaw),
      );
      this.previousButtons = input.buttons;
      this.stepFeet(this.motion, input, tick.footing, this.action);
      if (this.action.kind !== before || (this.action.age === 0 && beforeAge !== 0)) {
        this.events.push({
          kind: 'began',
          action: this.action.kind,
          step: this.action.step,
          seq: input.seq,
        });
      }
      if (tick.impact !== null)
        this.events.push({ kind: 'impact', impact: tick.impact, seq: input.seq });
      if (tick.cast) this.events.push({ kind: 'cast', seq: input.seq });
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
  reconcile(serverState: SnapshotEntity, ackSeq: number, dodgeCooldown = 0): void {
    while (this.pending.length > 0 && (this.pending[0]?.seq ?? 0) <= ackSeq) {
      const acked = this.pending.shift();
      if (acked !== undefined) this.ackedButtons = acked.buttons;
    }

    const replayed: PlayerMotion = {
      position: { x: serverState.x, y: serverState.y, z: serverState.z },
      velocity: { x: serverState.vx, y: serverState.vy, z: serverState.vz },
      facingYaw: serverState.yaw,
      grounded: (serverState.flags & SnapshotFlag.Airborne) === 0,
    };
    // The move too picks up from the server's word and replays on top of it,
    // so a swing it cut short, or a flinch it started, shows here as well.
    const action = unpackActionByte(serverState.action, this.scratchAction);
    action.age = serverState.actionAge;
    action.heading = serverState.actionHeading;
    action.dodgeCooldown = dodgeCooldown;
    let previousButtons = this.ackedButtons;
    for (const input of this.pending) {
      const tick = advanceAction(
        action,
        input,
        previousButtons,
        this.contextFor(replayed.position, input.aimYaw),
      );
      previousButtons = input.buttons;
      this.stepFeet(replayed, input, tick.footing, action);
    }
    copyActionState(action, this.action);

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
    into.x =
      this.previous.x + (this.motion.position.x - this.previous.x) * alpha + this.smoothing.x;
    into.y =
      this.previous.y + (this.motion.position.y - this.previous.y) * alpha + this.smoothing.y;
    into.z =
      this.previous.z + (this.motion.position.z - this.previous.z) * alpha + this.smoothing.z;
    return into;
  }

  renderYaw(): number {
    const alpha = Math.min(1, this.accumulator / TICK_SECONDS);
    const delta = shortestTurn(this.previousYaw, this.motion.facingYaw);
    return this.previousYaw + delta * alpha;
  }

  /** Walk, stand planted, or roll, whichever the move asks of the feet this tick. */
  private stepFeet(
    motion: PlayerMotion,
    input: PlayerInput,
    footing: Footing,
    action: ActionState,
  ): void {
    if (footing === 'dodging') stepDodge(motion, action, this.collision);
    else
      stepPlayer(
        motion,
        footedInput(input, footing, motion.facingYaw),
        TICK_SECONDS,
        this.collision,
      );
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
