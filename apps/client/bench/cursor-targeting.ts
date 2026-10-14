import * as THREE from 'three/webgpu';
import { lootUnderCursor, type LootTarget } from '../src/input/loot-target';
const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2),
  material = new THREE.MeshBasicMaterial();
const candidates: LootTarget[] = [];
for (let n = 0; n < 240; n++) {
  const root = new THREE.Group();
  root.position.set(((n % 20) - 10) * 0.25, Math.floor(n / 20) * 0.2 - 1, 0);
  for (let c = 0; c < 6; c++) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.x = c * 0.03;
    root.add(mesh);
  }
  candidates.push({
    request: { kind: 'pile', id: n },
    item: 'log',
    count: 1,
    object: root,
    x: root.position.x,
    z: 0,
  });
}
const blocker = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 0.2), material);
blocker.position.z = 2;
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
camera.position.z = 5;
camera.lookAt(0, 0, 0);
camera.updateMatrixWorld();
const ray = new THREE.Raycaster();
for (let i = 0; i < 20; i++)
  lootUnderCursor(ray, { x: 300, y: 300 }, { width: 600, height: 600 }, camera, candidates, [
    blocker,
  ]);
const runs = [];
for (let batch = 0; batch < 7; batch++) {
  const start = performance.now();
  for (let i = 0; i < 100; i++)
    lootUnderCursor(ray, { x: 300, y: 300 }, { width: 600, height: 600 }, camera, candidates, [
      blocker,
    ]);
  runs.push((performance.now() - start) / 100);
}
runs.sort((a, b) => a - b);
console.log(JSON.stringify({ medianMs: runs[3], runs }));
