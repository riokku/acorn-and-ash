import * as THREE from 'three/webgpu';
import { LAKE, STREAM, createWildernessTerrain } from '@acorn/shared';
import { createGroundShader } from '../art/ground-shading';
import { createGround } from '../scene/wilderness';
import { createStreamScene } from '../scene/stream';

/** Real shared terrain and water, for inspecting the spring and uneven banks. */
export function createRiverExhibit(): { group: THREE.Group } {
  const terrain = createWildernessTerrain(1234);
  const group = new THREE.Group();
  group.add(
    createGround(terrain, createGroundShader({ water: [], props: [], lake: LAKE, stream: STREAM }))
      .mesh,
  );
  const river = createStreamScene(STREAM, terrain);
  group.add(river.group);
  if (new URLSearchParams(window.location.search).has('frozen')) river.setFrozen(true);
  return { group };
}
