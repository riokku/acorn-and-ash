import { INTERPOLATION_DELAY_SECONDS, lerpAngle, type SnapshotEntity } from '@acorn/shared';

/** One remembered position for a player, with the server time it applied at. */
interface Sample {
  readonly timeMs: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly moving: boolean;
}

export interface RemotePose {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly moving: boolean;
}

/** Older samples than this are no use to anybody. */
const HISTORY_MS = 1500;

/**
 * Where everybody else is.
 *
 * Other players are drawn about a tenth of a second in the past, between the two
 * snapshots either side of that moment. Without this they would jump from one
 * snapshot to the next ten times a second.
 */
export class RemotePlayers {
  private readonly history = new Map<number, Sample[]>();
  /** The client's running estimate of what time it is on the server. */
  private serverTimeMs = 0;

  /** Take everything in a snapshot except the player this browser controls. */
  ingest(serverTimeMs: number, entities: readonly SnapshotEntity[], selfNetId: number): void {
    this.serverTimeMs = Math.max(this.serverTimeMs, serverTimeMs);

    const seen = new Set<number>();
    for (const entity of entities) {
      if (entity.netId === selfNetId) continue;
      seen.add(entity.netId);

      const samples = this.history.get(entity.netId) ?? [];
      const newest = samples[samples.length - 1];
      // Snapshots can arrive out of order; an old one has nothing to add.
      if (newest !== undefined && serverTimeMs <= newest.timeMs) continue;

      samples.push({
        timeMs: serverTimeMs,
        x: entity.x,
        y: entity.y,
        z: entity.z,
        yaw: entity.yaw,
        moving: (entity.flags & 1) !== 0,
      });
      while (samples.length > 2 && (samples[0]?.timeMs ?? 0) < serverTimeMs - HISTORY_MS) {
        samples.shift();
      }
      this.history.set(entity.netId, samples);
    }
  }

  /** Keep the clock moving between snapshots. */
  advance(deltaSeconds: number): void {
    this.serverTimeMs += deltaSeconds * 1000;
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

    const renderTime = this.serverTimeMs - INTERPOLATION_DELAY_SECONDS * 1000;
    const newest = samples[samples.length - 1];
    if (newest === undefined) return undefined;

    // Not enough history yet, or the connection has gone quiet: hold still
    // rather than guessing and having to take it back.
    if (samples.length === 1 || renderTime >= newest.timeMs) return toPose(newest);

    const oldest = samples[0];
    if (oldest === undefined) return undefined;
    if (renderTime <= oldest.timeMs) return toPose(oldest);

    for (let i = samples.length - 1; i > 0; i--) {
      const after = samples[i];
      const before = samples[i - 1];
      if (after === undefined || before === undefined) continue;
      if (renderTime >= before.timeMs && renderTime <= after.timeMs) {
        const span = after.timeMs - before.timeMs;
        const alpha = span <= 0 ? 1 : (renderTime - before.timeMs) / span;
        return {
          x: before.x + (after.x - before.x) * alpha,
          y: before.y + (after.y - before.y) * alpha,
          z: before.z + (after.z - before.z) * alpha,
          yaw: lerpAngle(before.yaw, after.yaw, alpha),
          moving: after.moving,
        };
      }
    }
    return toPose(newest);
  }
}

function toPose(sample: Sample): RemotePose {
  return { x: sample.x, y: sample.y, z: sample.z, yaw: sample.yaw, moving: sample.moving };
}
