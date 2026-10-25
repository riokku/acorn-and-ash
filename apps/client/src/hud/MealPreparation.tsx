import {
  MEAL_BENEFITS,
  TICK_HZ,
  MAX_MEAL_TICKS,
  isMealItem,
  type ItemId,
  type MealItem,
} from '@acorn/shared';
import { ITEM_KINDS } from '../item-catalog';
import type { HudState } from './store';

/** The existing recipes connect an outing to something worth gathering. */
export const MEAL_PLANS: Record<MealItem, { purpose: string; route: string }> = {
  trailRation: {
    purpose: 'Hunting & nimble escapes',
    route: 'Hunt for meat → roast it at a lit fire → add wild berries. Combine by hand.',
  },
  forestStew: {
    purpose: 'Long fights & recovery',
    route: 'Roast meat, then gather mushrooms near damp timber. Simmer at a lit fire.',
  },
  berryTea: {
    purpose: 'Winter walks & foraging',
    route: 'Gather berries in sunny openings. Brew at a lit fire; warm gear still matters.',
  },
};

export function MealPreparation({
  state,
}: {
  state: Pick<HudState, 'meal' | 'nearCampfire'>;
}): React.JSX.Element {
  const active = state.meal.item !== null && state.meal.ticksLeft > 0 ? state.meal : null;
  const seconds = active ? Math.ceil(active.ticksLeft / TICK_HZ) : 0;
  return (
    <section
      className="meal-preparation"
      aria-label="Meal preparation"
      data-testid="meal-preparation"
    >
      <div className="meal-preparation-heading">Pack for the road</div>
      <p>
        Choose food for your next outing. Preparing packs a meal; eating starts its{' '}
        {MAX_MEAL_TICKS / TICK_HZ / 60}-minute benefit.
      </p>
      <div className="meal-preparation-active">
        {active && active.item ? (
          <>
            <strong>{ITEM_KINDS[active.item].displayName}</strong> · {Math.floor(seconds / 60)}:
            {String(seconds % 60).padStart(2, '0')} remaining
            <br />
            {MEAL_BENEFITS[active.item]}
          </>
        ) : (
          'No special meal active yet.'
        )}
      </div>
      <p className="meal-preparation-rule">
        One meal benefit at a time. Eating another replaces it; preparing one does not.
      </p>
      <span className="meal-preparation-fire">
        {state.nearCampfire === 'lit'
          ? 'Lit fire nearby · ready for hot recipes'
          : 'Hot recipes need a lit campfire or fireplace.'}{' '}
        Rations can be packed by hand after roasting the meat.
      </span>
    </section>
  );
}

export function mealPlan(item: ItemId): { purpose: string; route: string } | null {
  return isMealItem(item) ? MEAL_PLANS[item] : null;
}
