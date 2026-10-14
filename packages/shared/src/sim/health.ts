/** Whole points for the HUD: living players never appear to have zero health. */
export function displayedHealth(health: number): number {
  return health > 0 ? Math.max(1, Math.round(health)) : 0;
}
