import {
  INTERPOLATION_DELAY_SECONDS,
  TICK_MILLISECONDS,
  lerpAngle,
  SnapshotFlag,
  type SnapshotEntity,
} from '@acorn/shared';

/** One remembered position for an entity, with the server time it applied at. */
interface Sample {
  readonly timeMs: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly moving: boolean;
  /** Always false for wildlife - only a player's own snapshot entry ever sets these bits. */
  readonly sprinting: boolean;
  readonly airborne: boolean;
  /** Horizontal speed, in metres a second. */
  readonly speed: number;
  readonly verticalSpeed: number;
  /** The move under way, packed as the snapshot carries it (see `packActionByte`). */
  readonly action: number;
  readonly actionAge: number;
  readonly actionStartMs: number;
  readonly actionHeading: number;
}

export interface RemotePose {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly moving: boolean;
  readonly sprinting: boolean;
  readonly airborne: boolean;
  /** Horizontal speed, in metres a second. */
  readonly speed: number;
  /** Horizontal travel between the snapshots being drawn; zero while holding a sample. */
  readonly travelSpeed: number;
  /** The move being drawn, packed as the snapshot carries it. */
  readonly action: number;
  /** How far into it, in fractional ticks, at the moment being drawn. */
  readonly actionAge: number;
  readonly actionHeading: number;
}

/** Older samples than this are no use to anybody. */
const HISTORY_MS = 1500;
const CLOCK_FOLLOW = 2;
const MAX_CLOCK_CORRECTION = 0.1;

export interface InterpolationOptions {
  readonly delaySeconds?: number;
  /** Ease packet clock corrections instead of jumping forward or accumulating lateness. */
  readonly smoothClock?: boolean;
}

/**
 * Where everybody else is - other players, and now animals too.
 *
 * Anything only ever seen in a snapshot is drawn about a tenth of a second in
 * the past, between the two snapshots either side of that moment. Without
 * this it would jump from one snapshot to the next ten times a second. One
 * tracker only ever holds one kind of id at a time - a game keeps a separate
 * instance for players and for animals - so nothing here needs to know which
 * kind it is.
 */

export class InterpolatedEntities {
  private readonly history = new Map<number, Sample[]>();
  /** The client's running estimate of what time it is on the server. */
  private serverTimeMs = 0;
  private targetTimeMs = 0;
  private latestPacketTimeMs: number | null = null;
  private playbackRate = 1;
  private readonly delaySeconds: number;
  private readonly smoothClock: boolean;

  constructor(options: InterpolationOptions = {}) {
    this.delaySeconds = options.delaySeconds ?? INTERPOLATION_DELAY_SECONDS;
    this.smoothClock = options.smoothClock ?? false;
  }

  /**
   * Take everything in a snapshot, except the one entity this browser
   * controls directly - the local player has its own prediction and does not
   * need interpolating. Nothing is excluded when there is no such entity, an
   * animal tracker included.
   */
  ingest(serverTimeMs: number, entities: readonly SnapshotEntity[], excludeId?: number): void {
    if (this.smoothClock) {
      // A stale packet must not rewind the target clock. The target advances
      // between arrivals too, but each new packet resets its timing estimate.
      const newestTime = this.latestPacketTimeMs;
      if (
        newestTime === null ||
        serverTimeMs - newestTime > HISTORY_MS ||
        (serverTimeMs > newestTime && Math.abs(serverTimeMs - this.serverTimeMs) > HISTORY_MS)
      ) {
        this.serverTimeMs = serverTimeMs;
        this.targetTimeMs = serverTimeMs;
        this.playbackRate = 1;
      } else if (serverTimeMs > newestTime) {
        this.targetTimeMs = serverTimeMs;
      }
    } else {
      this.serverTimeMs = Math.max(this.serverTimeMs, serverTimeMs);
    }

    this.latestPacketTimeMs = Math.max(this.latestPacketTimeMs ?? -Infinity, serverTimeMs);

    for (const entity of entities) {
      if (entity.netId === excludeId) continue;

      const samples = this.history.get(entity.netId) ?? [];
      const newest = samples[samples.length - 1];
      // Snapshots can arrive out of order; an old one has nothing to add.
      if (newest !== undefined && serverTimeMs <= newest.timeMs) continue;

      if (newest !== undefined) {
        const seconds = (serverTimeMs - newest.timeMs) / 1000;
        const distance = Math.hypot(entity.x - newest.x, entity.y - newest.y, entity.z - newest.z);
        const pace = Math.max(
          Math.hypot(newest.speed, newest.verticalSpeed),
          Math.hypot(entity.vx, entity.vy, entity.vz),
        );
        // Keep normal travel and modest corrections smooth, but never draw a
        // respawn-sized change through the intervening terrain. Old history
        // after a long absence also cannot describe the route taken.
        if (seconds * 1000 > HISTORY_MS || distance > 3 + pace * seconds * 2) samples.length = 0;
      }

      samples.push({
        timeMs: serverTimeMs,
        x: entity.x,
        y: entity.y,
        z: entity.z,
        yaw: entity.yaw,
        moving: (entity.flags & SnapshotFlag.Moving) !== 0,
        sprinting: (entity.flags & SnapshotFlag.Sprinting) !== 0,
        airborne: (entity.flags & SnapshotFlag.Airborne) !== 0,
        speed: Math.hypot(entity.vx, entity.vz),
        verticalSpeed: Math.abs(entity.vy),
        action: entity.action,
        actionAge: entity.actionAge,
        // A tick's timestamp can wobble a little. Once this move has started,
        // keep its origin until the kind/step changes or its age resets.
        actionStartMs:
          this.smoothClock &&
          samples.length > 0 &&
          newest !== undefined &&
          newest.action === entity.action &&
          entity.actionAge >= newest.actionAge
            ? beganAt(newest)
            : serverTimeMs - entity.actionAge * TICK_MILLISECONDS,
        actionHeading: entity.actionHeading,
      });
      while (samples.length > 2 && (samples[0]?.timeMs ?? 0) < serverTimeMs - HISTORY_MS) {
        samples.shift();
      }
      this.history.set(entity.netId, samples);
    }
  }

