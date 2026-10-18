import {
  BONEHOLLOW_EXPEDITION_ID,
  EXPEDITIONS,
  inSkeletonTown,
  SKELETON_TOWN,
} from '@acorn/shared';
import type { HudState } from './store';
import './bonehollow-trail.css';

/** A quiet location card also keeps the chosen expedition readable during the fight. */
export function BonehollowTrail({ state }: { state: HudState }) {
  if (state.home !== null || !inSkeletonTown(state.position.x, state.position.z, 8)) return null;
  const atWarning =
    Math.hypot(
      state.position.x - (SKELETON_TOWN.x - 3.3),
      state.position.z - (SKELETON_TOWN.z + 30),
    ) < 4;
  const journey = state.expedition;
  const mission = EXPEDITIONS[BONEHOLLOW_EXPEDITION_ID]!;
  const active = journey?.active === mission.id;
  const next = active
    ? mission.objectives.findIndex((goal, i) => (journey.progress[i] ?? 0) < goal.goal)
    : -1;
  return (
    <aside className="bonehollow-trail" aria-label="Bonehollow expedition">
      {atWarning ? (
        <small>
          Carved in the watch stone: “Two cuts, then the turn. Retreat when bronze rises.”
        </small>
      ) : null}
      <span className="bonehollow-kicker">The fallen watch</span>
      <h2>Bonehollow</h2>
      <p>
        {active
          ? next < 0
            ? 'The last bell is silent. Return to your home board for the Last Watch helm.'
            : `${mission.objectives[next]!.label} · ${journey.progress[next] ?? 0}/${mission.objectives[next]!.goal}`
          : 'Read “The Last Bell of Bonehollow” at your home board to earn the watch captain’s helm.'}
      </p>
      {active && next === 2 ? (
        <small>Two combinations. Then a whirlwind. Watch the charge.</small>
      ) : null}
    </aside>
  );
}
