import * as THREE from 'three/webgpu';

import { plainMaterial } from '../art/materials';
import type { ModelBuilder } from '../art/shapes';
import { placed } from '../art/shapes';

/**
 * The plants that grow in still water, shared by the pond and the lake: lily
 * pads - some in flower - and clumps of reeds and cattails. Each is added to a
 * `ModelBuilder`, which merges everything that shares a material, so any
 * number of them costs a handful of draw calls.
 */

export interface WaterPlantMaterials {
  readonly pad: THREE.Material;
  readonly padUnder: THREE.Material;
  readonly petal: THREE.Material;
  readonly petalPink: THREE.Material;
  readonly heart: THREE.Material;
  readonly reed: THREE.Material;
  readonly reedPale: THREE.Material;
  readonly cattail: THREE.Material;
}

/** The painted colours the plants wear: plain, shared materials, so there is nothing of their own to free. */
export function waterPlantMaterials(): WaterPlantMaterials {
  return {
    pad: plainMaterial(0x5f9138, { roughness: 0.7, flatShading: true }),
    padUnder: plainMaterial(0x7a8a3c, { roughness: 0.8, flatShading: true }),
    petal: plainMaterial(0xfbeef0, { roughness: 0.6, flatShading: true }),
    petalPink: plainMaterial(0xf4b9c8, { roughness: 0.6, flatShading: true }),
    heart: plainMaterial(0xf2c94c, { roughness: 0.6, flatShading: true }),
    reed: plainMaterial(0x5d7a35, { roughness: 0.9, flatShading: true }),
    reedPale: plainMaterial(0x8a9a4a, { roughness: 0.9, flatShading: true }),
    cattail: plainMaterial(0x6b4a2e, { roughness: 1, flatShading: true }),
  };
}

/**
 * A round pad with the notch every lily pad has, and a lighter underside
 * showing at its curled edge. `flower` puts a water lily in bloom on it.
 */
export function addLilyPad(
  builder: ModelBuilder,
  materials: WaterPlantMaterials,
  at: { x: number; y: number; z: number },
  size: number,
  angle: number,
  flower: 'white' | 'pink' | null,
  surfaceHeightAt: (x: number, z: number) => number = () => at.y,
): void {
  const notch = 0.5;
  const top = new THREE.CircleGeometry(size, 12, notch / 2, Math.PI * 2 - notch);
  top.rotateX(-Math.PI / 2);
  const under = new THREE.CircleGeometry(size * 1.03, 12, notch / 2, Math.PI * 2 - notch);
  under.rotateX(-Math.PI / 2);
  const turn = { y: angle * 2.7 };
  for (const geometry of [top, under]) {
    const positions = geometry.getAttribute('position');
    for (let vertex = 0; vertex < positions.count; vertex++) {
      const x = positions.getX(vertex);
      const z = positions.getZ(vertex);
      const worldX = at.x + Math.cos(turn.y) * x + Math.sin(turn.y) * z;
      const worldZ = at.z - Math.sin(turn.y) * x + Math.cos(turn.y) * z;
      positions.setY(vertex, surfaceHeightAt(worldX, worldZ) - at.y);
    }
    geometry.computeVertexNormals();
  }
  builder.add(materials.pad, top, placed(at.x, at.y + 0.012, at.z, turn));
  builder.add(materials.padUnder, under, placed(at.x, at.y + 0.006, at.z, turn));
  if (flower === null) return;

  const colour = flower === 'white' ? materials.petal : materials.petalPink;
  for (let p = 0; p < 7; p++) {
    const petalAngle = (p / 7) * Math.PI * 2;
    builder.add(
      colour,
      new THREE.ConeGeometry(0.045, 0.12, 4),
      placed(
        at.x + Math.cos(petalAngle) * 0.04,
        at.y + 0.05,
        at.z + Math.sin(petalAngle) * 0.04,
        { y: -petalAngle, z: -1.0 },
        { x: 1, y: 1, z: 0.45 },
      ).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)),
    );
  }
  builder.add(
    materials.heart,
    new THREE.IcosahedronGeometry(0.03, 0),
    placed(at.x, at.y + 0.06, at.z),
  );
}

/**
 * A clump of seven long, flat blades, a few with a cattail: a thin stalk with
 * a brown velvet head. `random` supplies the spread and lean, so the same
 * seed grows the same clump.
 */
export function addReedClump(
  builder: ModelBuilder,
  materials: WaterPlantMaterials,
  random: () => number,
  at: { x: number; y: number; z: number },
  bladeCount = 7,
): void {
  for (let i = 0; i < bladeCount; i++) {
    const spin = random() * Math.PI * 2;
    const spread = random() * 0.22;
    const height = 0.7 + random() * 0.6;
    const lean = { x: (random() - 0.5) * 0.3, z: (random() - 0.5) * 0.3 };
    const bx = at.x + Math.cos(spin) * spread;
    const bz = at.z + Math.sin(spin) * spread;
    const blade = new THREE.ConeGeometry(0.035, height, 4);
    blade.translate(0, height / 2, 0);
    builder.add(
      random() < 0.3 ? materials.reedPale : materials.reed,
      blade,
      placed(bx, at.y, bz, { ...lean, y: spin }, { x: 1, y: 1, z: 0.25 }),
    );
    if (i % 3 === 0) {
      const stalkHeight = height + 0.25;
      const stalk = new THREE.CylinderGeometry(0.008, 0.012, stalkHeight, 4);
      stalk.translate(0, stalkHeight / 2, 0);
      const stalkMatrix = placed(bx + 0.03, at.y, bz, lean);
      builder.add(materials.reed, stalk, stalkMatrix);
      const head = new THREE.CapsuleGeometry(0.028, 0.14, 2, 6);
      head.translate(0, stalkHeight - 0.12, 0);
      builder.add(materials.cattail, head, stalkMatrix);
    }
  }
}
