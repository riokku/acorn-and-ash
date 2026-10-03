import * as THREE from 'three/webgpu';
import type { BuildArea, Terrain } from '@acorn/shared';

/** A ground-following ribbon; only rebuilt when its center or tier changes. */
export function createBuildBoundary(terrain: Terrain) {
  const geometry = new THREE.BufferGeometry();
  const material = new THREE.MeshBasicMaterial({
    color: 0xa3e4c7,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const group = new THREE.Group();
  const ribbon = new THREE.Mesh(geometry, material);
  ribbon.renderOrder = 3;
  ribbon.frustumCulled = false;
  group.add(ribbon);
  group.name = 'home-building-boundary';
  group.visible = false;
  let previous = '';
  return {
    group,
    show(area: BuildArea | null, blocked: boolean): void {
      group.visible = area !== null;
      if (area === null) return;
      material.color.setHex(blocked ? 0xffa28a : 0xa3e4c7);
      const key = `${area.x}:${area.z}:${area.radius}`;
      if (key === previous) return;
      previous = key;
      const positions: number[] = [];
      const point = (angle: number, radius: number): number[] => {
        const x = area.x + Math.cos(angle) * radius,
          z = area.z + Math.sin(angle) * radius;
        return [x, terrain.heightAt(x, z) + 0.07, z];
      };
      for (let segment = 0; segment < 256; segment++) {
        const a = (segment * Math.PI) / 128,
          b = ((segment + 1) * Math.PI) / 128;
        const insideA = point(a, area.radius - 0.06),
          outsideA = point(a, area.radius + 0.06);
        const insideB = point(b, area.radius - 0.06),
          outsideB = point(b, area.radius + 0.06);
        positions.push(...insideA, ...outsideA, ...outsideB, ...insideA, ...outsideB, ...insideB);
      }
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.computeBoundingSphere();
    },
    dispose(): void {
      geometry.dispose();
      material.dispose();
    },
  };
}
