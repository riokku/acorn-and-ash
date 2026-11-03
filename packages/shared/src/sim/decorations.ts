import { BUILDABLE_KINDS, type BuildableKindId } from '../data/buildables';
import { homeInteriorSize, type HomeKind } from '../data/housing';
import {
  furnitureColliders,
  furnitureRestingPlace,
  homeEntry,
  homeFire,
  homeFloorWakeSpot,
  isHomeFurniture,
} from '../world/home';
import { cylinder, type BoxCollider, type Collider } from '../world/colliders';
import { PLAYER_RADIUS } from '../constants';
export const DECORATION_KINDS = [
  'cedarBench',
  'timberTable',
  'wovenRug',
  'lantern',
  'guardianTrophy',
  'fernLantern',
  'moonLantern',
  'flowerPlanter',
  'trailPennant',
  'sentinelTrophy',
  'fishDisplay',
  'goldenFishDisplay',
  'lastBellTrophy',
  'sunreachPennant',
  'firstBellRelic',
  'bed',
  'desk',
  'storageChest',
  'indoorGarden',
] as const;
export type DecorationKind = (typeof DECORATION_KINDS)[number];
export const DECORATION_REASONS = [
  'unavailable',
  'private',
  'materials',
  'blocked',
  'tooFar',
  'busy',
  'limit',
  'missing',
  'packFull',
  'recipe',
  'occupied',
  'contents',
  'unsupported',
  'onlyOne',
] as const;
export type DecorationReason = (typeof DECORATION_REASONS)[number];
export const MAX_HOME_DECORATIONS = 16;
export const MAX_WORLD_DECORATIONS = 2048;
export interface HomeDecoration {
  readonly id: number;
  readonly homeId: number;
  readonly kind: DecorationKind;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
}
export interface DecorationRequest {
  readonly action: 'place' | 'move' | 'reclaim' | 'moveOutdoor' | 'reclaimOutdoor';
  readonly kind: BuildableKindId;
  readonly id: number;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
}
export interface DecorationState {
  readonly pieces: readonly HomeDecoration[];
  readonly reason: DecorationReason | null;
}
export function isDecorationKind(kind: BuildableKindId): kind is DecorationKind {
  return (DECORATION_KINDS as readonly string[]).includes(kind);
}
/** The rug and the furniture that used to come with every room are only ever built inside. */
export function isIndoorOnlyKind(kind: BuildableKindId): boolean {
  return kind === 'wovenRug' || isHomeFurniture(kind);
}
/** What you bump into on a placed piece: nothing at all for a rug. */
export function decorationColliders(piece: HomeDecoration): Collider[] {
  if (piece.kind === 'wovenRug') return [];
  if (isHomeFurniture(piece.kind)) return furnitureColliders({ ...piece, kind: piece.kind });
  return [
    cylinder(
      piece.x,
      piece.z,
      BUILDABLE_KINDS[piece.kind].footprintRadius,
      piece.kind === 'cedarBench' ? 0.5 : 1.2,
    ),
  ];
}
/** The floor a piece takes up: its furniture's boxes, or the circle of its footprint. */
function decorationOutline(piece: HomeDecoration): Collider[] {
  return isHomeFurniture(piece.kind)
    ? furnitureColliders({ ...piece, kind: piece.kind })
    : [cylinder(piece.x, piece.z, BUILDABLE_KINDS[piece.kind].footprintRadius, 1.2)];
}
function overlaps(point: { x: number; z: number }, radius: number, collider: Collider): boolean {
  const dx = point.x - collider.x,
    dz = point.z - collider.z;
  if (collider.shape === 'cylinder') return Math.hypot(dx, dz) < radius + collider.radius;
  const c = Math.cos(collider.rotationY),
    s = Math.sin(collider.rotationY);
  const x = dx * c - dz * s,
    z = dx * s + dz * c;
  return (
    Math.hypot(
      Math.max(0, Math.abs(x) - collider.halfX),
      Math.max(0, Math.abs(z) - collider.halfZ),
    ) < radius
  );
}
/** A box's own two flat axes, out in the room, the way `overlaps` turns into them. */
function boxAxes(box: BoxCollider): [[number, number], [number, number]] {
  const c = Math.cos(box.rotationY),
    s = Math.sin(box.rotationY);
  return [
    [c, -s],
    [s, c],
  ];
}
/** How far a box reaches either side of its middle, along this flat direction. */
function boxReach(box: BoxCollider, along: readonly [number, number]): number {
  const [u, v] = boxAxes(box);
  return (
    box.halfX * Math.abs(u[0] * along[0] + u[1] * along[1]) +
    box.halfZ * Math.abs(v[0] * along[0] + v[1] * along[1])
  );
}
/** Whether two outlines come closer than `gap` on the floor. Boxes test each other's sides. */
function outlinesOverlap(a: Collider, b: Collider, gap: number): boolean {
  if (a.shape === 'cylinder') return overlaps(a, a.radius + gap, b);
  if (b.shape === 'cylinder') return overlaps(b, b.radius + gap, a);
  const between = [b.x - a.x, b.z - a.z] as const;
  return [...boxAxes(a), ...boxAxes(b)].every(
    (axis) =>
      Math.abs(between[0] * axis[0] + between[1] * axis[1]) <
      boxReach(a, axis) + boxReach(b, axis) + gap,
  );
}
/** How far an outline reaches from its middle along X and along Z. */
function outlineExtent(outline: Collider): { x: number; z: number } {
  if (outline.shape === 'cylinder') return { x: outline.radius, z: outline.radius };
  return { x: boxReach(outline, [1, 0]), z: boxReach(outline, [0, 1]) };
}
/** How far from the wall a piece keeps: furniture stands flush, anything round a little off it. */
function wallMargin(kind: BuildableKindId): number {
  return isHomeFurniture(kind) ? 0.03 : 0.15;
}
/**
 * The same piece moved in from the walls, only as far as it has to be to fit
 * inside a room of this kind - for a saved piece in a room that has since
 * shrunk (decision 0285).
 */
