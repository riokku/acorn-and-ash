import * as THREE from 'three/webgpu';

/** Render hidden effects once behind the loading screen, using the live scene/light setup. */
export function rehearseEffects(roots: readonly THREE.Object3D[], draw: () => void): void {
  const saved: { object: THREE.Object3D; visible: boolean; culled: boolean; count?: number }[] = [];
  const seen = new Set<THREE.Object3D>();
  try {
    for (const root of roots)
      root.traverse((object) => {
        if (seen.has(object)) return;
        seen.add(object);
        saved.push({
          object,
          visible: object.visible,
          culled: object.frustumCulled,
          ...(object instanceof THREE.InstancedMesh ? { count: object.count } : {}),
        });
        object.visible = true;
        object.frustumCulled = false;
        if (object instanceof THREE.InstancedMesh && object.count === 0) object.count = 1;
      });
    draw();
  } finally {
    for (const state of saved) {
      state.object.visible = state.visible;
      state.object.frustumCulled = state.culled;
      if (state.object instanceof THREE.InstancedMesh && state.count !== undefined)
        state.object.count = state.count;
    }
  }
}
