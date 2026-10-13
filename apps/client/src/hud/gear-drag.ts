import { useSyncExternalStore } from 'react';

import { canWearIn, type GearSlot, type ItemId } from '@acorn/shared';

/**
 * The piece of gear being dragged right now, if any. A browser keeps what is
 * being dragged secret from everything it passes over until the drop, so the
 * pack (or a worn slot) says it here and the slots can light up while it moves.
 */
let dragged: ItemId | null = null;
const listeners = new Set<() => void>();
const DRAG_CAPTURE = { capture: true };
let stopCurrentDrag: (() => void) | null = null;

export function getDraggedGear(): ItemId | null {
  return dragged;
}
export function cancelGearDrag(): void {
  stopCurrentDrag?.();
}

function set(next: ItemId | null): void {
  if (dragged === next) return;
  dragged = next;
  for (const listener of listeners) listener();
}

/** Call from a drag start. Clears itself when the drag ends or drops anywhere. */
export function startGearDrag(item: ItemId): void {
  cancelGearDrag();
  set(item);
  // The pack slot may vanish mid-drag (the piece gets worn), and then it never
  // hears its own dragend - so listen on the window as well.
  const stop = (): void => {
    set(null);
    window.removeEventListener('dragend', stop, DRAG_CAPTURE);
    window.removeEventListener('drop', stop, DRAG_CAPTURE);
    window.removeEventListener('blur', stop);
    window.removeEventListener('keydown', escape, DRAG_CAPTURE);
    stopCurrentDrag = null;
  };
  const escape = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    // Leave the browser's native drag cancellation intact.
    event.stopPropagation();
    stop();
  };
  stopCurrentDrag = stop;
  window.addEventListener('blur', stop);
  window.addEventListener('keydown', escape, DRAG_CAPTURE);
  window.addEventListener('dragend', stop, DRAG_CAPTURE);
  window.addEventListener('drop', stop, DRAG_CAPTURE);
}

export function useDraggedGear(): ItemId | null {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, getDraggedGear);
}

/** Whether a slot should glow for the piece being dragged: it is the kind that fits there. */
export function fitsDraggedGear(item: ItemId | null, slot: GearSlot): boolean {
  return item !== null && canWearIn(item, slot);
}
