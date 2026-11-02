import { MEAL_BENEFITS, type ExpeditionDefinition } from '@acorn/shared';
import { expeditionPreparation, type PreparationState } from './expedition-preparation';
import { MEAL_PLANS } from './MealPreparation';
import { ItemIcon } from './item-icons';

export function ExpeditionPreparation({
  state,
  mission,
  onFood,
  onGear,
  onPack,
}: {
  state: PreparationState;
  mission: ExpeditionDefinition;
  onFood?: () => void;
  onGear?: () => void;
  onPack?: () => void;
}) {
  const plan = expeditionPreparation(state, mission);
  return (
    <section
      className="expedition-preparation"
      aria-label="Prepare for your outing"
      data-testid="expedition-preparation"
    >
      <header>
        <span className="expedition-eyebrow">The adventure starts at home</span>
        <h3>Before you take the trail</h3>
        <p>
          A little preparation for <strong>{mission.name}</strong>. These suggestions never prevent
          you from leaving.
        </p>
        <strong>
          {plan.ready}/{plan.total} preparations ready
        </strong>
        <progress aria-label="Outing preparation" value={plan.ready} max={plan.total} />
      </header>
      <ul>
        {plan.checks.map((check) => (
          <li key={check.id} data-ready={check.ready} data-preparation={check.id}>
            <span className="preparation-mark" aria-label={check.ready ? 'Ready' : 'Suggested'}>
              {check.ready ? '✓' : '○'}
            </span>
            <div>
              <strong>{check.label}</strong>
              <p>{check.detail}</p>
            </div>
          </li>
        ))}
      </ul>
      <aside className="preparation-meal">
        <small>
          Optional trail comfort ·{' '}
          {plan.specialMeal
            ? 'a special meal is packed or active'
            : 'no special meal packed or active'}
        </small>
        <h4>
          <ItemIcon item={plan.meal} color="currentColor" />
          <span>Suggested: {plan.mealName}</span>
        </h4>
        <p>{MEAL_BENEFITS[plan.meal]}</p>
        <p>{MEAL_PLANS[plan.meal].route}</p>
        <p>
          Prepare at home and eat when you choose. Eating another special meal replaces the current
          benefit.
        </p>
      </aside>
      <nav aria-label="Preparation shortcuts">
        {onFood && (
          <button type="button" onClick={onFood}>
            Prepare food
          </button>
        )}
        {onGear && (
          <button type="button" onClick={onGear}>
            Review equipment
          </button>
        )}
        {onPack && (
          <button type="button" onClick={onPack}>
            Check backpack
          </button>
        )}
      </nav>
      <footer>
        Your chosen outing stays saved while you prepare. Return to C → Expeditions to check
        progress and claim rewards at your home board. Head out whenever you feel ready.
      </footer>
    </section>
  );
}
