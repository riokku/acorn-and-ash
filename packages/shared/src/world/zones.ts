/** Named outdoor regions share one persistent world and travel needs no loading screen. */
import { HIGH_PLAINS, highPlainsWeight } from './high-plains';

export const WORLD_ZONES = {
  mountains: { id: 'mountains', name: 'Evergreen Mountains', climate: 'forest', danger: 'gentle' },
  highPlains: { ...HIGH_PLAINS, climate: 'dryUpland', danger: 'adventurous' },
} as const;
export type WorldZoneId = keyof typeof WORLD_ZONES;
export type WorldZone = (typeof WORLD_ZONES)[WorldZoneId];
export function worldZoneAt(x: number, z: number): WorldZone {
  return highPlainsWeight(x, z) > 0.4 ? WORLD_ZONES.highPlains : WORLD_ZONES.mountains;
}
