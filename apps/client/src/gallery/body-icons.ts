import * as THREE from 'three/webgpu';
import { ActionKind, CHARACTER_ORDER, DEFAULT_SKIN_TONE, type CharacterId } from '@acorn/shared';
import { createCharacterFromModel } from '../scene/character';
import { BODY_BEARD } from '../scene/body-shape';
import { preloadCharacterModels, characterModelTemplate } from '../scene/character-model';
import { preloadCharacterAnimations } from '../scene/character-animations';

/** Reproducible portrait source: ?gallery=body-icons&body=knight (or any CharacterId). */
export async function showBodyIcon(
  canvas: HTMLCanvasElement,
  params: URLSearchParams,
): Promise<void> {
  const requested = params.get('body') ?? 'knight';
  if (!CHARACTER_ORDER.includes(requested as CharacterId)) throw new Error('Unknown body');
  const body = requested as CharacterId;
  const renderer = new THREE.WebGPURenderer({
    canvas,
    alpha: true,
    antialias: true,
    forceWebGL: params.get('renderer') === 'webgl2',
  });
  await Promise.all([renderer.init(), preloadCharacterModels(), preloadCharacterAnimations()]);
  const template = characterModelTemplate(body);
  if (!template) throw new Error(`Could not load ${body} model`);
  renderer.setPixelRatio(1);
  renderer.setSize(192, 256, false);
  renderer.setClearColor(0x000000, 0);
  canvas.style.width = '192px';
  canvas.style.height = '256px';
  canvas.style.inset = 'auto';
  canvas.style.top = '0';
  canvas.style.left = '0';
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xcfe3f0, 0x6a5a45, 1.5));
  const key = new THREE.DirectionalLight(0xffe2b8, 2.4);
  key.position.set(-2.5, 3.2, 3.5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfd8ff, 1.1);
  rim.position.set(2.6, 2.2, -3);
  scene.add(rim);
  const character = createCharacterFromModel(template, {
    tint: null,
    skin: DEFAULT_SKIN_TONE,
    beard: BODY_BEARD[body],
  });
  character.setName(null);
  character.group.rotation.y = Math.PI;
  scene.add(character.group);
  character.update(0.6, {
    move: {
      kind: ActionKind.Idle,
      step: 0,
      age: 0,
      atTree: false,
      flinchVariant: 0,
      roll: 'forward',
    },
    locomotion: { speed: 0, airborne: false },
  });
  const camera = new THREE.OrthographicCamera(-0.405, 0.405, 0.54, -0.54, 0.1, 20);
  camera.position.set(0, 0.65, 4);
  camera.lookAt(0, 0.42, 0);
  document.body.dataset.bodyIcon = body;
  document.body.dataset.bodyIconIds = CHARACTER_ORDER.join(',');
  let frames = 0;
  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
    if (++frames === 8) document.body.dataset.galleryReady = 'true';
  });
  window.addEventListener(
    'pagehide',
    () => {
      renderer.setAnimationLoop(null);
      character.dispose();
      renderer.dispose();
    },
    { once: true },
  );
}
