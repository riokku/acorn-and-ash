import { PROP_KINDS } from '@acorn/shared';
import { createPropMeshes, placeInstance } from '../scene/props';
import * as THREE from 'three/webgpu';
import { createShelter } from '../scene/shelter';
import { createHomesteadProject } from '../scene/homestead-project';
import { createHomeDecoration } from '../scene/home-decoration';
import { createGardenPath } from '../scene/garden-path';
import type { RendererSetup } from '../scene/renderer';
import type { FireLights } from '../scene/fire-light';
export function showHomestead(
  renderer: RendererSetup['renderer'],
  scene: THREE.Scene,
  lights: FireLights,
  params: URLSearchParams,
) {
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
    add(createHomesteadProject('trailWorkbench'), -3.9, 0.4, 0.12);
    add(createHomesteadProject('trailPantry'), 0.7, -0.3, -0.18);
    const garden = createHomesteadProject('kitchenGarden');
    garden.setGardenPlots([
      { crop: 'berry', growTicks: 0 },
      { crop: 'mushroom', growTicks: 0 },
      { crop: 'flower', growTicks: 0 },
    ]);
    add(garden, 2.8, 1.4, -0.2);
    add(createHomeDecoration('fernLantern'), -2.6, 1.9);
    add(createHomeDecoration('cedarBench'), -0.7, 2.7, -0.15);
    for (let index = 0; index < 4; index++)
      add(createGardenPath(), -0.2 + index * 0.1, 0.7 + index * 0.6, index * 0.4);
  }
  const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.05, 80);
  camera.position.set(9, 8.5, 14);
  camera.lookAt(-0.3, 0.6, 0);
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
    : 'A place to make. A place to keep. A place to grow.';
  document.body.append(caption);
  let frames = 0;
  renderer.setAnimationLoop(() => {
    lights.update(camera.position);
    renderer.render(scene, camera);
    if (++frames === 8) {
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
