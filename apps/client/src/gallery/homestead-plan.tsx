import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BUILDABLE_KINDS,
  canAfford,
  inventoryFromEntries,
  inventoryEntries,
  removeItem,
  type HomesteadProject,
} from '@acorn/shared';
import { HomesteadPlan } from '../hud/HomesteadPlan';
import { HudStore, type HudState } from '../hud/store';
export function showHomesteadPlan(canvas: HTMLCanvasElement, params: URLSearchParams) {
  canvas.hidden = true;
  document.body.style.overflow = 'auto';
  document.body.style.height = 'auto';
  document.documentElement.style.overflow = 'auto';
  document.documentElement.style.height = 'auto';
  const container = document.createElement('div');
  container.className = 'homestead-gallery';
  document.body.append(container);
  const root = createRoot(container);
  function Preview() {
    const [state, setState] = useState<HudState>(() => ({
      ...new HudStore().getSnapshot(),
      homeKind: 'tent',
      carrying: [
        { item: 'log', count: 18 },
        { item: 'stick', count: 16 },
        { item: 'rope', count: 2 },
        { item: 'flower', count: 3 },
      ],
      homesteadProjects: params.has('complete')
        ? ['trailWorkbench', 'trailPantry', 'kitchenGarden']
        : [],
    }));
    const build = (kind: HomesteadProject) => {
      const inventory = inventoryFromEntries(state.carrying);
      if (
        (state.homesteadProjects ?? []).includes(kind) ||
        !canAfford(inventory, BUILDABLE_KINDS[kind])
      )
        return;
      for (const cost of BUILDABLE_KINDS[kind].costs) removeItem(inventory, cost.item, cost.amount);
      setState({
        ...state,
        carrying: inventoryEntries(inventory),
        homesteadProjects: [...(state.homesteadProjects ?? []), kind],
      });
    };
    return (
      <main>
        <HomesteadPlan state={state} onBuild={build} />
        <small>Interactive journal preview · gameplay places each project in your yard.</small>
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
