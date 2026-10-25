import * as THREE from 'three/webgpu';
import { DISCOVERIES, type Terrain } from '@acorn/shared';
import { createDiscoveryLandmarks } from '../scene/discovery-sites';
import { createGroundItems } from '../scene/ground-items';
import type { RendererSetup } from '../scene/renderer';
import type { FireLights } from '../scene/fire-light';

export async function showForagingHabitats(
  renderer: RendererSetup['renderer'],
  scene: THREE.Scene,
  lights: FireLights,
  params: URLSearchParams,
  terrain: Terrain,
): Promise<void> {
  const grove = { ...DISCOVERIES.find((site) => site.kind === 'grove')!, x: -1.6, z: 1.6 };
  const landmark = createDiscoveryLandmarks([grove], terrain);
  const items = createGroundItems((x, z) => terrain.heightAt(x, z));
  scene.add(landmark.group, items.group);
  items.setGatherPatches([
    { id: 204, item: 'berry', x: -3.4, z: 3.1, remaining: 3 },
    { id: 205, item: 'mushroom', x: 0.2, z: 3.1, remaining: 3 },
    ...(params.has('before')
      ? []
      : [
          { id: 243, item: 'mushroom' as const, x: 0, z: -3, remaining: 6 },
          { id: 246, item: 'berry' as const, x: -4, z: -1.5, remaining: 6 },
        ]),
  ]);
  const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.05, 60);
  camera.position.set(5.2, 6.5, 8.8);
  camera.lookAt(-1.5, 0.1, 0);
  const resize = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);
  let frames = 0;
  renderer.setAnimationLoop(() => {
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
      landmark.dispose();
      items.group.removeFromParent();
      landmark.group.removeFromParent();
    },
    { once: true },
  );
}
