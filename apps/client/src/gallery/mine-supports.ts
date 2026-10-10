import * as THREE from 'three/webgpu';

import { CUBE_DIG, checkSupportCell, type Dig, type Support, type Terrain } from '@acorn/shared';

import { installBvhRaycasting } from '../scene/bvh';
import { createDigScene } from '../scene/digging';
import { createMineSupports } from '../scene/mine-supports';

/**
 * A tunnel shored up with mine supports, in the art gallery (`?gallery=mine-supports`,
 * decision 0119). The ground is a sheer cliff face at x = 0 (nothing to the
 * west, flat ground to the east), so the tunnel can be seen from its open end.
 * A tunnel two metres wide and two tall runs six metres in, with a support in
 * every other metre, the way a mine is propped.
 */

const cliff: Terrain = { kind: 'cliff', heightAt: (x) => (x < 0 ? -8 : 0) };

export function createMineSupportsExhibit(): { group: THREE.Group } {
  installBvhRaycasting();
  const scene = createDigScene(cliff, { origin: -150, cell: 2.5, hide: () => undefined });
  const digs: Dig[] = [];
  for (let metre = 0; metre < 7; metre++) {
    for (const iy of [-6, -4]) {
      for (const iz of [0, 2]) digs.push({ ix: metre * 2, iy, iz, dir: CUBE_DIG });
    }
  }
  scene.apply(digs);

  // A support in every other metre, if the tunnel really has room for it.
  const supports: Support[] = [];
  for (const metre of [1, 3, 5]) {
    const cell = { ix: metre * 2, iy: -6, iz: 0 };
    const fit = checkSupportCell(scene.grid, cell, supports);
    if ('axis' in fit) supports.push({ ...cell, axis: fit.axis });
  }
  const standing = createMineSupports();
  standing.apply(supports, true);

  const group = new THREE.Group();
  scene.group.position.set(-4, 6.05, 0);
  standing.group.position.set(-4, 6.05, 0);
  group.add(scene.group, standing.group);
  return { group };
}
