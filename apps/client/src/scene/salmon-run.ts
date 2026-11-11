import * as THREE from 'three/webgpu';

import { STREAM } from '@acorn/shared';

import salmonUrl from '@assets/critters/salmon.glb?url';

import {
  SHOAL_SIZE,
  leaperAt,
  shoalAt,
  swimmerAt,
  swimmerCount,
  type SalmonPose,
} from '../art/salmon-run';
import { loadAnimatedModel } from './model-loading';

/**
 * The salmon of the autumn run (decision 0294), drawn by each player's own
 * game from the shared clock: swimmers up the Alderwash, leapers at each
 * waterfall and a shoal at the river's mouth. One model (tools/art/salmon.py),
 * drawn many times from one pool. Scenery only: they cannot be caught by hand
 * and the server does not track them.
 */

/** The most salmon ever drawn at once. */
const POOL = 72;
/** Salmon further than this from the player are not drawn. */
const REACH = 70;

let template: { geometry: THREE.BufferGeometry; material: THREE.Material } | null = null;
let loading: Promise<void> | null = null;

/** Fetches the salmon model once. Safe to call more than once. */
export function preloadSalmon(): Promise<void> {
  loading ??= loadAnimatedModel(salmonUrl)
    .then((model) => {
      model.root.updateMatrixWorld(true);
      model.root.traverse((child) => {
        if (template !== null || !(child instanceof THREE.Mesh)) return;
        const geometry = (child.geometry as THREE.BufferGeometry).clone();
        geometry.applyMatrix4(child.matrixWorld);
        const material = Array.isArray(child.material) ? child.material[0] : child.material;
        if (material !== undefined) template = { geometry, material };
      });
    })
    .catch((error: unknown) => {
      // The run still happens without them; the fishing does not depend on the picture.
      console.warn('The salmon could not be loaded', error);
    });
  return loading;
}

export interface SalmonRun {
  readonly group: THREE.Group;
  /** How many salmon are drawn just now, for tests. */
  inView(): number;
  /**
   * `worldSeconds` is the world's shared clock. With reduced motion the fish
   * hold still where they are and none leap.
   */
  update(
    watcher: { readonly x: number; readonly z: number },
    worldSeconds: number,
    running: boolean,
    reducedMotion: boolean,
  ): void;
  dispose(): void;
}

export function createSalmonRun(): SalmonRun {
  const group = new THREE.Group();
  group.name = 'salmon-run';
  group.visible = false;
  let fish: THREE.InstancedMesh | null = null;
  const dummy = new THREE.Object3D();
  let stillAt: number | null = null;
  const swimmers = swimmerCount();

  function ensure(): THREE.InstancedMesh | null {
    if (fish !== null || template === null) return fish;
    fish = new THREE.InstancedMesh(template.geometry, template.material, POOL);
    fish.name = 'salmon';
    fish.frustumCulled = false;
    fish.castShadow = false;
    fish.count = 0;
    group.add(fish);
    return fish;
  }

  return {
    group,
    inView: () => (group.visible && fish !== null ? fish.count : 0),
    update(watcher, worldSeconds, running, reducedMotion) {
      const mesh = running ? ensure() : fish;
      if (!running || mesh === null) {
        group.visible = false;
        if (mesh !== null) mesh.count = 0;
        stillAt = null;
        return;
      }
      if (reducedMotion) stillAt ??= worldSeconds;
      else stillAt = null;
      const seconds = stillAt ?? worldSeconds;
      let used = 0;
      const place = (pose: SalmonPose | null): void => {
        if (pose === null || used >= POOL) return;
        const dx = pose.x - watcher.x;
        const dz = pose.z - watcher.z;
        if (dx * dx + dz * dz > REACH * REACH) return;
        dummy.position.set(pose.x, pose.y, pose.z);
        dummy.rotation.set(-pose.pitch, pose.yaw, 0, 'YXZ');
        dummy.updateMatrix();
        mesh.setMatrixAt(used++, dummy.matrix);
      };
      // Leapers first, so a crowded river never crowds them out of the pool.
      if (!reducedMotion)
        for (let index = 0; index < STREAM.falls.length; index++) place(leaperAt(index, seconds));
      for (let index = 0; index < SHOAL_SIZE; index++) place(shoalAt(index, seconds));
      for (let index = 0; index < swimmers; index++) place(swimmerAt(index, seconds));
      mesh.count = used;
      mesh.instanceMatrix.needsUpdate = true;
      group.visible = used > 0;
    },
    dispose() {
      group.removeFromParent();
      // The geometry and material are the shared template's, kept for the next world.
      fish?.dispose();
    },
  };
}
