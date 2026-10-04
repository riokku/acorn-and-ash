import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';

/**
 * The few numbers the ground and the grass read every frame to look like the
 * season (see decision 0089). They are shared, so when the season moves
 * everything wearing the ground material or the grass material follows at
 * once, with no material rebuilt. The defaults are an unchanged, snow-free
 * look, which is what the gallery and any scene with no seasons gets.
 */
export const seasonUniforms = {
  /** Multiplies the painted ground. */
  ground: uniform(new THREE.Color(1, 1, 1)),
  /** Multiplies the blades of grass. */
  blades: uniform(new THREE.Color(1, 1, 1)),
  /** How much of the ground and grass is under snow, 0 to 1. */
  snow: uniform(0),
};
