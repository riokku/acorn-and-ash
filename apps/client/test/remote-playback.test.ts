import { expect, it } from 'vitest';
import { SnapshotFlag, type SnapshotEntity } from '@acorn/shared';
import { createRemotePlayback } from '../src/net/remote-playback';

it.each([30, 60, 144])(
  'keeps players and wildlife traveling between uneven packets at %s FPS',
  (fps) => {
    const tracker = createRemotePlayback();
    const delays = [0, 45, 10, 60, 5, 35, 0, 55];
    let packet = 0,
      previous = 0,
      pauses = 0,
      measured = 0;
    for (let frame = 0; frame < fps * 5; frame++) {
      const elapsed = frame / fps;
      while (packet * 100 + delays[packet % delays.length]! <= elapsed * 1000) {
        const entity: SnapshotEntity = {
          netId: 2,
          x: packet * 0.25,
          y: 0,
          z: 0,
          vx: 2.5,
          vy: 0,
          vz: 0,
          yaw: -Math.PI / 2,
          flags: SnapshotFlag.Moving,
          action: 0,
          actionAge: 0,
          actionHeading: 0,
        };
        tracker.ingest(1000 + packet * 100, [entity]);
        packet++;
      }
      tracker.advance(1 / fps);
      const pose = tracker.poseOf(2)!;
      if (elapsed > 0.5) {
        measured++;
        if (pose.x <= previous) pauses++;
        expect((pose.x - previous) * fps).toBeLessThan(2.8);
        expect(pose.travelSpeed).toBeGreaterThan(2.2);
      }
      previous = pose.x;
    }
    expect(pauses / measured).toBe(0);
    tracker.advance(1);
    expect(tracker.poseOf(2)!.travelSpeed).toBe(0);
    tracker.clear();
    expect(tracker.netIds()).toEqual([]);
  },
);
