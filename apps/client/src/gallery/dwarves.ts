import * as THREE from 'three/webgpu';

import {
  instantiateAnimatedModel,
  loadAnimatedModel,
  loadScaledModel,
  type AnimatedModel,
  type ModelPart,
} from '../scene/model-loading';

import dorrinUrl from '@assets/characters/dorrin.glb?url';
import hildeUrl from '@assets/characters/hilde.glb?url';
import ironAxeUrl from '@assets/items/iron-axe.glb?url';

/**
 * The dwarves (Dorrin and Hilde) and the iron axe, made in Blender (see
 * tools/art/), shown in the art gallery only - nothing in the game uses them
 * yet. `?gallery=dorrin`, `?gallery=hilde`, `?gallery=iron-axe`, or
 * `?gallery=dwarves` for all three. The dwarves play each of their eight
 * moves in turn; `&motion=walk` (or idle, run, jump, wave, chop, sit, sleep)
 * holds one.
 */

export type DwarfId = 'dorrin' | 'hilde';

/** Same scale the game draws the Quaternius characters at, so they stand level with the knight. */
const CHARACTER_SCALE = 0.6;
/** The axe at that same scale (it is 0.86 m long as modelled). */
const AXE_HEIGHT = 0.86 * CHARACTER_SCALE;
/** How long each move plays before the gallery moves on to the next. */
const SECONDS_PER_MOVE = 3;
const CROSSFADE_SECONDS = 0.3;

const URLS: Record<DwarfId, string> = { dorrin: dorrinUrl, hilde: hildeUrl };
const templates = new Map<DwarfId, AnimatedModel>();
let axeParts: ModelPart[] | undefined;
let preloadPromise: Promise<void> | null = null;

export function preloadDwarfModels(): Promise<void> {
  preloadPromise ??= Promise.all([
    ...(Object.entries(URLS) as Array<[DwarfId, string]>).map(async ([id, url]) => {
      templates.set(id, await loadAnimatedModel(url));
    }),
    loadScaledModel(ironAxeUrl, AXE_HEIGHT).then((parts) => {
      axeParts = parts;
    }),
  ]).then(() => undefined);
  return preloadPromise;
}

export function createDwarf(id: DwarfId): {
  group: THREE.Group;
  update(deltaSeconds: number): void;
} {
  const group = new THREE.Group();
  const template = templates.get(id);
  if (template === undefined) return { group, update: () => {} };

  const model = instantiateAnimatedModel(template);
  model.root.scale.setScalar(CHARACTER_SCALE);
  model.root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  group.add(model.root);

  const requested = new URLSearchParams(window.location.search).get('motion');
  const held = model.actions.find((action) => action.getClip().name === requested);
  let index = 0;
  let current = held ?? model.actions[0];
  current?.play();
  let elapsed = 0;

  return {
    group,
    update: (deltaSeconds) => {
      model.mixer.update(deltaSeconds);
      if (held !== undefined || model.actions.length < 2) return;
      elapsed += deltaSeconds;
      if (elapsed < SECONDS_PER_MOVE) return;
      elapsed = 0;
      index = (index + 1) % model.actions.length;
      const next = model.actions[index];
      if (next === undefined || current === undefined) return;
      next.reset().play();
      current.crossFadeTo(next, CROSSFADE_SECONDS, false);
      current = next;
    },
  };
}

/** The iron axe stood upright on its haft, blade side-on to the camera. */
export function createIronAxe(): { group: THREE.Group } {
  const group = new THREE.Group();
  for (const part of axeParts ?? []) {
    const mesh = new THREE.Mesh(part.geometry, part.material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return { group };
}
