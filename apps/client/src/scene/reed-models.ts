import * as THREE from 'three/webgpu';

import { REED_PATCH_DEPTH } from '@acorn/shared';

import { plainMaterial } from '../art/materials';
import { waterPlantMaterials } from './water-plants';

/**
 * The reeds that can be cut at the lake, and what they are twisted into (see
 * decision 0091). Built from the same plain shapes and shared colours as the
 * scenery reeds around them, so a patch you can cut reads as part of the
 * shore and not a sign; the ground items add and remove its tufts as it is
 * cut and as it grows back.
 */

/** What each of these models hands back: the parts to show one at a time, and how to free what it owns. */
export interface PartsModel {
  readonly group: THREE.Group;
  readonly parts: readonly THREE.Object3D[];
  dispose(): void;
}

/**
 * Where each tuft of a patch stands, in the order they are cut: a patch with
 * three left shows the first three, within a step or two of its middle.
 */
const TUFT_PLACES: readonly { x: number; z: number; tall: number; turn: number }[] = [
  { x: 0, z: 0, tall: 1, turn: 0.3 },
  { x: 0.34, z: 0.14, tall: 0.88, turn: 1.7 },
  { x: -0.3, z: 0.22, tall: 0.95, turn: 3.1 },
  { x: 0.12, z: -0.34, tall: 0.82, turn: 4.4 },
  { x: -0.34, z: -0.14, tall: 0.9, turn: 5.3 },
  { x: 0.36, z: -0.12, tall: 0.78, turn: 0.9 },
];

/** How tall a full tuft stands above the water, in metres. */
const TUFT_HEIGHT = 1.15;

/**
 * A patch of cuttable reeds standing in the shallows: a tuft of flat blades
 * for every reed left in it, with a brown cattail on the tallest.
 *
 * The group sits on the lake bed, which is `REED_PATCH_DEPTH` under the water,
 * so every blade starts that much taller than it shows.
 */
export function createReedPatchModel(): PartsModel {
  const materials = waterPlantMaterials();
  const bladeHeight = TUFT_HEIGHT + REED_PATCH_DEPTH;
  const bladeGeometry = new THREE.ConeGeometry(0.04, bladeHeight, 4);
  bladeGeometry.translate(0, bladeHeight / 2, 0);
  const stalkHeight = bladeHeight + 0.2;
  const stalkGeometry = new THREE.CylinderGeometry(0.009, 0.013, stalkHeight, 4);
  stalkGeometry.translate(0, stalkHeight / 2, 0);
  const headGeometry = new THREE.CapsuleGeometry(0.03, 0.15, 2, 6);
  headGeometry.translate(0, stalkHeight - 0.12, 0);

  const group = new THREE.Group();
  const tufts: THREE.Group[] = [];
  for (const place of TUFT_PLACES) {
    const tuft = new THREE.Group();
    tuft.position.set(place.x, 0, place.z);
    tuft.rotation.y = place.turn;
    tuft.scale.y = place.tall;
    for (let blade = 0; blade < 3; blade++) {
      const mesh = new THREE.Mesh(bladeGeometry, blade === 1 ? materials.reedPale : materials.reed);
      const around = (blade / 3) * Math.PI * 2 + place.turn;
      mesh.position.set(Math.cos(around) * 0.05, 0, Math.sin(around) * 0.05);
      mesh.rotation.set(Math.sin(around) * 0.16, around, -Math.cos(around) * 0.16);
      mesh.scale.set(1, 1, 0.25);
      mesh.castShadow = true;
      tuft.add(mesh);
    }
    const stalk = new THREE.Mesh(stalkGeometry, materials.reed);
    stalk.position.set(0.03, 0, 0);
    const head = new THREE.Mesh(headGeometry, materials.cattail);
    head.position.set(0.03, 0, 0);
    head.castShadow = true;
    tuft.add(stalk, head);
    tufts.push(tuft);
    group.add(tuft);
  }

  return {
    group,
    parts: tufts,
    dispose: () => {
      bladeGeometry.dispose();
      stalkGeometry.dispose();
      headGeometry.dispose();
    },
  };
}

/** Where each of the first few cut reeds lies, crossed over one another. */
const LYING_REEDS: readonly { x: number; z: number; yaw: number; length: number }[] = [
  { x: 0, z: 0, yaw: 0.35, length: 0.9 },
  { x: 0.04, z: 0.07, yaw: -0.5, length: 0.82 },
  { x: -0.06, z: -0.05, yaw: 1.2, length: 0.76 },
];

/** A few cut reeds lying on the grass, one more for each of the first few there are. */
export function createReedPileModel(): PartsModel {
  const materials = waterPlantMaterials();
  const geometry = new THREE.CylinderGeometry(0.02, 0.026, 1, 5).rotateZ(Math.PI / 2);
  const group = new THREE.Group();
  const reeds: THREE.Mesh[] = [];
  LYING_REEDS.forEach((place, index) => {
    const mesh = new THREE.Mesh(geometry, index === 1 ? materials.reedPale : materials.reed);
    mesh.position.set(place.x, 0.03 + index * 0.035, place.z);
    mesh.rotation.y = place.yaw;
    mesh.scale.x = place.length;
    mesh.castShadow = true;
    group.add(mesh);
    reeds.push(mesh);
  });
  return { group, parts: reeds, dispose: () => geometry.dispose() };
}

/** The rope's straw-gold, shared with everything else of the same colour. */
const ROPE_COLOUR = 0xc9a46a;
/** How many coils a pile of rope shows at most, however much it really holds. */
const ROPE_COILS = 3;

/** Rope lying in a flat coil, another coil on top for each of the first few there are. */
export function createRopeModel(): PartsModel {
  const material = plainMaterial(ROPE_COLOUR, { roughness: 1, flatShading: true });
  const geometry = new THREE.TorusGeometry(0.13, 0.03, 5, 14).rotateX(Math.PI / 2);
  const group = new THREE.Group();
  const coils: THREE.Mesh[] = [];
  for (let index = 0; index < ROPE_COILS; index++) {
    const coil = new THREE.Mesh(geometry, material);
    coil.position.set(index * 0.025, 0.035 + index * 0.05, index * -0.02);
    coil.rotation.y = index * 0.9;
    coil.castShadow = true;
    group.add(coil);
    coils.push(coil);
  }
  return { group, parts: coils, dispose: () => geometry.dispose() };
}
