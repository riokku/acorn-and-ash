import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';

/** x/z centre, seconds since the disturbance, and its strength. Shared by every water surface. */
export const waterRippleUniforms = Array.from({ length: 12 }, () =>
  uniform(new THREE.Vector4(0, 0, 10, 0)),
);
