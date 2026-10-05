import * as THREE from 'three/webgpu';

import { REED_PATCHES, type WaterCircle } from '@acorn/shared';

import { createBankMaterial, createWaterMaterial, paintedMaterial } from '../art/materials';
import { seededRandom } from '../art/noise';
import { ModelBuilder, placed, stoneGeometry } from '../art/shapes';
import { addLilyPad, addReedClump, waterPlantMaterials } from './water-plants';

/**
 * Where the water's surface is drawn.
 *
 * A hair above the ground, which is a flat plane at zero, so the ground does
 * not show through. The float bobs relative to this.
 */
export const WATER_SURFACE_Y = 0.03;
/** The muddy bank sits between the grass and the water. */
const BANK_Y = 0.015;
/** How far the bank reaches out past the water's edge, fading into the grass as it goes. */
const BANK_WIDTH = 0.85;

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

/** Scenery reeds keep this far from a reed that can be cut, in metres. */
const REED_PATCH_CLEAR = 1.8;

/**
 * The pond (see decision 0053): painted water on a muddy bank that fades
 * into the grass, lily pads - a couple in flower - clumps of reeds and
 * cattails in the shallows, and a few stones along the edge.
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

  const waterMaterial = createWaterMaterial(water);
  const bankMaterial = createBankMaterial(water, BANK_WIDTH);
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

  // Lily pads, reeds and a few stones round the edge, all built from shared
  // painted and plain materials and merged into a handful of meshes.
  const plants = createPondPlants(water);
  group.add(plants.group);

  return {
    group,
    dispose: () => {
      for (const geometry of geometries) geometry.dispose();
      waterMaterial.dispose();
      bankMaterial.dispose();
      plants.dispose();
    },
  };
}

/** A flat disc lying on the ground, facing up. */
function flatDisc(radius: number, segments: number): THREE.BufferGeometry {
  const geometry = new THREE.CircleGeometry(radius, segments);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

/** Lily pads, reeds and stones, merged by material. */
function createPondPlants(water: readonly WaterCircle[]): { group: THREE.Group; dispose(): void } {
  const plants = waterPlantMaterials();
  const stone = paintedMaterial('stone', { roughness: 1, flatShading: true });
  const builder = new ModelBuilder();

  LILY_PADS.forEach((lily, index) => {
    const circle = water[lily.circle];
    if (circle === undefined) return;
    const out = circle.radius * lily.out;
    const at = {
      x: circle.x + Math.cos(lily.angle) * out,
      y: WATER_SURFACE_Y,
      z: circle.z + Math.sin(lily.angle) * out,
    };
    // Every other pad has a water lily in flower on it.
    const flower = index % 2 === 0 ? (index % 4 === 0 ? 'white' : 'pink') : null;
    addLilyPad(builder, plants, at, lily.size, lily.angle, flower);
  });

  const random = seededRandom(707);
  for (const clump of REED_CLUMPS) {
    const circle = water[clump.circle];
    if (circle === undefined) continue;
    const edge = circle.radius - 0.3;
    const at = {
      x: circle.x + Math.cos(clump.angle) * edge,
      y: WATER_SURFACE_Y,
      z: circle.z + Math.sin(clump.angle) * edge,
    };
    // The reeds that can be cut are drawn by the ground items, so the
    // scenery leaves a gap round each one instead of burying it.
    if (REED_PATCHES.some((bed) => Math.hypot(bed.x - at.x, bed.z - at.z) < REED_PATCH_CLEAR)) {
      continue;
    }
    addReedClump(builder, plants, random, at);
  }

  // A few stones along the edge, half in the water.
  water.forEach((circle, circleIndex) => {
    const stones = circleIndex === 0 ? 4 : 2;
    for (let i = 0; i < stones; i++) {
      const angle = random() * Math.PI * 2;
      const r = 0.12 + random() * 0.14;
      const inside = water.some(
        (other) =>
          other !== circle &&
          Math.hypot(
            circle.x + Math.cos(angle) * circle.radius - other.x,
            circle.z + Math.sin(angle) * circle.radius - other.z,
          ) < other.radius,
      );
      // Not where two circles overlap: that edge is under water.
      if (inside) continue;
      builder.add(
        stone,
        stoneGeometry(r, r * 0.55, 720 + circleIndex * 10 + i, 0.5, 0),
        placed(
          circle.x + Math.cos(angle) * (circle.radius + 0.05),
          0,
          circle.z + Math.sin(angle) * (circle.radius + 0.05),
          { y: random() * 3 },
        ),
      );
    }
  });

  return builder.build();
}
