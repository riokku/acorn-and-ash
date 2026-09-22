/**
 * The item table.
 *
 * Content lives in typed data tables, not scattered through code, so adding a
 * new thing to carry means adding a row here.
 */

export type ItemId = 'axe' | 'log' | 'rod' | 'perch' | 'trout' | 'goldenCarp';

export interface ItemKind {
  readonly id: ItemId;
  readonly displayName: string;
  /** What more than one is called: logs, but two trout and not two trouts. */
  readonly pluralName: string;
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
    pluralName: 'Axes',
    maxCarry: 1,
    placeholderColor: 0x9a7b4f,
  },
  log: {
    id: 'log',
    displayName: 'Log',
    pluralName: 'Logs',
    maxCarry: 10,
    placeholderColor: 0x8c6239,
  },
  rod: {
    id: 'rod',
    displayName: 'Fishing rod',
    pluralName: 'Fishing rods',
    maxCarry: 1,
    placeholderColor: 0xb89a5e,
  },
  perch: {
    id: 'perch',
    displayName: 'Perch',
    pluralName: 'Perch',
    maxCarry: 10,
    placeholderColor: 0x8fa35a,
  },
  trout: {
    id: 'trout',
    displayName: 'Trout',
    pluralName: 'Trout',
    maxCarry: 10,
    placeholderColor: 0xc98f86,
  },
  goldenCarp: {
    id: 'goldenCarp',
    displayName: 'Golden carp',
    pluralName: 'Golden carp',
    maxCarry: 10,
    placeholderColor: 0xe8b53a,
  },
} as const satisfies Record<ItemId, ItemKind>;

/**
 * A stable order, so an item can be sent over the wire as a small number.
 *
 * Only ever add to the end. Packs are saved by these numbers, so reordering
 * would turn somebody's logs into fish.
 */
export const ITEM_ORDER: readonly ItemId[] = ['axe', 'log', 'rod', 'perch', 'trout', 'goldenCarp'];

export function itemIndex(id: ItemId): number {
  const index = ITEM_ORDER.indexOf(id);
  if (index < 0) throw new Error(`Unknown item: ${id}`);
  return index;
}

export function itemFromIndex(index: number): ItemId | null {
  return ITEM_ORDER[index] ?? null;
}
