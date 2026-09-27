import * as THREE from 'three/webgpu';

import type { WaterCircle } from '@acorn/shared';

import {
  createBankMaterial,
  createWaterMaterial,
  paintedMaterial,
  plainMaterial,
} from '../art/materials';
import { seededRandom } from '../art/noise';
import { ModelBuilder, placed, stoneGeometry } from '../art/shapes';

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
  const pad = plainMaterial(0x5f9138, { roughness: 0.7, flatShading: true });
  const padUnder = plainMaterial(0x7a8a3c, { roughness: 0.8, flatShading: true });
  const petal = plainMaterial(0xfbeef0, { roughness: 0.6, flatShading: true });
  const petalPink = plainMaterial(0xf4b9c8, { roughness: 0.6, flatShading: true });
  const heart = plainMaterial(0xf2c94c, { roughness: 0.6, flatShading: true });
  const reed = plainMaterial(0x5d7a35, { roughness: 0.9, flatShading: true });
  const reedPale = plainMaterial(0x8a9a4a, { roughness: 0.9, flatShading: true });
  const cattail = plainMaterial(0x6b4a2e, { roughness: 1, flatShading: true });
  const stone = paintedMaterial('stone', { roughness: 1, flatShading: true });
  const builder = new ModelBuilder();

  LILY_PADS.forEach((lily, index) => {
    const circle = water[lily.circle];
    if (circle === undefined) return;
    const out = circle.radius * lily.out;
    const x = circle.x + Math.cos(lily.angle) * out;
    const z = circle.z + Math.sin(lily.angle) * out;
    // A round pad with the notch every lily pad has, and a lighter underside
    // showing at its curled edge.
    const notch = 0.5;
    const top = new THREE.CircleGeometry(lily.size, 12, notch / 2, Math.PI * 2 - notch);
    top.rotateX(-Math.PI / 2);
    const under = new THREE.CircleGeometry(lily.size * 1.03, 12, notch / 2, Math.PI * 2 - notch);
    under.rotateX(-Math.PI / 2);
    const turn = { y: lily.angle * 2.7 };
    builder.add(pad, top, placed(x, WATER_SURFACE_Y + 0.012, z, turn));
    builder.add(padUnder, under, placed(x, WATER_SURFACE_Y + 0.006, z, turn));
    // Every other pad has a water lily in flower on it.
    if (index % 2 === 0) {
      const colour = index % 4 === 0 ? petal : petalPink;
      for (let p = 0; p < 7; p++) {
        const angle = (p / 7) * Math.PI * 2;
        builder.add(
          colour,
          new THREE.ConeGeometry(0.045, 0.12, 4),
          placed(
            x + Math.cos(angle) * 0.04,
            WATER_SURFACE_Y + 0.05,
            z + Math.sin(angle) * 0.04,
            { y: -angle, z: -1.0 },
            { x: 1, y: 1, z: 0.45 },
          ).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)),
        );
      }
      builder.add(
        heart,
        new THREE.IcosahedronGeometry(0.03, 0),
        placed(x, WATER_SURFACE_Y + 0.06, z),
      );
    }
  });

  const random = seededRandom(707);
  for (const clump of REED_CLUMPS) {
    const circle = water[clump.circle];
    if (circle === undefined) continue;
    const edge = circle.radius - 0.3;
    const baseX = circle.x + Math.cos(clump.angle) * edge;
    const baseZ = circle.z + Math.sin(clump.angle) * edge;
    for (let i = 0; i < 7; i++) {
      const spin = random() * Math.PI * 2;
      const spread = random() * 0.22;
      const height = 0.7 + random() * 0.6;
      const lean = { x: (random() - 0.5) * 0.3, z: (random() - 0.5) * 0.3 };
      const bx = baseX + Math.cos(spin) * spread;
      const bz = baseZ + Math.sin(spin) * spread;
      // A long, flat blade.
      const blade = new THREE.ConeGeometry(0.035, height, 4);
      blade.translate(0, height / 2, 0);
      builder.add(
        random() < 0.3 ? reedPale : reed,
        blade,
        placed(bx, WATER_SURFACE_Y, bz, { ...lean, y: spin }, { x: 1, y: 1, z: 0.25 }),
      );
      // Some are cattails: a thin stalk with a brown velvet head.
      if (i % 3 === 0) {
        const stalkHeight = height + 0.25;
        const stalk = new THREE.CylinderGeometry(0.008, 0.012, stalkHeight, 4);
        stalk.translate(0, stalkHeight / 2, 0);
        const stalkMatrix = placed(bx + 0.03, WATER_SURFACE_Y, bz, lean);
        builder.add(reed, stalk, stalkMatrix);
        const head = new THREE.CapsuleGeometry(0.028, 0.14, 2, 6);
        head.translate(0, stalkHeight - 0.12, 0);
        builder.add(cattail, head, stalkMatrix);
      }
    }
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
