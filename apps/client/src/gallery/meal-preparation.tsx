import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { craft, inventoryFromEntries, inventoryEntries, startMeal } from '@acorn/shared';
import { CraftPanel } from '../hud/Hud';
import { HudStore, type HudState } from '../hud/store';

export function showMealPreparation(canvas: HTMLCanvasElement, params: URLSearchParams): void {
  canvas.hidden = true;
  const container = document.createElement('div');
  container.className = 'meal-gallery';
  document.body.append(container);
  const root = createRoot(container);
  function Preview() {
    const [state, setState] = useState<HudState>(() => ({
      ...new HudStore().getSnapshot(),
      craftTab: 'food' as const,
      connection: 'connected' as const,
      nearCampfire: 'lit' as const,
      discoveriesClaimed: (1 << 0) | (1 << 2) | (1 << 3),
      carrying: [
        { item: 'roastedMeat' as const, count: 2 },
        { item: 'berry' as const, count: 5 },
        { item: 'mushroom' as const, count: 2 },
        { item: 'trailRation' as const, count: 1 },
      ],
      meal: { ...startMeal('trailRation'), ticksLeft: 5400 },
    }));
    return (
      <CraftPanel
        state={state}
        navigation={null}
        guidedMeals={!params.has('before')}
        onPick={(action) => {
          if (action.kind !== 'craft') return;
          const pack = inventoryFromEntries(state.carrying);
          if (craft(pack, action.item, state.discoveriesClaimed))
            setState({ ...state, carrying: inventoryEntries(pack) });
        }}
      />
    );
  }
  root.render(<Preview />);
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      document.body.dataset.galleryReady = 'true';
    }),
  );
  window.addEventListener(
    'pagehide',
    () => {
      root.unmount();
      container.remove();
    },
    { once: true },
  );
}
