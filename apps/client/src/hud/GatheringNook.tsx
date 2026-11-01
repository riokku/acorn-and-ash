import {
  BUILDABLE_KINDS,
  countOf,
  inventoryFromEntries,
  type BuildableKindId,
} from '@acorn/shared';
import { ITEM_KINDS } from '../item-catalog';
import { BuildableIcon, ItemIcon } from './item-icons';
import type { HudState } from './store';

const PIECES = [
  { kind: 'cedarBench', detail: 'Two seats for you and a friend. Approach the front and press E.' },
  {
    kind: 'timberTable',
    detail: 'A centerpiece for a picnic corner, beside your garden or cabin.',
  },
  { kind: 'gardenPath', detail: 'Trace a little trail from your door to the gathering spot.' },
  { kind: 'campfire', detail: 'Warmth and cooking nearby. Bring logs to keep the flame burning.' },
  { kind: 'fernLantern', detail: 'A gentle woodland glow for evenings together.' },
] as const;

export function GatheringNook({
  state,
  onPlace,
}: {
  state: Pick<HudState, 'carrying' | 'home' | 'homeKind'>;
  onPlace?: (kind: BuildableKindId) => void;
}) {
  const pack = inventoryFromEntries(state.carrying);
  return (
    <details className="gathering-nook" data-testid="gathering-nook">
      <summary>
        <span>A place for company</span>
        <strong>Make a woodland gathering nook</strong>
      </summary>
      <p>
        Build a corner worth lingering in: a table, a couple of benches, a winding path and a warm
        fire a few paces away. Every bench seats two; visitors are welcome to sit.
      </p>
      <p>
        Choose level ground and leave the front of each bench clear for getting up. Scroll to rotate
        the preview. Move or reclaim your furniture later by right-clicking it; occupied benches
        stay put.
      </p>
      {state.homeKind === null ? (
        <p>Place your first home to establish a yard for these pieces.</p>
      ) : null}
      <div className="gathering-nook-pieces">
        {PIECES.map(({ kind, detail }) => {
          const definition = BUILDABLE_KINDS[kind];
          const ready = definition.costs.every((cost) => countOf(pack, cost.item) >= cost.amount);
          return (
            <article key={kind}>
              <div className="homestead-project-heading">
                <BuildableIcon kind={kind} color="#76533a" />
                <h4>{definition.displayName}</h4>
              </div>
              <p>{detail}</p>
              <div className="homestead-costs">
                {definition.costs.map((cost) => (
                  <span key={cost.item} data-ready={countOf(pack, cost.item) >= cost.amount}>
                    <ItemIcon item={cost.item} color="#76533a" />
                    {cost.amount} {ITEM_KINDS[cost.item].pluralName.toLowerCase()}
                  </span>
                ))}
              </div>
              <button
                type="button"
                disabled={state.homeKind === null || !ready || state.home !== null || !onPlace}
                onClick={() => onPlace?.(kind)}
              >
                {state.homeKind === null
                  ? 'Place a home first'
                  : state.home !== null
                    ? 'Step outside to place'
                    : ready
                      ? `Place ${definition.displayName}`
                      : 'Gather materials'}
              </button>
            </article>
          );
        })}
      </div>
    </details>
  );
}
