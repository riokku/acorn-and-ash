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
  combineHomeSupplies,
  inventoryFromEntries,
  inventoryEntries,
  homeBuildArea,
  checkHomeBuildArea,
  checkPieceBuildArea,
  buildGroundIsLevel,
  describeBuildAreaRefusal,
  type Terrain,
  type ProtectedBuildSite,
  isHomeKind,
  nextHome,
  knowsHome,
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
  readonly terrain?: Terrain;
  readonly protectedSites?: readonly ProtectedBuildSite[];
  readonly enforceHomeArea?: boolean;
  readonly homeSkills?: number;
  /** Which way the mouse wheel has turned it. A fence snapped onto another ignores this. */
  readonly yaw: number;
  /** The spot on the ground under the mouse, or null if it points at the sky. */
  readonly mouse: { readonly x: number; readonly z: number } | null;
  readonly player: Readonly<Vec3>;
  /** False while Shift is held, to put a fence down freely instead of joining it on. */
  readonly snap: boolean;
  readonly storedSupplies?: readonly { readonly item: ItemId; readonly count: number }[];
  readonly carrying: readonly { readonly item: ItemId; readonly count: number }[];
  readonly built: readonly BuiltPropView[];
  /** Placed by this player a moment ago, and not yet back from the server as built. */
  readonly pending: readonly BuildRequest[];
  /** Every tree, rock and stump. */
  readonly scenery: readonly Footprint[];
  readonly water: readonly WaterCircle[];
  /** Is the lake frozen over right now? There is no water to float a boat on. */
  readonly lakeFrozen?: boolean;
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
  const home = inputs.built.find((prop) => prop.yours && isHomeKind(prop.kind));
  const upgrading = isHomeKind(kind) && home !== undefined;
  const affordable = missingCosts(kind, availableSupplies(inputs)) === null;
  if (mouse === null && !upgrading)
    return { spot: null, refusal: null, snapped: false, affordable };

  const everythingBuilt: Footprint[] = [
    ...inputs.built
      .filter((prop) => !upgrading || prop.id !== home?.id)
      .map((prop) => buildableFootprint(prop.kind, prop.x, prop.z, prop.yaw)),
    ...inputs.pending.map((request) =>
      buildableFootprint(request.kind, request.x, request.z, request.yaw),
    ),
  ];

  const snap =
    kind === 'fence' && inputs.snap
      ? snapFence(clampToReach(mouse!, player), everythingBuilt, BUILD_ROTATION_STEP)
      : null;
  const spot =
    upgrading && home !== undefined
      ? { x: home.x, z: home.z, yaw: home.yaw }
      : (snap ?? { ...clampToReach(mouse!, player), yaw: inputs.yaw });

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

  if (isHomeKind(inputs.kind)) {
    const home = inputs.built.find((prop) => prop.yours && isHomeKind(prop.kind));
    if (inputs.kind !== nextHome(home !== undefined && isHomeKind(home.kind) ? home.kind : null))
      return 'Upgrade your home one tier at a time';
    if (!knowsHome(inputs.homeSkills ?? 0, inputs.kind))
      return `Learn the ${buildable.displayName.toLowerCase()} blueprint first · found on skeletons`;
  }
  const missing = missingCosts(inputs.kind, availableSupplies(inputs));
  if (missing !== null) return `Need ${missing}`;

  if (buildable.capPerPlayer && !buildable.isHome) {
    const alreadyHave =
      inputs.built.some((prop) => prop.yours && prop.kind === inputs.kind) ||
      inputs.pending.some((request) => request.kind === inputs.kind);
    if (alreadyHave) return `You already have a ${buildable.displayName.toLowerCase()}`;
  }

  const piece = buildableFootprint(inputs.kind, spot.x, spot.z, spot.yaw);
  // A boat is moored at the lake, wherever that is: no home area, and the
  // water's own rule (see `checkBuildSpot`) stands in for level ground.
  if (inputs.enforceHomeArea && inputs.kind !== 'rowboat') {
    const home = inputs.built.find((prop) => prop.yours && isHomeKind(prop.kind)) ?? null;
    const others = inputs.built.filter((prop) => isHomeKind(prop.kind) && prop.id !== home?.id);
    const area = homeBuildArea({ id: home?.id ?? 0, kind: inputs.kind, ...spot });
    const areaRefusal =
      isHomeKind(inputs.kind) && area !== null
        ? checkHomeBuildArea(area, others, inputs.protectedSites ?? [])
        : checkPieceBuildArea(piece, home, others, inputs.protectedSites ?? []);
    if (areaRefusal !== null) return describeBuildAreaRefusal(areaRefusal);
    if (inputs.terrain !== undefined && !buildGroundIsLevel(piece, inputs.terrain))
      return 'Choose more level ground for this piece';
  }

  const refusal = checkBuildSpot(
    buildableFootprint(inputs.kind, spot.x, spot.z, spot.yaw),
    inputs.player,
    BUILD_REACH,
    inputs.water,
    [...inputs.scenery, ...everythingBuilt],
    inputs.enforceHomeArea ?? false,
    inputs.lakeFrozen ?? false,
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
    case 'worldEdge':
      return 'Outside the world boundary';
    case 'pastTreeLine':
      return 'Only inside the clearing';
    case 'water':
      return 'Too close to the water';
    case 'needsWater':
      return 'Rowboats float in the lake · moor it a step or two out from the bank';
    case 'tooFarOut':
      return 'Too far out · moor it closer to the bank';
    case 'frozen':
      return 'The lake is frozen · no boats until spring';
    case 'tooClose':
      return `Too close to the ${refusal.what}`;
  }
}

function availableSupplies(inputs: PlacementInputs) {
  const upgrading =
    isHomeKind(inputs.kind) && inputs.built.some((prop) => prop.yours && isHomeKind(prop.kind));
  return upgrading
    ? inventoryEntries(
        combineHomeSupplies(inventoryFromEntries(inputs.carrying), inputs.storedSupplies ?? []),
      )
    : inputs.carrying;
}
