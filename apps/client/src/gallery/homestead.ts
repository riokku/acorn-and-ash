import { ActionKind, benchSeats, GARDEN_GROW_TICKS, PROP_KINDS } from '@acorn/shared';
import { createPropMeshes, placeInstance } from '../scene/props';
import * as THREE from 'three/webgpu';
import { createShelter } from '../scene/shelter';
import { createHomesteadProject } from '../scene/homestead-project';
import { createHomeDecoration } from '../scene/home-decoration';
import { createGardenPath } from '../scene/garden-path';
import { createCampfire } from '../scene/campfire';
import { createCharacter } from '../scene/character';
import { preloadCharacterModels } from '../scene/character-model';
import { preloadCharacterAnimations } from '../scene/character-animations';
import { MoveMemory } from '../scene/character-driver';
import type { RendererSetup } from '../scene/renderer';
import type { FireLights } from '../scene/fire-light';
export async function showHomestead(
  renderer: RendererSetup['renderer'],
  scene: THREE.Scene,
  lights: FireLights,
  params: URLSearchParams,
) {
  if (params.has('nook'))
    await Promise.all([preloadCharacterModels(), preloadCharacterAnimations()]);
  const seated: Array<ReturnType<typeof createCharacter>> = [];
  let campfire: ReturnType<typeof createCampfire> | null = null;
  const forest = createPropMeshes(PROP_KINDS.pine, 5);
  for (const [index, [x, z]] of [
    [-7, -4],
    [-4, -7],
    [1, -7],
    [6, -5],
    [8, 0],
  ].entries()) {
    placeInstance(forest, index, {
      id: index + 1,
      kind: 'pine',
      x: x!,
      z: z!,
      scale: 0.7 + index * 0.06,
      rotationY: index * 0.8,
    });
  }
  for (const part of forest) scene.add(part.mesh);
  const tent = createShelter('tent');
  tent.group.position.set(-1.2, 0, -1.8);
  scene.add(tent.group);
  const pieces: { group: THREE.Group; dispose(): void }[] = [tent];
  const add = (piece: { group: THREE.Group; dispose(): void }, x: number, z: number, yaw = 0) => {
    piece.group.position.set(x, 0, z);
    piece.group.rotation.y = yaw;
    scene.add(piece.group);
    pieces.push(piece);
  };
  if (!params.has('before')) {
    const bench = createHomesteadProject('trailWorkbench');
    bench.setAppearance({ id: 1, stocked: 0, tool: params.has('empty') ? null : 'axe', plots: [] });
    add(bench, -3.9, 0.4, 0.12);
    const pantry = createHomesteadProject('trailPantry');
    pantry.setAppearance({ id: 2, stocked: params.has('empty') ? 0 : 5, tool: null, plots: [] });
    add(pantry, 0.7, -0.3, -0.18);
    const garden = createHomesteadProject('kitchenGarden');
    garden.setGardenPlots([
      {
        crop: 'berry',
        growTicks: params.has('empty') ? GARDEN_GROW_TICKS : Math.round(GARDEN_GROW_TICKS * 0.7),
      },
      {
        crop: 'mushroom',
        growTicks: params.has('empty') ? GARDEN_GROW_TICKS : Math.round(GARDEN_GROW_TICKS * 0.3),
      },
      { crop: 'flower', growTicks: 0 },
    ]);
    add(garden, 2.8, 1.4, -0.2);
    add(createHomeDecoration('fernLantern'), -2.6, 1.9);
    if (!params.has('nook')) add(createHomeDecoration('cedarBench'), -0.7, 2.7, -0.15);
    for (let index = 0; index < 4; index++)
      add(createGardenPath(), -0.2 + index * 0.1, 0.7 + index * 0.6, index * 0.4);
  }
  if (params.has('nook') && !params.has('before')) {
    add(createHomeDecoration('timberTable'), 1.8, 4.4);
    for (const [index, x] of [-0.5, 4.1].entries()) {
      const yaw = index === 0 ? -Math.PI / 2 : Math.PI / 2;
      add(createHomeDecoration('cedarBench'), x, 4.4, yaw);
      const seat = benchSeats({ id: index, x, z: 4.4, yaw }, () => 0)[0]!;
      const character = createCharacter(
        index === 0 ? 'ranger' : 'rogue',
        index === 0 ? 0x748b64 : 0x92765c,
      );
      character.group.position.set(seat.stand.x, 0, seat.stand.z);
      character.group.rotation.y = yaw;
      character.setRestSpot(seat.rest);
      const memory = new MoveMemory();
      // A still preview should show the settled pose, not freeze halfway through its blend.
      for (let frame = 0; frame < 60; frame++)
        character.update(1 / 60, {
          move: memory.view(ActionKind.Sit, 0, 40 + frame / 3, false, 'forward'),
          locomotion: { speed: 0, airborne: false },
        });
      seated.push(character);
      scene.add(character.group);
      pieces.push(character);
    }
    campfire = createCampfire();
    campfire.setLit(true);
    add(campfire, 1.8, 7.2);
    add(createHomeDecoration('fernLantern'), 4.2, 6.5);
    add(createGardenPath(), 0.1, 3.1);
    add(createGardenPath(), 0.6, 3.55);
  }
  const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.05, 80);
  camera.position.set(9, 8.5, 14);
  camera.lookAt(-0.3, 0.6, 0);
  if (params.has('nook')) {
    camera.position.set(8, 7, 13);
    camera.lookAt(0.4, 0.6, 2.4);
  }
  const resize = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);
  const caption = document.createElement('p');
  caption.className = 'homestead-gallery-caption';
  caption.textContent = params.has('before')
    ? 'A shelter in the wild'
    : params.has('nook')
      ? 'A warm fire. A place for company. A home worth coming back to.'
      : 'A place to make. A place to keep. A place to grow.';
  document.body.append(caption);
  let frames = params.has('nook') ? 60 : 0;
  const seatMemory = new MoveMemory();
  renderer.setAnimationLoop(() => {
    lights.update(camera.position);
    campfire?.update(1 / 60);
    for (const character of seated)
      character.update(1 / 60, {
        move: seatMemory.view(ActionKind.Sit, 0, 40 + frames / 3, false, 'forward'),
        locomotion: { speed: 0, airborne: false },
      });
    renderer.render(scene, camera);
    if (++frames === (params.has('nook') ? 68 : 8)) {
      document.body.dataset.galleryReady = 'true';
      if (params.has('still')) renderer.setAnimationLoop(null);
    }
  });
  addEventListener(
    'pagehide',
    () => {
      renderer.setAnimationLoop(null);
      window.removeEventListener('resize', resize);
      pieces.forEach((piece) => piece.dispose());
      forest.forEach((part) => part.dispose());
      caption.remove();
    },
    { once: true },
  );
}
