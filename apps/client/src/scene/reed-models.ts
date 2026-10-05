import * as THREE from 'three/webgpu';

import { REED_PATCH_DEPTH } from '@acorn/shared';

import { plainMaterial } from '../art/materials';
import { waterPlantMaterials } from './water-plants';

/**
 * The mature reeds at the pond and the lake that can be cut, and what they are
 * twisted into (see decisions 0091, 0099 and 0101). They stand out from the scenery reeds all
 * round them: taller, golden instead of green, with fat brown cattails, so
 * the ones worth walking to can be picked out from across the water. They are
 * still built from the same plain shapes; the ground items add and remove
 * their tufts as they are cut and as they come back.
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

/** How tall a full tuft stands above the water, in metres - well above the scenery reeds around it. */
const TUFT_HEIGHT = 1.9;
/** The gold of a mature reed's blades, and the paler gold of the odd one among them. */
const MATURE_BLADE_COLOUR = 0xd2a93c;
const MATURE_BLADE_PALE_COLOUR = 0xeccb6e;
/** The deep brown of its cattail. */
const MATURE_CATTAIL_COLOUR = 0x5a3a22;

/**
 * A patch of cuttable mature reeds standing in the shallows: a tuft of flat
 * golden blades for every reed left in it, with a fat brown cattail on each.
 *
 * The group sits on the lake bed, which is `REED_PATCH_DEPTH` under the water,
 * so every blade starts that much taller than it shows.
 */
export function createReedPatchModel(): PartsModel {
  // Shared with everything else of the same colour (see materials.ts), so never disposed here.
  const gold = plainMaterial(MATURE_BLADE_COLOUR, { roughness: 0.85, flatShading: true });
  const paleGold = plainMaterial(MATURE_BLADE_PALE_COLOUR, { roughness: 0.85, flatShading: true });
  const brown = plainMaterial(MATURE_CATTAIL_COLOUR, { roughness: 1, flatShading: true });
  const bladeHeight = TUFT_HEIGHT + REED_PATCH_DEPTH;
  const bladeGeometry = new THREE.ConeGeometry(0.05, bladeHeight, 4);
  bladeGeometry.translate(0, bladeHeight / 2, 0);
  const stalkHeight = bladeHeight + 0.25;
  const stalkGeometry = new THREE.CylinderGeometry(0.011, 0.016, stalkHeight, 4);
  stalkGeometry.translate(0, stalkHeight / 2, 0);
  const headGeometry = new THREE.CapsuleGeometry(0.045, 0.24, 2, 6);
  headGeometry.translate(0, stalkHeight - 0.16, 0);

  const group = new THREE.Group();
  const tufts: THREE.Group[] = [];
  for (const place of TUFT_PLACES) {
    const tuft = new THREE.Group();
    tuft.position.set(place.x, 0, place.z);
    tuft.rotation.y = place.turn;
    tuft.scale.y = place.tall;
    for (let blade = 0; blade < 3; blade++) {
      const mesh = new THREE.Mesh(bladeGeometry, blade === 1 ? paleGold : gold);
      const around = (blade / 3) * Math.PI * 2 + place.turn;
      mesh.position.set(Math.cos(around) * 0.05, 0, Math.sin(around) * 0.05);
      mesh.rotation.set(Math.sin(around) * 0.16, around, -Math.cos(around) * 0.16);
      mesh.scale.set(1, 1, 0.25);
      mesh.castShadow = true;
      tuft.add(mesh);
    }
    const stalk = new THREE.Mesh(stalkGeometry, gold);
    stalk.position.set(0.03, 0, 0);
    const head = new THREE.Mesh(headGeometry, brown);
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
