import * as THREE from 'three/webgpu';
import { expect, it } from 'vitest';
import { groundBuildingSupport, groundLooseBuildingPart } from '../src/scene/building-ground';
import { createBuildGhost } from '../src/scene/build-ghost';

it('buries a rotated, scaled footing on a slope without tilting or moving its top', () => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.2, 3.7).translate(0, 0.1, 0));
  const home = new THREE.Group();
  home.position.set(12, 0, -7);
  home.rotation.y = 0.9;
  home.scale.set(1.2, 1, 1.2);
  home.add(mesh);
  const heightAt = (x: number, z: number) => (x - 12) * 0.07 + (z + 7) * 0.035;
  const positions = mesh.geometry.getAttribute('position');
  const before = Float32Array.from(positions.array);
  const fit = groundBuildingSupport(mesh, 0.09);
  fit(heightAt);
  const point = new THREE.Vector3();
  for (let vertex = 0; vertex < positions.count; vertex++) {
    expect(positions.getX(vertex)).toBe(before[vertex * 3]);
    expect(positions.getZ(vertex)).toBe(before[vertex * 3 + 2]);
    if (before[vertex * 3 + 1]! > 0.1) expect(positions.getY(vertex)).toBe(before[vertex * 3 + 1]);
    else {
      point.fromBufferAttribute(positions, vertex).applyMatrix4(mesh.matrixWorld);
      expect(point.y).toBeLessThan(heightAt(point.x, point.z));
    }
  }
  mesh.geometry.dispose();
  (mesh.material as THREE.Material).dispose();
});

it('restores the original support when a preview moves from steep to flat ground', () => {
  const geometry = new THREE.BoxGeometry(4, 0.2, 4).translate(0, 0.1, 0);
  const fresh = new THREE.Mesh(geometry.clone());
  const moved = new THREE.Mesh(geometry);
  const fit = groundBuildingSupport(moved, 0.09);
  fit((x) => x * 0.4);
  moved.position.set(15, 0, 12);
  moved.rotation.y = 1.1;
  fit(() => 0);
  const once = Float32Array.from(geometry.getAttribute('position').array);
  fit(() => 0);
  groundBuildingSupport(fresh, 0.09)(() => 0);
  expect(geometry.getAttribute('position').array).toEqual(once);
  expect(once).toEqual(fresh.geometry.getAttribute('position').array);
  for (const mesh of [moved, fresh]) {
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  }
});

it('moves the entrance step to local ground height while keeping the home level', () => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 0.4).translate(-0.6, 0.055, 3.1));
  const home = new THREE.Group();
  home.position.set(5, 1, -2);
  home.rotation.y = Math.PI / 2;
  home.scale.set(1.2, 1, 1.2);
  home.add(mesh);
  const fit = groundBuildingSupport(mesh, 0.05, true);
  const heightAt = (x: number) => 1 + (x - 5) * 0.04;
  fit(heightAt);
  const point = new THREE.Vector3(-0.6, 0, 3.1).applyMatrix4(mesh.matrixWorld);
  expect(point.y).toBeCloseTo(heightAt(point.x));
  expect(home.position.y).toBe(1);
  fit(heightAt);
  expect(mesh.position.y).toBeCloseTo(0.1488);
  mesh.geometry.dispose();
  (mesh.material as THREE.Material).dispose();
});

it('grounds the placement model only when its position or rotation changes', () => {
  const group = new THREE.Group();
  const placements: number[][] = [];
  const source = {
    group,
    groundOn: () => {
      group.updateWorldMatrix(true, false);
      const spot = new THREE.Vector3().setFromMatrixPosition(group.matrixWorld);
      placements.push(spot.toArray());
    },
    dispose: () => {},
  };
  const ghost = createBuildGhost(source, { radius: 3, halfLength: 0 }, () => 0);
  ghost.show(8, 4, 0.5, true, 2);
  ghost.show(8, 4, 0.5, false, 2);
  expect(placements).toEqual([[8, 2, 4]]);
  ghost.show(8, 4, 1, true, 2);
  expect(placements).toHaveLength(2);
  ghost.show(9, 4, 1, true, 2);
  expect(placements[2]).toEqual([9, 2, 4]);
  ghost.dispose();
});

it('rests loose firewood on rotated, scaled ground without accumulating its tilt', () => {
  const home = new THREE.Group();
  home.position.set(12, 0, -7);
  home.rotation.y = 0.8;
  home.scale.set(1.2, 1, 1.2);
  const pile = new THREE.Group();
  pile.position.x = -2.5;
  home.add(pile);
  const heightAt = (x: number, z: number) => (x - 12) * 0.05 + (z + 7) * 0.015;
  groundLooseBuildingPart(pile, heightAt);
  home.updateMatrixWorld(true);
  const at = new THREE.Vector3().setFromMatrixPosition(pile.matrixWorld);
  expect(at.y).toBeCloseTo(heightAt(at.x, at.z) - 0.02);
  const normal = new THREE.Vector3(0, 1, 0)
    .applyMatrix3(new THREE.Matrix3().getNormalMatrix(pile.matrixWorld))
    .normalize();
  expect(normal.dot(new THREE.Vector3(-0.05, 1, -0.015).normalize())).toBeCloseTo(1);
  const once = pile.quaternion.clone();
  groundLooseBuildingPart(pile, heightAt);
  expect(pile.quaternion.equals(once)).toBe(true);
});
