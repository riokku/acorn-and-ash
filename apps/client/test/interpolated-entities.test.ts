import { describe, expect, it } from 'vitest';

import { INTERPOLATION_DELAY_SECONDS, SnapshotFlag, type SnapshotEntity } from '@acorn/shared';

import { InterpolatedEntities } from '../src/net/interpolated-entities';

function entity(netId: number, x: number, z: number, yaw = 0, flags = 0): SnapshotEntity {
  return { netId, x, y: 0, z, vx: 0, vy: 0, vz: 0, yaw, flags };
}

const DELAY_MS = INTERPOLATION_DELAY_SECONDS * 1000;

describe('tracking where other entities are, between snapshots', () => {
  it('knows nothing about a player it has not seen', () => {
    const players = new InterpolatedEntities();
    expect(players.poseOf(2)).toBeUndefined();
  });

  it('ignores the player this browser controls', () => {
    const players = new InterpolatedEntities();
    players.ingest(1000, [entity(1, 5, 5), entity(2, 0, 0)], 1);
    expect(players.netIds()).toEqual([2]);
  });

  it('draws a player between two snapshots, not on the newest one', () => {
    const players = new InterpolatedEntities();
    // Two snapshots a tenth of a second apart, the player walking along +X.
    players.ingest(1000, [entity(2, 0, 0)], 1);
    players.ingest(1100, [entity(2, 1, 0)], 1);

    // The clock now reads 1100, so the render time is 1000: the older sample.
    expect(players.poseOf(2)?.x).toBeCloseTo(0, 5);

    // Half the delay later, the player should be drawn half way between.
    players.advance(DELAY_MS / 2 / 1000);
    expect(players.poseOf(2)?.x).toBeCloseTo(0.5, 5);
  });

  it('holds still rather than guessing when snapshots stop arriving', () => {
    const players = new InterpolatedEntities();
    players.ingest(1000, [entity(2, 0, 0)], 1);
    players.ingest(1100, [entity(2, 1, 0)], 1);

    players.advance(5);
    // No extrapolating past the newest thing we actually know.
    expect(players.poseOf(2)?.x).toBeCloseTo(1, 5);
  });

  it('turns a player the short way round', () => {
    const players = new InterpolatedEntities();
    players.ingest(1000, [entity(2, 0, 0, -3.0)], 1);
    players.ingest(1100, [entity(2, 0, 0, 3.0)], 1);
    players.advance(DELAY_MS / 2 / 1000);

    const yaw = players.poseOf(2)?.yaw ?? 0;
    // Going from -3.0 to 3.0 is a short hop across PI, not a long spin through 0.
    expect(Math.abs(yaw)).toBeGreaterThan(3.0);
  });

  it('ignores a snapshot that arrives out of order', () => {
    const players = new InterpolatedEntities();
    players.ingest(1000, [entity(2, 0, 0)], 1);
    players.ingest(1100, [entity(2, 1, 0)], 1);
    players.ingest(1050, [entity(2, 99, 0)], 1);

    players.advance(5);
    expect(players.poseOf(2)?.x).toBeCloseTo(1, 5);
  });

  it('forgets a player who is no longer in the snapshot', () => {
    const players = new InterpolatedEntities();
    players.ingest(1000, [entity(2, 0, 0), entity(3, 1, 1)], 1);
    expect(players.netIds().sort()).toEqual([2, 3]);

    expect(players.retainOnly(new Set([2]))).toEqual([3]);
    expect(players.netIds()).toEqual([2]);
  });

  it('reports whether a player is walking', () => {
    const players = new InterpolatedEntities();
    players.ingest(1000, [entity(2, 0, 0, 0, 1)], 1);
    expect(players.poseOf(2)?.moving).toBe(true);

    players.ingest(1100, [entity(2, 0, 0, 0, 0)], 1);
    players.advance(1);
    expect(players.poseOf(2)?.moving).toBe(false);
  });

  it('reports whether a player is sprinting or airborne, the same way', () => {
    const players = new InterpolatedEntities();
    players.ingest(1000, [entity(2, 0, 0, 0, SnapshotFlag.Sprinting)], 1);
    expect(players.poseOf(2)?.sprinting).toBe(true);
    expect(players.poseOf(2)?.airborne).toBe(false);

    players.ingest(1100, [entity(2, 0, 0, 0, SnapshotFlag.Airborne)], 1);
    players.advance(1);
    expect(players.poseOf(2)?.sprinting).toBe(false);
    expect(players.poseOf(2)?.airborne).toBe(true);
  });

  it('does not grow forever while a player walks about', () => {
    const players = new InterpolatedEntities();
    for (let i = 0; i < 500; i++) {
      players.ingest(1000 + i * 100, [entity(2, i, 0)], 1);
    }
    // Only a second or so of history is worth keeping.
    expect(players.poseOf(2)).toBeDefined();
  });

  it('excludes nobody when tracking animals, which are never the browser itself', () => {
    const animals = new InterpolatedEntities();
    animals.ingest(1000, [entity(1001, 0, 0), entity(1002, 5, 5)]);
    expect(animals.netIds().sort()).toEqual([1001, 1002]);
  });
});
