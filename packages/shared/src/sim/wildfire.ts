import { hashSeed } from '../rng';

export const FIRE_LIMIT = 32;
export const FIRE_SPREAD_METRES = 5;
export const FIRE_SPREAD_SECONDS = 12;
export const FIRE_TREE_SECONDS = 55;
export const FIRE_BUILDING_SECONDS = 90;
export const LIGHTNING_INTERVAL_MS = 18_000;
export interface FireTarget {
  readonly id: number;
  readonly kind: 'tree' | 'building';
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly height: number;
  readonly radius: number;
}
export interface Wildfire extends FireTarget {
  readonly startedAt: number;
  readonly generation: number;
  spread: boolean;
}
export interface LightningStrike {
  readonly serial: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}
export interface WildfireView {
  readonly testWeather?: 'storm' | 'blizzard' | null;
  readonly fires: readonly Wildfire[];
  readonly lightning: LightningStrike | null;
  readonly now: number;
}
export const fireKey = (target: Pick<FireTarget, 'kind' | 'id'>): string =>
  `${target.kind}:${target.id}`;
export const fireLifetime = (target: FireTarget): number =>
  target.kind === 'tree' ? FIRE_TREE_SECONDS : FIRE_BUILDING_SECONDS;

/** Bounded, deterministic fire fronts. Spread happens once per tree, never every frame. */
export class WildfireSimulation {
  readonly fires = new Map<string, Wildfire>();
  lightning: LightningStrike | null = null;
  lastStrike = -1;
  ignite(target: FireTarget, now: number, generation = 0): boolean {
    const key = fireKey(target);
    if (this.fires.has(key) || this.fires.size >= FIRE_LIMIT) return false;
    this.fires.set(key, { ...target, startedAt: now, generation, spread: false });
    return true;
  }
  advance(seed: number, now: number, targets: readonly FireTarget[]): FireTarget[] {
    const available = new Map(targets.map((target) => [fireKey(target), target]));
    const burned: FireTarget[] = [];
    for (const [key, fire] of [...this.fires]) {
      if (!available.has(key)) {
        this.fires.delete(key);
        continue;
      }
      const age = (now - fire.startedAt) / 1000;
      if (age >= fireLifetime(fire)) {
        burned.push(fire);
        available.delete(key);
        this.fires.delete(key);
        continue;
      }
      if (age < FIRE_SPREAD_SECONDS || fire.spread) continue;
      fire.spread = true;
      if (fire.generation >= 3) continue;
      for (const target of targets) {
        if (fireKey(target) === key || !available.has(fireKey(target))) continue;
        const reach = FIRE_SPREAD_METRES + (target.kind === 'building' ? target.radius : 0);
        if (Math.hypot(target.x - fire.x, target.z - fire.z) > reach) continue;
        if (hashSeed('fire-spread', seed, fire.id, target.id, fire.startedAt) % 100 >= 65) continue;
        this.ignite(target, now, fire.generation + 1);
      }
    }
    return burned;
  }
  view(now: number): WildfireView {
    return { fires: [...this.fires.values()], lightning: this.lightning, now };
  }
  save(): string {
    return JSON.stringify({ fires: [...this.fires.values()], lastStrike: this.lastStrike });
  }
  restore(saved: string, targets: readonly FireTarget[]): void {
    try {
      const data = JSON.parse(saved) as { fires?: Wildfire[]; lastStrike?: number };
      const available = new Map(targets.map((target) => [fireKey(target), target]));
      if (Number.isSafeInteger(data.lastStrike)) this.lastStrike = data.lastStrike!;
      for (const fire of (Array.isArray(data.fires) ? data.fires : []).slice(0, FIRE_LIMIT)) {
        const target = available.get(fireKey(fire));
        if (
          !target ||
          !Number.isFinite(fire.startedAt) ||
          fire.startedAt < 0 ||
          !Number.isInteger(fire.generation) ||
          fire.generation < 0 ||
          fire.generation > 3
        )
          continue;
        this.fires.set(fireKey(target), {
          ...target,
          startedAt: fire.startedAt,
          generation: fire.generation,
          spread: fire.spread === true,
        });
      }
    } catch {
      /* Old or malformed saved weather starts without an active fire. */
    }
  }
}
