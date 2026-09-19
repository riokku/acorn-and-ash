import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { Hud } from './Hud';
import type { HudStore } from './store';

/**
 * The HUD is React, drawn as an HTML layer over the canvas. The 3D scene is
 * plain Three.js and never goes through React.
 */
export function mountHud(container: HTMLElement, store: HudStore, onPlay: () => void): void {
  createRoot(container).render(
    <StrictMode>
      <Hud store={store} onPlay={onPlay} />
    </StrictMode>,
  );
}
