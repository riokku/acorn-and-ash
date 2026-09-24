import * as THREE from 'three/webgpu';

import {
  ITEM_KINDS,
  PROP_KINDS,
  choppingRuleFor,
  stumpFor,
  treeAtGeneration,
  type Clearing,
  type GatherSpot,
  type PlacedPickup,
  type PlacedProp,
} from '@acorn/shared';

import { flowerModelParts } from './flower-models';
import { createPond } from './pond';
import {
  HIDDEN_INSTANCE,
  blockerGeometry,
  createCameraBlockers,
  createPropMeshes,
  placeInstance,
  placeOneInstance,
  type PropPart,
} from './props';

/** The scenery, plus an invisible mesh the camera uses to avoid clipping. */
export interface ClearingScene {
  readonly group: THREE.Group;
  /**
   * A single merged mesh of every trunk and rock, for camera raycasts. Replaced
   * when a tree comes down, so the camera stops avoiding a trunk that is gone.
   */
  cameraBlockers: THREE.Mesh;
  /** Hide whatever the server says has already been picked up. */
  setTakenPickups(taken: ReadonlySet<number>): void;
  /**
   * Put the trees where the server says they are: felled ones as stumps, grown
   * ones back at whatever size this generation of them is.
   */
  setTreeStates(states: ReadonlyMap<number, TreeAppearance>): void;
  dispose(): void;
}

/** What the server says about one tree that is not as the seed left it. */
export interface TreeAppearance {
  readonly generation: number;
  readonly felled: boolean;
}

/**
 * Build the clearing out of placeholder shapes.
 *
 * Every tree of the same kind is drawn with one instanced mesh, so a hundred and
 * fifty trees cost a handful of draw calls instead of three hundred.
 *
 * The ground itself is not built here: the wilderness scene draws one mesh for
 * the whole visible world, flat through the clearing and rolling into hills
 * beyond it, so there is only ever one surface to stand on and nothing for two
 * flat planes to z-fight over.
 */
export function buildClearingScene(clearing: Clearing): ClearingScene {
  const group = new THREE.Group();
  const disposables: Array<{ dispose(): void }> = [];

  const pond = createPond(clearing.water);
  group.add(pond.group);
  disposables.push(pond);

  const byKind = new Map<string, PlacedProp[]>();
  for (const prop of clearing.props) {
    const existing = byKind.get(prop.kind);
    if (existing === undefined) byKind.set(prop.kind, [prop]);
    else existing.push(prop);
  }

  /** Where a tree's instance sits, so it can be taken away when it is felled. */
  const standing = new Map<number, { parts: PropPart[]; index: number }>();

  for (const [kindId, props] of byKind) {
    const kind = PROP_KINDS[kindId as keyof typeof PROP_KINDS];
    const parts = createPropMeshes(kind, props.length);
    for (const part of parts) {
      group.add(part.mesh);
      disposables.push(part);
    }

    const isTree = choppingRuleFor(kind) !== null;
    props.forEach((prop, index) => {
      placeInstance(parts, index, prop);
      if (isTree) standing.set(prop.id, { parts, index });
    });

    for (const part of parts) part.mesh.instanceMatrix.needsUpdate = true;
  }

  // One spare stump per tree, waiting out of sight until that tree comes down.
  const trees = clearing.props.filter((prop) => choppingRuleFor(PROP_KINDS[prop.kind]) !== null);
  const freshStumps = createPropMeshes(PROP_KINDS.stump, trees.length);
  for (const part of freshStumps) {
    group.add(part.mesh);
    disposables.push(part);
    for (let i = 0; i < trees.length; i++) part.mesh.setMatrixAt(i, HIDDEN_INSTANCE);
    part.mesh.instanceMatrix.needsUpdate = true;
  }
  const stumpSlotOf = new Map<number, number>();
  trees.forEach((tree, index) => stumpSlotOf.set(tree.id, index));

  let cameraBlockers = createCameraBlockers(blockersFor(clearing, new Map()));
  // Never drawn: it exists so the camera can feel the trees.
  cameraBlockers.visible = false;
  group.add(cameraBlockers);

  const pickups = new Map<number, THREE.Object3D>();
  for (const pickup of clearing.pickups) {
    const model = createPickup(pickup, disposables);
    pickups.set(pickup.id, model);
    group.add(model);
  }

  // Never taken away, unlike a pickup: there is nothing here to track once it
  // is placed.
  for (const spot of clearing.gatherSpots) {
    const model =
      spot.item === 'flower'
        ? createFlowerPatch(spot, disposables)
        : createStickPile(spot, disposables);
    group.add(model);
  }

  /** What is drawn right now, so nothing is rebuilt that has not changed. */
  const drawn = new Map<number, TreeAppearance>();

  const scene: ClearingScene = {
    group,
    cameraBlockers,
    setTakenPickups: (taken) => {
      for (const [id, model] of pickups) model.visible = !taken.has(id);
    },
    setTreeStates: (states) => {
      let changed = false;

      for (const tree of trees) {
        const want = states.get(tree.id) ?? UNTOUCHED;
        const have = drawn.get(tree.id) ?? UNTOUCHED;
        if (want.felled === have.felled && want.generation === have.generation) continue;
        changed = true;

        const grown = treeAtGeneration(clearing.seed, tree, want.generation);

        const slot = standing.get(tree.id);
        if (slot !== undefined) {
          for (const part of slot.parts) {
            if (want.felled) part.mesh.setMatrixAt(slot.index, HIDDEN_INSTANCE);
            else placeOneInstance(part, slot.index, grown);
            part.mesh.instanceMatrix.needsUpdate = true;
          }
        }

        const stumpSlot = stumpSlotOf.get(tree.id);
        if (stumpSlot !== undefined) {
          for (const part of freshStumps) {
            if (want.felled) placeOneInstance(part, stumpSlot, stumpFor(grown));
            else part.mesh.setMatrixAt(stumpSlot, HIDDEN_INSTANCE);
            part.mesh.instanceMatrix.needsUpdate = true;
          }
        }

        drawn.set(tree.id, want);
      }

      // The camera should stop shying away from a trunk that is no longer
      // there, and start minding one that has grown back. Rebuilt only when
      // something actually changed, which is rare.
      if (!changed) return;
      group.remove(cameraBlockers);
      cameraBlockers.geometry.dispose();
      cameraBlockers = createCameraBlockers(blockersFor(clearing, drawn));
      cameraBlockers.visible = false;
      group.add(cameraBlockers);
      scene.cameraBlockers = cameraBlockers;
    },
    dispose: () => {
      for (const item of disposables) item.dispose();
      cameraBlockers.geometry.dispose();
    },
  };

  return scene;
}

