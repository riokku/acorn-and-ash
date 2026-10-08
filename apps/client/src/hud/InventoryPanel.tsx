import {
  ITEM_KINDS,
  PACK_ITEMS,
  hasItem,
  inventoryFromEntries,
  packSlots,
  packStacks,
  slotsUsed,
  blueprintHome,
  isGear,
  type GearSlot,
  type Inventory,
  type ItemId,
} from '@acorn/shared';

import { GEAR_ITEM_DRAG_TYPE, GEAR_SLOT_DRAG_TYPE } from './CharacterPanel';
import { ItemIcon } from './item-icons';
import { Tooltip } from './Tooltip';
import { itemDescription, itemUseHint } from './item-description';

/**
 * A slot right-clicked to drop or destroy what is in it: what, how many -
 * that stack, or everything a hotbar slot stands for - and where the click
 * was, for the menu to open beside it (see decision 0061).
 */
export interface SlotMenuTarget {
  readonly item: ItemId;
  readonly count: number;
  readonly x: number;
  readonly y: number;
}

/** The custom drag type a hotbar slot sets on itself, so dropping it back here can unpin it. */
export const HOTBAR_SLOT_DRAG_TYPE = 'application/x-acorn-hotbar-slot';

/** The ring drawn around the bag button: one arc per slot, a small gap between each. */
const RING_RADIUS = 29;
const RING_BOX = 62;
const RING_GAP = 3;

type CarriedEntries = readonly { readonly item: ItemId; readonly count: number }[];

/** A 0xRRGGBB placeholder colour, as a CSS colour string - the same helper Hud.tsx keeps of its own. */
function colorOf(placeholderColor: number): string {
  return `#${placeholderColor.toString(16).padStart(6, '0')}`;
}

/** How many slots are taken and how many there are - what both the button and the panel show. */
function packRoom(carrying: CarriedEntries): { pack: Inventory; used: number; slots: number } {
  const pack = inventoryFromEntries(carrying);
  return { pack, used: slotsUsed(pack), slots: packSlots(pack) };
}

/**
 * The bag button at the end of the hotbar, which opens or closes the pack -
 * the mouse-first way in, alongside the `I` key. Its ring has one segment
 * per slot, filled for each one in use, so how full the pack is can be read
 * without opening it (see decision 0060).
 */
export function PackButton({
  carrying,
  open,
  onToggle,
}: {
  carrying: CarriedEntries;
  open: boolean;
  onToggle: () => void;
}): React.JSX.Element {
  const { used, slots } = packRoom(carrying);
  const full = used >= slots;
  const classes = ['pack-button'];
  if (open) classes.push('pack-button-open');
  if (full) classes.push('pack-button-full');

  return (
    <Tooltip
      label={
        <>
          <strong>Your pack</strong> · {used} of {slots} slots · I
        </>
      }
    >
      <button
        type="button"
        className={classes.join(' ')}
        aria-label={`${open ? 'Close' : 'Open'} your pack, ${used} of ${slots} slots used`}
        onClick={onToggle}
      >
        <SlotRing used={used} slots={slots} />
        <span className="hotbar-slot-key">I</span>
        <ItemIcon
          item="bag"
          color={colorOf(ITEM_KINDS.bag.placeholderColor)}
          className="hotbar-slot-icon"
        />
        <span className="pack-button-count">
          {used}/{slots}
        </span>
      </button>
    </Tooltip>
  );
}

/** One arc per slot around the bag button, the first `used` of them filled. */
function SlotRing({ used, slots }: { used: number; slots: number }): React.JSX.Element {
  const circumference = 2 * Math.PI * RING_RADIUS;
  const segment = circumference / slots;
  const dash = Math.max(1, segment - RING_GAP);
  const centre = RING_BOX / 2;

  return (
    <svg
      className="pack-ring"
      width={RING_BOX}
      height={RING_BOX}
      viewBox={`0 0 ${RING_BOX} ${RING_BOX}`}
      aria-hidden="true"
    >
      {Array.from({ length: slots }, (_, index) => (
        <circle
          key={index}
          className={index < used ? 'pack-ring-filled' : 'pack-ring-empty'}
          cx={centre}
          cy={centre}
          r={RING_RADIUS}
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeDashoffset={-index * segment}
        />
      ))}
    </svg>
  );
}

/**
 * The pack, opened: one square per slot, filled ones showing their stack and
 * empty ones left dashed, under a meter of how many are in use - see
 * decision 0060. Each stack can be dragged onto a hotbar slot to pin it
 * there, and dropping a hotbar slot back here unpins it, read off the same
 * custom drag type the hotbar slot itself sets on the way out.
 */
