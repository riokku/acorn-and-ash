import * as THREE from 'three/webgpu';
import {
  attribute,
  cameraPosition,
  length,
  positionWorld,
  smoothstep,
  uniform,
  uv,
} from 'three/tsl';

import type { WaterCircle } from '@acorn/shared';

import { mistAt, mistSpots, type MistSpot } from '../art/valley-mist';

/**
 * Mist lying on the water and in the hollows (decision 0287).
 *
 * Each bank is one soft, wide sheet standing upright and turned to face the
 * camera, so a handful of them overlapping read as a layer of mist. Only the
 * banks near the camera are drawn, from one pool, with nothing made per frame.
 * It is scenery: nobody's game depends on it and the server never hears of it.
 */

/** The most banks ever drawn at once. */
const POOL = 96;
/** Banks further than this from the camera are not drawn; they fade out before it. */
const REACH = 105;
/** How tall a bank stands for each metre of its width. */
const HEIGHT_SHARE = 0.3;
/** How thick the thickest part of one bank is. Several overlap. */
const THICKEST = 0.44;
/** Seconds for a bank to gather or thin out. */
const GATHER_SECONDS = 9;

const DAY_MIST = new THREE.Color(0xf1f6f7);

export interface MistState {
  /** How much mist there is over the whole world, 0 to 1 (see `mistStrength`). */
  readonly strength: number;
  /** The colour of the sky at the horizon, which is also the colour of the fog. */
  readonly haze: THREE.Color;
  /** 0 is midnight, 1 is noon. */
  readonly daylight: number;
  /** Indoors or underground: nothing is drawn. */
  readonly hidden: boolean;
  readonly reducedMotion: boolean;
}

export interface ValleyMist {
  readonly group: THREE.Group;
  /** How many banks of mist are showing, for tests. */
  visibleBanks(): number;
  update(deltaSeconds: number, camera: THREE.Camera, state: MistState): void;
  dispose(): void;
}

export function createValleyMist(
  seed: number,
  heightAt: (x: number, z: number) => number,
  pond: readonly WaterCircle[],
): ValleyMist {
  const spots: readonly MistSpot[] = mistSpots(seed, heightAt, pond);
  /** How far each spot's mist has gathered, 0 to 1. */
  const gathered = new Float32Array(spots.length);

  const geometry = new THREE.PlaneGeometry(1, 1);
  const thickness = new THREE.InstancedBufferAttribute(new Float32Array(POOL), 1);
  thickness.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('thickness', thickness);

  const colour = new THREE.Color();
  const material = new THREE.MeshBasicNodeMaterial();
  material.transparent = true;
  material.depthWrite = false;
  material.fog = false;
  material.side = THREE.DoubleSide;
  material.colorNode = uniform(colour);
  // Thick in the middle, gone at the edge, so a bank never shows as a card.
  const fromMiddle = length(uv().sub(0.5).mul(2));
  const soft = smoothstep(0.1, 1, fromMiddle).oneMinus();
  const away = length(positionWorld.sub(cameraPosition));
  // Thinned right in front of the camera, so walking into a bank never fills the screen.
  const near = smoothstep(2.5, 10, away);
  const far = smoothstep(REACH * 0.75, REACH, away).oneMinus();
  material.opacityNode = soft
    .mul(soft)
    .mul(attribute('thickness', 'float'))
    .mul(near)
    .mul(far)
    .mul(THICKEST);

  const banks = new THREE.InstancedMesh(geometry, material, POOL);
  banks.name = 'valley-mist';
  banks.frustumCulled = false;
  banks.castShadow = false;
  banks.receiveShadow = false;
  // After the water it lies on, which is see-through too.
  banks.renderOrder = 4;
  banks.count = 0;

  const group = new THREE.Group();
  group.add(banks);

  const dummy = new THREE.Object3D();
  const eye = new THREE.Vector3();
  let seconds = 0;

  return {
    group,
    visibleBanks: () => (group.visible ? banks.count : 0),
    update(deltaSeconds, camera, state) {
      const delta = Math.max(0, deltaSeconds);
      if (!state.reducedMotion) seconds += Math.min(delta, 0.1);
      const ease = Math.min(1, delta / GATHER_SECONDS);
      camera.getWorldPosition(eye);
      let used = 0;
      let any = false;
      for (let i = 0; i < spots.length; i++) {
        const spot = spots[i]!;
        const wanted = mistAt(state.strength, spot.onWater);
        const now = gathered[i]! + Math.sign(wanted - gathered[i]!) * ease;
        gathered[i] = wanted > gathered[i]! ? Math.min(wanted, now) : Math.max(wanted, now);
        if (gathered[i]! <= 0.01) continue;
        any = true;
        if (used >= POOL) continue;
        // A slow drift to and fro, each bank in its own time.
        const x = spot.x + Math.sin(seconds * 0.05 + spot.phase) * 2.5;
        const z = spot.z + Math.cos(seconds * 0.04 + spot.phase * 1.7) * 2.5;
        const dx = eye.x - x;
        const dz = eye.z - z;
        if (dx * dx + dz * dz > REACH * REACH) continue;
        const height = spot.width * HEIGHT_SHARE;
        dummy.position.set(x, spot.y + height * 0.36, z);
        dummy.rotation.set(0, Math.atan2(dx, dz), 0);
        dummy.scale.set(spot.width, height, 1);
        dummy.updateMatrix();
        banks.setMatrixAt(used, dummy.matrix);
        thickness.setX(used, gathered[i]!);
        used++;
      }
      banks.count = used;
      group.visible = any && !state.hidden && used > 0;
      if (!group.visible) return;
      banks.instanceMatrix.needsUpdate = true;
      thickness.needsUpdate = true;
      // Brighter than the air around it by day; a pale shape in moonlight.
      const day = THREE.MathUtils.clamp(state.daylight, 0, 1);
      colour
        .copy(DAY_MIST)
        .multiplyScalar(0.3 + 0.7 * day)
        .lerp(state.haze, 0.45);
    },
    dispose() {
      group.removeFromParent();
      geometry.dispose();
      material.dispose();
      banks.dispose();
    },
  };
}