const UNTOUCHED: TreeAppearance = { generation: 0, felled: false };

/** A cylinder for everything still standing, with stumps where trees came down. */
function blockersFor(
  clearing: Clearing,
  states: ReadonlyMap<number, TreeAppearance>,
): THREE.BufferGeometry[] {
  return clearing.props.map((prop) => {
    const state = states.get(prop.id);
    const grown = treeAtGeneration(clearing.seed, prop, state?.generation ?? 0);
    const here: PlacedProp = state?.felled === true ? stumpFor(grown) : grown;
    return blockerGeometry(PROP_KINDS[here.kind], here);
  });
}

/** Something lying in the clearing to be found, in placeholder shapes. */
function createPickup(
  pickup: PlacedPickup,
  disposables: Array<{ dispose(): void }>,
): THREE.Object3D {
  if (pickup.item === 'rod') return createRodPickup(pickup, disposables);
  return createAxePickup(pickup, disposables);
}

/**
 * A fishing rod left on the bank: a long pole propped up off the grass, with
 * its red and white float hanging from the tip so it reads as a rod and not
 * as a stick.
 */
function createRodPickup(
  pickup: PlacedPickup,
  disposables: Array<{ dispose(): void }>,
): THREE.Object3D {
  const group = new THREE.Group();

  const poleGeometry = new THREE.CylinderGeometry(0.018, 0.03, 1.7, 6);
  // Measured from the butt end, so the whole rod pivots about where it rests.
  poleGeometry.translate(0, 0.85, 0);
  const poleMaterial = new THREE.MeshStandardMaterial({
    color: ITEM_KINDS.rod.placeholderColor,
    roughness: 0.8,
    flatShading: true,
  });
  const pole = new THREE.Mesh(poleGeometry, poleMaterial);
  // Leaning east, out over the water, at a lazy angle.
  pole.rotation.z = -1.05;
  pole.castShadow = true;

  const floatGeometry = new THREE.SphereGeometry(0.06, 8, 6);
  const floatMaterial = new THREE.MeshStandardMaterial({ color: 0xd8432f, roughness: 0.5 });
  const float = new THREE.Mesh(floatGeometry, floatMaterial);
  const tip = new THREE.Vector3(0, 1.7, 0).applyEuler(pole.rotation);
  float.position.set(tip.x, tip.y - 0.35, tip.z);
  float.castShadow = true;

  group.add(pole, float);
  group.position.set(pickup.x, pickup.y + 0.05, pickup.z);

  disposables.push({
    dispose: () => {
      poleGeometry.dispose();
      poleMaterial.dispose();
      floatGeometry.dispose();
      floatMaterial.dispose();
    },
  });
  return group;
}

