import * as THREE from 'three/webgpu';
import { wornWeapon } from '../scene/gear-models';
import type { RendererSetup } from '../scene/renderer';

/** The exact equipped/dropped weapon and shared GPU enchantment, framed for inspection. */
export function showKingsRequiem(
  renderer: RendererSetup['renderer'],
  scene: THREE.Scene,
  params: URLSearchParams,
): void {
  const weapon = wornWeapon(params.has('before') ? 'watchGreatsword' : 'kingsRequiem')!;
  const root = new THREE.Group();
  root.position.y = 0.2;
  for (const part of weapon.parts) {
    const mesh = new THREE.Mesh(part.geometry, part.material);
    mesh.castShadow = !part.effect;
    mesh.frustumCulled = !part.effect;
    root.add(mesh);
  }
  scene.add(root);
  const camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.05, 30);
  camera.position.set(1.15, 1.05, 2.1);
  camera.lookAt(0, 0.8, 0);
  const resize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);
  let frames = 0;
  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
    document.body.dataset.enchantmentFrame = String(++frames);
    if (frames === 8) document.body.dataset.galleryReady = 'true';
  });
}
