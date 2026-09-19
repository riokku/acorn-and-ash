/**
 * The item table.
 *
 * Content lives in typed data tables, not scattered through code, so adding a
 * new thing to carry means adding a row here.
 */

export type ItemId = 'axe' | 'log';

export interface ItemKind {
  readonly id: ItemId;
  readonly displayName: string;
  /**
   * The most of this one player can carry.
   *
   * The limit is per kind rather than a shared bag of slots, so carrying the axe
   * never costs you room for logs.
   */
  readonly maxCarry: number;
  /** Placeholder colour, as 0xRRGGBB. */
  readonly placeholderColor: number;
}

export const ITEM_KINDS = {
  axe: {
    id: 'axe',
    displayName: 'Axe',
    maxCarry: 1,
    placeholderColor: 0x9a7b4f,
  },
  log: {
    id: 'log',
    displayName: 'Log',
    maxCarry: 10,
    placeholderColor: 0x8c6239,
  },
} as const satisfies Record<ItemId, ItemKind>;

/** A stable order, so an item can be sent over the wire as a small number. */
export const ITEM_ORDER: readonly ItemId[] = ['axe', 'log'];

export function itemIndex(id: ItemId): number {
  const index = ITEM_ORDER.indexOf(id);
  if (index < 0) throw new Error(`Unknown item: ${id}`);
  return index;
}

export function itemFromIndex(index: number): ItemId | null {
  return ITEM_ORDER[index] ?? null;
}
