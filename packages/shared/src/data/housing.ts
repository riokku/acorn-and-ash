import type { BuildableKindId } from './buildables';
import type { ItemId } from './items';

export type HomeKind = 'tent' | 'teepee' | 'cabin' | 'largeCabin';
export const HOME_TIERS: readonly HomeKind[] = ['tent', 'teepee', 'cabin', 'largeCabin'];
export const HOME_BLUEPRINTS = {
  teepeeBlueprint: 'teepee',
  cabinBlueprint: 'cabin',
  largeCabinBlueprint: 'largeCabin',
} as const;
export type BlueprintItem = keyof typeof HOME_BLUEPRINTS;
/** Three permanent unlocks. Tent building is known from the start. */
export const HOME_SKILL_MASK = 7;
export const BLUEPRINT_DROP_CHANCE = 0.3;
export const BLUEPRINT_CHANCE_INCREMENT = 0.15;
export const BLUEPRINT_MAX_MISSES = 5;
/** A sixth eligible kill cannot miss. The streak resets only when a drop is made. */
export function blueprintDropChance(misses: number): number {
  const streak = Number.isFinite(misses) ? Math.max(0, Math.floor(misses)) : 0;
  return streak >= BLUEPRINT_MAX_MISSES
    ? 1
    : BLUEPRINT_DROP_CHANCE + streak * BLUEPRINT_CHANCE_INCREMENT;
}
export function isHomeKind(kind: BuildableKindId): kind is HomeKind {
  return HOME_TIERS.includes(kind as HomeKind);
}
export function blueprintHome(item: ItemId): HomeKind | null {
  return Object.hasOwn(HOME_BLUEPRINTS, item) ? HOME_BLUEPRINTS[item as BlueprintItem] : null;
}
export function blueprintForHome(kind: HomeKind): BlueprintItem | null {
  return (
    (Object.keys(HOME_BLUEPRINTS) as BlueprintItem[]).find(
      (item) => HOME_BLUEPRINTS[item] === kind,
    ) ?? null
  );
}
export function knowsHome(skills: number, kind: HomeKind): boolean {
  return kind === 'tent' || (skills & (1 << (HOME_TIERS.indexOf(kind) - 1))) !== 0;
}
export function learnHome(skills: number, kind: HomeKind): number {
  return kind === 'tent'
    ? skills
    : (skills | (1 << (HOME_TIERS.indexOf(kind) - 1))) & HOME_SKILL_MASK;
}
export function nextHome(kind: HomeKind | null): HomeKind | null {
  return kind === null ? 'tent' : (HOME_TIERS[HOME_TIERS.indexOf(kind) + 1] ?? null);
}
export function nextBlueprint(skills: number): BlueprintItem | null {
  const home = HOME_TIERS.find((kind) => !knowsHome(skills, kind));
  return home === undefined ? null : blueprintForHome(home);
}
/** An open fire ring on the floor, or a stone fireplace built into the +X wall. */
export type HomeFire = 'campfire' | 'fireplace';
export interface HomeInteriorSize {
  /** Half the room's width (X) and depth (Z), inside the walls. */
  readonly halfWidth: number;
  readonly halfDepth: number;
  /** The middle of the doorway, along the +Z wall. */
  readonly doorX: number;
  readonly fire: HomeFire;
  /** How big the fire ring is drawn and bumped into, for a campfire. */
  readonly fireScale: number;
}
/**
 * Each home's room inside (see decision 0285). Every room starts empty
 * except for its fire; the bed, desk, chest and garden are built.
 */
export const HOME_INTERIORS: Record<HomeKind, HomeInteriorSize> = {
  tent: { halfWidth: 2, halfDepth: 2, doorX: -0.6, fire: 'campfire', fireScale: 0.75 },
  teepee: { halfWidth: 2.75, halfDepth: 2.75, doorX: -0.85, fire: 'campfire', fireScale: 1 },
  cabin: { halfWidth: 3.5, halfDepth: 3, doorX: -1.1, fire: 'fireplace', fireScale: 1 },
  largeCabin: { halfWidth: 5, halfDepth: 4, doorX: -1.1, fire: 'fireplace', fireScale: 1 },
};
/** The room inside this home, as a cabin's when it isn't one of the home kinds. */
export function homeInteriorSize(kind: BuildableKindId = 'cabin'): HomeInteriorSize {
  return HOME_INTERIORS[isHomeKind(kind) ? kind : 'cabin'];
}
export function homeOuterScale(kind: BuildableKindId = 'cabin'): number {
  return kind === 'tent' ? 0.6 : kind === 'teepee' ? 0.8 : kind === 'largeCabin' ? 1.2 : 1;
}

export const HOME_BUILD_REASONS = [
  'materials',
  'identity',
  'blueprint',
  'tier',
  'moved',
  'occupied',
  'blocked',
  'player',
  'busy',
  'area',
  'ground',
  'furnishings',
] as const;
export type HomeBuildReason = (typeof HOME_BUILD_REASONS)[number];
export interface HomeBuildFeedback {
  readonly kind: HomeKind;
  readonly homeId: number;
  readonly reason: HomeBuildReason | null;
}
