import * as THREE from 'three/webgpu';
import { smoothstep } from '@acorn/shared';

export type GroundHeight = (x: number, z: number) => number;

/** A loose part, such as stacked firewood, rests on the slope as a whole. */
export function groundLooseBuildingPart(group: THREE.Group, heightAt: GroundHeight): void {
  const parent = group.parent!;
  parent.updateWorldMatrix(true, false);
  const inverse = parent.matrixWorld.clone().invert();
  const point = new THREE.Vector3();
  const sample = (x: number, z: number) => {
    point.set(x, 0, z).applyMatrix4(parent.matrixWorld);
    point.y = heightAt(point.x, point.z);
    return point.applyMatrix4(inverse).y;
  };
  const { x, z } = group.position;
  group.position.y = sample(x, z) - 0.02;
  const slopeX = (sample(x + 0.25, z) - sample(x - 0.25, z)) / 0.5;
  const slopeZ = (sample(x, z + 0.25) - sample(x, z - 0.25)) / 0.5;
  group.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(-slopeX, 1, -slopeZ).normalize(),
  );
}

/**
 * Extend the existing lower support into the hillside, leaving its top and
 * the building above it level. Reapply from the original geometry so moving
 * and rotating a placement preview never accumulates deformation.
 */
export function groundBuildingSupport(
  mesh: THREE.Mesh,
  band: number,
  followGround = false,
): (heightAt: GroundHeight) => void {
  const geometry = mesh.geometry;
  const positions = geometry.getAttribute('position');
  const original = Float32Array.from(positions.array);
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox!.clone();
  const bottom = bounds.min.y;
  const weights = Array.from(
    { length: positions.count },
    (_, vertex) => 1 - smoothstep(positions.getY(vertex), bottom, bottom + band),
  );
  const center = bounds.getCenter(new THREE.Vector3());
  const point = new THREE.Vector3();
  const inverse = new THREE.Matrix4();

  return (heightAt) => {
    if (followGround) {
      mesh.position.y = 0;
      mesh.updateWorldMatrix(true, false);
      point.set(center.x, 0, center.z).applyMatrix4(mesh.matrixWorld);
      const offset = heightAt(point.x, point.z) - point.y;
      // Supports inherit only yaw and scale from the upright home.
      const scaleY = new THREE.Vector3().setFromMatrixScale(mesh.matrixWorld).y;
      mesh.position.y = offset / scaleY;
    }
    mesh.updateWorldMatrix(true, false);
    inverse.copy(mesh.matrixWorld).invert();
    let lowest = Infinity;
    // Include the visible terrain's neighbouring coarse triangles. This
    // prevents a small analytic/mesh height difference exposing a bottom cap.
    for (const padding of [0, 1.25])
      for (let ix = 0; ix <= 4; ix++)
        for (let iz = 0; iz <= 4; iz++) {
          point
            .set(
              THREE.MathUtils.lerp(bounds.min.x - padding, bounds.max.x + padding, ix / 4),
              bottom,
              THREE.MathUtils.lerp(bounds.min.z - padding, bounds.max.z + padding, iz / 4),
            )
            .applyMatrix4(mesh.matrixWorld);
          lowest = Math.min(lowest, heightAt(point.x, point.z));
        }
    for (let vertex = 0; vertex < positions.count; vertex++) {
      const x = original[vertex * 3]!,
        y = original[vertex * 3 + 1]!,
        z = original[vertex * 3 + 2]!;
      point.set(x, bottom, z).applyMatrix4(mesh.matrixWorld);
      point.y = Math.min(point.y, lowest - 0.08);
      point.applyMatrix4(inverse);
      positions.setXYZ(vertex, x, y + weights[vertex]! * (point.y - bottom), z);
    }
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  };
}
