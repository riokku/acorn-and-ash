import * as THREE from 'three/webgpu';

/**
 * A placeholder mound: a low dome of turned-over earth. Art replaces this
 * once the mechanic around it is fun, the same as every other placeholder.
 */
export interface BuriedCacheMound {
  readonly group: THREE.Group;
  dispose(): void;
}

const RADIUS = 0.4;
const HEIGHT_SCALE = 0.45;

export function createBuriedCacheMound(): BuriedCacheMound {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 1 });

  const geometry = new THREE.SphereGeometry(RADIUS, 12, 8);
  const mound = new THREE.Mesh(geometry, material);
  mound.scale.y = HEIGHT_SCALE;
  mound.position.y = RADIUS * HEIGHT_SCALE * 0.5;
  mound.castShadow = true;
  group.add(mound);

  return {
    group,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}
