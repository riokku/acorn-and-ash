import type * as THREE from 'three/webgpu';
import type { ItemId, LootRequest } from '@acorn/shared';

export interface LootTarget {
  readonly request: LootRequest;
  readonly item: ItemId;
  readonly count: number;
  readonly object: THREE.Object3D;
  readonly x: number;
  readonly z: number;
}

/** Pick visible loot, with invisible collision meshes enforcing scenery occlusion. */
export function lootUnderRay(
  raycaster: THREE.Raycaster,
  candidates: readonly LootTarget[],
  blockers: readonly THREE.Object3D[],
): LootTarget | null {
  for (const candidate of candidates) candidate.object.updateWorldMatrix(true, true);
  const visible = (object: THREE.Object3D): boolean => {
    for (let parent: THREE.Object3D | null = object; parent !== null; parent = parent.parent)
      if (!parent.visible) return false;
    return true;
  };
  const hit = raycaster
    .intersectObjects(
      candidates.map((candidate) => candidate.object),
      true,
    )
    .find((entry) => visible(entry.object));
  if (hit === undefined) return null;
  // Collision proxies are intentionally invisible. Only hits before the loot matter.
  const previousFar = raycaster.far;
  let blocked: boolean;
  try {
    raycaster.far = Math.min(previousFar, Math.max(0, hit.distance - 0.02));
    for (const blocker of blockers) blocker.updateWorldMatrix(true, true);
    blocked = raycaster.intersectObjects([...blockers], true).length > 0;
  } finally {
    raycaster.far = previousFar;
  }
  if (blocked) return null;
  return (
    candidates.find((candidate) => {
      for (let parent: THREE.Object3D | null = hit.object; parent !== null; parent = parent.parent)
        if (parent === candidate.object) return true;
      return false;
    }) ?? null
  );
}
