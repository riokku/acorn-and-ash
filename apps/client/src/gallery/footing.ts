import * as THREE from 'three/webgpu';
import { CHARACTER_KINDS, type CharacterId } from '@acorn/shared';
import { createCharacter } from '../scene/character';
import { MoveMemory } from '../scene/character-driver';
import { preloadCharacterModels } from '../scene/character-model';
import { preloadCharacterAnimations } from '../scene/character-animations';
import type { RendererSetup } from '../scene/renderer';
import type { FireLights } from '../scene/fire-light';

export const galleryLedgeHeight = (x: number): number => (x < -0.09 ? -1.5 : x * 0.3);

/** The actual character straddling a small supported slope and a deep drop. */
export async function showFooting(
  renderer: RendererSetup['renderer'],
  scene: THREE.Scene,
  lights: FireLights,
  params: URLSearchParams,
): Promise<void> {
  await Promise.all([preloadCharacterModels(), preloadCharacterAnimations()]);
  const asked = params.get('body');
  const kind: CharacterId =
    asked !== null && asked in CHARACTER_KINDS ? (asked as CharacterId) : 'knight';
  const actor = createCharacter(kind, 0x82955e);
  scene.add(actor.group);
  const memory = new MoveMemory();
  const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.05, 50);
  camera.position.set(1.5, 1.4, 2.3);
  camera.lookAt(0, 0.65, 0);
  const resize = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);
  const draw = (dt: number) =>
    actor.update(dt, {
      move: memory.view(0, 0, 0, false, 'forward', false),
      locomotion: { speed: 0, airborne: false },
      groundHeight: galleryLedgeHeight,
    });
  for (let frame = 0; frame < 120; frame++) draw(1 / 60);
  let frames = 0,
    last = performance.now();
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    draw(Math.min(0.1, (now - last) / 1000));
    last = now;
    lights.update(camera.position);
    renderer.render(scene, camera);
    if (++frames === 8) document.body.dataset.galleryReady = 'true';
  });
}
