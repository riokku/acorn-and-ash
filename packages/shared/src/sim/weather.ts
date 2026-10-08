import { createRng, hashSeed } from '../rng';
import { calendarAt, type Calendar } from './seasons';
import { DAY_LENGTH_MS } from './day-night';

/** A shared, wall-clock forest forecast, like the existing day/night clock. */
export const WEATHER_CYCLE_MS = 30 * 60_000;
export type WeatherKind = 'clear' | 'drizzle' | 'rain' | 'storm' | 'blizzard';
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
/** Half of winters have one three-day blizzard, wholly inside the six-day season. */
export const BLIZZARD_DURATION_MS = 3 * DAY_LENGTH_MS;
export const BLIZZARD_SPEED = 0.78;
export function blizzardPlan(seed: number, year: number) {
  const rng = createRng(hashSeed('winter-blizzard', seed, year));
  return { occurs: rng.nextInt(2) === 0, startDay: 1 + rng.nextInt(4) };
}
export function isBlizzard(seed: number, calendar: Calendar): boolean {
  const plan = blizzardPlan(seed, calendar.year);
  return (
    calendar.season === 'winter' &&
    plan.occurs &&
    calendar.dayOfSeason >= plan.startDay &&
    calendar.dayOfSeason < plan.startDay + 3
  );
}
export function forestWeather(
  seed: number,
  nowMs: number,
  calendar = calendarAt(seed, nowMs),
): ForestWeather {
  const cycle = Math.floor(nowMs / WEATHER_CYCLE_MS);
  const phase = nowMs - cycle * WEATHER_CYCLE_MS;
  const plan = weatherPlan(seed, cycle);
  const kind: WeatherKind = isBlizzard(seed, calendar)
    ? 'blizzard'
    : phase >= plan.rainEnds && plan.storm
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
    precipitation: { clear: 0, drizzle: 0.18, rain: 0.6, storm: 1, blizzard: 1 }[kind],
    wind: { clear: 0.15, drizzle: 0.25, rain: 0.45, storm: 0.85, blizzard: 1.6 }[kind],
    mushroomsAbundant,
  };
}
