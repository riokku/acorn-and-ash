import * as THREE from 'three/webgpu';

import { CUBE_DIG, type Dig, type Terrain } from '@acorn/shared';

import { installBvhRaycasting } from '../scene/bvh';
import { createDigScene } from '../scene/digging';

/**
 * Holes cut with the same code the shovel uses, so the smooth lining and the
 * layers painted on it can be looked at in the art gallery (`?gallery=dug-earth`,
 * decision 0114). The ground is a sheer cliff face at x = 0 (nothing to the west,
 * flat ground to the east), so each hole can be seen from its open end. The
 * gallery's own ground is not cut away, so the group floats just above it.
 *
 * From the near side: a tunnel a metre across (one cube), a tunnel a metre wide
 * and two tall (what two swings make), and a shaft six metres deep open to the sky.
 */

const cliff: Terrain = { kind: 'cliff', heightAt: (x) => (x < 0 ? -8 : 0) };

/** One-metre cubes in a row along +X, starting at metre `fromMetre`. */
function row(fromMetre: number, count: number, zMetre: number, floorIy: number): Dig[] {
  return Array.from({ length: count }, (_, i) => ({
    ix: (fromMetre + i) * 2,
    iy: floorIy,
    iz: zMetre * 2,
    dir: CUBE_DIG,
  }));
}

export function createDugEarth(): { group: THREE.Group } {
  // The wall meshes build the camera's raycast index, which the game sets up at start.
  installBvhRaycasting();
  const scene = createDigScene(cliff, { origin: -150, cell: 2.5, hide: () => undefined });
  const digs: Dig[] = [
    // A tunnel one metre across, four metres long, with a round end.
    ...row(0, 4, -3, -6),
    // The same, a metre taller: two swings a metre.
    ...row(0, 4, 0, -6),
    ...row(0, 4, 0, -4),
    // A shaft six metres deep, open to the sky, ending in a round floor.
    ...Array.from({ length: 6 }, (_, i) => ({
      ix: 14,
      iy: -12 + i * 2,
      iz: 0,
      dir: CUBE_DIG,
    })),
  ];
  scene.apply(digs);

  const group = new THREE.Group();
  scene.group.position.set(-4, 6.05, 0);
  group.add(scene.group);
  return { group };
}
