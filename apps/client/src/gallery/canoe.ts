import * as THREE from 'three/webgpu';
import { ActionKind, STREAM, navigableWaterSurfaceAt, streamPointAt } from '@acorn/shared';
import { createWaterMaterial } from '../art/materials';
import { createCharacter } from '../scene/character';
import { preloadCharacterAnimations } from '../scene/character-animations';
import { boatSeatAt } from '../scene/character-driver';
import { preloadCharacterModels } from '../scene/character-model';
import { createRowboat } from '../scene/rowboat';
import type { RendererSetup } from '../scene/renderer';
import type { FireLights } from '../scene/fire-light';

/** The real hull and seated character, at the spring's actual elevated water level. */
export async function showCanoe(
  renderer: RendererSetup['renderer'],
  scene: THREE.Scene,
  lights: FireLights,
  params: URLSearchParams,
): Promise<void> {
  await Promise.all([preloadCharacterModels(), preloadCharacterAnimations()]);
  const spot = streamPointAt(STREAM, 2);
  const level = navigableWaterSurfaceAt(spot.x, spot.z);
  const boat = createRowboat();
  boat.group.position.set(spot.x, level, spot.z);
  scene.add(boat.group);
  const rider = createCharacter('knight', 0xf2efe6);
  rider.group.position.set(spot.x, level, spot.z);
  rider.group.rotation.y = -Math.PI / 2;
  rider.setRestSpot(boatSeatAt(spot.x, spot.z, -Math.PI / 2));
  scene.add(rider.group);
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(7, 48).rotateX(-Math.PI / 2),
    createWaterMaterial([{ ...spot, radius: 7 }]),
  );
  water.position.set(spot.x, level, spot.z);
  water.receiveShadow = true;
  scene.add(water);
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 200);
  const target = new THREE.Vector3(spot.x, level + 0.5, spot.z);
  const resize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  };
  window.addEventListener('resize', resize);
  resize();
  let angle = Number(params.get('angle') ?? 0.7);
  let elapsed = 0;
  let last = performance.now();
  let frames = 0;
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const delta = Math.min(0.1, (now - last) / 1000);
    last = now;
    elapsed += delta;
    if (params.has('spin')) angle += delta * 0.3;
    const frozen = params.has('at');
    const age = frozen ? Math.max(10, Number(params.get('at')) || 60) : 60 + elapsed * 20;
    rider.update(delta, {
      move: {
        kind: ActionKind.Row,
        step: 0,
        age,
        atTree: false,
        flinchVariant: 0,
        roll: 'forward',
      },
      locomotion: { speed: 0, airborne: false },
    });
    boat.setRowing(params.has('empty') ? null : (age / 24) % 1);
    rider.group.visible = !params.has('empty');
    const distance = Number(params.get('distance') ?? 5.2);
    camera.position.set(
      target.x + Math.sin(angle) * distance,
      target.y + Number(params.get('height') ?? 3),
      target.z + Math.cos(angle) * distance,
    );
    camera.lookAt(target);
    lights.update(camera.position);
    renderer.render(scene, camera);
    if (++frames === 8) {
      document.body.dataset.galleryReady = 'true';
      if (params.has('still')) renderer.setAnimationLoop(null);
    }
  });
}
