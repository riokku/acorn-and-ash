import * as THREE from 'three/webgpu';
import {
  nearestOnStream,
  streamPointAt,
  streamWaterHalfWidthAt,
  type Stream,
  type Terrain,
} from '@acorn/shared';

export interface RefinedGroundCell {
  readonly vertices: readonly number[];
  readonly divisions: number;
  readonly firstIndex: number;
  readonly indexCount: number;
}

/** Refine only the channel around falls; keep the rest of the world and digging grid coarse. */
export function refineWaterfallGround(
  geometry: THREE.BufferGeometry,
  terrain: Terrain,
  stream: Stream,
  size: number,
  segments: number,
): Map<number, RefinedGroundCell> {
  const cell = size / segments,
    origin = -size / 2,
    stride = segments + 1;
  const selected = new Set<number>();
  for (const fall of stream.falls) {
    const center = streamPointAt(
      stream,
      Math.round(fall.at / (stream.length / (stream.count - 1))),
    );
    for (
      let j = Math.max(0, Math.floor((center.z - 16 - origin) / cell));
      j <= Math.min(segments - 1, Math.ceil((center.z + 16 - origin) / cell));
      j++
    ) {
      for (
        let i = Math.max(0, Math.floor((center.x - 16 - origin) / cell));
        i <= Math.min(segments - 1, Math.ceil((center.x + 16 - origin) / cell));
        i++
      ) {
        const spot = nearestOnStream(
          stream,
          origin + (i + 0.5) * cell,
          origin + (j + 0.5) * cell,
          14,
        );
        if (
          spot &&
          Math.abs(spot.along - fall.at) < 12 &&
          spot.distance < streamWaterHalfWidthAt(stream, spot.along) + 6
        )
          selected.add(j * segments + i);
      }
    }
  }
  const source = geometry.getAttribute('position');
  const positions = Array.from(source.array);
  const indices = Array.from(geometry.getIndex()!.array);
  const refined = new Map<number, RefinedGroundCell>();
  const divisions = 8;
  for (const key of selected) {
    const i = key % segments,
      j = Math.floor(key / segments);
    // PlaneGeometry's local Y points north before it is laid onto the ground.
    const northRow = j;
    const a = northRow * stride + i,
      b = a + stride,
      c = b + 1,
      d = a + 1;
    const vertices: number[] = [];
    for (let z = 0; z <= divisions; z++) {
      for (let x = 0; x <= divisions; x++) {
        const u = x / divisions,
          v = z / divisions;
        const worldX = origin + (i + u) * cell,
          worldZ = origin + (j + v) * cell;
        let height = terrain.heightAt(worldX, worldZ);
        // Meet unrefined neighbours exactly along the outer patch boundary.
        if (x === 0 && !selected.has(key - 1))
          height = source.getZ(a) * (1 - v) + source.getZ(b) * v;
        if (x === divisions && !selected.has(key + 1))
          height = source.getZ(d) * (1 - v) + source.getZ(c) * v;
        if (z === 0 && !selected.has(key - segments))
          height = source.getZ(a) * (1 - u) + source.getZ(d) * u;
        if (z === divisions && !selected.has(key + segments))
          height = source.getZ(b) * (1 - u) + source.getZ(c) * u;
        vertices.push(positions.length / 3);
        positions.push(worldX, -worldZ, height);
      }
    }
    const firstIndex = indices.length;
    for (let z = 0; z < divisions; z++)
      for (let x = 0; x < divisions; x++) {
        const a = vertices[z * (divisions + 1) + x]!,
          b = vertices[(z + 1) * (divisions + 1) + x]!,
          c = vertices[(z + 1) * (divisions + 1) + x + 1]!,
          d = vertices[z * (divisions + 1) + x + 1]!;
        indices.push(a, b, d, b, c, d);
      }
    const first = (northRow * segments + i) * 6;
    indices.fill(0, first, first + 6);
    // Store keys in the existing digging grid's north-to-south row order.
    refined.set(northRow * segments + i, {
      vertices,
      divisions,
      firstIndex,
      indexCount: indices.length - firstIndex,
    });
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.deleteAttribute('normal');
  geometry.deleteAttribute('uv');
  geometry.setIndex(indices);
  return refined;
}
