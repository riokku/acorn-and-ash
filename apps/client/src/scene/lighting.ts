import * as THREE from 'three/webgpu';

/** Soft daylight over the clearing, and fog so the tree line fades out. */
export function addDaylight(scene: THREE.Scene): THREE.DirectionalLight {
  scene.background = new THREE.Color(0x9fc4d8);
  scene.fog = new THREE.Fog(0x9fc4d8, 55, 120);

  const sky = new THREE.HemisphereLight(0xcfe3f0, 0x51603f, 1.6);
  scene.add(sky);

  const sun = new THREE.DirectionalLight(0xfff0d4, 2.1);
  sun.position.set(28, 40, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 140;
  sun.shadow.camera.left = -55;
  sun.shadow.camera.right = 55;
  sun.shadow.camera.top = 55;
  sun.shadow.camera.bottom = -55;
  sun.shadow.bias = -0.0008;
  scene.add(sun);
  scene.add(sun.target);

  return sun;
}
