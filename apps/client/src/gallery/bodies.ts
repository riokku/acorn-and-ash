import * as THREE from 'three/webgpu';

import { CHARACTER_KINDS, CHARACTER_ORDER, type CharacterId } from '@acorn/shared';

import { characterModelTemplate, preloadCharacterModels } from '../scene/character-model';
import {
  instantiateAnimatedModel,
  loadAnimatedModel,
  type AnimatedModel,
  type AnimatedModelInstance,
} from '../scene/model-loading';
import { createNameplate } from '../scene/nameplate';
import type { FireLights } from '../scene/fire-light';
import type { RendererSetup } from '../scene/renderer';

import barbarianBearHatUrl from '@assets/gear/barbarian-bear-hat.glb?url';
import barbarianOutfitUrl from '@assets/gear/barbarian-outfit.glb?url';
import knightArmourUrl from '@assets/gear/knight-armour.glb?url';
import knightCapeUrl from '@assets/gear/knight-cape.glb?url';
import knightHelmetUrl from '@assets/gear/knight-helmet.glb?url';
import mageCapeUrl from '@assets/gear/mage-cape.glb?url';
import mageHatUrl from '@assets/gear/mage-hat.glb?url';
import mageRobeUrl from '@assets/gear/mage-robe.glb?url';
import rangerCapeUrl from '@assets/gear/ranger-cape.glb?url';
import rangerOutfitUrl from '@assets/gear/ranger-outfit.glb?url';
import rangerQuiverUrl from '@assets/gear/ranger-quiver.glb?url';
import rogueCapeUrl from '@assets/gear/rogue-cape.glb?url';
import rogueHoodUrl from '@assets/gear/rogue-hood.glb?url';
import rogueHoodedCapeUrl from '@assets/gear/rogue-hooded-cape.glb?url';
import rogueHoodedOutfitUrl from '@assets/gear/rogue-hooded-outfit.glb?url';
import rogueMaskUrl from '@assets/gear/rogue-mask.glb?url';
import rogueOutfitUrl from '@assets/gear/rogue-outfit.glb?url';

/**
 * The six bodies in just a shirt and shorts, and the outfits they used to
 * wear, now separate gear (see decision 0112): `?gallery=bodies` shows each
 * body as a pair, wearing its old outfit (how it looked before) and plain
 * (how it looks now). `&gear=mage-hat` (any name below) puts that one piece
 * on the left of every pair instead, to see how it fits;
 * `&motion=walk` or `run` sets them moving. Nothing in the game wears gear
 * yet: this is only for looking at the art.
 */

/** Where a piece is worn: an outfit replaces the shirt, shorts, arms and legs. */
type GearSlot = 'head' | 'face' | 'back' | 'outfit';

const GEAR: Record<string, { url: string; slot: GearSlot }> = {
  'knight-helmet': { url: knightHelmetUrl, slot: 'head' },
  'barbarian-bear-hat': { url: barbarianBearHatUrl, slot: 'head' },
  'mage-hat': { url: mageHatUrl, slot: 'head' },
  'rogue-hood': { url: rogueHoodUrl, slot: 'head' },
  'rogue-mask': { url: rogueMaskUrl, slot: 'face' },
  'knight-cape': { url: knightCapeUrl, slot: 'back' },
  'mage-cape': { url: mageCapeUrl, slot: 'back' },
  'ranger-cape': { url: rangerCapeUrl, slot: 'back' },
  'rogue-cape': { url: rogueCapeUrl, slot: 'back' },
  'rogue-hooded-cape': { url: rogueHoodedCapeUrl, slot: 'back' },
  'ranger-quiver': { url: rangerQuiverUrl, slot: 'back' },
  'knight-armour': { url: knightArmourUrl, slot: 'outfit' },
  'barbarian-outfit': { url: barbarianOutfitUrl, slot: 'outfit' },
  'mage-robe': { url: mageRobeUrl, slot: 'outfit' },
  'ranger-outfit': { url: rangerOutfitUrl, slot: 'outfit' },
  'rogue-outfit': { url: rogueOutfitUrl, slot: 'outfit' },
  'rogue-hooded-outfit': { url: rogueHoodedOutfitUrl, slot: 'outfit' },
};

/** What each body wore before it became a plain body. */
const OLD_OUTFITS: Record<CharacterId, readonly string[]> = {
  knight: ['knight-helmet', 'knight-cape', 'knight-armour'],
  barbarian: ['barbarian-bear-hat', 'barbarian-outfit'],
  mage: ['mage-hat', 'mage-cape', 'mage-robe'],
  ranger: ['ranger-quiver', 'ranger-cape', 'ranger-outfit'],
  rogue: ['rogue-cape', 'rogue-outfit'],
  rogueHooded: ['rogue-hood', 'rogue-mask', 'rogue-hooded-cape', 'rogue-hooded-outfit'],
};

/** The game draws the pack's characters at 0.6 of their modelled size. */
const MODEL_SCALE = 0.6;
/** From one body's pair to the next, and between before and after within a pair. */
const PAIR_SPACING = 1.7;
const PAIR_GAP = 0.68;
const PLAIN_PARTS = ['_Body', '_ArmLeft', '_ArmRight', '_LegLeft', '_LegRight'];
const CLIP_NAMES = {
  idle: 'Idle_A_Rig_Medium',
  walk: 'Walking_A_Rig_Medium',
  run: 'Running_A_Rig_Medium',
} as const;