  /** Keep the clock moving between snapshots. */
  advance(deltaSeconds: number): void {
    if (this.smoothClock) {
      // At most ten percent faster/slower, always forward. Packet jitter cannot
      // jump a pose or rewind a combat clip; a lost connection still holds the
      // newest position rather than extrapolating through scenery.
      const errorSeconds = (this.targetTimeMs - this.serverTimeMs) / 1000;
      this.playbackRate =
        1 +
        Math.min(
          MAX_CLOCK_CORRECTION,
          Math.max(-MAX_CLOCK_CORRECTION, errorSeconds * CLOCK_FOLLOW),
        );
      this.targetTimeMs += deltaSeconds * 1000;
    }
    this.serverTimeMs += deltaSeconds * 1000 * this.playbackRate;
  }

  /** A new connection/world must not inherit the previous playback clock. */
  clear(): void {
    this.history.clear();
    this.serverTimeMs = 0;
    this.targetTimeMs = 0;
    this.latestPacketTimeMs = null;
    this.playbackRate = 1;
  }

  remove(netId: number): void {
    this.history.delete(netId);
  }

  /** Everybody we currently know about. */
  netIds(): number[] {
    return [...this.history.keys()];
  }

  /** Forget anybody who was not in the newest snapshot. */
  retainOnly(netIds: ReadonlySet<number>): number[] {
    const dropped: number[] = [];
    for (const netId of this.history.keys()) {
      if (!netIds.has(netId)) {
        this.history.delete(netId);
        dropped.push(netId);
      }
    }
    return dropped;
  }

  /** Where a player should be drawn right now. */
  poseOf(netId: number): RemotePose | undefined {
    const samples = this.history.get(netId);
    if (samples === undefined || samples.length === 0) return undefined;

    const renderTime = this.serverTimeMs - this.delaySeconds * 1000;
    const newest = samples[samples.length - 1];
    if (newest === undefined) return undefined;

    // Not enough history yet, or the connection has gone quiet: hold still
    // rather than guessing and having to take it back.
    if (samples.length === 1 || renderTime >= newest.timeMs) return toPose(newest, renderTime);

    const oldest = samples[0];
    if (oldest === undefined) return undefined;
    if (renderTime <= oldest.timeMs) return toPose(oldest, renderTime);

    for (let i = samples.length - 1; i > 0; i--) {
      const after = samples[i];
      const before = samples[i - 1];
      if (after === undefined || before === undefined) continue;
      if (renderTime >= before.timeMs && renderTime <= after.timeMs) {
        const span = after.timeMs - before.timeMs;
        const alpha = span <= 0 ? 1 : (renderTime - before.timeMs) / span;
        // Whichever move had begun by the moment being drawn: the later
        // snapshot's, if it had started by then, else the earlier one's.
        const move = beganAt(after) <= renderTime ? after : before;
        return {
          x: before.x + (after.x - before.x) * alpha,
          y: before.y + (after.y - before.y) * alpha,
          z: before.z + (after.z - before.z) * alpha,
          yaw: lerpAngle(before.yaw, after.yaw, alpha),
          moving: after.moving,
          sprinting: after.sprinting,
          airborne: after.airborne,
          speed: before.speed + (after.speed - before.speed) * alpha,
          // Cap correction distance, then match the pace of the playback clock.
          travelSpeed:
            Math.min(
              Math.hypot(after.x - before.x, after.z - before.z) / (span / 1000),
              Math.max(before.speed, after.speed),
            ) * this.playbackRate,
          action: move.action,
          actionAge: (renderTime - beganAt(move)) / TICK_MILLISECONDS,
          actionHeading: move.actionHeading,
        };
      }
    }
    return toPose(newest, renderTime);
  }
}

/** When, on the server's clock, the move a sample shows had begun. */
function beganAt(sample: Sample): number {
  return sample.actionStartMs;
}

function toPose(sample: Sample, renderTime: number): RemotePose {
  return {
    x: sample.x,
    y: sample.y,
    z: sample.z,
    yaw: sample.yaw,
    moving: sample.moving,
    sprinting: sample.sprinting,
    airborne: sample.airborne,
    speed: sample.speed,
    travelSpeed: 0,
    action: sample.action,
    actionAge: Math.max(0, (renderTime - beganAt(sample)) / TICK_MILLISECONDS),
    actionHeading: sample.actionHeading,
  };
}
