import { cookedItemFor, isFood, type ItemId } from '@acorn/shared';
import { ITEM_KINDS } from '../item-catalog';

/** Only describe a confirmed change; arrival and repeated broadcasts stay quiet. */
export function handSelectionText(
  before: ItemId | null | undefined,
  after: ItemId | null,
): string | null {
  if (before === undefined || before === after) return null;
  if (after === null) return 'Hands free.';
  const name = ITEM_KINDS[after].displayName;
  if (isFood(after))
    return `Holding ${name} · select again to eat${cookedItemFor(after) === null ? '.' : ', or press E at a lit fire to cook.'}`;
  return `Holding ${name}.`;
}

/** Repeated taps while a selection is in flight must not become an accidental meal. */
export class HandSelection {
  private pending: ItemId | null = null;
  private until = 0;
  begin(item: ItemId, now: number): boolean {
    if (this.pending === item && now < this.until) return false;
    this.pending = item;
    this.until = now + 3000;
    return true;
  }
  confirm(item: ItemId | null): void {
    if (item === this.pending) this.clear();
  }
  clear(): void {
    this.pending = null;
    this.until = 0;
  }
}
