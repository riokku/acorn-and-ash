import * as THREE from 'three/webgpu';

import {
  CHARACTER_KINDS,
  CHARACTER_ORDER,
  DEFAULT_SKIN_TONE,
  SKIN_TONES,
  SKIN_TONE_SWATCHES,
  type CharacterId,
  type SkinToneId,
} from '@acorn/shared';

import { characterModelTemplate, preloadCharacterModels } from '../scene/character-model';
import { characterClips, preloadCharacterAnimations } from '../scene/character-animations';
import { BODY_BEARD, showBeard, type BeardStyle } from '../scene/body-shape';
import { instantiateAnimatedModel, type AnimatedModelInstance } from '../scene/model-loading';
import { createNameplate } from '../scene/nameplate';
import { isSkinMaterial, skinShade } from '../scene/skin-tone';
import type { FireLights } from '../scene/fire-light';
import type { RendererSetup } from '../scene/renderer';

/**
 * The six dwarf bodies in just a shirt and shorts (tools/art/dwarf_bodies.py,
 * decision 0112): `?gallery=bodies` lines them up, each with its own beard;
 * `&beard=long` (braids, long, full, stache, chops or none) gives every one
 * that beard instead; `&motion=walk` or `run` sets them moving; `&skin=darker`
 * (any skin tone) gives them all that skin. `?gallery=bodies&tones` instead
 * lines up every body in all five skin tones, lightest at the front
 * (decision 0113).
 */

const BEARDS: readonly BeardStyle[] = ['braids', 'long', 'full', 'stache', 'chops'];
/** The game draws characters at 0.6 of their modelled size. */
const MODEL_SCALE = 0.6;
/** From one body to the next. */
const SPACING = 0.95;
/** Across and back between bodies in the line-up of skin tones. */
const TONE_SPACING = 0.8;
const TONE_ROW_GAP = 1.1;

export async function showBodies(
  renderer: RendererSetup['renderer'],
  scene: THREE.Scene,
  fireLights: FireLights,
  params: URLSearchParams,
): Promise<void> {
  const motion = params.get('motion');
  const clipName = motion === 'walk' || motion === 'run' ? motion : 'idle';
  const askedSkin = params.get('skin');
  const skin: SkinToneId =
    askedSkin !== null && askedSkin in SKIN_TONES ? (askedSkin as SkinToneId) : DEFAULT_SKIN_TONE;
  const askedBeard = params.get('beard');
  const beardFor = (character: CharacterId): BeardStyle | null =>
    askedBeard === null
      ? BODY_BEARD[character]
      : (BEARDS.find((style) => style === askedBeard) ?? null);
  const tones = params.has('tones');

  await Promise.all([preloadCharacterModels(), preloadCharacterAnimations()]);
  const clip = characterClips('dwarf')?.whole.get(clipName);

  const mixers: THREE.AnimationMixer[] = [];
  const place = (
    character: CharacterId,
    x: number,
    column: number,
    tone: SkinToneId = skin,
    z = 0,
  ) => {
    const template = characterModelTemplate(character);
    if (template === undefined) return;
    const body = instantiateAnimatedModel(template);
    showBeard(body.root, beardFor(character));
    shadeSkin(body.root, tone);
    body.root.scale.setScalar(MODEL_SCALE);
    body.root.position.set(x, 0, z);
    body.root.traverse((child) => {
      if (child instanceof THREE.Mesh) child.castShadow = child.receiveShadow = true;
    });
    scene.add(body.root);
    if (clip !== undefined) play(body, clip, column);
    mixers.push(body.mixer);
  };

  if (tones) {
    // A row for each tone, lightest at the front, every body across it.
    SKIN_TONE_SWATCHES.forEach((tone, row) => {
      const z = -row * TONE_ROW_GAP;
      CHARACTER_ORDER.forEach((character, column) => {
        const x = (column - (CHARACTER_ORDER.length - 1) / 2) * TONE_SPACING;
        place(character, x, column + row, tone, z);
      });
      const label = createNameplate(SKIN_TONES[tone].displayName);
      label.sprite.position.set(-((CHARACTER_ORDER.length + 0.8) / 2) * TONE_SPACING, 0.4, z);
      label.sprite.scale.multiplyScalar(0.5);
      scene.add(label.sprite);
    });
  } else {
    CHARACTER_ORDER.forEach((character, column) => {
      const x = (column - (CHARACTER_ORDER.length - 1) / 2) * SPACING;
      place(character, x, column);
      const label = createNameplate(CHARACTER_KINDS[character].displayName);
      label.sprite.position.set(x, 0.95, 0);
      label.sprite.scale.multiplyScalar(0.5);
      scene.add(label.sprite);
    });
  }
  const title = createNameplate(
    tones ? 'Every body in each skin tone' : 'The six bodies, in a shirt and shorts',
  );
  title.sprite.position.set(
    0,
    tones ? 1.4 : 1.25,
    tones ? -(SKIN_TONE_SWATCHES.length - 1) * TONE_ROW_GAP : 0,
  );
  title.sprite.scale.multiplyScalar(0.6);
  scene.add(title.sprite);

  const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.05, 300);
  const target = tones
    ? new THREE.Vector3(0, 0.4, -((SKIN_TONE_SWATCHES.length - 1) * TONE_ROW_GAP) / 2)
    : new THREE.Vector3(0, 0.5, 0);
  const distance = Number(params.get('distance') ?? (tones ? 7.5 : 5.6));
  const height = Number(params.get('height') ?? (tones ? 4.2 : 0.5));
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

/** Lightens or darkens just this body's skin, on its own copy of the skin materials. */
function shadeSkin(body: THREE.Object3D, tone: SkinToneId): void {
  if (tone === DEFAULT_SKIN_TONE) return;
  const shade = skinShade(tone);
  body.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) return;
    const material = child.material as THREE.Material;
    if (!isSkinMaterial(material) || !(material instanceof THREE.MeshStandardMaterial)) return;
    const own = material.clone();
    own.color.multiply(shade);
    child.material = own;
  });
}

/** Plays one of the dwarves' moves, each body a little out of step with its neighbour. */
function play(body: AnimatedModelInstance, clip: THREE.AnimationClip, column: number): void {
  const action = body.mixer.clipAction(clip);
  action.play();
  action.time = (column * 0.23) % clip.duration;
}
