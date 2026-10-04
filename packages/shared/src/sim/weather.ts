import { createRng, hashSeed } from '../rng';

/** A shared, wall-clock forest forecast, like the existing day/night clock. */
export const WEATHER_CYCLE_MS = 30 * 60_000;
export type WeatherKind = 'clear' | 'drizzle' | 'rain' | 'storm';
export interface ForestWeather {
  readonly kind: WeatherKind;
  readonly cycle: number;
  readonly precipitation: number;
  readonly wind: number;
  readonly mushroomsAbundant: boolean;
}
export function weatherPlan(seed: number, cycle: number) {
  const rng = createRng(hashSeed('forest-weather', seed, cycle));
  const storm = rng.nextInt(4) === 0;
  const stormMs = storm ? rng.nextRange(60_000, 120_000) : 0;
  const rainMs = rng.nextRange(180_000, 300_000);
  const rainEnds = WEATHER_CYCLE_MS - stormMs;
  return { storm, stormMs, rainStarts: rainEnds - rainMs, rainEnds };
}
export function forestWeather(seed: number, nowMs: number): ForestWeather {
  const cycle = Math.floor(nowMs / WEATHER_CYCLE_MS);
  const phase = nowMs - cycle * WEATHER_CYCLE_MS;
  const plan = weatherPlan(seed, cycle);
  const kind: WeatherKind =
    phase >= plan.rainEnds && plan.storm
      ? 'storm'
      : phase >= plan.rainStarts
        ? 'rain'
        : phase >= plan.rainStarts - 360_000
          ? 'drizzle'
          : 'clear';
  const previous = weatherPlan(seed, cycle - 1);
  const mushroomsAbundant =
    phase >= plan.rainStarts || phase + WEATHER_CYCLE_MS - previous.rainEnds < 360_000;
  return {
    kind,
    cycle,
    precipitation: { clear: 0, drizzle: 0.18, rain: 0.6, storm: 1 }[kind],
    wind: { clear: 0.15, drizzle: 0.25, rain: 0.45, storm: 0.85 }[kind],
    mushroomsAbundant,
  };
}
