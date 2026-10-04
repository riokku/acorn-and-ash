import {
  EXPEDITIONS,
  expeditionComplete,
  emptyExpedition,
  ITEM_KINDS,
  TRAIL_PENNANT_SKILL,
  type ExpeditionRequest,
  type ExpeditionNotice,
} from '@acorn/shared';
import type { HudState } from './store';
import { JournalTabs } from './DiscoveryJournal';
const NOTES: Record<ExpeditionNotice, string> = {
  none: '',
  away: 'Choose and claim outings at your own home board.',
  busy: 'Finish your current action before using the board.',
  active: 'Finish your chosen outing before choosing another.',
  choice: 'That outing is no longer available.',
  unfinished: 'There is still work to do on this outing.',
  full: 'Make room in your backpack, then claim again. Your reward is safe.',
  accepted: 'Your outing is saved. Enjoy the trail.',
  claimed: 'Rewards collected. Three fresh outings await.',
};
export function ExpeditionPanel({
  state,
  onChange,
  onRequest,
}: {
  state: HudState;
  onChange?: (tab: 'craft' | 'discoveries' | 'garden' | 'expeditions' | 'fishing') => void;
  onRequest?: (request: ExpeditionRequest) => void;
}) {
  const journey = state.expedition ?? {
    ...emptyExpedition(),
    offers: [0, 1, 2],
    notice: 'none' as const,
  };
  const active = journey.active === null ? undefined : EXPEDITIONS[journey.active];
  const atBoard = state.nearExpeditionBoard === true,
    pending = state.expeditionPending === true;
  const reward = (id: number) =>
    EXPEDITIONS[id]!.rewards.map(
      (r) => `${r.count} ${ITEM_KINDS[r.item].pluralName.toLowerCase()}`,
    ).join(' · ');
  return (
    <section className="hud-journal expedition-panel" aria-label="Expedition board">
      <div className="hud-journal-header">
        <h2 className="hud-journal-title">The next trail</h2>
        <span className="hud-journal-closehint">C to close</span>
      </div>
      <JournalTabs
        selected="expeditions"
        onChange={onChange}
        hasGarden={state.garden.homeId !== 0}
      />
      <p className="expedition-intro">
        One outing at a time. Take your time—progress is saved, even when you leave the forest.
      </p>
      {active ? (
        <article className="expedition-active">
          <span className="expedition-eyebrow">Your chosen outing</span>
          <h3>{active.name}</h3>
          <p>{active.hint}</p>
          <ul className="expedition-objectives">
            {active.objectives.map((objective, i) => (
              <li key={i}>
                <span>{objective.label}</span>
                <strong>
                  {journey.progress[i] ?? 0} / {objective.goal}
                </strong>
                <progress
                  aria-label={objective.label}
                  value={journey.progress[i] ?? 0}
                  max={objective.goal}
                />
              </li>
            ))}
          </ul>
          <p className="expedition-rewards">Reward · {reward(active.id)}</p>
          <button
            type="button"
            disabled={!atBoard || !expeditionComplete(journey) || pending}
            onClick={() => onRequest?.({ action: 'claim' })}
          >
            Claim rewards
          </button>
          {!atBoard ? <p>Return to your home board to collect the reward.</p> : null}
        </article>
      ) : (
        <div className="expedition-offers">
          {journey.offers.map((id, index) => {
            const mission = EXPEDITIONS[id];
            if (!mission) return null;
            return (
              <article className="expedition-offer" key={id}>
                <span className="expedition-eyebrow">Outing {index + 1}</span>
                <h3>{mission.name}</h3>
                <p>{mission.hint}</p>
                <ul>
                  {mission.objectives.map((goal, i) => (
                    <li key={i}>
                      {goal.label} · {goal.goal}
                    </li>
                  ))}
                </ul>
                <p className="expedition-rewards">Reward · {reward(id)}</p>
                <button
                  type="button"
                  disabled={!atBoard || pending}
                  onClick={() => onRequest?.({ action: 'accept', index })}
                >
                  Choose outing
                </button>
              </article>
            );
          })}
        </div>
      )}
      {!atBoard && active === undefined ? (
        <p>
          Read the board beside your own home—or from inside—to choose an outing. Your journal
          travels with you.
        </p>
      ) : null}
      <p className="expedition-milestone">
        {journey.completed} outings completed ·{' '}
        {(journey.cosmetics & TRAIL_PENNANT_SKILL) !== 0
          ? 'Trail pennant recipe learned'
          : 'Complete three outings to learn the trail pennant recipe'}
      </p>
      <p role="status">{pending ? 'Sending your choice…' : NOTES[journey.notice]}</p>
    </section>
  );
}
