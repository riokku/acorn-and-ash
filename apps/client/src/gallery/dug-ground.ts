import * as THREE from 'three/webgpu';

import {
  CUBE_DIG,
  DEFAULT_WORLD_SEED,
  LAKE,
  STREAM,
  createWildernessTerrain,
  inHomeClearing,
  type Dig,
  type Terrain,
} from '@acorn/shared';

import { createGroundShader } from '../art/ground-shading';
import { installBvhRaycasting } from '../scene/bvh';
import { createDigScene } from '../scene/digging';
import { createGround } from '../scene/wilderness';

/**
 * A hole dug into real hillside, so the way the ground is cut can be looked at
 * in the art gallery (`?gallery=dug-ground`, decision 0114): the real ground, in
 * its own paint, with a pit and a short slope down cut with the same code the
 * shovel uses. The ground is the whole world's, so the exhibit is placed where
 * a gentle slope is found, away from the home clearing.
 */

/** A spot outside the clearing where the ground slopes a little, at some height above the water. */
export function findDugGroundSpot(terrain: Terrain): { x: number; z: number } {
  for (let x = -280; x < -60; x += 3) {
    for (let z = 280; z > 60; z -= 3) {
      if (inHomeClearing(x, z)) continue;
      const here = terrain.heightAt(x, z);
      const rise = terrain.heightAt(x, z - 4) - here;
      if (here > 3 && rise > 0.8 && rise < 1.6) return { x, z };
    }
  }
  return { x: -150, z: 150 };
}

export function createDugGround(): { group: THREE.Group; spot: { x: number; z: number } } {
  return makeDugGround('pit');
}

/** A ramp dug down in half-metre drops, one a metre, the way a held swing digs it. */
export function createDugRamp(): { group: THREE.Group; spot: { x: number; z: number } } {
  return makeDugGround('ramp');
}

function makeDugGround(kind: 'pit' | 'ramp'): {
  group: THREE.Group;
  spot: { x: number; z: number };
} {
  installBvhRaycasting();
  const terrain = createWildernessTerrain(DEFAULT_WORLD_SEED);
  const spot = findDugGroundSpot(terrain);
  const ground = createGround(
    terrain,
    createGroundShader({ water: [], lake: LAKE, stream: STREAM, props: [] }),
  );
  const scene = createDigScene(terrain, ground);
  // Whole metres: a pit two metres across, then a second cube deeper in one corner.
  const ix = Math.floor(spot.x) * 2;
  const iz = Math.floor(spot.z) * 2;
  const top = Math.floor(terrain.heightAt(spot.x, spot.z) / 0.5) - 1;
  const digs: Dig[] =
    kind === 'ramp'
      ? []
      : [
          { ix, iy: top, iz, dir: CUBE_DIG },
          { ix: ix + 2, iy: top, iz, dir: CUBE_DIG },
          { ix, iy: top, iz: iz + 2, dir: CUBE_DIG },
          { ix, iy: top - 2, iz, dir: CUBE_DIG },
          { ix: ix + 2, iy: top - 1, iz, dir: CUBE_DIG },
        ];
  // A ramp down, one swing a metre and half a metre lower each time, as a held swing digs it.
  if (kind === 'ramp')
    for (let step = 0; step < 6; step++)
      // Each step, and the cubes above it up to the open air: a trench, not a tunnel.
      for (let iy = top - step; iy <= top + 2; iy += 2)
        digs.push({ ix: ix + 2 * step, iy, iz, dir: CUBE_DIG });
  if (kind === 'ramp') {
    // On from the foot of the ramp under the hill: a tunnel a metre across, two tall, then a step up.
    for (let along = 6; along < 11; along++) {
      digs.push({ ix: ix + 2 * along, iy: top - 5, iz, dir: CUBE_DIG });
      digs.push({ ix: ix + 2 * along, iy: top - 3, iz, dir: CUBE_DIG });
    }
  }
  scene.apply(digs);

  // Placed so the hole is where the gallery looks: the exhibit's own position.
  const world = new THREE.Group();
  world.add(ground.mesh, ground.underground, scene.group);
  world.position.set(-spot.x, -terrain.heightAt(spot.x, spot.z), -spot.z);
  const group = new THREE.Group();
  group.add(world);
  return { group, spot };
}