export function insideTheWalls(kind: HomeKind, piece: HomeDecoration): HomeDecoration {
  const room = homeInteriorSize(kind),
    margin = wallMargin(piece.kind);
  let reachX = 0,
    reachZ = 0;
  for (const part of decorationOutline(piece)) {
    const extent = outlineExtent(part);
    reachX = Math.max(reachX, part.x - piece.x + extent.x, piece.x - part.x + extent.x);
    reachZ = Math.max(reachZ, part.z - piece.z + extent.z, piece.z - part.z + extent.z);
  }
  const clamp = (value: number, half: number) =>
    Math.max(-Math.max(0, half), Math.min(Math.max(0, half), value));
  return {
    ...piece,
    x: clamp(piece.x, room.halfWidth - margin - reachX),
    z: clamp(piece.z, room.halfDepth - margin - reachZ),
  };
}
/**
 * Whether a piece can go here in a home of this kind, among the others
 * already there, with its owner standing at `player`: inside the walls, clear
 * of the fire, the doorway, the spot you wake on the floor, every other piece,
 * and wherever anyone gets into a bed or onto a chair.
 */
export function checkDecorationSpot(
  kind: HomeKind,
  piece: HomeDecoration,
  others: readonly HomeDecoration[],
  player: { x: number; z: number },
): DecorationReason | null {
  if (![piece.x, piece.z, piece.yaw].every(Number.isFinite)) return 'blocked';
  const room = homeInteriorSize(kind),
    fire = homeFire(kind),
    outline = decorationOutline(piece),
    rest = furnitureRestingPlace(piece);
  if (piece.kind === 'indoorGarden' && kind !== 'largeCabin') return 'unsupported';
  const company = others.filter((other) => other.id !== piece.id);
  if (isHomeFurniture(piece.kind) && company.some((other) => other.kind === piece.kind))
    return 'onlyOne';
  const margin = wallMargin(piece.kind);
  for (const part of outline) {
    const extent = outlineExtent(part);
    if (
      Math.abs(part.x) + extent.x > room.halfWidth - margin ||
      Math.abs(part.z) + extent.z > room.halfDepth - margin
    )
      return 'blocked';
  }
  if (Math.hypot(piece.x - player.x, piece.z - player.z) > 6) return 'tooFar';
  if (piece.kind !== 'wovenRug' && outline.some((part) => overlaps(player, PLAYER_RADIUS, part)))
    return 'blocked';
  if (
    outline.some(
      (part) => outlinesOverlap(part, fire.collider, 0.08) || overlaps(fire.cooking, 0.6, part),
    )
  )
    return 'blocked';
  // A flat rug may lie where you wake on the floor; nothing may block the door.
  const keepClear =
    piece.kind === 'wovenRug' ? [homeEntry(kind)] : [homeEntry(kind), homeFloorWakeSpot(kind)];
  for (const spot of keepClear)
    if (outline.some((part) => overlaps(spot, 0.7, part))) return 'blocked';
  // Room to get into this bed or onto this chair.
  if (rest !== null) {
    const stand = rest.stand;
    if (
      Math.abs(stand.x) + PLAYER_RADIUS > room.halfWidth ||
      Math.abs(stand.z) + PLAYER_RADIUS > room.halfDepth ||
      overlaps(stand, PLAYER_RADIUS, fire.collider) ||
      company.some(
        (other) =>
          other.kind !== 'wovenRug' &&
          decorationOutline(other).some((part) => overlaps(stand, PLAYER_RADIUS, part)),
      )
    )
      return 'blocked';
  }
  for (const other of company) {
    const stand = furnitureRestingPlace(other)?.stand;
    if (
      stand !== undefined &&
      piece.kind !== 'wovenRug' &&
      outline.some((part) => overlaps(stand, PLAYER_RADIUS + 0.05, part))
    )
      return 'blocked';
  }
  if (
    piece.kind !== 'wovenRug' &&
    company.some(
      (other) =>
        other.kind !== 'wovenRug' &&
        decorationOutline(other).some((theirs) =>
          outline.some((ours) => outlinesOverlap(ours, theirs, 0.1)),
        ),
    )
  )
    return 'blocked';
  if (
    piece.kind === 'wovenRug' &&
    company.some(
      (other) =>
        other.kind === 'wovenRug' &&
        Math.hypot(other.x - piece.x, other.z - piece.z) <
          BUILDABLE_KINDS.wovenRug.footprintRadius + 1.05,
    )
  )
    return 'blocked';
  return null;
}

