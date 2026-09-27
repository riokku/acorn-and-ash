/**
 * Where a piece being placed would go, and whether it can (see decision
 * 0052).
 *
 * Worked out fresh every frame from where the mouse points: the preview
 * follows it across the ground up to `BUILD_REACH` away, a fence snaps onto
 * the end of one already standing, and the same `checkBuildSpot` the server
 * runs says whether it fits. The answer comes back in words a player would
 * use, for the hint along the bottom.
 *
 * Plain data in and out, no Three.js, so it can be tested on its own.
 */

import {
  BUILDABLE_KINDS,
  BUILD_REACH,
  BUILD_ROTATION_STEP,
  ITEM_KINDS,
  buildableFootprint,
  checkBuildSpot,
  snapFence,
  type BuildRefusal,
  type BuildRequest,
  type BuildableKindId,
  type BuiltPropView,
  type Footprint,
  type ItemId,
  type Vec3,
  type WaterCircle,
} from '@acorn/shared';

export interface PlacementInputs {
  readonly kind: BuildableKindId;
  /** Which way the mouse wheel has turned it. A fence snapped onto another ignores this. */
  readonly yaw: number;
  /** The spot on the ground under the mouse, or null if it points at the sky. */
  readonly mouse: { readonly x: number; readonly z: number } | null;
  readonly player: Readonly<Vec3>;
  /** False while Shift is held, to put a fence down freely instead of joining it on. */
  readonly snap: boolean;
  readonly carrying: readonly { readonly item: ItemId; readonly count: number }[];
  readonly built: readonly BuiltPropView[];
  /** Placed by this player a moment ago, and not yet back from the server as built. */
  readonly pending: readonly BuildRequest[];
  /** Every tree, rock and stump. */
  readonly scenery: readonly Footprint[];
  readonly water: readonly WaterCircle[];
}

export interface PlacementPlan {
  /** Where it would go, or null if the mouse is not over the ground at all. */
  readonly spot: { readonly x: number; readonly z: number; readonly yaw: number } | null;
  /** Why it cannot go there, in a player's words, or null if a click would place it. */
  readonly refusal: string | null;
  /** Whether it has joined onto the end of a fence already standing. */
  readonly snapped: boolean;
  /** Whether the pack holds enough to pay for it. */
  readonly affordable: boolean;
}

export function planPlacement(inputs: PlacementInputs): PlacementPlan {
  const { kind, mouse, player } = inputs;
  const affordable = missingCosts(kind, inputs.carrying) === null;
  if (mouse === null) return { spot: null, refusal: null, snapped: false, affordable };

  const everythingBuilt: Footprint[] = [
    ...inputs.built.map((prop) => buildableFootprint(prop.kind, prop.x, prop.z, prop.yaw)),
    ...inputs.pending.map((request) =>
      buildableFootprint(request.kind, request.x, request.z, request.yaw),
    ),
  ];

  const snap =
    kind === 'fence' && inputs.snap
      ? snapFence(clampToReach(mouse, player), everythingBuilt, BUILD_ROTATION_STEP)
      : null;
  const spot = snap ?? { ...clampToReach(mouse, player), yaw: inputs.yaw };

  return {
    spot,
    refusal: refusalFor(inputs, spot, everythingBuilt),
    snapped: snap !== null,
    affordable,
  };
}

/** The mouse's spot, pulled in to `BUILD_REACH` if it is further than that. */
function clampToReach(
  mouse: { readonly x: number; readonly z: number },
  player: Readonly<Vec3>,
): { x: number; z: number } {
  const dx = mouse.x - player.x;
  const dz = mouse.z - player.z;
  const distance = Math.hypot(dx, dz);
  if (distance <= BUILD_REACH) return { x: mouse.x, z: mouse.z };
  const scale = BUILD_REACH / distance;
  return { x: player.x + dx * scale, z: player.z + dz * scale };
}

function refusalFor(
  inputs: PlacementInputs,
  spot: { readonly x: number; readonly z: number; readonly yaw: number },
  everythingBuilt: readonly Footprint[],
): string | null {
  const buildable = BUILDABLE_KINDS[inputs.kind];

  const missing = missingCosts(inputs.kind, inputs.carrying);
  if (missing !== null) return `Need ${missing}`;

  if (buildable.capPerPlayer) {
    const alreadyHave =
      inputs.built.some((prop) => prop.yours && prop.kind === inputs.kind) ||
      inputs.pending.some((request) => request.kind === inputs.kind);
    if (alreadyHave) return `You already have a ${buildable.displayName.toLowerCase()}`;
  }

  const refusal = checkBuildSpot(
    buildableFootprint(inputs.kind, spot.x, spot.z, spot.yaw),
    inputs.player,
    BUILD_REACH,
    inputs.water,
    [...inputs.scenery, ...everythingBuilt],
  );
  return refusal === null ? null : describeRefusal(refusal);
}

/** "2 more logs", "1 more stick and 3 more flowers", or null if there is enough of everything. */
export function missingCosts(
  kind: BuildableKindId,
  carrying: readonly { readonly item: ItemId; readonly count: number }[],
): string | null {
  const short = BUILDABLE_KINDS[kind].costs.flatMap((cost) => {
    const have = carrying.find((entry) => entry.item === cost.item)?.count ?? 0;
    const need = cost.amount - have;
    if (need <= 0) return [];
    const item = ITEM_KINDS[cost.item];
    const name = need === 1 ? item.displayName : item.pluralName;
    return [`${need} more ${name.toLowerCase()}`];
  });
  return short.length === 0 ? null : short.join(' and ');
}

export function describeRefusal(refusal: BuildRefusal): string {
  switch (refusal.reason) {
    case 'tooFar':
      return 'Too far away';
    case 'onPlayer':
      return "You're in the way - step back";
    case 'pastTreeLine':
      return 'Only inside the clearing';
    case 'water':
      return 'Too close to the water';
    case 'tooClose':
      return `Too close to the ${refusal.what}`;
  }
}
