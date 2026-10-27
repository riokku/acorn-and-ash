import type { ItemId } from '@acorn/shared';

export interface HomecomingSummary {
  readonly id: number;
  readonly gathered: readonly { item: ItemId; count: number }[];
  readonly discoveries: number;
}

/** Session-only memories, from confirmed outdoor collections rather than pack transfers. */
export class Homecoming {
  private gathered = new Map<ItemId, number>();
  private discoveries = 0;
  private nextId = 1;

  collect(item: ItemId, count: number): void {
    if (!Number.isFinite(count) || count <= 0) return;
    this.gathered.set(item, (this.gathered.get(item) ?? 0) + count);
  }
  discover(): void {
    this.discoveries++;
  }
  arrive(): HomecomingSummary | null {
    const gathered = [...this.gathered].map(([item, count]) => ({ item, count }));
    const discoveries = this.discoveries;
    this.clear();
    if (gathered.length === 0 && discoveries === 0) return null;
    return { id: this.nextId++, gathered, discoveries };
  }
  clear(): void {
    this.gathered.clear();
    this.discoveries = 0;
  }
}
