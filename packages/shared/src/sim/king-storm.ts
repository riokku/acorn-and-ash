import { SOUL_STORM } from '../data/world-boss';
import { CROWNBREAKER_HOLD, KING_WARDS } from '../world/hollow-king';
export const KING_STORM_PHASES = ['warning', 'storm', 'recovery'] as const;
export interface KingStormView {
  readonly bossId: number;
  readonly wave: number;
  readonly phase: (typeof KING_STORM_PHASES)[number];
  readonly remainingTicks: number;
  readonly sheltered: boolean;
  readonly outside: boolean;
}
export function kingStormSheltered(at: { x: number; z: number }): boolean {
  return KING_WARDS.some(
    (ward) => Math.hypot(ward.x - at.x, ward.z - at.z) <= SOUL_STORM.shelterRadius,
  );
}
export function inKingStorm(at: { x: number; z: number }): boolean {
  return Math.hypot(at.x - CROWNBREAKER_HOLD.x, at.z - CROWNBREAKER_HOLD.z) <= SOUL_STORM.radius;
}
export function kingStormPhase(
  elapsed: number,
): Pick<KingStormView, 'phase' | 'remainingTicks'> | null {
  if (elapsed < 0) return null;
  if (elapsed < SOUL_STORM.warningTicks)
    return { phase: 'warning', remainingTicks: SOUL_STORM.warningTicks - elapsed };
  elapsed -= SOUL_STORM.warningTicks;
  if (elapsed < SOUL_STORM.activeTicks)
    return { phase: 'storm', remainingTicks: SOUL_STORM.activeTicks - elapsed };
  elapsed -= SOUL_STORM.activeTicks;
  return elapsed < SOUL_STORM.recoveryTicks
    ? { phase: 'recovery', remainingTicks: SOUL_STORM.recoveryTicks - elapsed }
    : null;
}
