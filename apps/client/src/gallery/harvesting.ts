import * as THREE from 'three/webgpu';
import { ActionKind, Gesture } from '@acorn/shared';
import { createCharacter } from '../scene/character';
import { preloadCharacterModels } from '../scene/character-model';
import { preloadCharacterAnimations } from '../scene/character-animations';
import { createGroundItems } from '../scene/ground-items';
import type { RendererSetup } from '../scene/renderer';
import type { FireLights } from '../scene/fire-light';

/** Replays the actual pickup, plant motion and hand correction without a server. */
export async function showHarvesting(
  renderer: RendererSetup['renderer'],
  scene: THREE.Scene,
  lights: FireLights,
  params: URLSearchParams,
): Promise<void> {
  await Promise.all([preloadCharacterModels(), preloadCharacterAnimations()]);
  const actor = createCharacter('knight', 0x82955e);
  const items = createGroundItems(() => 0);
  scene.add(actor.group, items.group);
  const patch = { id: 1, item: 'flower' as const, x: 0.25, z: -0.45, remaining: 4 };
  const target = new THREE.Vector3(patch.x, 0.3, patch.z);
  const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.05, 50);
  camera.position.set(2.1, 1.6, -2.4);
  camera.lookAt(0, 0.55, -0.2);
  const before = params.has('before');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const frame = {
    move: {
      kind: ActionKind.Idle,
      step: 0,
      age: 0,
      atTree: false,
      flinchVariant: 0 as const,
      roll: 'forward' as const,
    },
    locomotion: { speed: 0, airborne: false },
    groundHeight: () => 0,
  };
  const reset = () => {
    items.clearHarvesting();
    items.setGatherPatches([patch]);
    actor.playGesture(Gesture.PickUp, 'flower');
    if (!before) {
      const picked = items.collect(
        { netId: 1, item: 'flower', count: 1, x: patch.x, z: patch.z, depleted: false },
        (into) => actor.handPosition(into),
      );
      actor.reachForCollection(picked ?? target);
    }
    items.setGatherPatches([{ ...patch, remaining: 3 }]);
    if (before) items.clearHarvesting();
  };
  for (let i = 0; i < 60; i++) actor.update(1 / 60, frame);
  reset();
  const draw = (dt: number) => {
    actor.update(dt, frame);
    items.update(dt, reduced);
  };
  const frozen = params.has('at');
  const at = Math.max(0, Math.min(2, Number(params.get('at')) || 0));
  if (frozen) {
    let age = 0;
    while (age < at) {
      const dt = Math.min(1 / 60, at - age);
      draw(dt);
      age += dt;
    }
  }
  const resize = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);
  let age = 0,
    last = performance.now(),
    frames = 0;
  renderer.setAnimationLoop(() => {
    const now = performance.now(),
      dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!frozen) {
      age += dt;
      if (age >= 2) {
        reset();
        age = 0;
      }
      draw(dt);
    }
    lights.update(camera.position);
    renderer.render(scene, camera);
    if (++frames === 8) document.body.dataset.galleryReady = 'true';
  });
  window.addEventListener(
    'pagehide',
    () => {
      renderer.setAnimationLoop(null);
      window.removeEventListener('resize', resize);
      items.dispose();
      actor.dispose();
      items.group.removeFromParent();
      actor.group.removeFromParent();
    },
    { once: true },
  );
}
