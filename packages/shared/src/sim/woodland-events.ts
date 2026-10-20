import { hashSeed, createRng } from '../rng';
import { DAYS_PER_YEAR, type Calendar } from './seasons';
import type { DiscoverySite } from '../data/discoveries';
import type { GatherPatchView } from './gathering';

/** Reserved after mountain patches (210–239); patch IDs remain one byte. */
export const MUSHROOM_FLUSH_IDS = [240, 241, 242] as const;
export const isMushroomFlush = (id: number): boolean =>
  MUSHROOM_FLUSH_IDS.some((candidate) => candidate === id);
export function woodlandDay(calendar: Calendar): number {
  return (calendar.year - 1) * DAYS_PER_YEAR + calendar.dayOfYear + 1;
}
/** Two full game days per damp season. No countdown or exclusive reward. */
export function mushroomFlushSite(
  seed: number,
  calendar: Calendar,
  sites: readonly DiscoverySite[],
) {
  if (!['spring', 'autumn'].includes(calendar.season) || ![2, 5].includes(calendar.dayOfSeason))
    return null;
  const candidates = sites.filter((site) => site.kind === 'camp' || site.kind === 'grove');
  return (
    candidates[hashSeed(seed, 'mushroom-flush', woodlandDay(calendar)) % candidates.length] ?? null
  );
}
export function mushroomFlushSpot(
  seed: number,
  day: number,
  id: number,
  site: { x: number; z: number },
  clear: (x: number, z: number) => boolean,
) {
  const rng = createRng(hashSeed(seed, 'mushroom-flush-spot', day, id));
  for (let attempt = 0; attempt < 64; attempt++) {
    const angle = rng.nextRange(0, Math.PI * 2),
      radius = rng.nextRange(4, 11);
    const x = site.x + Math.cos(angle) * radius,
      z = site.z + Math.sin(angle) * radius;
    if (clear(x, z)) return { x, z };
  }
  return null;
}
export function mushroomFlushHint(
  patches: readonly GatherPatchView[],
  x: number,
  z: number,
): string | null {
  return patches.some(
    (p) => isMushroomFlush(p.id) && p.remaining > 0 && Math.hypot(p.x - x, p.z - z) < 12,
  )
    ? 'A mushroom flush! Fresh clusters are growing here today. Gather some for the cooking pot.'
    : null;
}
