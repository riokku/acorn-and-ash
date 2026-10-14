import type * as THREE from 'three/webgpu';
import { Vector2 } from 'three/webgpu';
import type { ItemId, LootRequest } from '@acorn/shared';

export interface LootTarget {
  readonly request: LootRequest;
  readonly item: ItemId;
  readonly count: number;
  readonly object: THREE.Object3D;
  readonly x: number;
  readonly z: number;
  readonly heightOffset?: number;
}

/** Transforms and lists are prepared once for this pointer query, never cached across frames. */
function prepareLoot(candidates: readonly LootTarget[], blockers: readonly THREE.Object3D[]) {
  const objects: THREE.Object3D[] = [];
  const owners = new Map<THREE.Object3D, { target: LootTarget; index: number }>();
  const preparedBlockers = new Set<THREE.Object3D>();
  for (const [index, candidate] of candidates.entries()) {
    candidate.object.updateWorldMatrix(true, true);
    objects.push(candidate.object);
    if (!owners.has(candidate.object)) owners.set(candidate.object, { target: candidate, index });
  }
  return (raycaster: THREE.Raycaster): LootTarget | null => {
    const hit = raycaster.intersectObjects(objects, true).find((entry) => visible(entry.object));
    if (hit === undefined) return null;
    const previousFar = raycaster.far;
    try {
      raycaster.far = Math.min(previousFar, Math.max(0, hit.distance - 0.02));
      // Collision proxies are intentionally invisible. Stop at the first
      // blocker: the result is occluded regardless of any later intersection.
      for (const blocker of blockers) {
        if (!preparedBlockers.has(blocker)) {
          blocker.updateWorldMatrix(true, true);
          preparedBlockers.add(blocker);
        }
        if (raycaster.intersectObject(blocker, true).length > 0) return null;
      }
    } finally {
      raycaster.far = previousFar;
    }
    let chosen: { target: LootTarget; index: number } | undefined;
    for (let object: THREE.Object3D | null = hit.object; object !== null; object = object.parent) {
      const owner = owners.get(object);
      if (owner !== undefined && (chosen === undefined || owner.index < chosen.index))
        chosen = owner;
    }
    return chosen?.target ?? null;
  };
}

function visible(object: THREE.Object3D): boolean {
  for (let parent: THREE.Object3D | null = object; parent !== null; parent = parent.parent)
    if (!parent.visible) return false;
  return true;
}

/** Pick visible loot, with invisible collision meshes enforcing scenery occlusion. */
export function lootUnderRay(
  raycaster: THREE.Raycaster,
  candidates: readonly LootTarget[],
  blockers: readonly THREE.Object3D[],
): LootTarget | null {
  return prepareLoot(candidates, blockers)(raycaster);
}

const cursor = new Vector2();
const CURSOR_SAMPLES = [
  [0, 0],
  [-3, 0],
  [3, 0],
  [0, -3],
  [0, 3],
] as const;

/** A small CSS-pixel tolerance keeps thin/bobbing loot from flickering under a cursor.
 * A direct hit always wins; every nearby sample still respects real scenery occlusion.
 */
export function lootUnderCursor(
  raycaster: THREE.Raycaster,
  point: { x: number; y: number },
  viewport: { width: number; height: number },
  camera: THREE.Camera,
  candidates: readonly LootTarget[],
  blockers: readonly THREE.Object3D[],
): LootTarget | null {
  const setRay = (x: number, y: number) => {
    cursor.set((x / viewport.width) * 2 - 1, -(y / viewport.height) * 2 + 1);
    raycaster.setFromCamera(cursor, camera);
  };
  const pick = prepareLoot(candidates, blockers);
  try {
    for (const [x, y] of CURSOR_SAMPLES) {
      const sampleX = point.x + x,
        sampleY = point.y + y;
      if (sampleX < 0 || sampleY < 0 || sampleX > viewport.width || sampleY > viewport.height)
        continue;
      setRay(sampleX, sampleY);
      const target = pick(raycaster);
      if (target !== null) return target;
    }
    return null;
  } finally {
    // Other cursor operations retain the actual pointer ray, not an offset sample.
    setRay(point.x, point.y);
  }
}
