import { describe, expect, it } from 'vitest';
import { Group } from 'three/webgpu';
import { ActionKind, createActionState, packActionByte, type SnapshotEntity } from '@acorn/shared';
import { RaiderCrowd } from '../src/scene/raiders';
import { ImpactBursts } from '../src/scene/impact-bursts';

const snapshot = (id: number, down = false): SnapshotEntity => ({
  netId: id,
  x: 0,
  y: 0,
  z: -4,
  vx: 0,
  vy: 0,
  vz: 0,
  yaw: 0,
  flags: 0,
  action: packActionByte({
    ...createActionState(),
    kind: down ? ActionKind.KnockedOut : ActionKind.Idle,
  }),
  actionAge: 0,
  actionHeading: 0,
});

describe('raider target lifecycle', () => {
  it('excludes unknown, defeated, and removed raiders using the existing registry', () => {
    const bursts = new ImpactBursts();
    const crowd = new RaiderCrowd(new Group(), bursts);
    try {
      crowd.ingest(1000, [snapshot(1), snapshot(2, true), snapshot(3)]);
      expect(crowd.targets()).toEqual([]);
      crowd.setList([
        { id: 1, kind: 'minion', hitsLeft: 2 },
        { id: 2, kind: 'minion', hitsLeft: 2 },
      ]);
      expect(crowd.targets().map((target) => target.id)).toEqual([1]);
      // The kill event arrives before the next pose snapshot.
      crowd.confirmHit(
        { raiderId: 1, hitsLeft: 0, netId: 10, heavy: false, shrugged: false },
        undefined,
        true,
        null,
      );
      expect(crowd.targets()).toEqual([]);
      crowd.setList([{ id: 1, kind: 'minion', hitsLeft: 2 }]);
      expect(crowd.targets().map((target) => target.id)).toEqual([1]);
      crowd.ingest(1100, []);
      expect(crowd.targets()).toEqual([]);
      crowd.ingest(1200, [snapshot(1)]);
      crowd.setList([]);
      expect(crowd.targets()).toEqual([]);
    } finally {
      crowd.dispose();
      bursts.dispose();
    }
  });
});
