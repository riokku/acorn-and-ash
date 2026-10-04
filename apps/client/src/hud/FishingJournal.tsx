import { FISH_SPECIES, fishRecordsFromSaved, REEL_CYCLE, reelSteady } from '@acorn/shared';
import type { HudState } from './store';
import { JournalTabs } from './DiscoveryJournal';
export function FishingJournal({
  state,
  onChange,
}: {
  state: HudState;
  onChange?: (tab: HudState['journalTab']) => void;
}) {
  const records = fishRecordsFromSaved(state.fishRecords),
    total = records.counts.reduce((a, b) => a + b, 0);
  return (
    <section className="hud-journal fishing-journal" aria-label="Fishing collection">
      <div className="hud-journal-header">
        <h2 className="hud-journal-title">Notes from the water</h2>
        <span>C to close</span>
      </div>
      <JournalTabs selected="fishing" onChange={onChange} hasGarden={state.garden.homeId !== 0} />
      <p>Every landed catch tells a story—even fish released when your pack is full.</p>
      <div className="fishing-species">
        {FISH_SPECIES.map((species, i) => (
          <article key={species.item}>
            <svg viewBox="0 0 180 100" role="img" aria-label={`${species.name} illustration`}>
              <path
                d="M18 80 Q90 60 162 80 M26 88 Q90 74 154 88"
                fill="none"
                stroke="#9cae9d"
                opacity=".5"
              />
              <path d="M132 48 L166 26 L160 66 Z" fill={species.color} />
              <ellipse cx="87" cy="46" rx="51" ry="22" fill={species.color} />
              <path d="M76 26 L95 9 L117 30 M79 58 L101 77 L118 59" fill={species.color} />
              {species.item === 'perch' ? (
                <path
                  d="M63 28 L58 61 M79 25 L73 65 M96 26 L91 66"
                  stroke="#3b4b40"
                  strokeWidth="3"
                  opacity=".4"
                />
              ) : species.item === 'trout' ? (
                <>
                  <path d="M42 49 Q84 43 133 46" fill="none" stroke="#bc7887" strokeWidth="5" />
                  {[62, 81, 105, 121].map((x) => (
                    <circle key={x} cx={x} cy="35" r="2" fill="#3b4b40" />
                  ))}
                </>
              ) : (
                <path d="M78 38L83 45L91 47L83 49L78 56L76 49L69 47L76 45Z" fill="#f4db87" />
              )}
              <circle cx="49" cy="41" r="3" fill="#26342b" />
              <path d="M39 48 Q53 57 61 42" fill="none" stroke="#53694f" />
            </svg>
            <h3>{species.name}</h3>
            <p>{species.note}</p>
            <strong>
              {records.counts[i]} caught ·{' '}
              {records.bestCm[i] ? `Best ${records.bestCm[i]} cm` : 'No size recorded yet'}
            </strong>
          </article>
        ))}
      </div>
      <p>
        {total} catches recorded ·{' '}
        {records.displays & 1
          ? 'Carved fish display recipe learned'
          : `${Math.min(total, 5)} / 5 catches toward a carved fish display`}
      </p>
      <p>
        {records.displays & 2
          ? 'Golden collection display recipe learned'
          : 'Catch all three species to learn the golden collection display'}
      </p>
    </section>
  );
}
export function RareReelHint({ state }: { state: HudState }) {
  if (state.fishing !== 'reeling' || !state.reel) return null;
  const phase = state.reel.age % REEL_CYCLE,
    steady = reelSteady(state.reel.age);
  return (
    <section
      className={`rare-reel ${steady ? 'rare-reel-steady' : ''}`}
      aria-label="Rare fish challenge"
    >
      <strong>A golden carp! · {state.reel.hits} / 2 steady pulls</strong>
      <div className="rare-reel-track">
        <span className="rare-reel-zone" />
        <span className="rare-reel-marker" style={{ left: `${(phase / REEL_CYCLE) * 100}%` }} />
      </div>
      <p role="status">
        {steady ? 'Steady—click to reel gently!' : 'Wait for the marker to enter the green water.'}
      </p>
      {state.reel.misses > 0 ? (
        <small>Ease the line. You can try the next steady moment.</small>
      ) : null}
    </section>
  );
}