/**
 * An axe standing in a stump, as two placeholder blocks.
 *
 * It is tilted and pale against the dark stump so you can pick it out from
 * across the clearing, which is the whole point of it being there.
 */
function createAxePickup(
  pickup: PlacedPickup,
  disposables: Array<{ dispose(): void }>,
): THREE.Object3D {
  const group = new THREE.Group();
  const kind = ITEM_KINDS[pickup.item];

  const handleGeometry = new THREE.CylinderGeometry(0.035, 0.03, 0.7, 6);
  const handleMaterial = new THREE.MeshStandardMaterial({
    color: kind.placeholderColor,
    roughness: 0.9,
    flatShading: true,
  });
  const handle = new THREE.Mesh(handleGeometry, handleMaterial);
  handle.position.y = 0.3;
  handle.castShadow = true;

  const headGeometry = new THREE.BoxGeometry(0.1, 0.22, 0.3);
  const headMaterial = new THREE.MeshStandardMaterial({
    color: 0xc8ccd2,
    roughness: 0.45,
    metalness: 0.35,
    flatShading: true,
  });
  const head = new THREE.Mesh(headGeometry, headMaterial);
  head.position.set(0, 0.6, 0.08);
  head.castShadow = true;

  group.add(handle, head);
  group.position.set(pickup.x, pickup.y, pickup.z);
  // Sunk into the stump at an angle, the way somebody would have left it.
  group.rotation.set(0.38, 0.9, 0.1);

  disposables.push({
    dispose: () => {
      handleGeometry.dispose();
      handleMaterial.dispose();
      headGeometry.dispose();
      headMaterial.dispose();
    },
  });
  return group;
}

/**
 * A little pile of fallen branches: a few crossed sticks lying flat, sharing
 * one geometry and material since there are only ever a couple of these.
 */
function createStickPile(
  spot: GatherSpot,
  disposables: Array<{ dispose(): void }>,
): THREE.Object3D {
  const group = new THREE.Group();

  const geometry = new THREE.CylinderGeometry(0.02, 0.026, 0.55, 5);
  const material = new THREE.MeshStandardMaterial({
    color: ITEM_KINDS.stick.placeholderColor,
    roughness: 0.95,
    flatShading: true,
  });

  for (const angle of [0.3, -0.45, 0.95]) {
    const stick = new THREE.Mesh(geometry, material);
    stick.rotation.set(Math.PI / 2 - 0.12, 0, angle);
    stick.position.y = 0.05;
    stick.castShadow = true;
    group.add(stick);
  }

  group.position.set(spot.x, 0, spot.z);

  disposables.push({
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  });
  return group;
}

/**
 * A little patch of wildflowers: a handful of thin stems, each topped with a
 * small bloom, scattered within a step or two of the spot's centre.
 */
function createFlowerPatch(
  spot: GatherSpot,
  disposables: Array<{ dispose(): void }>,
): THREE.Object3D {
  const group = new THREE.Group();

  const offsets = [
    { x: 0, z: 0 },
    { x: 0.28, z: 0.12 },
    { x: -0.22, z: 0.2 },
    { x: 0.1, z: -0.26 },
    { x: -0.26, z: -0.1 },
  ];

  const realFlower = flowerModelParts();
  if (realFlower !== undefined) {
    // Shared geometry and material loaded once for every flower patch and
    // bed in the world, so this group never owns them to dispose.
    offsets.forEach((offset, index) => {
      for (const part of realFlower) {
        const bloom = new THREE.Mesh(part.geometry, part.material);
        bloom.position.set(offset.x, 0, offset.z);
        bloom.rotation.y = index * 1.3;
        bloom.castShadow = true;
        group.add(bloom);
      }
    });
  } else {
    const stemGeometry = new THREE.CylinderGeometry(0.012, 0.018, 0.3, 5);
    const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x4a7a3c, roughness: 0.9 });
    const headGeometry = new THREE.SphereGeometry(0.07, 6, 5);
    const headMaterial = new THREE.MeshStandardMaterial({
      color: ITEM_KINDS.flower.placeholderColor,
      roughness: 0.7,
      flatShading: true,
    });
    disposables.push({
      dispose: () => {
        stemGeometry.dispose();
        stemMaterial.dispose();
        headGeometry.dispose();
        headMaterial.dispose();
      },
    });

    for (const offset of offsets) {
      const stem = new THREE.Mesh(stemGeometry, stemMaterial);
      stem.position.set(offset.x, 0.15, offset.z);
      stem.castShadow = true;
      group.add(stem);

      const head = new THREE.Mesh(headGeometry, headMaterial);
      head.position.set(offset.x, 0.32, offset.z);
      head.castShadow = true;
      group.add(head);
    }
  }

  group.position.set(spot.x, 0, spot.z);
  return group;
}
