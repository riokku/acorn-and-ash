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

/** Refine local contact patches and falls; preserve the original digging grid. */
export function refineGroundContacts(
  geometry: THREE.BufferGeometry,
  terrain: Terrain,
  stream: Stream,
  size: number,
  segments: number,
  shoreCells: ReadonlyMap<number, number> = new Map(),
): Map<number, RefinedGroundCell> {
  const cell = size / segments,
    origin = -size / 2,
    stride = segments + 1;
  const selected = new Map<number, number>(shoreCells);
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
          selected.set(j * segments + i, Math.max(8, selected.get(j * segments + i) ?? 0));
      }
    }
  }
  const source = geometry.getAttribute('position');
  const positions = Array.from(source.array);
  const indices = Array.from(geometry.getIndex()!.array);
  const refined = new Map<number, RefinedGroundCell>();
  const edgeVertices = new Map<number, number>();
  const edgeStride = segments * 16 + 1;
  for (const [key, divisions] of selected) {
    const i = key % segments,
      j = Math.floor(key / segments);
    // PlaneGeometry's local Y points north before it is laid onto the ground.
    const northRow = j;
    const a = northRow * stride + i,
      b = a + stride,
      c = b + 1,
      d = a + 1;
    const vertices: number[] = [];
    // On a boundary, use the coarser neighbour's edge samples. Extra
    // vertices then lie on that same line, preventing cracks at T-junctions.
    const edgeHeight = (
      first: number,
      last: number,
      t: number,
      neighbor: number,
      current: number,
    ): number => {
      const steps = Math.min(divisions, selected.get(neighbor) ?? 1);
      if (steps === divisions) return current;
      const slot = Math.min(steps - 1, Math.floor(t * steps));
      const alpha = t * steps - slot;
      const at = (u: number): number =>
        steps === 1
          ? source.getZ(first) * (1 - u) + source.getZ(last) * u
          : terrain.heightAt(
              source.getX(first) * (1 - u) + source.getX(last) * u,
              -source.getY(first) * (1 - u) - source.getY(last) * u,
            );
      return at(slot / steps) * (1 - alpha) + at((slot + 1) / steps) * alpha;
    };
    for (let z = 0; z <= divisions; z++) {
      for (let x = 0; x <= divisions; x++) {
        const u = x / divisions,
          v = z / divisions;
        const worldX = origin + (i + u) * cell,
          worldZ = origin + (j + v) * cell;
        let height = terrain.heightAt(worldX, worldZ);
        if (x === 0) height = edgeHeight(a, b, v, key - 1, height);
        if (x === divisions) height = edgeHeight(d, c, v, key + 1, height);
        if (z === 0) height = edgeHeight(a, d, u, key - segments, height);
        if (z === divisions) height = edgeHeight(b, c, u, key + segments, height);
        const gx = i * 16 + (x * 16) / divisions,
          gz = j * 16 + (z * 16) / divisions;
        const edge = x === 0 || z === 0 || x === divisions || z === divisions;
        let vertex =
          gx % 16 === 0 && gz % 16 === 0
            ? (gz / 16) * stride + gx / 16
            : edge
              ? edgeVertices.get(gz * edgeStride + gx)
              : undefined;
        if (vertex === undefined) {
          vertex = positions.length / 3;
          positions.push(worldX, -worldZ, height);
          if (edge) edgeVertices.set(gz * edgeStride + gx, vertex);
        }
        vertices.push(vertex);
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
