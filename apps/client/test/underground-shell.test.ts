import * as THREE from 'three/webgpu';
import { expect, it, vi } from 'vitest';
import { createUnderground } from '../src/scene/underground-shell';
import { createDigScene } from '../src/scene/digging';
import { FollowCamera } from '../src/camera/follow-camera';
import { installBvhRaycasting } from '../src/scene/bvh';

it('closes every horizontal and downward view under sloping terrain without covering openings', () => {
  const geometry = new THREE.PlaneGeometry(100, 100, 8, 8).rotateX(-Math.PI / 2);
  const p = geometry.getAttribute('position');
  for (let i = 0; i < p.count; i++) p.setY(i, p.getX(i) * 0.1);
  const shell = createUnderground(geometry, 100);
  shell.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 16)
    for (const down of [0, -0.2, -1]) {
      ray.set(
        new THREE.Vector3(0, -10, 0),
        new THREE.Vector3(Math.cos(angle), down, Math.sin(angle)).normalize(),
      );
      expect(ray.intersectObject(shell, true).length).toBeGreaterThan(0);
    }
  for (const mesh of shell.children as THREE.Mesh[])
    expect((mesh.material as THREE.MeshBasicMaterial).fog).toBe(false);
  // A removed top stays an opening to the real sky; only the perimeter and bottom are sealed.
  geometry.setIndex([]);
  ray.set(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 1, 0));
  expect(ray.intersectObject(shell, true)).toHaveLength(0);
  for (const mesh of shell.children as THREE.Mesh[]) {
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  }
});

it('includes rebuilt ground and its underside in camera collision, replacing stale meshes on further digs', () => {
  installBvhRaycasting();
  const loader = vi
    .spyOn(THREE.TextureLoader.prototype, 'load')
    .mockReturnValue(new THREE.Texture());
  const material = new THREE.MeshBasicMaterial();
  const scene = createDigScene(
    { kind: 'flat', heightAt: () => 0 },
    {
      origin: 0,
      cell: 2.5,
      hide() {},
      material,
      lattice(cx, cz, n) {
        const count = (n + 1) ** 2,
          position = new Float32Array(count * 3),
          normal = new Float32Array(count * 3);
        for (let z = 0; z <= n; z++)
          for (let x = 0; x <= n; x++) {
            const i = z * (n + 1) + x;
            position.set([cx * 2.5 + (x * 2.5) / n, 0, cz * 2.5 + (z * 2.5) / n], i * 3);
            normal[i * 3 + 1] = 1;
          }
        return {
          position,
          normal,
          floor: new Float32Array(count),
          rock: new Float32Array(count),
          snow: new Float32Array(count),
          tint: new Float32Array(count * 3),
          bank: new Float32Array(count * 2),
        };
      },
    },
  );
  try {
    scene.apply([{ ix: 2, iy: -2, iz: 2, dir: 4 }]);
    scene.group.updateMatrixWorld(true);
    const skin = scene.cameraBlockers.find((m) => m.material === material)!;
    expect(skin).toBeDefined();
    expect(scene.cameraBlockers).toContain(skin.children[0]);
    const ray = new THREE.Raycaster(new THREE.Vector3(0.1, 1, 0.1), new THREE.Vector3(0, -1, 0));
    expect(ray.intersectObjects([...scene.cameraBlockers], false).length).toBeGreaterThan(0);
    ray.set(new THREE.Vector3(0.1, -1, 0.1), new THREE.Vector3(0, 1, 0));
    expect(ray.intersectObjects([...scene.cameraBlockers], false).length).toBeGreaterThan(0);
    scene.apply([{ ix: 4, iy: -2, iz: 2, dir: 4 }]);
    expect(scene.cameraBlockers).not.toContain(skin);
    expect(scene.cameraBlockers).not.toContain(skin.children[0]);
    expect(scene.pickables().filter((m) => m.material === material).length).toBeGreaterThan(0);
  } finally {
    scene.dispose();
    material.dispose();
    loader.mockRestore();
  }
});

it('keeps the full-size earth enclosure within the camera range from the playable boundary', () => {
  const geometry = new THREE.PlaneGeometry(940, 940, 8, 8).rotateX(-Math.PI / 2);
  const shell = createUnderground(geometry, 940);
  shell.updateMatrixWorld(true);
  const camera = new FollowCamera(1).camera;
  const ray = new THREE.Raycaster();
  ray.far = camera.far;
  for (const x of [-308, 308])
    for (const z of [-308, 308])
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 16) {
        ray.set(
          new THREE.Vector3(x, -10, z),
          new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)),
        );
        expect(ray.intersectObject(shell, true).length).toBeGreaterThan(0);
      }
  for (const mesh of shell.children as THREE.Mesh[]) {
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  }
});
