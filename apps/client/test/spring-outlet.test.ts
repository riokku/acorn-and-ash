import { expect, it } from 'vitest';
import { STREAM, streamPointAt, streamWaterHalfWidthAt } from '@acorn/shared';
import { riverPoolConnections } from '../src/scene/stream';

it('keeps the spring shoreline rim out of the full outlet into the moving channel', () => {
  const circles = riverPoolConnections(STREAM, STREAM.spring!);
  const spacing = STREAM.length / (STREAM.count - 1);
  // The old anchor-centred mask stopped at 6m, leaving the last spring lobe's
  // shoreline visible across flowing water at about 10m down the river.
  for (let row = 0; row <= 10; row++) {
    const point = streamPointAt(STREAM, row);
    const before = streamPointAt(STREAM, Math.max(0, row - 1));
    const after = streamPointAt(STREAM, row + 1);
    const dx = after.x - before.x,
      dz = after.z - before.z;
    const length = Math.hypot(dx, dz);
    for (const side of [-0.75, 0, 0.75]) {
      const across = streamWaterHalfWidthAt(STREAM, row * spacing, side) * side;
      const x = point.x - (dz / length) * across,
        z = point.z + (dx / length) * across;
      expect(circles.some((circle) => Math.hypot(circle.x - x, circle.z - z) < circle.radius)).toBe(
        true,
      );
    }
  }
});
