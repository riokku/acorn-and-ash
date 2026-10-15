import type * as THREE from 'three/webgpu';
import {
  streamPointAt,
  streamWaterHalfWidthAt,
  streamPools,
  POND,
  FOREST_TRAILS,
  type Lake,
  type Stream,
  type Terrain,
} from '@acorn/shared';

/** Refine curved contact areas only when the broad triangles miss ground by over 4 cm. */
export function shoreGroundCells(
  geometry: THREE.BufferGeometry,
  terrain: Terrain,
  lake: Lake,
  stream: Stream,
  size: number,
  segments: number,
): Map<number, number> {
  const cell = size / segments;
  const origin = -size / 2;
  const candidates = new Set<number>();
  const band = 6 + cell;
  const addBox = (x: number, z: number, radius: number, ring = false): void => {
    for (
      let j = Math.max(0, Math.floor((z - radius - origin) / cell));
      j <= Math.min(segments - 1, Math.floor((z + radius - origin) / cell));
      j++
    ) {
      for (
        let i = Math.max(0, Math.floor((x - radius - origin) / cell));
        i <= Math.min(segments - 1, Math.floor((x + radius - origin) / cell));
        i++
      ) {
        const distance = Math.hypot(origin + (i + 0.5) * cell - x, origin + (j + 0.5) * cell - z);
        if (!ring || Math.abs(distance - (radius - band)) <= band) candidates.add(j * segments + i);
      }
    }
  };
  for (const circle of [
    ...POND,
    ...lake.basin,
    ...lake.islands.flatMap((island) => island.lobes),
    ...streamPools(stream).flatMap((slough) => slough.basin),
  ])
    addBox(circle.x, circle.z, circle.radius + band, true);
  for (let row = 0; row < stream.count; row++) {
    const point = streamPointAt(stream, row);
    const along = (row * stream.length) / (stream.count - 1);
    addBox(point.x, point.z, streamWaterHalfWidthAt(stream, along) + band);
  }

  const source = geometry.getAttribute('position');
  const stride = segments + 1;
  const selected = new Map<number, number>();
  for (const key of candidates) {
    const i = key % segments,
      j = Math.floor(key / segments);
    const a = j * stride + i,
      b = a + stride,
      c = b + 1,
      d = a + 1;
    const error = Math.max(
      ...[
        [0.5, 0.5],
        [0, 0.5],
        [1, 0.5],
        [0.5, 0],
        [0.5, 1],
        [0.25, 0.25],
        [0.75, 0.75],
      ].map(([u = 0, v = 0]) => {
        const drawn =
          u + v <= 1
            ? source.getZ(a) * (1 - u - v) + source.getZ(b) * v + source.getZ(d) * u
            : source.getZ(b) * (1 - u) + source.getZ(c) * (u + v - 1) + source.getZ(d) * (1 - v);
        return Math.abs(drawn - terrain.heightAt(origin + (i + u) * cell, origin + (j + v) * cell));
      }),
    );
    if (error <= 0.04) continue;
    const divisions = error > 0.35 ? 16 : error > 0.1 ? 8 : 4;
    // A surrounding cell gives the detail room to meet its coarse neighbours,
    // so the contact area itself samples the physical surface without edge blending.
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        const x = i + dx,
          z = j + dz;
        if (x >= 0 && z >= 0 && x < segments && z < segments)
          selected.set(z * segments + x, Math.max(divisions, selected.get(z * segments + x) ?? 0));
      }
  }
  // Contour paths need enough corners for their narrow worn tread and for
  // feet to meet the graded ground, rather than straddling a broad triangle.
  for (const trail of FOREST_TRAILS)
    for (const point of trail.points) {
      const i = Math.floor((point.x - origin) / cell);
      const j = Math.floor((point.z - origin) / cell);
      for (let dz = -2; dz <= 2; dz++)
        for (let dx = -2; dx <= 2; dx++) {
          const x = i + dx,
            z = j + dz;
          if (x >= 0 && z >= 0 && x < segments && z < segments)
            selected.set(z * segments + x, Math.max(4, selected.get(z * segments + x) ?? 0));
        }
    }
  return selected;
}
