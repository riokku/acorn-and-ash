/** Winter exposure advances only on authoritative active simulation ticks. */
import { TICK_HZ, TICK_SECONDS } from '../constants';

export const WARMTH_MAX = 100;
export const WINTER_WARMTH_REQUIRED = 60;
export const BLIZZARD_WARMTH_REQUIRED = 80;
export const WARMTH_WARNING_AT = 35;
export const COLD_GRACE_TICKS = 30 * TICK_HZ;
export const COLD_DAMAGE_INTERVAL_TICKS = 5 * TICK_HZ;
export const CAMPFIRE_WARMTH_RADIUS = 4.5;
export const WARMTH_STATUSES = ['comfortable', 'cooling', 'cold', 'freezing', 'warming'] as const;
export type WarmthStatus = (typeof WARMTH_STATUSES)[number];
export type HeatSource = 'fire' | 'indoors' | null;
export interface WarmthState {
  readonly value: number;
  readonly coldTicks: number;
}
export interface WarmthEnvironment {
  readonly winter: boolean;
  readonly blizzard: boolean;
  readonly insulation: number;
  readonly heat: HeatSource;
  /** Authoritative gear multiplier, applied only at a lit heat source. */
  readonly heatRecovery?: number;
}
export interface WarmthView {
  readonly value: number;
  readonly status: WarmthStatus;
  readonly heat: HeatSource;
  readonly secondsToDamage: number | null;
}
export function warmthFromSaved(saved: unknown): WarmthState {
  if (typeof saved !== 'object' || saved === null) return { value: WARMTH_MAX, coldTicks: 0 };
  const state = saved as Partial<WarmthState>;
  if (
    !Number.isFinite(state.value) ||
    state.value! < 0 ||
    state.value! > WARMTH_MAX ||
    !Number.isInteger(state.coldTicks) ||
    state.coldTicks! < 0 ||
    state.coldTicks! >= COLD_GRACE_TICKS + COLD_DAMAGE_INTERVAL_TICKS
  )
    return { value: WARMTH_MAX, coldTicks: 0 };
  return { value: state.value!, coldTicks: state.value! > 0 ? 0 : state.coldTicks! };
}
function deficit(environment: WarmthEnvironment): number {
  if (environment.heat !== null || !environment.winter) return 0;
  return Math.max(
    0,
    (environment.blizzard ? BLIZZARD_WARMTH_REQUIRED : WINTER_WARMTH_REQUIRED) -
      environment.insulation,
  );
}
export function advanceWarmth(
  state: WarmthState,
  environment: WarmthEnvironment,
): { state: WarmthState; damage: number } {
  const shortfall = deficit(environment);
  const rate =
    shortfall > 0
      ? -shortfall / 100
      : environment.heat === 'fire'
        ? 2
        : environment.heat === 'indoors'
          ? 1
          : 0.5;
  const value = Math.min(
    WARMTH_MAX,
    Math.max(
      0,
      state.value +
        rate *
          TICK_SECONDS *
          (environment.heat !== null
            ? Math.min(1.25, Math.max(1, environment.heatRecovery ?? 1))
            : 1),
    ),
  );
  if (value > 0 || shortfall === 0) return { state: { value, coldTicks: 0 }, damage: 0 };
  const coldTicks = state.coldTicks + 1;
  if (coldTicks >= COLD_GRACE_TICKS + COLD_DAMAGE_INTERVAL_TICKS)
    return { state: { value: 0, coldTicks: COLD_GRACE_TICKS }, damage: 1 };
  return { state: { value: 0, coldTicks }, damage: 0 };
}
export function warmthView(state: WarmthState, environment: WarmthEnvironment): WarmthView {
  const exposed = deficit(environment) > 0;
  const status: WarmthStatus = !exposed
    ? state.value < WARMTH_MAX
      ? 'warming'
      : 'comfortable'
    : state.value <= 0
      ? 'freezing'
      : state.value <= WARMTH_WARNING_AT
        ? 'cold'
        : 'cooling';
  return {
    value: Math.round(state.value),
    status,
    heat: environment.heat,
    secondsToDamage:
      status === 'freezing'
        ? Math.ceil((COLD_GRACE_TICKS + COLD_DAMAGE_INTERVAL_TICKS - state.coldTicks) / TICK_HZ)
        : null,
  };
}
