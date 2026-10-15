import { ITEM_KINDS } from '../item-catalog';
import { type ItemId, type CraftRefusal } from '@acorn/shared';

/** One authoritative result at a time; slow replies never trigger automatic retries. */
export class CraftFeedback {
  private request: { item: ItemId; sentAt: number } | null = null;
  get item(): ItemId | null {
    return this.request?.item ?? null;
  }
  begin(item: ItemId, now: number): boolean {
    if (this.request !== null) return false;
    this.request = { item, sentAt: now };
    return true;
  }
  settle(item: ItemId): boolean {
    if (this.item !== item) return false;
    this.request = null;
    return true;
  }
  clear(): boolean {
    const pending = this.request !== null;
    this.request = null;
    return pending;
  }
  text(now: number): string | null {
    if (this.request === null) return null;
    const name = ITEM_KINDS[this.request.item].displayName;
    return now - this.request.sentAt >= 8000
      ? `Still waiting for ${name.toLowerCase()}. Check your connection.`
      : `Making ${name.toLowerCase()}… Waiting for confirmation.`;
  }
}

export function craftRefusalText(reason: CraftRefusal): string {
  const labels: Record<CraftRefusal, string> = {
    unavailable: 'This item cannot be crafted right now.',
    recipe: 'Learn this recipe before crafting it.',
    materials: 'You need more materials to craft this.',
    alreadyOwned: 'You already carry one of these.',
    packFull: 'Make room in your pack before crafting this.',
    busy: 'Finish your current action before crafting this.',
    campfire: 'Move near a lit campfire to craft this.',
    workbench: 'Move near a workbench to craft this.',
  };
  return labels[reason];
}
