import { expect, it } from 'vitest';
import { STREAM, streamPointAt, navigableWaterSurfaceAt } from '@acorn/shared';
import { FloatingBoatMotion } from '../src/scene/floating-boat-motion';

it('smooths server corrections while river drift continues and holds still in sloughs or ice', () => {
  const row = Math.round((STREAM.count - 1) * 0.7),
    p = streamPointAt(STREAM, row),
    next = streamPointAt(STREAM, row + 1);
  const boat = new FloatingBoatMotion({ ...p, yaw: Math.atan2(-(next.z - p.z), next.x - p.x) });
  const first = boat.update(0, false),
    moving = boat.update(0.05, false);
  expect(Math.hypot(moving.x - first.x, moving.z - first.z)).toBeGreaterThan(0.02);
  boat.sync({ x: moving.x + 0.1, z: moving.z, yaw: moving.yaw });
  const synced = boat.update(0, false);
  expect(synced.x).toBeCloseTo(moving.x, 6);
  expect(synced.y).toBe(navigableWaterSurfaceAt(synced.x, synced.z));
  const frozen = boat.update(2, true),
    held = boat.update(1, true);
  expect(Math.hypot(held.x - frozen.x, held.z - frozen.z)).toBeLessThan(0.00001);
  for (const slough of STREAM.sloughs) {
    const calm = new FloatingBoatMotion({ ...slough.basin[0]!, yaw: 0 });
    const start = calm.update(0, false);
    expect(calm.update(1, false)).toEqual(start);
  }
});
