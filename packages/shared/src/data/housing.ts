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
/** Shared dimensions: positions, collision and rendering use the same scale. */
export function homeRoomScale(kind: BuildableKindId = 'cabin'): number {
  return kind === 'tent' ? 0.8 : kind === 'teepee' ? 0.9 : kind === 'largeCabin' ? 1.2 : 1;
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
] as const;
export type HomeBuildReason = (typeof HOME_BUILD_REASONS)[number];
export interface HomeBuildFeedback {
  readonly kind: HomeKind;
  readonly homeId: number;
  readonly reason: HomeBuildReason | null;
}
