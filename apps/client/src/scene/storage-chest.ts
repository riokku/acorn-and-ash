import * as THREE from 'three/webgpu';
import { ModelBuilder, placed, plankGeometry } from '../art/shapes';
import { paintedMaterial, plainMaterial } from '../art/materials';
import { polyforkGroup, polyforkPiece } from './polyfork-piece';

/**
 * Polyfork's free Common Chest (decision 0272) is 0.64 m tall and deep; ours,
 * and the solid shape around it, is 0.51 m tall and 0.5 m deep. It keeps its
 * width and is lowered and shortened evenly to fit.
 */
const CHEST_FIT = new THREE.Vector3(1.01, 0.8, 0.8);
/** Where Polyfork's lid hinges, along the chest's back edge, before fitting. */
const POLYFORK_HINGE = new THREE.Vector3(0, 0.45, -0.3);
const polyforkChest = polyforkPiece(
  'common-chest',
  new THREE.Matrix4().makeScale(CHEST_FIT.x, CHEST_FIT.y, CHEST_FIT.z),
);
let polyforkLid: THREE.BufferGeometry | undefined;

export interface StorageChest {
  readonly group: THREE.Group;
  /** Hinged at the back; turning it towards negative X opens it. */
  readonly lid: THREE.Group;
  dispose(): void;
}

/** The existing indoor chest, shared by the outdoor pantry. */
export function createStorageChest(
  materials = {
    darkWood: paintedMaterial('wood', { tint: 0x8f6444, roughness: 0.8 }),
    iron: plainMaterial(0x3b3733, { roughness: 0.55 }),
    brass: plainMaterial(0xb68a3e, { roughness: 0.35 }),
  },
): StorageChest {
  const polyfork = createPolyforkChest();
  if (polyfork !== undefined) return polyfork;

  const chest = new THREE.Group();
  chest.name = 'storage-chest';
  const chestBody = new ModelBuilder();
  chestBody
    .add(materials.darkWood, plankGeometry(0.9, 0.45, 0.46, 'x', 1, 482), placed(0, 0.225, 0))
    .add(materials.iron, plankGeometry(0.94, 0.04, 0.02, 'x', 1, 0), placed(0, 0.32, 0.24))
    .add(materials.brass, new THREE.BoxGeometry(0.08, 0.1, 0.03), placed(0, 0.4, 0.245));
  const body = chestBody.build();
  chest.add(body.group);
  const lid = new THREE.Group();
  lid.position.set(0, 0.45, -0.25);
  const lidModel = new ModelBuilder();
  lidModel.add(
    materials.darkWood,
    plankGeometry(0.94, 0.06, 0.5, 'x', 1, 483),
    placed(0, 0.03, 0.25),
  );
  const top = lidModel.build();
  lid.add(top.group);
  chest.add(lid);

  return {
    group: chest,
    lid,
    dispose() {
      body.dispose();
      top.dispose();
    },
  };
}

/** Polyfork's chest, its lid turning on the hinge like ours (negative X opens it). */
function createPolyforkChest(): StorageChest | undefined {
  const parts = polyforkChest.parts();
  const body = parts?.get('body');
  const lidMesh = parts?.get('lid-mesh');
  if (body === undefined || lidMesh === undefined) return undefined;
  const hinge = POLYFORK_HINGE.clone().multiply(CHEST_FIT);
  // The lid was loaded where it sits on the chest; moved so the hinge is its origin.
  polyforkLid ??= lidMesh.clone().translate(-hinge.x, -hinge.y, -hinge.z);

  const chest = polyforkGroup('storage-chest', [body]);
  const lid = polyforkGroup('storage-chest-lid', [polyforkLid]).group;
  lid.position.copy(hinge);
  chest.group.add(lid);
  return { group: chest.group, lid, dispose: chest.dispose };
}
