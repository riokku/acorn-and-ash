/** Owner-only administration responses. These are never part of the gameplay protocol. */
export interface WorldResetRecord {
  id: number;
  resetAt: string;
  characters: number;
  structures: number;
}
export interface AdminWorldStatus {
  worldId: string;
  seed: number;
  players: number;
  savedCharacters: number;
  builtStructures: number;
  canReset: boolean;
  history: WorldResetRecord[];
}
export interface WorldResetChallenge {
  token: string;
  expiresAt: number;
  confirmation: string;
  world: AdminWorldStatus;
}
export type WorldResetResult<T> = { ok: true; value: T } | { ok: false; error: string };
export const WORLD_RESET_CONFIRMATION_MS = 2 * 60_000;
