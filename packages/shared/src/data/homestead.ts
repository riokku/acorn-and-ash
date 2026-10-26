import type { BuildableKindId } from './buildables';

/** Permanent placed projects, never a second quest currency or a repeatable reward. */
export const HOMESTEAD_PROJECTS = [
  {
    kind: 'trailWorkbench',
    chapter: 'A place to make',
    benefit: 'Refine tools outside, even beside your first tent.',
    route:
      'Bring timber and sticks from the forest. Build near your door; open C while beside the bench to refine tools.',
  },
  {
    kind: 'trailPantry',
    chapter: 'A place to keep',
    benefit: 'Ten extra private storage slots beside your home.',
    route:
      'Gather reeds by the water and twist them into rope. Left-click the chest to store supplies; only you can open it.',
  },
  {
    kind: 'kitchenGarden',
    chapter: 'A place to grow',
    benefit: 'Three growing boxes, without waiting for a larger cabin.',
    route:
      'Gather flowers and timber. Plant one berry, mushroom or flower; harvest three after ten minutes of awake world time.',
  },
] as const;
export type HomesteadProject = (typeof HOMESTEAD_PROJECTS)[number]['kind'];
export function isHomesteadProject(kind: BuildableKindId): kind is HomesteadProject {
  return HOMESTEAD_PROJECTS.some((project) => project.kind === kind);
}
/** Selection is spatial and deterministic; authority still checks owner, reach and action. */
export function nearestHomesteadPiece<
  T extends {
    readonly kind: BuildableKindId;
    readonly x: number;
    readonly z: number;
    readonly id: number;
  },
>(
  pieces: readonly T[],
  kind: HomesteadProject,
  at: { readonly x: number; readonly z: number },
  reach = 2,
): T | null {
  let best: T | null = null,
    distance = reach;
  for (const piece of pieces) {
    if (piece.kind !== kind) continue;
    const d = Math.hypot(piece.x - at.x, piece.z - at.z);
    if (d < distance || (d === distance && (best === null || piece.id < best.id))) {
      best = piece;
      distance = d;
    }
  }
  return best;
}
