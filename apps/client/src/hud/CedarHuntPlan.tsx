import { MEAL_BENEFITS } from '@acorn/shared';
import { ITEM_KINDS, EQUIPMENT_BONUSES, itemRarity } from '../item-catalog';
import { cedarHuntProgress } from './cedar-hunt';
import type { HudState } from './store';
type HuntState = Pick<HudState, 'carrying' | 'worn' | 'meal' | 'cedarHuntPinned'>;
export function CedarHuntPlan({
  state,
  onPin,
}: {
  state: HuntState;
  onPin?: (pinned: boolean) => void;
}) {
  const progress = cedarHuntProgress(state),
    bonus = EQUIPMENT_BONUSES.cedarstalkerCoat ?? {};
  return (
    <section
      className="cedar-hunt-plan"
      aria-label="The Old Cedar Stag"
      data-testid="cedar-hunt-plan"
    >
      <span className="cedar-hunt-eyebrow">A hide worth the journey</span>
      <h3>The Old Cedar Stag</h3>
      <p>
        Follow the broad paired hoofprints northwest beyond the elk grove. Look for a larger,
        moss-colored stag with pale antlers.
      </p>
      <ol>
        <li>
          <strong>Pack for the hunt.</strong> Bring a weapon and food. A trail ration helps dodge
          recovery if you know its recipe; a meal is optional.
        </li>
        <li>
          <strong>Read his attention.</strong> Walk between pauses. When he lifts his head and
          watches, stop and let him settle. He can outrun a sprint.
        </li>
        <li>
          <strong>Bring the hide home.</strong> One successful catch guarantees one hide. If your
          pack is full, collect your personal hide from the ground at the catch.
        </li>
      </ol>
      <div className="cedar-hunt-reward">
        <strong>
          {ITEM_KINDS.cedarstalkerCoat.displayName} ·{' '}
          <span className="cedar-hunt-rarity">{itemRarity('cedarstalkerCoat')}</span>
        </strong>
        <span>
          +{bonus.protection ?? 0} protection · +{bonus.warmth ?? 0} warmth
        </span>
        <span>
          Quiet step · prey notices you from 15% less distance while worn. Hostile creatures are
          unaffected.
        </span>
      </div>
      {!progress.crafted && (
        <div className="cedar-hunt-ingredients" aria-label="Coat ingredients">
          {progress.ingredients.map((cost) => (
            <span key={cost.item} className={cost.have < cost.amount ? 'cedar-hunt-missing' : ''}>
              {cost.have}/{cost.amount}{' '}
              {(cost.amount === 1
                ? ITEM_KINDS[cost.item].displayName
                : ITEM_KINDS[cost.item].pluralName
              ).toLowerCase()}
            </span>
          ))}
        </div>
      )}
      <p className="cedar-hunt-next">{progress.next}</p>
      {state.meal.item === 'trailRation' && state.meal.ticksLeft > 0 ? (
        <p className="cedar-hunt-meal">Trail ration active · {MEAL_BENEFITS.trailRation}</p>
      ) : null}
      <button
        type="button"
        aria-pressed={state.cedarHuntPinned === true}
        onClick={() => onPin?.(!state.cedarHuntPinned)}
      >
        {state.cedarHuntPinned ? 'Unpin upgrade goal' : 'Pin upgrade goal'}
      </button>
      <small>
        Pin saved for this world on this browser. Craft by hand in Gear; equip the coat from Z.
      </small>
    </section>
  );
}
export function CedarHuntTracker({
  state,
  onPin,
}: {
  state: HuntState;
  onPin?: (pinned: boolean) => void;
}) {
  const progress = cedarHuntProgress(state);
  return (
    <aside className="cedar-hunt-tracker" aria-label="Pinned upgrade goal">
      <strong>{ITEM_KINDS.cedarstalkerCoat.displayName}</strong>
      <span>{progress.next}</span>
      {!progress.crafted ? (
        <span>
          {progress.ingredients
            .map(
              (cost) =>
                `${Math.min(cost.have, cost.amount)}/${cost.amount} ${ITEM_KINDS[cost.item].displayName.toLowerCase()}`,
            )
            .join(' · ')}
        </span>
      ) : null}
      <button
        type="button"
        aria-label="Unpin Cedarstalker coat goal"
        onClick={() => onPin?.(false)}
      >
        ×
      </button>
    </aside>
  );
}
