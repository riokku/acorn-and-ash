/**
 * Chopping trees down.
 *
 * The rule for what a swing reaches lives here so the client can show you which
 * tree you are about to hit, but only the server decides what a swing does: it
 * owns every tree's remaining swings and every pack the logs go into.
 */

import { CHOP_FACING_COSINE, CHOP_REACH } from '../constants';
import { PROP_KINDS, choppingRuleFor, propHeight, type ChoppingRule } from '../data/props';
import type { Vec3 } from '../math/vec3';
import type { PlacedProp } from '../world/clearing';
import { whirlwindTargets } from './hunting';

/** A tree a swing would land on. */
export interface ChopTarget {
  readonly prop: PlacedProp;
  readonly rule: ChoppingRule;
}

/**
 * The tree this player would hit if they swung right now, or null.
 *
 * Reach is measured to the trunk's surface, and the tree has to be roughly in
 * front of where the camera is looking: swinging at thin air between two trunks
 * should miss, and a tree behind you is not a target.
 *
 * `isFelled` is asked rather than handed in because the server keeps that set
 * and the client is told it; neither needs a copy of the other's.
 */
export function treeInReach(
  position: Readonly<Vec3>,
  aimYaw: number,
  props: readonly PlacedProp[],
  isFelled: (propId: number) => boolean,
): ChopTarget | null {
  // Yaw 0 looks down -Z, matching the way movement reads it.
  const forwardX = -Math.sin(aimYaw);
  const forwardZ = -Math.cos(aimYaw);

  let best: ChopTarget | null = null;
  let bestGap = CHOP_REACH;

  for (const prop of props) {
    if (isFelled(prop.id)) continue;
    const kind = PROP_KINDS[prop.kind];
    const rule = choppingRuleFor(kind);
    if (rule === null) continue;

    const dx = prop.x - position.x;
    const dz = prop.z - position.z;
    // Most trees in a forest are nowhere near: skip them before any square root.
    const farthest = CHOP_REACH + kind.colliderRadius * prop.scale;
    if (Math.abs(dx) > farthest || Math.abs(dz) > farthest) continue;
    const distance = Math.hypot(dx, dz);
    // Standing inside the trunk should not count as reaching it from outside.
    if (distance < 1e-6) continue;

    const gap = distance - kind.colliderRadius * prop.scale;
    if (gap > bestGap) continue;

    const facing = (dx / distance) * forwardX + (dz / distance) * forwardZ;
    if (facing < CHOP_FACING_COSINE) continue;

    best = { prop, rule };
    bestGap = gap;
  }

  return best;
}

/** Every standing trunk crossed by the axe this tick, rather than just the tree ahead. */
export function treesInWhirlwind(
  position: Readonly<Vec3>,
  yaw: number,
  age: number,
  props: readonly PlacedProp[],
  isFelled: (propId: number) => boolean,
  alreadyHit: ReadonlySet<number>,
  previousYaw = yaw,
): ChopTarget[] {
  const candidates = props.flatMap((prop) => {
    if (isFelled(prop.id) || alreadyHit.has(prop.id)) return [];
    const kind = PROP_KINDS[prop.kind];
    const rule = choppingRuleFor(kind);
    if (rule === null) return [];
    const radius = kind.colliderRadius * prop.scale;
    if (
      Math.abs(prop.x - position.x) > CHOP_REACH + radius ||
      Math.abs(prop.z - position.z) > CHOP_REACH + radius
    )
      return [];
    const base = prop.y ?? 0;
    if (position.y + 1.4 < base || position.y > base + propHeight(kind) * prop.scale) return [];
    return [
      { id: prop.id, x: prop.x, y: Math.max(base, position.y), z: prop.z, radius, prop, rule },
    ];
  });
  return whirlwindTargets(position, candidates, { age, yaw, previousYaw }, alreadyHit);
}
