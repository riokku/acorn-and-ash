import { createRng, hashSeed } from '../rng';
import type { ItemId } from '../data/items';
import { FISH_SPECIES } from '../data/fish';

export interface FishRecords {
  counts: number[];
  bestCm: number[];
  displays: number;
}
export function fishRecordsFromSaved(value: unknown): FishRecords {
  const state = value as Partial<FishRecords> | null;
  const clean = (values: unknown, max: number) =>
    Array.from({ length: 3 }, (_, i) => {
      const v = Array.isArray(values) ? values[i] : undefined;
      return Number.isInteger(v) && v >= 0 && v <= max ? (v as number) : 0;
    });
  const counts = clean(state?.counts, 0xffffffff),
    bestCm = clean(state?.bestCm, 80);
  // Recipes derive from earned records; a corrupt flag cannot grant a recipe.
  return {
    counts,
    bestCm,
    displays:
      (counts.reduce((a, b) => a + b, 0) >= 5 ? 1 : 0) | (counts.every((c) => c > 0) ? 2 : 0),
  };
}
export function recordFish(
  state: FishRecords,
  item: ItemId,
  seed: number,
  cast: number,
  tick: number,
): number {
  const i = FISH_SPECIES.findIndex((s) => s.item === item),
    species = FISH_SPECIES[i];
  if (!species) return 0;
  const cm = Math.floor(
    createRng(hashSeed('fish-size', seed, cast, tick)).nextRange(species.minCm, species.maxCm + 1),
  );
  state.counts[i] = Math.min(0xffffffff, (state.counts[i] ?? 0) + 1);
  state.bestCm[i] = Math.max(state.bestCm[i] ?? 0, cm);
  state.displays = fishRecordsFromSaved(state).displays;
  return cm;
}

export function fishDisplayLearned(kind: string, state: FishRecords): boolean {
  return kind === 'fishDisplay'
    ? (state.displays & 1) !== 0
    : kind === 'goldenFishDisplay'
      ? (state.displays & 2) !== 0
      : true;
}
