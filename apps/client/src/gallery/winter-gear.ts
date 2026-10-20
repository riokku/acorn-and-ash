import { createLastBellTrophy } from '../scene/skeleton-town';
import { characterStats } from '../item-catalog';
import * as THREE from 'three/webgpu';
import { CHARACTER_KINDS, type CharacterId } from '@acorn/shared';
import { createCharacter } from '../scene/character';
import { MoveMemory } from '../scene/character-driver';
import { preloadCharacterModels } from '../scene/character-model';
import { preloadCharacterAnimations } from '../scene/character-animations';
import type { RendererSetup } from '../scene/renderer';
import type { FireLights } from '../scene/fire-light';

/** Actual worn gear on the shared animated body; reuse the existing clothing rendering. */
export async function showWinterGear(
  renderer: RendererSetup['renderer'],
  scene: THREE.Scene,
  lights: FireLights,
  params: URLSearchParams,
): Promise<void> {
  await Promise.all([preloadCharacterModels(), preloadCharacterAnimations()]);
  const asked = params.get('body');
  const kind: CharacterId =
    asked !== null && asked in CHARACTER_KINDS ? (asked as CharacterId) : 'ranger';
  const basic = params.get('gallery') === 'basic-clothing';
  const lastWatch = params.get('gear') === 'last-watch-helm';
  const worn = lastWatch
    ? ({ helm: 'watchCaptainHelm' } as const)
    : basic
      ? ({ helm: 'woolCap', upperBody: 'linenShirt', lowerBody: 'workTrousers' } as const)
      : ({
          upperBody: 'winterJacket',
          helm: 'bearHat',
          lowerBody: 'travelerTrousers',
          feet: 'leatherBoots',
          hands: 'leatherGloves',
        } as const);
  const actor = createCharacter(kind, 0x82955e);
  actor.setGear(params.has('before') || params.get('gear') === 'last-bell' ? {} : worn);
  actor.group.rotation.y = params.has('back') ? -0.18 : Math.PI - 0.18;
  scene.add(actor.group);
  if (params.get('gear') === 'last-bell' && !params.has('before')) {
    const trophy = createLastBellTrophy();
    trophy.group.position.set(0.65, 0, 0);
    scene.add(trophy.group);
  }
  let heads = 0;
  actor.group.traverse((object) => {
    if (object.userData.gearItem === (basic ? 'woolCap' : 'bearHat')) heads++;
  });
  document.body.dataset.winterGearHeads = String(heads);
  document.body.dataset.clothingPieces = String(
    actor.group
      .getObjectsByProperty('type', 'SkinnedMesh')
      .filter((mesh) => mesh.userData.gearItem !== undefined).length,
  );
  const caption = document.createElement('p');
  caption.textContent = params.has('before')
    ? 'Plain clothes · Warmth 0'
    : params.get('gear') === 'last-bell'
      ? 'Last Bell keepsake · earned at Bonehollow, displayed at home'
      : lastWatch
        ? 'Last Watch helm · Protection 10% · Vitality 5 · Warmth 10'
        : basic
          ? `Basic clothing · Protection ${characterStats(worn).protection}% · Warmth ${characterStats(worn).warmth}`
          : `Winter clothing · Warmth ${characterStats(worn).warmth}`;
  caption.style.cssText =
    'position:absolute;left:0;right:0;bottom:24px;text-align:center;color:#f1efdc;font:18px Georgia;pointer-events:none';
  document.body.append(caption);
  const memory = new MoveMemory();
  const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.05, 50);
  camera.position.set(1.3, lastWatch ? 1.4 : 1.2, lastWatch ? 3 : 2.4);
  camera.lookAt(0, 0.6, 0);
  const resize = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);
  let frames = 0,
    last = performance.now();
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    actor.update(Math.min(0.1, (now - last) / 1000), {
      move: memory.view(0, 0, 0, false, 'forward', false),
      locomotion: { speed: 0, airborne: false },
      groundHeight: () => 0,
    });
    last = now;
    lights.update(camera.position);
    renderer.render(scene, camera);
    if (++frames === 8) {
      document.body.dataset.galleryReady = 'true';
      if (params.has('still')) renderer.setAnimationLoop(null);
    }
  });
}
