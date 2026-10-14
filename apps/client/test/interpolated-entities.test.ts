import { describe, expect, it } from 'vitest';

import { INTERPOLATION_DELAY_SECONDS, SnapshotFlag, type SnapshotEntity } from '@acorn/shared';

import { InterpolatedEntities } from '../src/net/interpolated-entities';

function entity(
  netId: number,
  x: number,
  z: number,
  yaw = 0,
  flags = 0,
  action = 0,
  actionAge = 0,
): SnapshotEntity {
  return {
    netId,
    x,
    y: 0,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw,
    flags,
    action,
    actionAge,
    actionHeading: 0,
  };
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

  it('draws a move from the moment it began, however the snapshots fell', () => {
    const players = new InterpolatedEntities();
    // A swing (kind 1) that began half a tick before the second snapshot.
    players.ingest(1000, [entity(2, 0, 0, 0, 0, 0, 0)]);
    players.ingest(1100, [entity(2, 0, 0, 0, 0, 1, 2)]);
    // Drawn a tenth of a second behind: at 1050, the swing had begun at 1000.
    players.advance((1050 + DELAY_MS - 1100) / 1000);
    const pose = players.poseOf(2);
    expect(pose?.action).toBe(1);
    expect(pose?.actionAge).toBeCloseTo(1, 5);
  });

  it('keeps showing the earlier move until the next one has begun', () => {
    const players = new InterpolatedEntities();
    players.ingest(1000, [entity(2, 0, 0, 0, 0, 0, 0)]);
    // This swing began at 1100 - 1 tick = 1050.
    players.ingest(1100, [entity(2, 0, 0, 0, 0, 1, 1)]);
    players.advance((1020 + DELAY_MS - 1100) / 1000);
    expect(players.poseOf(2)?.action).toBe(0);
  });
});

describe('resolved animation pace for remote players', () => {
  it('keeps stationary feet still despite a snapshot velocity pushing into an obstacle', () => {
    const players = new InterpolatedEntities();
    const blocked = { ...entity(2, 0, 0), vx: 4.5 };
    players.ingest(1000, [blocked]);
    players.ingest(1100, [blocked]);
    players.advance(0.05);
    expect(players.poseOf(2)?.speed).toBe(4.5);
    expect(players.poseOf(2)?.travelSpeed).toBe(0);
  });

  it('matches actual diagonal travel along a wall and stops when snapshots run out', () => {
    const players = new InterpolatedEntities();
    players.ingest(1000, [{ ...entity(2, 0, 0), vx: 4.5 }]);
    players.ingest(1100, [{ ...entity(2, 0.3, 0.2), vx: 4.5 }]);
    players.advance(0.05);
    expect(players.poseOf(2)?.travelSpeed).toBeCloseTo(Math.hypot(0.3, 0.2) / 0.1);
    players.advance(1);
    expect(players.poseOf(2)?.x).toBe(0.3);
    expect(players.poseOf(2)?.travelSpeed).toBe(0);
  });

  it('does not run in place when only the first snapshot is available', () => {
    const players = new InterpolatedEntities();
    players.ingest(1000, [{ ...entity(2, 0, 0), vx: 7 }]);
    expect(players.poseOf(2)?.travelSpeed).toBe(0);
  });

  it('keeps vertical motion and large corrections from accelerating the gait', () => {
    const players = new InterpolatedEntities();
    players.ingest(1000, [{ ...entity(2, 0, 0), vx: 4.5 }]);
    players.ingest(1100, [{ ...entity(2, 2, 0), vx: 4.5 }]);
    players.advance(0.05);
    expect(players.poseOf(2)?.travelSpeed).toBe(4.5);
    const jumping = new InterpolatedEntities();
    jumping.ingest(1000, [entity(3, 0, 0)]);
    jumping.ingest(1100, [{ ...entity(3, 0, 0), y: 1, vy: 5 }]);
    jumping.advance(0.05);
    expect(jumping.poseOf(3)?.travelSpeed).toBe(0);
  });
});

describe('discontinuous remote movement', () => {
  it('places a respawn directly at its new position without a fast slide or gait', () => {
    const players = new InterpolatedEntities();
    players.ingest(1000, [{ ...entity(2, 0, 0), vx: 4.5 }]);
    players.ingest(1100, [{ ...entity(2, 40, 20), y: 8, yaw: 1.2 }]);
    for (let i = 0; i < 10; i++) {
      const pose = players.poseOf(2)!;
      expect([pose.x, pose.y, pose.z, pose.yaw]).toEqual([40, 8, 20, 1.2]);
      expect(pose.travelSpeed).toBe(0);
      players.advance(0.02);
    }
  });
  it('smooths normal movement again after a discontinuity', () => {
    const players = new InterpolatedEntities();
    players.ingest(1000, [entity(2, 0, 0)]);
    players.ingest(1100, [{ ...entity(2, 40, 0), vx: 4.5 }]);
    players.ingest(1200, [{ ...entity(2, 40.4, 0), vx: 4.5 }]);
    players.advance(0.05);
    expect(players.poseOf(2)?.x).toBeCloseTo(40.2);
    expect(players.poseOf(2)?.travelSpeed).toBeCloseTo(4);
  });
  it('preserves legitimate fast horizontal and vertical travel', () => {
    const players = new InterpolatedEntities();
    players.ingest(1000, [{ ...entity(2, 0, 0), vx: 15, vy: -30 }]);
    players.ingest(1100, [{ ...entity(2, 1.5, 0), y: -3, vx: 15, vy: -30 }]);
    players.advance(0.05);
    expect(players.poseOf(2)?.x).toBeCloseTo(0.75);
    expect(players.poseOf(2)?.y).toBeCloseTo(-1.5);
  });
  it('drops stale movement history after a long snapshot gap', () => {
    const players = new InterpolatedEntities();
    players.ingest(1000, [{ ...entity(2, 0, 0), vx: 7 }]);
    players.ingest(4000, [{ ...entity(2, 10, 0), vx: 7 }]);
    expect(players.poseOf(2)?.x).toBe(10);
    expect(players.poseOf(2)?.travelSpeed).toBe(0);
  });
});

