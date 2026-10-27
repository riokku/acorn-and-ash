/** Rescue is a server-timed channel; additional helpers never accelerate it. */
export const RESCUE = {
  radius: 2.4,
  nearby: 40,
  windowTicks: 300,
  holdTicks: 60,
  healthFraction: 0.35,
} as const;
export interface AllyView {
  readonly netId: number;
  readonly health: number;
  readonly maxHealth: number;
  readonly downTicks: number;
  readonly rescueTicks: number;
  readonly rescuerId: number;
  readonly inReach: boolean;
  /** This is the one eligible nearby companion for the held two-serving meal. */
  readonly shareMeal?: true;
}
