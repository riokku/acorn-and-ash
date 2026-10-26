import { ITEM_KINDS } from '../item-catalog';
import { BUILDABLE_KINDS } from '@acorn/shared';
import { KEEPSAKES } from './keepsakes';
import { BuildableIcon } from './item-icons';
import { craftMenuEntries, entriesOnTab, CRAFT_HOTKEY_COUNT, type CraftAction } from './craft-menu';
import type { HudState } from './store';

export function TrophyCollection({
  state,
  onPick,
}: {
  state: HudState;
  onPick?: (action: CraftAction) => void;
}) {
  const placed = new Set(state.trophyDisplays ?? []),
    entries = craftMenuEntries(state);
  const count = KEEPSAKES.filter((keepsake) => placed.has(keepsake.kind)).length;
  return (
    <section
      className="trophy-collection"
      aria-label="Stories brought home"
      data-testid="trophy-collection"
    >
      <header>
        <span className="homestead-eyebrow">Your adventures belong here</span>
        <h3>Stories brought home</h3>
        <p>
          Turn a hard-won catch or victory into a landmark in your yard. These are real earned
          keepsakes, not free decorations.
        </p>
        <strong>
          {count}/{KEEPSAKES.length} kinds on display
        </strong>
      </header>
      <div className="keepsake-grid">
        {KEEPSAKES.map((keepsake) => {
          const displayed = placed.has(keepsake.kind),
            entry = entries.find(
              (entry) => entry.action.kind === 'build' && entry.action.buildable === keepsake.kind,
            );
          const key = entriesOnTab(entries, 'trophies').findIndex(
            (row) => row.action.kind === 'build' && row.action.buildable === keepsake.kind,
          );
          const ready =
            state.homeKind !== null && entry?.ready === true && !entry.locked && !displayed;
          return (
            <article key={keepsake.kind} data-keepsake={keepsake.kind} data-displayed={displayed}>
              <BuildableIcon kind={keepsake.kind} color={displayed ? '#bdcd93' : '#dfbf82'} />
              <small>
                {displayed
                  ? 'On display · your homestead'
                  : ready
                    ? 'Ready to bring home'
                    : 'An adventure ahead'}
              </small>
              <h4>
                {key >= 0 && key < CRAFT_HOTKEY_COUNT ? (
                  <kbd className="craft-key">{key + 1}</kbd>
                ) : null}
                {keepsake.title}
              </h4>
              <strong>{BUILDABLE_KINDS[keepsake.kind].displayName}</strong>
              <p>{keepsake.story}</p>
              <p className="keepsake-route">{keepsake.route}</p>
              {!displayed && (
                <div className="homestead-costs" aria-label="Backpack materials">
                  {BUILDABLE_KINDS[keepsake.kind].costs.map((cost) => {
                    const have = state.carrying.find((row) => row.item === cost.item)?.count ?? 0;
                    return (
                      <span key={cost.item} data-ready={have >= cost.amount}>
                        {Math.min(have, cost.amount)}/{cost.amount}{' '}
                        {ITEM_KINDS[cost.item].pluralName.toLowerCase()}
                      </span>
                    );
                  })}
                </div>
              )}
              <button
                type="button"
                disabled={!ready}
                onClick={() => entry && onPick?.(entry.action)}
              >
                {displayed
                  ? 'Part of your story'
                  : state.homeKind === null
                    ? 'Build a home first'
                    : state.home !== null
                      ? 'Place through B · Decorate'
                      : ready
                        ? 'Choose a place in your yard'
                        : (entry?.statusLabel ?? 'Find this keepsake on your travels')}
              </button>
            </article>
          );
        })}
      </div>
      <footer>
        Place outdoors inside your home boundary, or use B to decorate indoors. Placing spends the
        trophy or listed materials; reclaiming uses the existing return rules. No collection bonus
        or upkeep. Counts reflect pieces currently placed, not a permanent achievement history.
      </footer>
    </section>
  );
}