describe('buffered skeleton snapshot playback', () => {
  it.each([30, 60, 144])(
    'keeps position, gait and combat age advancing through packet jitter at %i FPS',
    (fps) => {
      const skeletons = new InterpolatedEntities({ delaySeconds: 0.18, smoothClock: true });
      const delays = [0, 45, 10, 60, 5, 35, 0, 55];
      let next = 0;
      let previousX = 0;
      let previousAge = 0;
      for (let frame = 0; frame < fps * 5; frame++) {
        const now = (frame * 1000) / fps;
        while (next * 100 + delays[next % delays.length]! <= now) {
          skeletons.ingest(1000 + next * 100, [
            {
              ...entity(2, next * 0.3, 0, 0, SnapshotFlag.Moving, 1, next * 2),
              vx: 3,
            },
          ]);
          next++;
        }
        skeletons.advance(1 / fps);
        const pose = skeletons.poseOf(2)!;
        if (now > 500) {
          // No pause/restart in either the body or feet, and no rewound clip.
          expect((pose.x - previousX) * fps).toBeGreaterThan(2.4);
          expect((pose.x - previousX) * fps).toBeLessThan(3.4);
          expect(pose.travelSpeed).toBeGreaterThan(2.4);
          expect(pose.actionAge).toBeGreaterThan(previousAge);
        }
        previousX = pose.x;
        previousAge = pose.actionAge;
      }
      const held = skeletons.poseOf(2)!;
      skeletons.advance(2);
      const stopped = skeletons.poseOf(2)!;
      expect(stopped.x).toBeGreaterThanOrEqual(held.x);
      expect(stopped.travelSpeed).toBe(0);
      skeletons.advance(1);
      expect(skeletons.poseOf(2)!.x).toBe(stopped.x);
    },
  );

  it('eases an early packet without jumping, ignores stale packets and resets on a teleport', () => {
    const skeletons = new InterpolatedEntities({ delaySeconds: 0.18, smoothClock: true });
    for (let i = 0; i < 5; i++) {
      skeletons.ingest(1000 + i * 100, [{ ...entity(2, i * 0.3, 0), vx: 3 }]);
      skeletons.advance(0.1);
    }
    const before = skeletons.poseOf(2)!;
    skeletons.ingest(1500, [{ ...entity(2, 1.5, 0), vx: 3 }]);
    expect(skeletons.poseOf(2)!.x).toBe(before.x);
    skeletons.ingest(1200, [entity(2, 99, 0)]);
    expect(skeletons.poseOf(2)!.x).toBe(before.x);
    skeletons.advance(1 / 60);
    expect(skeletons.poseOf(2)!.x - before.x).toBeLessThan(0.06);
    skeletons.ingest(1600, [entity(2, 40, 0)]);
    expect(skeletons.poseOf(2)!.x).toBe(40);
    expect(skeletons.poseOf(2)!.travelSpeed).toBe(0);
  });
  it('resumes recent movement after hidden-tab frames stop and starts fresh on reconnect', () => {
    const skeletons = new InterpolatedEntities({ delaySeconds: 0.18, smoothClock: true });
    // Packets keep arriving while the browser suspends render callbacks.
    for (let i = 0; i <= 50; i++) {
      skeletons.ingest(1000 + i * 100, [{ ...entity(2, i * 0.3, 0), vx: 3 }]);
    }
    skeletons.advance(1 / 60);
    expect(skeletons.poseOf(2)!.x).toBeGreaterThan(13);
    expect(skeletons.poseOf(2)!.travelSpeed).toBeGreaterThan(0);
    skeletons.clear();
    expect(skeletons.netIds()).toEqual([]);
    skeletons.ingest(100, [entity(3, 0, 0)]);
    skeletons.advance(0.1);
    skeletons.ingest(200, [{ ...entity(3, 0.3, 0), vx: 3 }]);
    skeletons.advance(0.1);
    expect(skeletons.poseOf(3)!.x).toBeGreaterThan(0);
    expect(skeletons.poseOf(3)!.x).toBeLessThan(0.3);
  });
  it('keeps the current combat clip advancing when tick timestamps wobble', () => {
    const skeletons = new InterpolatedEntities({ delaySeconds: 0.18, smoothClock: true });
    const wobble = [0, 18, -18, 14, -10];
    let next = 0;
    let age = 0;
    for (let frame = 0; frame < 300; frame++) {
      const now = (frame * 1000) / 60;
      while (next * 100 <= now) {
        skeletons.ingest(1000 + next * 100 + wobble[next % wobble.length]!, [
          {
            ...entity(2, next * 0.3, 0, 0, SnapshotFlag.Moving, 1, next * 2),
            vx: 3,
          },
        ]);
        next++;
      }
      skeletons.advance(1 / 60);
      const nextAge = skeletons.poseOf(2)!.actionAge;
      if (now > 500) expect(nextAge).toBeGreaterThan(age);
      age = nextAge;
    }
  });
});
