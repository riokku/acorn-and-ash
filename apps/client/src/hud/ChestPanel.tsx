import { useEffect, useRef } from 'react';
import {
  CHEST_SLOTS,
  CHEST_BUILDING_SUPPLIES,
  ITEM_KINDS,
  inventoryFromEntries,
  packSlots,
  packStacks,
  slotsUsed,
  type ChestSlot,
  type ChestRequest,
  type ItemId,
} from '@acorn/shared';
import { ItemIcon } from './item-icons';
import { Tooltip } from './Tooltip';
import { itemDescription } from './item-description';

export function ChestPanel({
  slots,
  carrying,
  pending,
  note,
  onTransfer,
  onClose,
}: {
  slots: readonly ChestSlot[];
  carrying: readonly { item: ItemId; count: number }[];
  pending: boolean;
  note: string | null;
  onTransfer: (request: ChestRequest) => void;
  onClose: () => void;
}): React.JSX.Element {
  const close = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    close.current?.focus();
  }, []);
  useEffect(() => {
    if (!pending && panel.current !== null && !panel.current.contains(document.activeElement))
      close.current?.focus();
  }, [pending, slots]);
  const inventory = inventoryFromEntries(carrying);
  const pack = packStacks(inventory);
  const used = slots.filter((slot) => slot !== null).length;
  return (
    <div className="chest-scrim" onClick={onClose}>
      <div
        ref={panel}
        className="chest-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chest-title"
        data-testid="chest-panel"
        onClick={(event) => event.stopPropagation()}
        onContextMenu={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          if (event.key !== 'Tab') return;
          const buttons = [
            ...(panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []),
          ];
          const first = buttons[0],
            last = buttons[buttons.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <header>
          <div>
            <span className="chest-eyebrow">A place for your treasures</span>
            <h2 id="chest-title">Storage chest</h2>
          </div>
          <button
            ref={close}
            type="button"
            className="chest-close"
            onClick={onClose}
            aria-label="Close storage chest"
          >
            ×
          </button>
        </header>
        <p className="chest-help">
          Click a stack to move it. Shift-click moves one. Only you can open this chest.
        </p>
        <button
          type="button"
          className="chest-store-supplies"
          disabled={pending || !CHEST_BUILDING_SUPPLIES.some((item) => (inventory[item] ?? 0) > 0)}
          onClick={() => onTransfer({ action: 'storeSupplies' })}
        >
          Store building supplies
        </button>
        <p className="chest-help">
          Keeps tools, food, blueprints and trophies in your pack. Stored building supplies count
          toward home upgrades.
        </p>
        <div className="chest-columns">
          <section>
            <h3>
              Your pack{' '}
              <span>
                {slotsUsed(inventory)}/{packSlots(inventory)}
              </span>
            </h3>
            <div className="chest-grid">
              {Array.from({ length: Math.max(packSlots(inventory), pack.length) }, (_, i) => {
                const stack = pack[i] ?? null;
                return (
                  <StorageSlot
                    key={i}
                    stack={stack}
                    index={i}
                    testId={`chest-deposit-${i}`}
                    disabled={pending}
                    action="Store"
                    onMove={(one) => {
                      if (stack !== null)
                        onTransfer({
                          action: 'deposit',
                          item: stack.item,
                          amount: one ? 1 : stack.count,
                        });
                    }}
                  />
                );
              })}
            </div>
          </section>
          <section>
            <h3>
              Your chest{' '}
              <span>
                {used}/{CHEST_SLOTS}
              </span>
            </h3>
            <div className="chest-grid">
              {slots.map((stack, i) => (
                <StorageSlot
                  key={i}
                  stack={stack}
                  index={i}
                  testId={`chest-withdraw-${i}`}
                  disabled={pending}
                  action="Take"
                  onMove={(one) => {
                    if (stack !== null)
                      onTransfer({ action: 'withdraw', slot: i, amount: one ? 1 : stack.count });
                  }}
                />
              ))}
            </div>
          </section>
        </div>
        <p className="chest-note" role="status" aria-live="polite">
          {pending
            ? 'Moving your items…'
            : (note ?? 'Your belongings are saved here between visits.')}
        </p>
      </div>
    </div>
  );
}
function StorageSlot({
  stack,
  index,
  testId,
  disabled,
  action,
  onMove,
}: {
  stack: ChestSlot;
  index: number;
  testId: string;
  disabled: boolean;
  action: string;
  onMove: (one: boolean) => void;
}): React.JSX.Element {
  if (stack === null)
    return (
      <div
        className="storage-slot storage-slot-empty"
        data-testid={testId}
        aria-label={`Empty slot ${index + 1}`}
      >
        <span>·</span>
      </div>
    );
  const kind = ITEM_KINDS[stack.item];
  return (
    <Tooltip
      label={
        <>
          <strong>{kind.displayName}</strong>
          <br />
          {itemDescription(stack.item)}
          <br />
          {action} stack · Shift-click for one
        </>
      }
    >
      <button
        type="button"
        className="storage-slot"
        data-testid={testId}
        disabled={disabled}
        aria-label={`${action} ${stack.count} ${kind.displayName}`}
        onClick={(event) => onMove(event.shiftKey)}
      >
        <ItemIcon
          item={stack.item}
          color={`#${kind.placeholderColor.toString(16).padStart(6, '0')}`}
          className="storage-slot-icon"
        />
        <span className="storage-slot-count">{stack.count}</span>
      </button>
    </Tooltip>
  );
}