export function InventoryPanel({
  open,
  carrying,
  equippedItem,
  onUseItem,
  onUnpinFromHotbar,
  onOpenSlotMenu,
  beside = false,
  onWearGear,
  onTakeOffGear,
}: {
  open: boolean;
  carrying: CarriedEntries;
  equippedItem: ItemId | null;
  onUseItem: (item: ItemId) => void;
  onUnpinFromHotbar: (slotIndex: number) => void;
  onOpenSlotMenu: (target: SlotMenuTarget) => void;
  /** Whether the character screen is open on its left, so the pack steps aside for it. */
  beside?: boolean;
  /** Right-click on a piece of gear: wear it in the slot it fits. */
  onWearGear?: (item: ItemId) => void;
  /** A worn piece dropped back on the pack: take it off. */
  onTakeOffGear?: (slot: GearSlot) => void;
}): React.JSX.Element | null {
  if (!open) return null;

  const { pack, used, slots } = packRoom(carrying);
  const stacks = packStacks(pack);
  const emptySlots = Math.max(0, slots - stacks.length);

  return (
    <div
      className={beside ? 'inventory-panel inventory-panel-beside' : 'inventory-panel'}
      onDragOver={(event) => {
        const types = event.dataTransfer.types;
        if (types.includes(HOTBAR_SLOT_DRAG_TYPE) || types.includes(GEAR_SLOT_DRAG_TYPE)) {
          event.preventDefault();
        }
      }}
      onDrop={(event) => {
        const worn = event.dataTransfer.getData(GEAR_SLOT_DRAG_TYPE);
        if (worn !== '') {
          event.preventDefault();
          onTakeOffGear?.(worn as GearSlot);
          return;
        }
        const slot = event.dataTransfer.getData(HOTBAR_SLOT_DRAG_TYPE);
        if (slot === '') return;
        onUnpinFromHotbar(Number(slot));
      }}
    >
      <div className="hud-journal-header">
        <span className="inventory-title">
          <ItemIcon
            item="bag"
            color={colorOf(ITEM_KINDS.bag.placeholderColor)}
            className="inventory-title-icon"
          />
          <span className="hud-journal-title">Your pack</span>
        </span>
        <span className="hud-journal-closehint">
          Drag onto a hotbar slot · right-click to drop · B to close
        </span>
      </div>

      <div className="inventory-meter">
        <div
          className="inventory-meter-segments"
          style={{ gridTemplateColumns: `repeat(${slots}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: slots }, (_, index) => (
            <span
              key={index}
              className={
                index < used ? 'inventory-meter-segment-filled' : 'inventory-meter-segment'
              }
            />
          ))}
        </div>
        <span className="inventory-meter-label">
          {used} of {slots} slots
        </span>
      </div>

      <div className="inventory-grid">
        {stacks.map((stack, index) => (
          <PackSlot
            key={`${stack.item}-${index}`}
            item={stack.item}
            count={stack.count}
            equipped={stack.item === equippedItem}
            onUseItem={onUseItem}
            onOpenSlotMenu={onOpenSlotMenu}
            onWearGear={onWearGear}
          />
        ))}
        {Array.from({ length: emptySlots }, (_, index) => (
          <div key={`empty-${index}`} className="inventory-slot-empty" />
        ))}
      </div>

      <p className="inventory-footnote">{footnote(pack)}</p>
    </div>
  );
}

/** One filled slot: an icon, a name, and how many are in this stack, if it can hold more than one. */
function PackSlot({
  item,
  count,
  equipped,
  onUseItem,
  onOpenSlotMenu,
  onWearGear,
}: {
  item: ItemId;
  count: number;
  equipped: boolean;
  onUseItem: (item: ItemId) => void;
  onOpenSlotMenu: (target: SlotMenuTarget) => void;
  onWearGear?: (item: ItemId) => void;
}): React.JSX.Element {
  const kind = ITEM_KINDS[item];
  const classes = ['inventory-item'];
  if (kind.equippable || blueprintHome(item) !== null) classes.push('inventory-item-usable');
  if (equipped) classes.push('inventory-item-equipped');

  return (
    <Tooltip
      label={
        <>
          <strong>{kind.displayName}</strong>
          <span className="item-tooltip-detail">{itemDescription(item)}</span>
          <span className="item-tooltip-action">{itemUseHint(item)}</span>
        </>
      }
    >
      <div
        className={classes.join(' ')}
        draggable
        onDragStart={(event) => {
          event.dataTransfer.setData('text/plain', item);
          if (isGear(item)) event.dataTransfer.setData(GEAR_ITEM_DRAG_TYPE, item);
        }}
        role="button"
        tabIndex={0}
        aria-label={`${kind.displayName}, ${count}. ${itemDescription(item)}`}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (kind.equippable || blueprintHome(item) !== null) onUseItem(item);
          }
        }}
        onClick={() => {
          if (kind.equippable || blueprintHome(item) !== null) onUseItem(item);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          // Gear goes on with a right-click; Shift keeps the drop menu within reach.
          if (isGear(item) && !event.shiftKey && onWearGear !== undefined) onWearGear(item);
          else onOpenSlotMenu({ item, count, x: event.clientX, y: event.clientY });
        }}
        data-testid={`pack-slot-${item}`}
      >
        {kind.stackSize > 1 ? <span className="inventory-item-count">{count}</span> : null}
        <ItemIcon
          item={item}
          color={colorOf(kind.placeholderColor)}
          className="inventory-item-icon"
        />
        <span className="inventory-item-name">
          {count === 1 ? kind.displayName : kind.pluralName}
        </span>
      </div>
    </Tooltip>
  );
}

/**
 * The line under the slots: what a slot holds, and what the bag does for
 * them - either the slots it is already adding, or the ones it would.
 */
function footnote(pack: Inventory): string {
  const rule = 'A slot holds up to 10 of one thing. Tools take a slot each.';
  const carried = PACK_ITEMS.find((item) => hasItem(pack, item));
  if (carried !== undefined) {
    const kind = ITEM_KINDS[carried];
    return `${rule} Your ${kind.displayName.toLowerCase()} adds ${kind.extraSlots ?? 0}.`;
  }
  const findable = PACK_ITEMS[0];
  if (findable === undefined) return rule;
  const kind = ITEM_KINDS[findable];
  return `${rule} Find a ${kind.displayName.toLowerCase()} for ${kind.extraSlots ?? 0} more.`;
}
