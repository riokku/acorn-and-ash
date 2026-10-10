import type * as THREE from 'three/webgpu';
import { smoothstep, type PlacedProp, type Terrain } from '@acorn/shared';

export interface PropFootprint {
  readonly bottom: number;
  readonly band: number;
  readonly radius: number;
}

/** Measure the actual roots or rock base, rather than the narrower collision cylinder. */
export function propFootprint(
  parts: readonly { geometry: THREE.BufferGeometry; offsetY: number }[],
  band: number,
): PropFootprint {
  let bottom = Infinity;
  for (const { geometry, offsetY } of parts) {
    geometry.computeBoundingBox();
    bottom = Math.min(bottom, geometry.boundingBox!.min.y + offsetY);
  }
  let radius = 0;
  for (const { geometry, offsetY } of parts) {
    const positions = geometry.getAttribute('position');
    for (let vertex = 0; vertex < positions.count; vertex++) {
      if (positions.getY(vertex) + offsetY > bottom + band) continue;
      radius = Math.max(radius, Math.hypot(positions.getX(vertex), positions.getZ(vertex)));
    }
  }
  return { bottom, band, radius };
}

/** Only the lower base stretches; the trunk, canopy and rock top keep their original placement. */
export function groundWeights(
  geometry: THREE.BufferGeometry,
  offsetY: number,
  footprint: PropFootprint,
): Float32Array {
  const positions = geometry.getAttribute('position');
  return Float32Array.from(
    { length: positions.count },
    (_, vertex) =>
      1 -
      smoothstep(
        positions.getY(vertex) + offsetY,
        footprint.bottom,
        footprint.bottom + footprint.band,
      ),
  );
}

/** How far the foot must extend to bury its bottom cap below every side of the slope. */
export function propBurialDepth(
  prop: Pick<PlacedProp, 'x' | 'y' | 'z' | 'scale'>,
  footprint: PropFootprint,
  terrain?: Terrain,
): number {
  const bottom = (prop.y ?? 0) + footprint.bottom * prop.scale;
  let lowest = terrain?.heightAt(prop.x, prop.z) ?? bottom;
  if (terrain !== undefined) {
    // Probe the foot and a surrounding ring. The outer ring covers the
    // corners of the 2.5 m visible ground triangles as well as the analytic slope.
    for (const reach of [footprint.radius * prop.scale, footprint.radius * prop.scale + 2.5]) {
      for (let step = 0; step < 16; step++) {
        const angle = (step / 16) * Math.PI * 2;
        lowest = Math.min(
          lowest,
          terrain.heightAt(prop.x + Math.cos(angle) * reach, prop.z + Math.sin(angle) * reach),
        );
      }
    }
  }
  return Math.max(0.08 * prop.scale, bottom - lowest + 0.08 * prop.scale);
}

/** The same buried base for loose shore stones that are merged rather than instanced. */
export function buryGeometryBase(
  geometry: THREE.BufferGeometry,
  at: { x: number; y: number; z: number },
  heightAt: (x: number, z: number) => number,
): THREE.BufferGeometry {
  geometry.computeBoundingBox();
  const band = (geometry.boundingBox!.max.y - geometry.boundingBox!.min.y) * 0.35;
  const footprint = propFootprint([{ geometry, offsetY: 0 }], band);
  const weights = groundWeights(geometry, 0, footprint);
  const depth = propBurialDepth({ ...at, scale: 1 }, footprint, { kind: 'shore', heightAt });
  const positions = geometry.getAttribute('position');
  for (let vertex = 0; vertex < positions.count; vertex++)
    positions.setY(vertex, positions.getY(vertex) - weights[vertex]! * depth);
  positions.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.computeVertexNormals();
  return geometry;
}
