import * as THREE from 'three/webgpu';
import { FreshAnimalTracks } from '../scene/fresh-animal-tracks';
import { createWoodlandCreature } from '../scene/woodland-creatures';
import type { RendererSetup } from '../scene/renderer';
import type { FireLights } from '../scene/fire-light';

export const trackGalleryGround = (x: number, z: number) => 0.05 * x + 0.06 * z;
export async function showFreshTracks(
  renderer: RendererSetup['renderer'],
  scene: THREE.Scene,
  lights: FireLights,
  params: URLSearchParams,
): Promise<void> {
  const tracks = new FreshAnimalTracks(trackGalleryGround);
  const marks = Array.from({ length: 14 }, (_, i) => ({
    id: i + 1,
    kind: 'elk' as const,
    x: Math.sin(i * 0.18) * 0.6 - 0.6,
    z: 2 - i * 0.35,
    yaw: 0,
    freshness: 0.15 + i / 17,
  }));
  tracks.setTracks(marks);
  tracks.group.visible = !params.has('before');
  const elk = createWoodlandCreature('elk');
  elk.group.position.set(0.1, trackGalleryGround(0.1, -3.2), -3.2);
  scene.add(tracks.group, elk.group);
  const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.05, 60);
  camera.position.set(3.1, 4, 6.2);
  camera.lookAt(0, 1, -0.8);
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
      tracks.dispose();
      elk.dispose();
      elk.group.removeFromParent();
    },
    { once: true },
  );
}
