import * as THREE from 'three/webgpu';

import type { WaterCircle } from '@acorn/shared';

/**
 * Where the water's surface is drawn.
 *
 * A hair above the ground, which is a flat plane at zero, so the ground does
 * not show through. The float bobs relative to this.
 */
export const WATER_SURFACE_Y = 0.03;
/** The muddy bank sits between the grass and the water. */
const BANK_Y = 0.015;
/** How far the bank reaches out past the water's edge. */
const BANK_WIDTH = 0.55;

/** Lily pads, as a fraction of the way from a circle's middle to its edge, and an angle. */
const LILY_PADS: readonly { circle: number; out: number; angle: number; size: number }[] = [
  { circle: 0, out: 0.55, angle: 0.4, size: 0.42 },
  { circle: 0, out: 0.7, angle: 2.3, size: 0.34 },
  { circle: 0, out: 0.35, angle: 4.1, size: 0.3 },
  { circle: 1, out: 0.6, angle: 1.2, size: 0.38 },
  { circle: 1, out: 0.45, angle: 3.6, size: 0.28 },
  { circle: 2, out: 0.5, angle: 5.2, size: 0.33 },
];

/** Reeds stand in the shallows, just inside the edge, where nobody walks. */
const REED_CLUMPS: readonly { circle: number; angle: number }[] = [
  { circle: 0, angle: 3.9 },
  { circle: 1, angle: 0.3 },
  { circle: 1, angle: 5.6 },
  { circle: 2, angle: 2.6 },
];

/**
 * The pond, in placeholder shapes: flat water on a muddy bank, a few lily pads
 * and some reeds.
 *
 * Each circle of the pond is drawn as its own disc. Where two overlap they
 * share the same colour and height, so the join does not show.
 */
export function createPond(water: readonly WaterCircle[]): {
  group: THREE.Group;
  dispose(): void;
} {
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];

  const waterMaterial = new THREE.MeshStandardMaterial({
    color: 0x3d7c8f,
    roughness: 0.18,
    metalness: 0.05,
  });
  const bankMaterial = new THREE.MeshStandardMaterial({ color: 0x6f5f45, roughness: 1 });
  const padMaterial = new THREE.MeshStandardMaterial({
    color: 0x5c8a3a,
    roughness: 0.8,
    flatShading: true,
  });
  const reedMaterial = new THREE.MeshStandardMaterial({
    color: 0x4f6b2f,
    roughness: 0.9,
    flatShading: true,
  });

  for (const circle of water) {
    const bank = flatDisc(circle.radius + BANK_WIDTH, 28);
    geometries.push(bank);
    const bankMesh = new THREE.Mesh(bank, bankMaterial);
    bankMesh.position.set(circle.x, BANK_Y, circle.z);
    bankMesh.receiveShadow = true;
    group.add(bankMesh);

    const surface = flatDisc(circle.radius, 28);
    geometries.push(surface);
    const surfaceMesh = new THREE.Mesh(surface, waterMaterial);
    surfaceMesh.position.set(circle.x, WATER_SURFACE_Y, circle.z);
    surfaceMesh.receiveShadow = true;
    group.add(surfaceMesh);
  }

  for (const pad of LILY_PADS) {
    const circle = water[pad.circle];
    if (circle === undefined) continue;
    const geometry = flatDisc(pad.size, 9);
    geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, padMaterial);
    const out = circle.radius * pad.out;
    mesh.position.set(
      circle.x + Math.cos(pad.angle) * out,
      WATER_SURFACE_Y + 0.01,
      circle.z + Math.sin(pad.angle) * out,
    );
    mesh.rotation.y = pad.angle * 2.7;
    group.add(mesh);
  }

  const reed = new THREE.ConeGeometry(0.05, 1.1, 5);
  reed.translate(0, 0.55, 0);
  geometries.push(reed);
  for (const clump of REED_CLUMPS) {
    const circle = water[clump.circle];
    if (circle === undefined) continue;
    const edge = circle.radius - 0.35;
    const baseX = circle.x + Math.cos(clump.angle) * edge;
    const baseZ = circle.z + Math.sin(clump.angle) * edge;
    for (let i = 0; i < 5; i++) {
      const stalk = new THREE.Mesh(reed, reedMaterial);
      const spin = clump.angle * 3 + i * 1.7;
      stalk.position.set(
        baseX + Math.cos(spin) * 0.18,
        WATER_SURFACE_Y,
        baseZ + Math.sin(spin) * 0.18,
      );
      stalk.scale.y = 0.7 + ((i * 37) % 10) / 20;
      stalk.rotation.set(Math.cos(spin) * 0.12, 0, Math.sin(spin) * 0.12);
      stalk.castShadow = true;
      group.add(stalk);
    }
  }

  return {
    group,
    dispose: () => {
      for (const geometry of geometries) geometry.dispose();
      waterMaterial.dispose();
      bankMaterial.dispose();
      padMaterial.dispose();
      reedMaterial.dispose();
    },
  };
}

/** A flat disc lying on the ground, facing up. */
function flatDisc(radius: number, segments: number): THREE.BufferGeometry {
  const geometry = new THREE.CircleGeometry(radius, segments);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}
