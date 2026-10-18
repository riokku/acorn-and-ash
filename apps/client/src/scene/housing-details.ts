import * as THREE from 'three/webgpu';
import { color, texture, triplanarTexture } from 'three/tsl';
import { artTexture } from '../art/textures';
import { loadAnimatedModel } from './model-loading';
import { createTriplanarMaterial } from '../art/materials';
import detailsUrl from '@assets/housing/cabin-details.glb?url';

let template: THREE.Group | undefined;
let loading: Promise<void> | undefined;
/** Shared authored parts load once before homes are constructed. */
export function preloadHousingDetails(): Promise<void> {
  return (loading ??= loadAnimatedModel(detailsUrl)
    .then(({ root }) => {
      const materials = new Map<THREE.Material, THREE.Material>();
      root.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const dress = (source: THREE.Material) => {
          if (!(source instanceof THREE.MeshStandardMaterial)) return source;
          if (!materials.has(source)) {
            const type = /Canvas/.test(source.name)
              ? 'burlap'
              : /Cedar/.test(source.name)
                ? 'wood'
                : null;
            const material = type
              ? createTriplanarMaterial(type, source.color.getHex(), 0.7)
              : source;
            if (/Canvas/.test(source.name) && material instanceof THREE.MeshStandardNodeMaterial) {
              material.colorNode = triplanarTexture(texture(artTexture('burlap')))
                .rgb.mul(0.16)
                .add(color(source.color).mul(0.85));
            }
            material.side = THREE.DoubleSide;
            materials.set(source, material);
          }
          return materials.get(source)!;
        };
        object.material = Array.isArray(object.material)
          ? object.material.map(dress)
          : dress(object.material);
        object.castShadow = true;
        object.receiveShadow = true;
      });
      template = root;
    })
    .catch((error) => {
      loading = undefined;
      // Existing shelter geometry remains usable if this optional visual asset fails.
      console.warn('Housing detail model unavailable', error);
    }));
}
/** Clones share immutable geometry/materials with the cache; no per-home disposal. */
export function housingDetails(prefix: 'Cabin' | 'Porch' | 'Tent' | 'Teepee'): THREE.Group {
  const group = new THREE.Group();
  group.name = `housing-details-${prefix.toLowerCase()}`;
  for (const child of template?.children ?? [])
    if (child.name.startsWith(prefix)) group.add(child.clone(true));
  return group;
}
