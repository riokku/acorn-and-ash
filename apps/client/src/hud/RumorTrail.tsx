import {
  rumorDefinition,
  rumorRoute,
  rumorStage,
  rumorInteraction,
  rumorOutcome,
} from '@acorn/shared';
import type { HudState } from './store';
import './bonehollow-trail.css';
export function RumorTrail({ state }: { state: HudState }) {
  const journey = state.expedition,
    rumor = rumorDefinition(journey?.active ?? null);
  if (!journey || !rumor || state.home !== null) return null;
  const stage = rumorStage(journey),
    site = rumorRoute(journey, state.discoverySites)[stage];
  const interaction = rumorInteraction(
    journey,
    state.discoverySites,
    state.position,
    state.equippedItem,
  );
  const bearing = site ? Math.atan2(site.x - state.position.x, -(site.z - state.position.z)) : 0;
  const direction = [
    'north',
    'northeast',
    'east',
    'southeast',
    'south',
    'southwest',
    'west',
    'northwest',
  ][(Math.round(bearing / (Math.PI / 4)) + 8) % 8];
  return (
    <aside className="bonehollow-trail rumor-trail" aria-label="Rumors of the Wild">
      <span className="bonehollow-kicker">
        Rumors of the Wild · {stage < 0 ? 'Trail complete' : `Clue ${stage + 1} of 3`}
      </span>
      <h2>{rumor.name}</h2>
      <p>
        {stage < 0
          ? rumorOutcome(journey, state.worldSeed ?? 0)?.story
          : stage === 0
            ? rumor.introduction
            : rumor.clues[stage - 1]}
      </p>
      <small>
        {stage < 0
          ? 'Return to your home board to collect your recovered find.'
          : interaction
            ? interaction.ready
              ? `E · ${interaction.hint}`
              : interaction.hint
            : site
              ? `${site.name} lies to the ${direction} · look for the landmark.`
              : 'Read the clue in your expedition journal.'}
      </small>
    </aside>
  );
}