export const LANTERN_PALETTES = {
  amber: { glass: 0xffe3a8, emissive: 0xffa93f, light: 0xffce7a },
  fern: { glass: 0xc3e2ab, emissive: 0x86bd75, light: 0xb1d99e },
  moonlight: { glass: 0xcfdef0, emissive: 0x8eb5d9, light: 0xb8d3ed },
} as const;

/** First furnishing that would obstruct the upgraded room's built-in layout. */
export function homeUpgradeObstruction(
  kind: HomeKind,
  homeId: number,
  decorations: readonly HomeDecoration[],
): HomeDecoration | null {
  const furnishings = decorations.filter((piece) => piece.homeId === homeId);
  return (
    furnishings.find(
      (piece) =>
        checkDecorationSpot(kind, piece, furnishings, {
          x: piece.x + BUILDABLE_KINDS[piece.kind].footprintRadius + PLAYER_RADIUS + 0.2,
          z: piece.z,
        }) !== null,
    ) ?? null
  );
}

/** Stable request kind IDs: existing indoor IDs stay intact. Append new kinds only. */
export const DECORATION_REQUEST_KINDS: readonly BuildableKindId[] = [
  'cedarBench',
  'timberTable',
  'wovenRug',
  'lantern',
  'guardianTrophy',
  'fernLantern',
  'moonLantern',
  'flowerPlanter',
  'trailPennant',
  'sentinelTrophy',
  'fishDisplay',
  'goldenFishDisplay',
  'lastBellTrophy',
  'campfire',
  'cabin',
  'flowerBed',
  'fence',
  'gardenPath',
  'tent',
  'teepee',
  'largeCabin',
  'rowboat',
  'sunreachPennant',
  'firstBellRelic',
  'trailWorkbench',
  'trailPantry',
  'kitchenGarden',
  'woodshed',
  'bed',
  'desk',
  'storageChest',
  'indoorGarden',
];
export const DECORATION_ACTIONS = [
  'place',
  'move',
  'reclaim',
  'moveOutdoor',
  'reclaimOutdoor',
] as const;
export function placedObjectRefund(kind: BuildableKindId) {
  return BUILDABLE_KINDS[kind].costs
    .map((cost) => ({
      item: cost.item,
      amount: isDecorationKind(kind) ? cost.amount : Math.floor(cost.amount / 2),
    }))
    .filter((cost) => cost.amount > 0);
}
