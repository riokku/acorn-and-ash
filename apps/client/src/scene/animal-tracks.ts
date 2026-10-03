import * as THREE from 'three/webgpu';
import type { Terrain, Collider } from '@acorn/shared';
import { buildWoodlandTracks, type WoodlandKind } from '@acorn/shared';
import { ModelBuilder, placed } from '../art/shapes';

/** Shallow dark prints conform to the ground, with a distinct silhouette per species. */
export function createAnimalTracks(
  seed: number,
  terrain: Terrain,
  colliders: readonly Collider[] = [],
) {
  const tracks = buildWoodlandTracks(seed, colliders);
  const builder = new ModelBuilder();
  const mud = new THREE.MeshBasicMaterial({
    color: 0x372e24,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const scratch = (x: number, z: number, yaw: number, kind: WoodlandKind): void => {
    const y = terrain.heightAt(x, z) + 0.025;
    const local = (dx: number, dz: number) => ({
      x: x + dx * Math.cos(yaw) + dz * Math.sin(yaw),
      z: z - dx * Math.sin(yaw) + dz * Math.cos(yaw),
    });
    const pad = (dx: number, dz: number, radius: number, stretch = 1): void => {
      const at = local(dx, dz);
      builder.add(
        mud,
        new THREE.CircleGeometry(radius, 4),
        placed(at.x, y, at.z, { x: -Math.PI / 2, z: yaw }, { x: 1, y: stretch, z: 1 }),
      );
    };
    if (kind === 'elk') {
      pad(-0.045, 0, 0.055, 1.5);
      pad(0.045, 0, 0.055, 1.5);
    } else if (kind === 'curiousRaccoon') {
      pad(0, 0.025, 0.055);
      for (let toe = 0; toe < 4; toe++) pad((toe - 1.5) * 0.036, -0.06, 0.022, 1.5);
    } else
      for (let root = 0; root < 3; root++) {
        const at = local((root - 1) * 0.12, 0);
        builder.add(
          mud,
          new THREE.PlaneGeometry(0.04, 0.43 - root * 0.05),
          placed(at.x, y, at.z, { x: -Math.PI / 2, z: yaw + (root - 1) * 0.22 }),
        );
      }
  };
  for (const track of tracks)
    for (const side of [-1, 1])
      scratch(
        track.x + Math.cos(track.yaw) * side * 0.17,
        track.z - Math.sin(track.yaw) * side * 0.17,
        track.yaw,
        track.kind,
      );
  const model = builder.build();
  model.group.name = 'woodland-animal-tracks';
  model.group.traverse((child) => {
    if (child instanceof THREE.Mesh) child.castShadow = false;
  });
  return {
    ...model,
    tracks,
    dispose: () => {
      model.dispose();
      mud.dispose();
    },
  };
}
