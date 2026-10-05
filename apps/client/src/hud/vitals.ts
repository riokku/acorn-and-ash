import { HEALTH_THROB_BELOW, HUNGER_THROB_BELOW } from '@acorn/shared';

/** Which of the two bars in the bottom left corner are throbbing right now. */
export interface VitalsThrob {
  hunger: boolean;
  health: boolean;
}

/**
 * Hunger throbs once it is below 10 and health once it is below 20: exactly
 * on the line is still quiet, the next point down is not.
 */
export function vitalsThrob(hunger: number, health: number): VitalsThrob {
  return { hunger: hunger < HUNGER_THROB_BELOW, health: health < HEALTH_THROB_BELOW };
}
