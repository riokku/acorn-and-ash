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
function prepareLoot(
  candidates: readonly LootTarget[],
  blockers: readonly THREE.Object3D[],
  preferred?: LootRequest,
) {
  const objects: THREE.Object3D[] = [];
  const owners = new Map<THREE.Object3D, { target: LootTarget; index: number }>();
  const preparedBlockers = new Set<THREE.Object3D>();
  for (const [index, candidate] of candidates.entries()) {
    candidate.object.updateWorldMatrix(true, true);
    objects.push(candidate.object);
    if (!owners.has(candidate.object)) owners.set(candidate.object, { target: candidate, index });
  }
  const ownerOf = (leaf: THREE.Object3D): LootTarget | undefined => {
    let chosen: { target: LootTarget; index: number } | undefined;
    for (let object: THREE.Object3D | null = leaf; object !== null; object = object.parent) {
      const owner = owners.get(object);
      if (owner !== undefined && (chosen === undefined || owner.index < chosen.index))
        chosen = owner;
    }
    return chosen?.target;
  };
  return (raycaster: THREE.Raycaster): LootTarget | null => {
    const hits = raycaster.intersectObjects(objects, true);
    let hit = hits.find((entry) => visible(entry.object));
    if (hit === undefined) return null;
    const nearest = hit;
    // Keep the current tooltip through nearly coincident/bobbing surfaces.
    // A clearly nearer object still wins, and scenery is checked anew below.
    if (preferred) {
      const nearestDistance = hit.distance;
      hit =
        hits.find((entry) => {
          if (entry.distance > nearestDistance + 0.04 || !visible(entry.object)) return false;
          const owner = ownerOf(entry.object);
          return owner?.request.kind === preferred.kind && owner.request.id === preferred.id;
        }) ?? hit;
    }
    const previousFar = raycaster.far;
    try {
      for (const choice of hit === nearest ? [hit] : [hit, nearest]) {
        raycaster.far = Math.min(previousFar, Math.max(0, choice.distance - 0.02));
        let blocked = false;
        // Collision proxies are intentionally invisible. A preference never
        // bypasses scenery; a visible nearer candidate can still be selected.
        for (const blocker of blockers) {
          if (!preparedBlockers.has(blocker)) {
            blocker.updateWorldMatrix(true, true);
            preparedBlockers.add(blocker);
          }
          if (raycaster.intersectObject(blocker, true).length > 0) {
            blocked = true;
            break;
          }
        }
        if (!blocked) return ownerOf(choice.object) ?? null;
      }
      return null;
    } finally {
      raycaster.far = previousFar;
    }
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
 * A direct hit wins over offset samples; every nearby sample still respects real scenery occlusion.
 */
export function lootUnderCursor(
  raycaster: THREE.Raycaster,
  point: { x: number; y: number },
  viewport: { width: number; height: number },
  camera: THREE.Camera,
  candidates: readonly LootTarget[],
  blockers: readonly THREE.Object3D[],
  preferred?: LootRequest,
): LootTarget | null {
  const setRay = (x: number, y: number) => {
    cursor.set((x / viewport.width) * 2 - 1, -(y / viewport.height) * 2 + 1);
    raycaster.setFromCamera(cursor, camera);
  };
  const pick = prepareLoot(candidates, blockers, preferred);
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
