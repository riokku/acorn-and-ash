import { TICK_HZ } from '../constants';
import { addItem, countOf, removeItem, roomFor, type Inventory } from './inventory';

export const GARDEN_CROPS = ['berry', 'mushroom', 'flower'] as const;
export type GardenCrop = (typeof GARDEN_CROPS)[number];
export const GARDEN_PLOTS = 3;
export const GARDEN_GROW_TICKS = 10 * 60 * TICK_HZ;
export const GARDEN_YIELD = 3;
export interface GardenPlot {
  crop: GardenCrop | null;
  growTicks: number;
}
export type GardenRequest =
  | { action: 'inspect' }
  | { action: 'plant'; plot: number; crop: GardenCrop }
  | { action: 'harvest'; plot: number };
export const GARDEN_REASONS = [
  'unavailable',
  'private',
  'tooFar',
  'busy',
  'empty',
  'growing',
  'occupied',
  'packFull',
  'invalid',
] as const;
export type GardenReason = (typeof GARDEN_REASONS)[number];
export interface GardenState {
  readonly homeId: number;
  readonly yours: boolean;
  readonly plots: readonly GardenPlot[];
  readonly reason: GardenReason | null;
}
export function emptyGarden(): GardenPlot[] {
  return Array.from({ length: GARDEN_PLOTS }, () => ({ crop: null, growTicks: 0 }));
}
export function gardenFromSaved(value: unknown): GardenPlot[] | null {
  if (!Array.isArray(value) || value.length !== GARDEN_PLOTS) return null;
  const result: GardenPlot[] = [];
  for (const row of value) {
    if (typeof row !== 'object' || row === null) return null;
    const { crop, growTicks } = row as { crop?: unknown; growTicks?: unknown };
    if (crop !== null && !GARDEN_CROPS.includes(crop as GardenCrop)) return null;
    if (
      typeof growTicks !== 'number' ||
      !Number.isInteger(growTicks) ||
      growTicks < 0 ||
      growTicks > GARDEN_GROW_TICKS ||
      (crop === null && growTicks !== 0)
    )
      return null;
    result.push({ crop: crop as GardenCrop | null, growTicks });
  }
  return result;
}
/** Refuse a harvest in full; a ready plant never expires and never loses items. */
export function useGarden(
  plots: GardenPlot[],
  inventory: Inventory,
  request: GardenRequest,
): GardenReason | null {
  if (request.action === 'inspect') return null;
  if (!Number.isInteger(request.plot) || request.plot < 0 || request.plot >= GARDEN_PLOTS)
    return 'invalid';
  const plot = plots[request.plot];
  if (plot === undefined) return 'invalid';
  if (request.action === 'plant') {
    if (!GARDEN_CROPS.includes(request.crop)) return 'invalid';
    if (plot.crop !== null) return 'occupied';
    if (countOf(inventory, request.crop) < 1) return 'empty';
    removeItem(inventory, request.crop, 1);
    plot.crop = request.crop;
    plot.growTicks = GARDEN_GROW_TICKS;
    return null;
  }
  if (plot.crop === null) return 'empty';
  if (plot.growTicks > 0) return 'growing';
  if (roomFor(inventory, plot.crop) < GARDEN_YIELD) return 'packFull';
  addItem(inventory, plot.crop, GARDEN_YIELD);
  plot.crop = null;
  return null;
}
