import {
  isFood,
  isMealItem,
  isWeapon,
  toolKind,
  inventoryFromEntries,
  packSlots,
  slotsUsed,
  WINTER_WARMTH_REQUIRED,
  BLIZZARD_WARMTH_REQUIRED,
  type ExpeditionDefinition,
  type MealItem,
  type ItemId,
} from '@acorn/shared';
import { characterStats, ITEM_KINDS } from '../item-catalog';
import type { HudState } from './store';
export type PreparationState = Pick<
  HudState,
  'carrying' | 'worn' | 'health' | 'hunger' | 'season' | 'forestWeather' | 'meal'
>;
export interface PreparationCheck {
  id: string;
  label: string;
  detail: string;
  ready: boolean;
}
/** Advice uses the current authoritative inventory and equipment, never a stored readiness flag. */
export function expeditionPreparation(state: PreparationState, mission: ExpeditionDefinition) {
  const pack = inventoryFromEntries(state.carrying),
    stats = characterStats(state.worn);
  const hasTool = (tool: 'axe' | 'rod') =>
    state.carrying.some((row) => row.count > 0 && toolKind(row.item) === tool) ||
    (state.worn.mainHand !== undefined && toolKind(state.worn.mainHand) === tool);
  const combat = mission.objectives.some(
    (goal) => goal.kind === 'defeat' || goal.kind === 'bonehollow' || goal.kind === 'sunreach',
  );
  const winter = state.season?.season === 'winter';
  const meal: MealItem = winter
    ? 'berryTea'
    : combat
      ? 'forestStew'
      : mission.objectives.some((goal) => goal.kind === 'fish' || goal.kind === 'chop')
        ? 'trailRation'
        : 'berryTea';
  const checks: PreparationCheck[] = [];
  for (const tool of ['axe', 'rod'] as const) {
    if (mission.objectives.some((goal) => goal.kind === (tool === 'axe' ? 'chop' : 'fish')))
      checks.push({
        id: tool,
        label: tool === 'axe' ? 'Bring an axe' : 'Bring a fishing rod',
        detail: hasTool(tool)
          ? 'Packed or equipped · refined tools count too.'
          : tool === 'axe'
            ? 'Craft an axe in C → Tools before a timber outing.'
            : 'Craft a rod in C → Tools before heading to the water.',
        ready: hasTool(tool),
      });
  }
  if (combat) {
    const usefulWeapon = (item: ItemId) =>
      isWeapon(item) && toolKind(item) !== 'rod' && item !== 'shovel' && item !== 'torch';
    const armed =
      (state.worn.mainHand !== undefined && usefulWeapon(state.worn.mainHand)) ||
      state.carrying.some((row) => row.count > 0 && usefulWeapon(row.item));
    checks.push({
      id: 'weapon',
      label: 'Bring a weapon',
      detail: armed
        ? 'A weapon is packed or equipped. Choose the one you want before setting out.'
        : 'An axe, knife or sword helps against hostile creatures.',
      ready: armed,
    });
    checks.push({
      id: 'protection',
      label: 'Put on protective gear',
      detail: `${stats.protection}% protection from worn equipment. Clothing left in the backpack does not protect you.`,
      ready: stats.protection > 0,
    });
  }
  const servings = state.carrying.reduce((sum, row) => sum + (isFood(row.item) ? row.count : 0), 0);
  checks.push({
    id: 'food',
    label: 'Pack food for the road',
    detail: `${servings} servings packed · two is a useful starting point.`,
    ready: servings >= 2,
  });
  const free = Math.max(0, packSlots(pack) - slotsUsed(pack));
  checks.push({
    id: 'space',
    label: 'Leave room for discoveries',
    detail: `${free} empty slots · try to leave at least two. Top-ups may fit in existing stacks. Store spare supplies at home.`,
    ready: free >= 2,
  });
  checks.push({
    id: 'recovery',
    label: 'Start rested and fed',
    detail: `${Math.round(state.health)}/${stats.vitality} health · ${Math.round(state.hunger)}% food. Rest at home or eat before a long outing.`,
    ready: state.health >= stats.vitality * 0.8 && state.hunger >= 60,
  });
  if (winter) {
    const required =
      state.forestWeather?.kind === 'blizzard' ? BLIZZARD_WARMTH_REQUIRED : WINTER_WARMTH_REQUIRED;
    checks.push({
      id: 'warmth',
      label: 'Dress for the cold',
      detail: `${stats.warmth}/${required} warmth from worn gear for ${required === BLIZZARD_WARMTH_REQUIRED ? 'the blizzard' : 'ordinary winter'}. Warm up at a lit fire before leaving; food warmth is temporary.`,
      ready: stats.warmth >= required,
    });
  }
  const specialMeal =
    (state.meal.item !== null && state.meal.ticksLeft > 0) ||
    state.carrying.some((row) => row.count > 0 && isMealItem(row.item));
  return {
    checks,
    meal,
    specialMeal,
    ready: checks.filter((check) => check.ready).length,
    total: checks.length,
    mealName: ITEM_KINDS[meal].displayName,
  };
}
