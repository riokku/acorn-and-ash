import * as THREE from 'three/webgpu';

import { PLAYER_HEIGHT, PLAYER_RADIUS } from '@acorn/shared';

/**
 * A placeholder character: a capsule with a snout so you can tell which way it
 * is facing. Art replaces this once moving around is fun.
 */
export interface Character {
  readonly group: THREE.Group;
  setColor(color: THREE.ColorRepresentation): void;
  dispose(): void;
}

const CAPSULE_LENGTH = PLAYER_HEIGHT - PLAYER_RADIUS * 2;

export function createCharacter(color: THREE.ColorRepresentation): Character {
  const group = new THREE.Group();

  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0 });
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(PLAYER_RADIUS, CAPSULE_LENGTH, 6, 12),
    material,
  );
  // The simulation puts the player's feet at the position; the capsule is
  // measured from its middle.
  body.position.y = PLAYER_HEIGHT / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const snoutMaterial = new THREE.MeshStandardMaterial({ color: 0x2d2a26, roughness: 0.9 });
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 8), snoutMaterial);
  snout.rotation.x = -Math.PI / 2;
  // Yaw 0 faces -Z, so the snout points that way too.
  snout.position.set(0, PLAYER_HEIGHT * 0.78, -PLAYER_RADIUS - 0.1);
  snout.castShadow = true;
  group.add(snout);

  return {
    group,
    setColor: (next) => material.color.set(next),
    dispose: () => {
      body.geometry.dispose();
      snout.geometry.dispose();
      material.dispose();
      snoutMaterial.dispose();
    },
  };
}

/** Give every player a recognisable colour, derived from their network id. */
export function colorForPlayer(netId: number): THREE.Color {
  // Spread hues with the golden angle so nearby ids do not look alike.
  const hue = (netId * 0.61803398875) % 1;
  return new THREE.Color().setHSL(hue, 0.45, 0.58);
}
