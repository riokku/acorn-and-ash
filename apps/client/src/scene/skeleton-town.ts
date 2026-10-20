import * as THREE from 'three/webgpu';
import { SKELETON_TOWN, type Terrain, type RaiderKindId } from '@acorn/shared';
import { loadAnimatedModel } from './model-loading';
import { createTriplanarMaterial } from '../art/materials';
import townUrl from '@assets/settlements/bonehollow.glb?url';

let template: THREE.Group | undefined;
let loading: Promise<void> | undefined;
export function preloadSkeletonTown(): Promise<void> {
  return (loading ??= loadAnimatedModel(townUrl)
    .then((model) => {
      template = model.root;
      const materials = new Map<string, THREE.Material>();
      template.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const dress = (source: THREE.Material) => {
          if (!(source instanceof THREE.MeshStandardMaterial)) return source;
          const name = source.name;
          if (!materials.has(name)) {
            const texture = /masonry|slate/i.test(name)
              ? 'stone'
              : /cloth/i.test(name)
                ? 'burlap'
                : /cedar|beams/i.test(name)
                  ? 'wood'
                  : null;
            materials.set(
              name,
              texture ? createTriplanarMaterial(texture, source.color.getHex(), 0.6) : source,
            );
          }
          return materials.get(name)!;
        };
        object.material = Array.isArray(object.material)
          ? object.material.map(dress)
          : dress(object.material);
        object.castShadow = true;
        object.receiveShadow = true;
      });
    })
    .catch((error) => {
      loading = undefined;
      throw error;
    }));
}
/** Shared Blender modules; the copied scene owns no geometry or materials. */
export function createSkeletonTown(terrain: Terrain): THREE.Group {
  const group = template?.clone(true) ?? new THREE.Group();
  group.name = 'bonehollow';
  group.getObjectByName('TownWatch')?.removeFromParent();
  group.getObjectByName('TownScavenger')?.removeFromParent();
  group.position.set(
    SKELETON_TOWN.x,
    terrain.heightAt(SKELETON_TOWN.x, SKELETON_TOWN.z),
    SKELETON_TOWN.z,
  );
  return group;
}
export function townHeadwear(kind: RaiderKindId): THREE.Object3D | null {
  const name = kind === 'minion' ? 'TownScavenger' : kind === 'warrior' ? 'TownWatch' : null;
  const piece = name ? template?.getObjectByName(name)?.clone(true) : null;
  if (!piece) return null;
  const group = new THREE.Group();
  group.name = 'bonehollow-headwear';
  group.add(piece);
  group.scale.setScalar(1 / 0.6);
  group.position.y = 0.68;
  group.visible = false;
  return group;
}

/** A home-sized copy of the existing Blender bell, resting with its rim on the ground. */
export function createLastBellTrophy() {
  const group = new THREE.Group();
  group.name = 'last-bell-keepsake';
  const bell = template?.getObjectByName('LastBell')?.clone(true);
  if (bell) {
    group.add(bell);
    const bounds = new THREE.Box3().setFromObject(group);
    const center = bounds.getCenter(new THREE.Vector3());
    bell.position.sub(new THREE.Vector3(center.x, bounds.min.y, center.z));
    group.scale.setScalar(0.72 / (bounds.max.x - bounds.min.x));
  }
  // Geometry and materials belong to the cached town template.
  return { group, dispose() {} };
}
