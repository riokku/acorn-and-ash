import * as THREE from 'three/webgpu';
import type { Vec3 } from '@acorn/shared';

const OFFSET = new THREE.Vector3(28, 40, 18);
const FORWARD = OFFSET.clone().normalize();
const RIGHT = new THREE.Vector3(0, 1, 0).cross(FORWARD).normalize();
const UP = FORWARD.clone().cross(RIGHT).normalize();

/** Follow the player on whole shadow texels, keeping static scenery's sample grid stable. */
export function centreDaylightShadow(sun: THREE.DirectionalLight, position: Readonly<Vec3>): void {
  const camera = sun.shadow.camera;
  const texelX = (camera.right - camera.left) / sun.shadow.mapSize.x;
  const texelY = (camera.top - camera.bottom) / sun.shadow.mapSize.y;
  const right = position.x * RIGHT.x + position.y * RIGHT.y + position.z * RIGHT.z;
  const up = position.x * UP.x + position.y * UP.y + position.z * UP.z;
  const shiftRight = Math.round(right / texelX) * texelX - right;
  const shiftUp = Math.round(up / texelY) * texelY - up;
  sun.target.position
    .set(position.x, position.y, position.z)
    .addScaledVector(RIGHT, shiftRight)
    .addScaledVector(UP, shiftUp);
  sun.position.copy(sun.target.position).add(OFFSET);
  sun.target.updateMatrixWorld();
}
