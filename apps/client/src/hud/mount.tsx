import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import type { BuildableKindId, ItemId } from '@acorn/shared';

import { Hud } from './Hud';
import type { HudStore } from './store';
import type { HotbarPins } from './hotbar-layout';
import type { Preferences } from '../preferences/preferences';
import type { MapFeed } from '../map/map-feed';
import type { CombatFeed } from './combat-feed';

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
  onPickBuildable: (kind: BuildableKindId) => void,
  onHotbarSlotsChange: (next: HotbarPins) => void,
  initialPreferences: Preferences,
  onSettingsChange: (preferences: Preferences) => void,
  mapFeed: MapFeed,
  onToggleMap: () => void,
  onSetDoorLock: (locked: boolean) => void,
  onDiscard: (item: ItemId, amount: number, destroy: boolean) => void,
  combatFeed: CombatFeed,
): void {
  createRoot(container).render(
    <StrictMode>
      <Hud
        store={store}
        onPlay={onPlay}
        onToggleInventory={onToggleInventory}
        onUseItem={onUseItem}
        onPickBuildable={onPickBuildable}
        onHotbarSlotsChange={onHotbarSlotsChange}
        initialPreferences={initialPreferences}
        onSettingsChange={onSettingsChange}
        mapFeed={mapFeed}
        onToggleMap={onToggleMap}
        onSetDoorLock={onSetDoorLock}
        onDiscard={onDiscard}
        combatFeed={combatFeed}
      />
    </StrictMode>,
  );
}
