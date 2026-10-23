import {
  highPlainsWeight,
  SUNREACH_EXPEDITION_ID,
  SUNREACH_SURVEY,
  surveyStage,
  surveyInteraction,
} from '@acorn/shared';
import type { HudState } from './store';
import './bonehollow-trail.css';

export function SunreachTrail({ state }: { state: HudState }) {
  if (state.home !== null || highPlainsWeight(state.position.x, state.position.z) < 0.35)
    return null;
  const journey = state.expedition;
  if (journey === undefined) return null;
  const active = journey.active === SUNREACH_EXPEDITION_ID;
  const next = surveyStage(journey);
  const interaction = surveyInteraction(journey, state.position, state.equippedItem);
  return (
    <aside className="bonehollow-trail" aria-label="Sunreach expedition">
      <span className="bonehollow-kicker">The vanished survey</span>
      <h2>Sunreach</h2>
      <p>
        {!active
          ? 'Choose “The Sunreach Survey” at your home board to follow the rangers’ trail.'
          : next < 0
            ? SUNREACH_SURVEY[2].clue
            : next === 0
              ? 'Search the broken ranger outpost just beyond the pass. Press E to read the notes.'
              : SUNREACH_SURVEY[next - 1]!.clue}
      </p>
      {active && !interaction && next >= 0 ? (
        <small>Coyotes circle, crouch, then bite. Dodge past the shoulder and counter.</small>
      ) : null}
      {interaction ? (
        <small>{interaction.ready ? `E · ${interaction.hint}` : interaction.hint}</small>
      ) : null}
    </aside>
  );
}
