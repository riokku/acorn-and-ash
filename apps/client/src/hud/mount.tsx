import type { ExpeditionRequest } from '@acorn/shared';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import type { BuildableKindId, ItemId, ChestRequest } from '@acorn/shared';
import type { GardenRequest, GearRequest } from '@acorn/shared';

import { Hud } from './Hud';
import type { HudStore } from './store';
import type { HotbarPins } from './hotbar-layout';
import type { Preferences } from '../preferences/preferences';
import type { MapFeed } from '../map/map-feed';
import type { CombatFeed } from './combat-feed';
import type { CraftAction, CraftTabId } from './craft-menu';

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
  onChestTransfer: (request: ChestRequest) => void,
  onCloseChest: () => void,
  onSettingsOpenChange?: (open: boolean) => void,
  journalActions?: {
    onTabChange: (tab: 'craft' | 'discoveries' | 'garden' | 'expeditions' | 'fishing') => void;
    onCraftTab: (tab: CraftTabId) => void;
    onPickCraft: (action: CraftAction) => void;
    onExpedition?: (request: ExpeditionRequest) => void;
    onGarden?: (request: GardenRequest) => void;
    onToggleDecorations?: () => void;
    onMoveDecoration?: (id: number) => void;
    onReclaimDecoration?: (id: number) => void;
  },
  accountActions?: {
    onSignOut: () => void;
    onCancelSignOut: () => void;
    onDeleteCharacter?: () => Promise<void>;
  },
  gearActions?: {
    onChange: (request: GearRequest) => void;
  },
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
        onSettingsOpenChange={onSettingsOpenChange}
        mapFeed={mapFeed}
        onToggleMap={onToggleMap}
        onSetDoorLock={onSetDoorLock}
        onDiscard={onDiscard}
        combatFeed={combatFeed}
        onChestTransfer={onChestTransfer}
        onCloseChest={onCloseChest}
        onSignOut={accountActions?.onSignOut}
        onCancelSignOut={accountActions?.onCancelSignOut}
        onDeleteCharacter={accountActions?.onDeleteCharacter}
        onGearChange={gearActions?.onChange}
        onJournalTabChange={journalActions?.onTabChange}
        onCraftTabChange={journalActions?.onCraftTab}
        onPickCraft={journalActions?.onPickCraft}
        onGardenUse={journalActions?.onGarden}
        onExpedition={journalActions?.onExpedition}
        onToggleDecorations={journalActions?.onToggleDecorations}
        onMoveDecoration={journalActions?.onMoveDecoration}
        onReclaimDecoration={journalActions?.onReclaimDecoration}
      />
    </StrictMode>,
  );
}
