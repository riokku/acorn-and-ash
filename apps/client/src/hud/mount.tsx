import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import type { ItemId } from '@acorn/shared';

import { Hud } from './Hud';
import type { HudStore } from './store';
import type { HotbarPins } from './hotbar-layout';
import type { Preferences } from '../preferences/preferences';

/**
 * The HUD is React, drawn as an HTML layer over the canvas. The 3D scene is
 * plain Three.js and never goes through React.
 */
export function mountHud(
  container: HTMLElement,
  store: HudStore,
  onPlay: () => void,
  onToggleInventory: () => void,
  onUseItem: (item: ItemId) => void,
  onHotbarSlotsChange: (next: HotbarPins) => void,
  initialPreferences: Preferences,
  onSettingsChange: (preferences: Preferences) => void,
): void {
  createRoot(container).render(
    <StrictMode>
      <Hud
        store={store}
        onPlay={onPlay}
        onToggleInventory={onToggleInventory}
        onUseItem={onUseItem}
        onHotbarSlotsChange={onHotbarSlotsChange}
        initialPreferences={initialPreferences}
        onSettingsChange={onSettingsChange}
      />
    </StrictMode>,
  );
}
