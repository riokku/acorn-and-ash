import { describe, expect, it } from 'vitest';
import * as THREE from 'three/webgpu';
import { createFlatTerrain } from '@acorn/shared';
import { groundAlongRay } from '../src/building/ground-ray';
import { createBuildBoundary } from '../src/scene/build-boundary';

describe('wilderness building feedback', () => {
  it('intersects elevated ground instead of the old zero-height plane', () => {
    const hit = groundAlongRay(
      { x: 0, y: 10, z: 0 },
      { x: 0, y: -Math.SQRT1_2, z: -Math.SQRT1_2 },
      createFlatTerrain(4),
    );
    expect(hit?.z).toBeCloseTo(-6, 2);
    expect(
      groundAlongRay({ x: 0, y: 10, z: 0 }, { x: 0, y: 1, z: 0 }, createFlatTerrain(4)),
    ).toBeNull();
  });
  it('follows the ground at its full radius and releases its geometry', () => {
    const boundary = createBuildBoundary(createFlatTerrain(4));
    boundary.show({ x: 90, z: 80, radius: 36 }, false);
    expect(boundary.group.visible).toBe(true);
    const mesh = boundary.group.children[0] as THREE.Mesh<THREE.BufferGeometry>;
    const bounds = new THREE.Box3().setFromObject(boundary.group);
    expect(bounds.min.x).toBeCloseTo(90 - 36.06, 2);
    expect(bounds.max.y).toBeCloseTo(4.07, 2);
    const before = mesh.geometry.attributes.position;
    boundary.show({ x: 90, z: 80, radius: 36 }, true);
    expect(mesh.geometry.attributes.position).toBe(before);
    boundary.show(null, false);
    expect(boundary.group.visible).toBe(false);
    boundary.dispose();
  });
});
