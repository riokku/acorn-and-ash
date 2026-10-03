import { PROP_KINDS, choppingRuleFor } from '../data/props';
import type { PlacedProp } from '../world/clearing';

/** A short accelerating fall, then a beat on the ground before it breaks into logs. */
export const TREE_FALL_SECONDS = 1.4;
export const TREE_BREAK_SECONDS = 1.8;

export interface TreeFall {
  /** Direction the crown falls, with +Z as zero, measured away from the final blow. */
  readonly yaw: number;
  readonly startedAtMs: number;
}

/** The final cutter decides the direction, including when two players share a tree. */
export function treeFallYaw(
  tree: { x: number; z: number },
  cutter: { x: number; z: number },
): number {
  return Math.atan2(tree.x - cutter.x, tree.z - cutter.z);
}

/** Tipping accelerates from upright and settles flat on the ground. */
export function treeFallAngle(ageSeconds: number): number {
  if (ageSeconds >= TREE_FALL_SECONDS) {
    const t = Math.min(
      1,
      (ageSeconds - TREE_FALL_SECONDS) / (TREE_BREAK_SECONDS - TREE_FALL_SECONDS),
    );
    // A small rebound loses energy quickly and settles before the trunk breaks.
    return Math.PI / 2 - Math.sin(t * Math.PI * 2) ** 2 * 0.055 * (1 - t);
  }
  const t = Math.max(0, ageSeconds / TREE_FALL_SECONDS);
  return (Math.PI / 2) * t * t;
}

/** Individual pieces along the fallen trunk, with a little sideways scatter. */
export function treeLogSpots(tree: PlacedProp, yaw: number): Array<{ x: number; z: number }> {
  const kind = PROP_KINDS[tree.kind];
  const rule = choppingRuleFor(kind);
  if (rule === null || kind.shape.family !== 'tree') return [];
  const length = (kind.shape.trunkHeight + kind.shape.canopyHeight * 0.4) * tree.scale;
  return Array.from({ length: rule.logs }, (_, index) => {
    const along = 0.8 + ((index + 0.5) / rule.logs) * length;
    const across = index % 2 === 0 ? 0.18 : -0.18;
    return {
      x: tree.x + Math.sin(yaw) * along + Math.cos(yaw) * across,
      z: tree.z + Math.cos(yaw) * along - Math.sin(yaw) * across,
    };
  });
}
