import { FISH_SPECIES, fishRecordsFromSaved, REEL_CYCLE, reelSteady } from '@acorn/shared';
import type { HudState } from './store';
import { JournalTabs } from './DiscoveryJournal';
import { ItemIcon } from './item-icons';
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
            <div className="fishing-species-art" aria-hidden="true">
              <ItemIcon item={species.item} color={species.color} />
            </div>
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
