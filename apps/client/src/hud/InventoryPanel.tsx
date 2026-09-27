import { ITEM_KINDS, type ItemId } from '@acorn/shared';

import { ItemIcon } from './item-icons';
import { Tooltip } from './Tooltip';

/** The custom drag type a hotbar slot sets on itself, so dropping it back here can unpin it. */
export const HOTBAR_SLOT_DRAG_TYPE = 'application/x-acorn-hotbar-slot';

/** A 0xRRGGBB placeholder colour, as a CSS colour string - the same helper Hud.tsx keeps of its own. */
function colorOf(placeholderColor: number): string {
  return `#${placeholderColor.toString(16).padStart(6, '0')}`;
}

/**
 * The bag button that opens or closes the inventory panel - the mouse-first
 * way in, alongside the `I` key, the same pairing the gear button and its
 * own key-free equivalent give the Settings menu.
 */
export function InventoryToggleButton({ onToggle }: { onToggle: () => void }): React.JSX.Element {
  return (
    <button
      type="button"
      className="inventory-toggle-button"
      aria-label="Open your pack"
      onClick={onToggle}
    >
      <ItemIcon item="bag" color="currentColor" className="inventory-toggle-icon" />
    </button>
  );
}

/**
 * Every item currently carried, not just the six the hotbar has room for -
 * see decision 0050. Each entry can be dragged onto a hotbar slot to pin it
 * there, and dropping a hotbar slot back here unpins it, read off the same
 * custom drag type the hotbar slot itself sets on the way out.
 */
export function InventoryPanel({
  open,
  entries,
  onUseItem,
  onUnpinFromHotbar,
}: {
  open: boolean;
  entries: readonly { readonly item: ItemId; readonly count: number }[];
  onUseItem: (item: ItemId) => void;
  onUnpinFromHotbar: (slotIndex: number) => void;
}): React.JSX.Element | null {
  if (!open) return null;

  return (
    <div
      className="inventory-panel"
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes(HOTBAR_SLOT_DRAG_TYPE)) event.preventDefault();
      }}
      onDrop={(event) => {
        const slot = event.dataTransfer.getData(HOTBAR_SLOT_DRAG_TYPE);
        if (slot === '') return;
        onUnpinFromHotbar(Number(slot));
      }}
    >
      <div className="hud-journal-header">
        <span className="hud-journal-title">Your pack</span>
        <span className="hud-journal-closehint">Drag onto a hotbar slot, or I to close</span>
      </div>

      {entries.length === 0 ? (
        <p className="inventory-empty">Nothing yet.</p>
      ) : (
        <div className="inventory-grid">
          {entries.map((entry) => {
            const kind = ITEM_KINDS[entry.item];
            return (
              <Tooltip
                key={entry.item}
                label={
                  <>
                    <strong>{kind.displayName}</strong>
                    {kind.equippable ? ' · click or drag to a hotbar slot' : null}
                  </>
                }
              >
                <div
                  className={
                    kind.equippable ? 'inventory-item inventory-item-usable' : 'inventory-item'
                  }
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData('text/plain', entry.item);
                  }}
                  onClick={() => onUseItem(entry.item)}
                >
                  <ItemIcon
                    item={entry.item}
                    color={colorOf(kind.placeholderColor)}
                    className="inventory-item-icon"
                  />
                  <span className="inventory-item-name">{kind.displayName}</span>
                  {kind.maxCarry > 1 ? (
                    <span className="inventory-item-count">{entry.count}</span>
                  ) : null}
                </div>
              </Tooltip>
            );
          })}
        </div>
      )}
    </div>
  );
}
