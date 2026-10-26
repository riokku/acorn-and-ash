import { countOf, inventoryFromEntries, recipeFor } from '@acorn/shared';
import type { HudState } from './store';
export function cedarHuntProgress(state: Pick<HudState, 'carrying' | 'worn'>) {
  const pack = inventoryFromEntries(state.carrying);
  const equipped = state.worn.upperBody === 'cedarstalkerCoat';
  const crafted = equipped || countOf(pack, 'cedarstalkerCoat') > 0;
  const ingredients = recipeFor('cedarstalkerCoat')!.costs.map((cost) => ({
    ...cost,
    have: countOf(pack, cost.item),
  }));
  const ready = ingredients.every((cost) => cost.have >= cost.amount);
  const next = equipped
    ? 'Quiet step active · your next hunt awaits'
    : crafted
      ? 'Coat ready · wear it from the character screen (Z)'
      : countOf(pack, 'cedarHide') === 0
        ? 'Follow broad hoofprints northwest beyond the elk grove'
        : ready
          ? 'Materials ready · stitch your coat in C → Gear'
          : 'Hide secured · gather reeds and twist two rope';
  return { equipped, crafted, ready, ingredients, next };
}
const key = (world: string) => `acorn.cedarHunt.${world}`;
export function readCedarHuntPin(storage: Pick<Storage, 'getItem'>, world: string): boolean {
  try {
    return storage.getItem(key(world)) === 'pinned';
  } catch {
    return false;
  }
}
export function writeCedarHuntPin(
  storage: Pick<Storage, 'setItem'>,
  world: string,
  pinned: boolean,
): void {
  try {
    storage.setItem(key(world), pinned ? 'pinned' : '');
  } catch {
    /* A cosmetic goal still works with storage disabled. */
  }
}
