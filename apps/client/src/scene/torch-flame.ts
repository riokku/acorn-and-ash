import * as THREE from 'three/webgpu';
import { createFlame } from './flame';

/** The existing animated fire asset, sized for a torch and kept upright in world space. */
export function createTorchFlame() {
  const instance = createFlame();
  if (!instance) return null;
  const group = instance.root;
  group.name = 'torch-flame';
  group.scale.setScalar(0.72);

  const parentRotation = new THREE.Quaternion();
  return {
    group,
    update(deltaSeconds: number, visible: boolean) {
      group.visible = visible;
      if (!visible) return;
      instance.update(deltaSeconds);
      // The wick follows the hand, but fire rises upward even when its handle leans.
      if (group.parent !== null) {
        group.parent.updateWorldMatrix(true, false);
        group.parent.getWorldQuaternion(parentRotation);
        group.quaternion.copy(parentRotation).invert();
      }
    },
    dispose() {
      instance.dispose();
      // The flame geometry and materials belong to the shared loaded template.
    },
  };
}
