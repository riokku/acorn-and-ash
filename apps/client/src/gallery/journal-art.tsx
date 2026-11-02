import { createRoot } from 'react-dom/client';
import { DISCOVERIES, RUMORS, rumorMemoryBit, TRAIL_PENNANT_SKILL } from '@acorn/shared';
import { DiscoveryJournal } from '../hud/DiscoveryJournal';
import { GardenJournal } from '../hud/GardenJournal';
import { HomeStories } from '../hud/HomeStories';
import { HudStore, type HudState } from '../hud/store';

/** Read-only examples of the real journal pages. */
export function showJournalArt(canvas: HTMLCanvasElement, params: URLSearchParams): void {
  canvas.hidden = true;
  const view = params.get('view') ?? 'discoveries';
  const sample = params.get('state') ?? 'mixed';
  const allFound = DISCOVERIES.reduce((mask, discovery) => mask | (1 << discovery.id), 0);
  const found = sample === 'unknown' ? 0 : sample === 'mixed' ? (1 << 0) | (1 << 4) : allFound;
  const claimed = sample === 'claimed' ? allFound : 0;
  const base = new HudStore().getSnapshot();
  const state: HudState = {
    ...base,
    discoveriesFound: found,
    discoveriesClaimed: claimed,
    nearGarden: true,
    garden: {
      homeId: 1,
      yours: true,
      reason: null,
      plots:
        sample === 'unknown'
          ? [
              { crop: null, growTicks: 0 },
              { crop: null, growTicks: 0 },
              { crop: null, growTicks: 0 },
            ]
          : [
              { crop: null, growTicks: 0 },
              { crop: 'mushroom', growTicks: 2400 },
              { crop: 'flower', growTicks: 0 },
            ],
    },
    carrying: [
      { item: 'berry', count: 1 },
      { item: 'mushroom', count: 1 },
      { item: 'flower', count: 1 },
    ],
  };
  const cosmetics =
    sample === 'unknown'
      ? 0
      : (sample === 'mixed' ? RUMORS.slice(0, 1) : RUMORS).reduce(
          (mask, rumor) => mask | rumorMemoryBit(rumor.id),
          TRAIL_PENNANT_SKILL,
        );
  document.body.style.overflow = 'auto';
  document.body.style.height = 'auto';
  document.documentElement.style.overflow = 'auto';
  document.documentElement.style.height = 'auto';
  const container = document.createElement('div');
  container.className = 'journal-art-gallery';
  document.body.append(container);
  const root = createRoot(container);
  root.render(
    <main>
      {view === 'garden' ? (
        <GardenJournal state={state} />
      ) : view === 'stories' ? (
        <section className="homestead-plan">
          <HomeStories cosmetics={cosmetics} />
        </section>
      ) : (
        <DiscoveryJournal state={state} />
      )}
    </main>,
  );
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
