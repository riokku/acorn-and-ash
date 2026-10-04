import { TICK_HZ } from '../constants';
import type { ItemId } from '../data/items';
/** Meal identity is append-only on the wire; zero means no active benefit. */
export const MEAL_ITEMS = ['trailRation', 'forestStew', 'berryTea'] as const;
export type MealItem = (typeof MEAL_ITEMS)[number];
export interface MealState {
  readonly item: MealItem | null;
  readonly ticksLeft: number;
}
export const NO_MEAL: MealState = { item: null, ticksLeft: 0 };
export const MAX_MEAL_TICKS = 10 * 60 * TICK_HZ;
export function isMealItem(item: ItemId): item is MealItem {
  return MEAL_ITEMS.some((candidate) => candidate === item);
}
/** Old or malformed saves must never create an indefinite benefit. */
export function mealFromSaved(value: unknown): MealState {
  if (typeof value !== 'object' || value === null) return { ...NO_MEAL };
  const row = value as { item?: unknown; ticksLeft?: unknown };
  if (
    !MEAL_ITEMS.some((item) => item === row.item) ||
    typeof row.ticksLeft !== 'number' ||
    !Number.isInteger(row.ticksLeft) ||
    row.ticksLeft < 1 ||
    row.ticksLeft > MAX_MEAL_TICKS
  )
    return { ...NO_MEAL };
  return { item: row.item as MealItem, ticksLeft: row.ticksLeft };
}

export const MEAL_BENEFITS: Record<MealItem, string> = {
  trailRation: 'Dodge recovers 25% faster',
  forestStew: 'Restores 2 health every 10 seconds',
  berryTea: 'Hand gathering recovers 25% faster',
};
export function startMeal(item: MealItem): MealState {
  return { item, ticksLeft: MAX_MEAL_TICKS };
}
export function advanceMeal(state: MealState): { state: MealState; healing: number } {
  if (state.item === null || state.ticksLeft < 1) return { state: { ...NO_MEAL }, healing: 0 };
  const left = state.ticksLeft - 1;
  const healing = state.item === 'forestStew' && left % (10 * TICK_HZ) === 0 ? 2 : 0;
  return { state: left === 0 ? { ...NO_MEAL } : { item: state.item, ticksLeft: left }, healing };
}
export function mealCooldown(state: MealState, normal: number, item: MealItem): number {
  return state.item === item && state.ticksLeft > 0
    ? Math.max(1, Math.round(normal * 0.75))
    : normal;
}
