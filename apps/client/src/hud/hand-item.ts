import { isWeapon, type ItemId, type WornGear } from '@acorn/shared';

/**
 * What the character screen shows in the main hand, and whether it is only
 * held rather than worn there. A tool or weapon chosen from the hotbar (the
 * axe, the rod, the shovel) is what the hand holds, so it appears in the main
 * hand slot; with none chosen, it is whatever is worn there.
 */
export function handItemFor(
  held: ItemId | null,
  worn: Readonly<WornGear>,
): { readonly item: ItemId | null; readonly fromHotbar: boolean } {
  const item = held !== null && isWeapon(held) ? held : (worn.mainHand ?? null);
  return { item, fromHotbar: item !== null && item !== worn.mainHand };
}
