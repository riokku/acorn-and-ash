import { rumorDefinition, rumorOutcome, rumorStage } from '@acorn/shared';
import { ExpeditionPreparation } from './ExpeditionPreparation';
import { ITEM_KINDS } from '../item-catalog';
import {
  EXPEDITIONS,
  expeditionComplete,
  emptyExpedition,
  TRAIL_PENNANT_SKILL,
  type ExpeditionRequest,
  type ExpeditionNotice,
} from '@acorn/shared';
import type { HudState } from './store';
import { JournalTabs } from './DiscoveryJournal';
import { ItemIcon } from './item-icons';
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
  onFood,
  onGear,
  onPack,
  preparation = true,
}: {
  state: HudState;
  onFood?: () => void;
  onGear?: () => void;
  onPack?: () => void;
  preparation?: boolean;
  onChange?: (tab: 'craft' | 'discoveries' | 'garden' | 'expeditions' | 'fishing') => void;
  onRequest?: (request: ExpeditionRequest) => void;
}) {
  const journey = state.expedition ?? {
    ...emptyExpedition(),
    offers: [0, 1, 2],
    notice: 'none' as const,
  };
  const active = journey.active === null ? undefined : EXPEDITIONS[journey.active];
  const rumor = rumorDefinition(active?.id ?? null);
  const nextClue = rumorStage(journey);
  const atBoard = state.nearExpeditionBoard === true,
    pending = state.expeditionPending === true;
  const reward = (id: number) => (
    <>
      <span>Reward · </span>
      {(rumorDefinition(id)
        ? rumorOutcome({ ...journey, active: id }, state.worldSeed ?? 0)!.rewards
        : EXPEDITIONS[id]!.rewards
      ).map((r) => (
        <span className="expedition-reward-item" key={r.item}>
          <ItemIcon item={r.item} color="currentColor" />
          <span>
            {' '}
            {r.count}{' '}
            {(r.count === 1
              ? ITEM_KINDS[r.item].displayName
              : ITEM_KINDS[r.item].pluralName
            ).toLowerCase()}
          </span>
        </span>
      ))}
    </>
  );
  return (
    <section className="hud-journal expedition-panel" aria-label="Expedition board">
      <div className="hud-journal-header">
        <h2 className="hud-journal-title">The next trail</h2>
        <span className="hud-journal-closehint">C or E to close</span>
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
          <span className="expedition-eyebrow">
            {rumorDefinition(active.id) ? 'Rumors of the Wild' : 'Your chosen outing'}
          </span>
          <h3>{active.name}</h3>
          <p>
            {rumor && nextClue < 0
              ? 'The trail bundle is recovered. Return to your home board to collect the find.'
              : rumor && nextClue > 0
                ? rumor.clues[nextClue - 1]
                : active.hint}
          </p>
          {rumor && journey.progress[0]! > 0 ? (
            <details className="rumor-notes">
              <summary>Collected clues</summary>
              <ol>
                {rumor.clues.map((clue, index) =>
                  (journey.progress[index] ?? 0) > 0 ? <li key={index}>{clue}</li> : null,
                )}
              </ol>
            </details>
          ) : null}
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
          {preparation && !expeditionComplete(journey) ? (
            <ExpeditionPreparation
              state={state}
              mission={active}
              onFood={onFood}
              onGear={onGear}
              onPack={onPack}
            />
          ) : null}
          {rumorDefinition(active.id) && expeditionComplete(journey) ? (
            <p className="rumor-outcome">
              {rumorOutcome(journey, state.worldSeed ?? 0)?.title} ·{' '}
              {rumorOutcome(journey, state.worldSeed ?? 0)?.story}
            </p>
          ) : null}
          <p className="expedition-rewards">
            {rumorDefinition(active.id) && !expeditionComplete(journey)
              ? 'A personal trail bundle · clothing, useful supplies or a bag. Its contents are revealed when you finish the trail.'
              : reward(active.id)}
          </p>
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
                <span className="expedition-eyebrow">
                  {rumorDefinition(id) ? 'Rumors of the Wild' : `Outing ${index + 1}`}
                </span>
                <h3>{mission.name}</h3>
                <p>{mission.hint}</p>
                <ul>
                  {mission.objectives.map((goal, i) => (
                    <li key={i}>
                      {goal.label} · {goal.goal}
                    </li>
                  ))}
                </ul>
                <p className="expedition-rewards">
                  {rumorDefinition(id)
                    ? 'Follow three clues · recover a personal trail bundle. Bring a shovel.'
                    : reward(id)}
                </p>
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
          : 'Recover a rumor or complete three outings to learn the trail pennant recipe'}
      </p>
      <p role="status">{pending ? 'Sending your choice…' : NOTES[journey.notice]}</p>
    </section>
  );
}
