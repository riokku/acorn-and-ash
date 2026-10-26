import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import {
  emptyExpedition,
  craft,
  inventoryFromEntries,
  inventoryEntries,
  recipeFor,
} from '@acorn/shared';
import { ExpeditionPanel } from '../hud/ExpeditionPanel';
import { CraftPanel } from '../hud/Hud';
import { HudStore, type HudState } from '../hud/store';
export function showExpeditionPreparation(canvas: HTMLCanvasElement, params: URLSearchParams) {
  canvas.hidden = true;
  document.documentElement.style.overflow = 'auto';
  document.documentElement.style.height = 'auto';
  document.body.style.overflow = 'auto';
  document.body.style.height = 'auto';
  const container = document.createElement('main');
  container.className = 'preparation-gallery';
  document.body.append(container);
  const root = createRoot(container);
  function Preview() {
    const [page, setPage] = useState<'outing' | 'food'>('outing');
    const [state, setState] = useState<HudState>(() => ({
      ...new HudStore().getSnapshot(),
      homeKind: 'cabin',
      nearExpeditionBoard: true,
      nearCampfire: 'lit',
      craftTab: 'food',
      discoveriesClaimed: (1 << 0) | (1 << 2) | (1 << 3),
      carrying: params.has('ready')
        ? [
            { item: 'bag', count: 2 },
            { item: 'forestStew', count: 2 },
          ]
        : [
            { item: 'bag', count: 1 },
            ...recipeFor('forestStew')!.costs.map((cost) => ({
              item: cost.item,
              count: cost.amount * 2,
            })),
            { item: 'berry', count: 5 },
          ],
      worn: params.has('ready') ? { mainHand: 'ironSword', upperBody: 'winterJacket' } : {},
      expedition: { ...emptyExpedition(), active: 8, offers: [0, 1, 8], notice: 'accepted' },
    }));
    return (
      <>
        <p>
          Expedition journal preview · prepare a meal here with the existing recipe. Your chosen
          outing stays saved.
        </p>
        {page === 'outing' ? (
          <ExpeditionPanel
            state={state}
            preparation={!params.has('before')}
            onFood={() => setPage('food')}
          />
        ) : (
          <CraftPanel
            state={state}
            navigation={
              <button type="button" onClick={() => setPage('outing')}>
                Back to chosen outing
              </button>
            }
            onTabChange={(craftTab) => setState({ ...state, craftTab })}
            onPick={(action) => {
              if (action.kind !== 'craft') return;
              const pack = inventoryFromEntries(state.carrying);
              if (craft(pack, action.item, state.discoveriesClaimed))
                setState({ ...state, carrying: inventoryEntries(pack) });
            }}
          />
        )}
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
