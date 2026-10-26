import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { craft, inventoryEntries, inventoryFromEntries } from '@acorn/shared';
import { CedarHuntPlan, CedarHuntTracker } from '../hud/CedarHuntPlan';
import { HudStore, type HudState } from '../hud/store';
export function showCedarHuntPlan(canvas: HTMLCanvasElement, params: URLSearchParams): void {
  canvas.hidden = true;
  const container = document.createElement('div');
  container.className = 'cedar-hunt-gallery';
  document.body.append(container);
  const root = createRoot(container);
  function Preview() {
    const [state, setState] = useState<HudState>(() => ({
      ...new HudStore().getSnapshot(),
      cedarHuntPinned: false,
      carrying: [
        { item: 'rope', count: 2 },
        { item: 'reed', count: 4 },
        ...(params.has('hide') ? [{ item: 'cedarHide' as const, count: 1 }] : []),
      ],
    }));
    return (
      <main>
        <CedarHuntPlan
          state={state}
          onPin={(pinned) => setState({ ...state, cedarHuntPinned: pinned })}
        />
        {state.cedarHuntPinned ? (
          <CedarHuntTracker
            state={state}
            onPin={(pinned) => setState({ ...state, cedarHuntPinned: pinned })}
          />
        ) : null}
        <button
          type="button"
          onClick={() => {
            const pack = inventoryFromEntries(state.carrying);
            if (craft(pack, 'cedarstalkerCoat'))
              setState({ ...state, carrying: inventoryEntries(pack) });
          }}
        >
          Stitch coat
        </button>
      </main>
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
