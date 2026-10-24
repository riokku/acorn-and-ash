/** A prepared group encounter; no hard minimum-player gate. */
export const HOLLOW_KING = {
  kind: 'hollowKing',
  name: 'The Hollow King',
  scale: 3.1,
  toughness: 220,
  maximumToughness: 240,
  reach: 7.2,
  attackRange: 5.2,
  armor: 0.22,
  exposed: 0.65,
  chargeTicks: 40,
  spinRecoverySeconds: 3.8,
  rewardRecentTicks: 90 * 20,
  respawnSeconds: 30 * 60,
} as const;
export function hollowKingToughness(helpers: number): number {
  return HOLLOW_KING.toughness + Math.max(0, Math.min(5, helpers) - 3) * 10;
}
export function hollowKingAttack(turn: number, health: number) {
  return {
    strike: turn % (health <= 0.5 ? 2 : 3) === (health <= 0.5 ? 1 : 2),
    swings: health <= 0.5 ? 3 : 2,
  };
}
