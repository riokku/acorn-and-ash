import {
  GARDEN_CROPS,
  ITEM_KINDS,
  TICK_HZ,
  inventoryFromEntries,
  countOf,
  type GardenRequest,
} from '@acorn/shared';
import type { HudState } from './store';
import { JournalTabs } from './DiscoveryJournal';

const REASONS = {
  unavailable: 'A garden comes with the larger cabin.',
  private: 'Only the home owner can tend this garden.',
  tooFar: 'Move closer to the garden boxes.',
  busy: 'Finish your current action first.',
  empty: 'Bring one berry, mushroom or flower to plant.',
  growing: 'This plant is still growing.',
  occupied: 'Harvest this box before planting again.',
  packFull: 'Make room for the whole harvest. It will keep waiting.',
  invalid: 'Choose a garden box.',
};
export function GardenJournal({
  state,
  onChange,
  onUse,
}: {
  state: HudState;
  onChange?: (tab: 'craft' | 'discoveries' | 'garden') => void;
  onUse?: (request: GardenRequest) => void;
}) {
  const inventory = inventoryFromEntries(state.carrying),
    garden = state.garden;
  const canTend = garden.yours && state.nearGarden;
  return (
    <section className="hud-journal hud-garden" aria-label="Garden journal">
      <div className="hud-journal-header">
        <span className="hud-journal-title">A little garden</span>
        <span className="hud-journal-closehint">C to close</span>
      </div>
      <JournalTabs selected="garden" onChange={onChange} hasGarden />
      <p className="discovery-intro">
        Plant one, harvest three. Plants grow while this world is awake and stay ready until you
        return.
      </p>
      {!garden.yours ? (
        <p>Only the home owner can plant and harvest.</p>
      ) : !state.nearGarden ? (
        <p>Move closer to the garden boxes to tend them.</p>
      ) : null}
      {garden.reason !== null && garden.reason !== 'unavailable' ? (
        <p role="status">{REASONS[garden.reason]}</p>
      ) : null}
      {garden.plots.map((plot, index) => (
        <article className="garden-box" key={index}>
          <h3>
            Box {index + 1} ·{' '}
            {plot.crop === null ? 'Ready to plant' : ITEM_KINDS[plot.crop].displayName}
          </h3>
          {plot.crop === null ? (
            <div className="garden-choices">
              {GARDEN_CROPS.map((crop) => (
                <button
                  type="button"
                  key={crop}
                  disabled={!canTend || countOf(inventory, crop) < 1}
                  onClick={() => onUse?.({ action: 'plant', plot: index, crop })}
                >
                  Plant {ITEM_KINDS[crop].displayName.toLowerCase()} · 1
                </button>
              ))}
            </div>
          ) : plot.growTicks > 0 ? (
            <p>
              Growing · about {Math.max(1, Math.ceil(plot.growTicks / TICK_HZ / 60))} minutes of
              world time
            </p>
          ) : (
            <button
              type="button"
              disabled={!canTend}
              onClick={() => onUse?.({ action: 'harvest', plot: index })}
            >
              Harvest 3 {ITEM_KINDS[plot.crop].pluralName.toLowerCase()}
            </button>
          )}
        </article>
      ))}
    </section>
  );
}