export async function showBodies(
  renderer: RendererSetup['renderer'],
  scene: THREE.Scene,
  fireLights: FireLights,
  params: URLSearchParams,
): Promise<void> {
  const tryOn = params.get('gear');
  const tried = tryOn !== null && tryOn in GEAR ? tryOn : null;
  const motion = params.get('motion');
  const clipName = CLIP_NAMES[motion === 'walk' || motion === 'run' ? motion : 'idle'];

  await preloadCharacterModels();
  const gear = new Map<string, AnimatedModel>();
  await Promise.all(
    Object.entries(GEAR).map(async ([name, { url }]) => {
      gear.set(name, await loadAnimatedModel(url));
    }),
  );

  const mixers: THREE.AnimationMixer[] = [];
  const place = (character: CharacterId, x: number, wearing: readonly string[], column: number) => {
    const template = characterModelTemplate(character);
    if (template === undefined) return;
    const body = instantiateAnimatedModel(template);
    for (const name of wearing) {
      const piece = gear.get(name);
      const slot = GEAR[name]?.slot;
      if (piece !== undefined && slot !== undefined) wear(body.root, piece, slot);
    }
    body.root.scale.setScalar(MODEL_SCALE);
    body.root.position.set(x, 0, 0);
    body.root.traverse((child) => {
      if (child instanceof THREE.Mesh) child.castShadow = child.receiveShadow = true;
    });
    scene.add(body.root);
    play(body, clipName, column);
    mixers.push(body.mixer);
  };

  // A pair for each body: before (or wearing the piece being tried) on the
  // left, just a shirt and shorts on the right.
  CHARACTER_ORDER.forEach((character, column) => {
    const x = (column - (CHARACTER_ORDER.length - 1) / 2) * PAIR_SPACING;
    place(character, x - PAIR_GAP / 2, tried === null ? OLD_OUTFITS[character] : [tried], column);
    place(character, x + PAIR_GAP / 2, [], column);
    const label = createNameplate(CHARACTER_KINDS[character].displayName);
    label.sprite.position.set(x, 1.55, 0);
    label.sprite.scale.multiplyScalar(0.6);
    scene.add(label.sprite);
  });
  const title = createNameplate(
    tried === null
      ? 'Each pair: before (outfits, now gear), then after (shirt and shorts)'
      : `Each pair: wearing ${tried}, then plain`,
  );
  title.sprite.position.set(0, 2.05, 0);
  title.sprite.scale.multiplyScalar(0.75);
  scene.add(title.sprite);

  const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.05, 300);
  const target = new THREE.Vector3(0, 0.85, 0);
  const distance = Number(params.get('distance') ?? 8.6);
  const height = Number(params.get('height') ?? 0.9);
  const angle = Number(params.get('angle') ?? 0);
  camera.position.set(
    target.x + Math.sin(angle) * distance,
    target.y + height,
    target.z + Math.cos(angle) * distance,
  );
  camera.lookAt(target);
  const resize = (): void => {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  let last = performance.now();
  let frames = 0;
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const delta = Math.min(0.1, (now - last) / 1000);
    last = now;
    for (const mixer of mixers) mixer.update(delta);
    fireLights.update(camera.position);
    renderer.render(scene, camera);
    frames += 1;
    if (frames === 8) document.body.dataset.galleryReady = 'true';
  });
}

/**
 * Puts one piece of gear on a body. Every body and every piece share the
 * pack's skeleton (Rig_Medium), so each skinned part of the piece is bound to
 * the body's own bones by name and moves with them. An outfit replaces the
 * shirt, shorts, arms and legs it covers; anything on the head hides Body
 * 6's separate haircut, which a hat or hood would otherwise poke through.
 */
function wear(body: THREE.Object3D, piece: AnimatedModel, slot: GearSlot): void {
  let holder: THREE.Object3D | null = null;
  const plain: THREE.Object3D[] = [];
  body.traverse((child) => {
    if (!(child instanceof THREE.SkinnedMesh)) return;
    holder ??= child.parent;
    if (slot === 'outfit' && PLAIN_PARTS.some((part) => child.name.endsWith(part)))
      plain.push(child);
    if ((slot === 'head' || slot === 'face') && child.name.endsWith('_Hair')) plain.push(child);
  });
  for (const part of plain) part.visible = false;
  if (holder === null) return;
  const parent: THREE.Object3D = holder;
  piece.root.traverse((child) => {
    if (!(child instanceof THREE.SkinnedMesh)) return;
    const bones = child.skeleton.bones.map((bone) => body.getObjectByName(bone.name));
    if (!bones.every((bone): bone is THREE.Bone => bone instanceof THREE.Bone)) return;
    const mesh = new THREE.SkinnedMesh(child.geometry, child.material);
    mesh.name = child.name;
    mesh.position.copy(child.position);
    mesh.quaternion.copy(child.quaternion);
    mesh.scale.copy(child.scale);
    parent.add(mesh);
    mesh.bind(new THREE.Skeleton(bones, child.skeleton.boneInverses), child.bindMatrix);
  });
}

/** Plays one of the body's own moves, each a little out of step with its neighbour. */
function play(body: AnimatedModelInstance, clipName: string, column: number): void {
  const action = body.actions.find((candidate) => candidate.getClip().name === clipName);
  if (action === undefined) return;
  action.play();
  action.time = column * 0.23;
}
