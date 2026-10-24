import { smoothstep } from '../math/vec3';
import type { EncounterSite } from './encounters';
import { HOLLOW_KING } from '../data/world-boss';
export const CROWNBREAKER_HOLD = { name: 'Crownbreaker Hold', x: 246, z: 212, radius: 38 } as const;
export const HOLLOW_KING_SITE: EncounterSite = {
  id: 500,
  kind: 'ruins',
  x: CROWNBREAKER_HOLD.x,
  z: CROWNBREAKER_HOLD.z,
  yaw: 0,
  worldBoss: true,
  wakeRadius: 60,
  noticeRadius: 14,
  leashRadius: 38,
  restSeconds: HOLLOW_KING.respawnSeconds,
};
/** Existing ruined masonry and cairns, arranged around a wide open fighting floor. */
export const KING_REMNANTS: readonly EncounterSite[] = [
  ...[-19, 19].flatMap((dx, i) =>
    [-19, 19].map((dz, j) => ({
      id: 8000 + i * 2 + j,
      kind: 'ruins' as const,
      x: CROWNBREAKER_HOLD.x + dx,
      z: CROWNBREAKER_HOLD.z + dz,
      yaw: 0,
    })),
  ),
  { id: 8010, kind: 'wanderer', x: 212.8, z: 183.3, yaw: 0 },
  { id: 8011, kind: 'wanderer', x: 227.8, z: 195.3, yaw: 0 },
];
export function inKingsHold(x: number, z: number, margin = 0): boolean {
  return (
    Math.hypot(x - CROWNBREAKER_HOLD.x, z - CROWNBREAKER_HOLD.z) < CROWNBREAKER_HOLD.radius + margin
  );
}
export function kingsHoldGround(x: number, z: number, ground: number, level: number): number {
  const distance = Math.max(Math.abs(x - CROWNBREAKER_HOLD.x), Math.abs(z - CROWNBREAKER_HOLD.z));
  return ground + (level - ground) * (1 - smoothstep(distance, 28, 42));
}
