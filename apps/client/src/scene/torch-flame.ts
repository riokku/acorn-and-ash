import * as THREE from 'three/webgpu';
import { flameModelTemplate } from './campfire-models';
import { instantiateAnimatedModel } from './model-loading';

let nextPhase = 0;

/** The existing animated fire asset, sized for a torch and kept upright in world space. */
export function createTorchFlame() {
  const template = flameModelTemplate();
  if (template === undefined) return null;
  const instance = instantiateAnimatedModel(template);
  const group = instance.root;
  group.name = 'torch-flame';
  group.scale.setScalar(0.72);
  for (const action of instance.actions) action.play();
  instance.mixer.setTime((nextPhase++ * 0.37) % 1);
  const parentRotation = new THREE.Quaternion();
  const reducedMotion =
    typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  return {
    group,
    update(deltaSeconds: number, visible: boolean) {
      group.visible = visible;
      if (!visible) return;
      if (!reducedMotion?.matches) instance.mixer.update(Math.max(0, Math.min(deltaSeconds, 0.1)));
      // The wick follows the hand, but fire rises upward even when its handle leans.
      if (group.parent !== null) {
        group.parent.updateWorldMatrix(true, false);
        group.parent.getWorldQuaternion(parentRotation);
        group.quaternion.copy(parentRotation).invert();
      }
    },
    dispose() {
      instance.mixer.stopAllAction();
      instance.mixer.uncacheRoot(group);
      group.removeFromParent();
      // The flame geometry and materials belong to the shared loaded template.
    },
  };
}
