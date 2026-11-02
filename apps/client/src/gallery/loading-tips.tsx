import { createRoot } from 'react-dom/client';
import { LoadingScreen } from '../hud/LoadingScreen';
import { HudStore, type HudState } from '../hud/store';

/** Read-only examples of the actual loading screen. */
export function showLoadingTips(canvas: HTMLCanvasElement, params: URLSearchParams): void {
  canvas.hidden = true;
  const sample = params.get('state');
  const requestedProgress = Number(params.get('progress') ?? '42');
  const connection =
    sample === 'offline' || sample === 'rejected' || sample === 'elsewhere' || sample === 'deleted'
      ? sample
      : 'connecting';
  const state: HudState = {
    ...new HudStore().getSnapshot(),
    connection,
    loadingProgress: Number.isFinite(requestedProgress) ? requestedProgress : 42,
    loadingStage: 'Preparing your journey',
    loadingError: sample === 'error' ? 'Could not prepare this world.' : null,
  };
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  root.render(<LoadingScreen state={state} />);
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
