import { CAMPFIRE_BURN_SECONDS } from '../constants';

export const FIRE_LOG_MS = CAMPFIRE_BURN_SECONDS * 1000;
export const FIRE_MAX_LOGS = 5;
export const FIRE_CAPACITY_MS = FIRE_LOG_MS * FIRE_MAX_LOGS;
export interface FireRequest {
  readonly propId: number;
  readonly action: 'addLog' | 'toggle' | 'storeLogs' | 'takeLogs';
  readonly amount?: number;
}
export interface FireFuelView {
  readonly propId: number;
  readonly lit: boolean;
  readonly remainingMs: number;
  readonly storedLogs: number;
}
export function remainingFireFuel(until: number | null, stored: number, now: number): number {
  return Math.max(0, Math.min(FIRE_CAPACITY_MS, until === null ? stored : until - now));
}

/** Firewood is separate from the indoor chest and never feeds a fire automatically. */
export function logStorageCapacity(kind: string): number {
  return kind === 'cabin' ? 20 : kind === 'largeCabin' ? 50 : 0;
}
export function logStorageSpot(home: { kind: string; x: number; z: number; yaw: number }): {
  x: number;
  z: number;
} {
  const offset = -2.9 * (home.kind === 'largeCabin' ? 1.2 : 1);
  return { x: home.x + Math.cos(home.yaw) * offset, z: home.z - Math.sin(home.yaw) * offset };
}
