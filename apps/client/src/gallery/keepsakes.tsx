import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { BUILDABLE_KINDS, inventoryFromEntries, inventoryEntries, removeItem } from '@acorn/shared';
import { CraftPanel } from '../hud/Hud';
import { HudStore, type HudState } from '../hud/store';
import { craftMenuEntries } from '../hud/craft-menu';

export function showKeepsakes(canvas: HTMLCanvasElement, params: URLSearchParams) {
  canvas.hidden = true;
  document.documentElement.style.overflow = 'auto';
  document.documentElement.style.height = 'auto';
  document.body.style.overflow = 'auto';
  document.body.style.height = 'auto';
  const container = document.createElement('main');
  container.className = 'keepsake-gallery';
  document.body.append(container);
  const root = createRoot(container);
  function Preview() {
    const [state, setState] = useState<HudState>(() => ({
      ...new HudStore().getSnapshot(),
      homeKind: 'tent',
      craftTab: 'trophies',
      trophyDisplays: params.has('displayed')
        ? ['guardianTrophy', 'fishDisplay', 'firstBellRelic']
        : [],
      carrying: [
        { item: 'guardianTrophy', count: 1 },
        { item: 'log', count: 3 },
        { item: 'flower', count: 3 },
      ],
      fishRecords: { counts: [2, 2, 1], bestCm: [22, 31, 24], displays: 3 },
    }));
    return (
      <>
        <p className="keepsake-gallery-note">
          Journal preview · choosing a spot here demonstrates collection progress. In the world,
          place the actual model in your yard.
        </p>
        <CraftPanel
          state={state}
          navigation={null}
          guidedKeepsakes={!params.has('before')}
          onTabChange={(craftTab) => setState({ ...state, craftTab })}
          onPick={(action) => {
            if (action.kind !== 'build' || (state.trophyDisplays ?? []).includes(action.buildable))
              return;
            const entry = craftMenuEntries(state).find(
              (entry) =>
                entry.action.kind === 'build' && entry.action.buildable === action.buildable,
            );
            if (!entry?.ready || entry.locked) return;
            const pack = inventoryFromEntries(state.carrying);
            for (const cost of BUILDABLE_KINDS[action.buildable].costs)
              removeItem(pack, cost.item, cost.amount);
            setState({
              ...state,
              trophyDisplays: [...(state.trophyDisplays ?? []), action.buildable],
              carrying: inventoryEntries(pack),
            });
          }}
        />
      </>
    );
  }
  root.render(<Preview />);
  document.body.dataset.galleryReady = 'true';
  addEventListener(
    'pagehide',
    () => {
      root.unmount();
      container.remove();
    },
    { once: true },
  );
}
