import { BUILDABLE_KINDS, type BuildableKindId } from '../data/buildables';
import { HOME_FACILITIES, homeHasFacility } from '../data/home-facilities';
import { homeRoomScale, type HomeKind } from '../data/housing';
import { HOME_ROOM, HOME_ENTRY, HOME_WAKE_SPOT, homeRoomColliders, homeSpot } from '../world/home';
import { cylinder, type Collider } from '../world/colliders';
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
  readonly action: 'place' | 'move' | 'reclaim';
  readonly kind: DecorationKind;
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
export function isIndoorOnlyKind(kind: BuildableKindId): boolean {
  return kind === 'cedarBench' || kind === 'timberTable' || kind === 'wovenRug';
}
export function decorationCollider(piece: HomeDecoration): Collider | null {
  return piece.kind === 'wovenRug'
    ? null
    : cylinder(
        piece.x,
        piece.z,
        BUILDABLE_KINDS[piece.kind].footprintRadius,
        piece.kind === 'cedarBench' ? 0.5 : 1.2,
      );
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
export function checkDecorationSpot(
  kind: HomeKind,
  piece: HomeDecoration,
  others: readonly HomeDecoration[],
  player: { x: number; z: number },
): DecorationReason | null {
  if (![piece.x, piece.z, piece.yaw].every(Number.isFinite)) return 'blocked';
  const radius = BUILDABLE_KINDS[piece.kind].footprintRadius,
    scale = homeRoomScale(kind);
  if (
    Math.abs(piece.x) + radius > HOME_ROOM.halfWidth * scale - 0.15 ||
    Math.abs(piece.z) + radius > HOME_ROOM.halfDepth * scale - 0.15
  )
    return 'blocked';
  if (Math.hypot(piece.x - player.x, piece.z - player.z) > 6) return 'tooFar';
  if (
    piece.kind !== 'wovenRug' &&
    Math.hypot(piece.x - player.x, piece.z - player.z) < radius + PLAYER_RADIUS
  )
    return 'blocked';
  if (homeRoomColliders(kind).some((c) => overlaps(piece, radius + 0.08, c))) return 'blocked';
  for (const spot of [homeSpot(HOME_ENTRY, kind), homeSpot(HOME_WAKE_SPOT, kind)])
    if (Math.hypot(piece.x - spot.x, piece.z - spot.z) < radius + 0.7) return 'blocked';
  for (const facility of ['cooking', 'workbench', 'garden'] as const) {
    if (!homeHasFacility(kind, facility)) continue;
    const spot = HOME_FACILITIES[facility];
    if (Math.hypot(piece.x - spot.x * scale, piece.z - spot.z * scale) < radius + 0.6)
      return 'blocked';
  }
  if (
    others.some(
      (other) =>
        other.id !== piece.id &&
        other.kind !== 'wovenRug' &&
        piece.kind !== 'wovenRug' &&
        Math.hypot(other.x - piece.x, other.z - piece.z) <
          radius + BUILDABLE_KINDS[other.kind].footprintRadius + 0.1,
    )
  )
    return 'blocked';
  if (
    piece.kind === 'wovenRug' &&
    others.some(
      (other) =>
        other.kind === 'wovenRug' &&
        other.id !== piece.id &&
        Math.hypot(other.x - piece.x, other.z - piece.z) < radius + 1.05,
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
