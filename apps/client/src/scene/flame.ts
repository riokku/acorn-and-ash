import * as THREE from 'three/webgpu';
import { float, positionLocal, smoothstep } from 'three/tsl';
import { flameModelTemplate } from './campfire-models';
import { instantiateAnimatedModel } from './model-loading';

let nextPhase = 0;

/** Shared authored fire, with independent timing and consistent accessibility/lifetime handling. */
export function createFlame(options: { softBase?: boolean } = {}) {
  const template = flameModelTemplate();
  if (!template) return null;
  const instance = instantiateAnimatedModel(template);
  const { root, mixer, actions } = instance;
  const ownedMaterials: THREE.Material[] = [];
  if (options.softBase) {
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      // Use the rest shape: morph-target bounds include the moving tips and would shift the fade.
      const bounds = new THREE.Box3().setFromBufferAttribute(
        object.geometry.getAttribute('position'),
      );
      const fadeEnd = bounds.min.y + Math.max(0.001, bounds.max.y - bounds.min.y) * 0.32;
      const soften = (source: THREE.Material) => {
        if (!(source instanceof THREE.MeshStandardMaterial)) return source;
        const material = new THREE.MeshStandardNodeMaterial().copy(source);
        material.transparent = true;
        material.depthWrite = false;
        material.opacityNode = float(source.opacity).mul(
          smoothstep(bounds.min.y, fadeEnd, positionLocal.y),
        );
        ownedMaterials.push(material);
        return material;
      };
      object.material = Array.isArray(object.material)
        ? object.material.map(soften)
        : soften(object.material);
    });
  }
  const preference =
    typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  for (const action of actions) action.play();
  // A non-integer step avoids matching neighboring fires even with short clips.
  mixer.setTime(nextPhase++ * 0.731);
  let disposed = false;
  return {
    root,
    update(deltaSeconds: number, reducedMotion = preference?.matches ?? false) {
      if (disposed || reducedMotion || !root.visible || !Number.isFinite(deltaSeconds)) return;
      // Do not leap through a whole burn cycle after a suspended browser tab.
      mixer.update(Math.max(0, Math.min(deltaSeconds, 0.1)));
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      mixer.stopAllAction();
      mixer.uncacheRoot(root);
      root.removeFromParent();
      for (const material of ownedMaterials) material.dispose();
      // Geometry, morph buffers and original materials belong to the loaded template.
    },
  };
}
