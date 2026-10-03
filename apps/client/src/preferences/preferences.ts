import { clamp } from '@acorn/shared';

const STORAGE_KEY = 'acorn.preferences';

/** A multiplier on the base mouse-look speed: 1 is what it has always been. */
export const MIN_SENSITIVITY = 0.5;
export const MAX_SENSITIVITY = 2;

/** What the Settings menu lets a player adjust, saved between visits. */
export interface Preferences {
  /** 0 (silent) to 1 (the tuned level everyone hears by default). */
  readonly musicVolume: number;
  /** 0 (silent) to 1 (the tuned level everyone hears by default). Covers every sound effect. */
  readonly sfxVolume: number;
  /** A multiplier on the base mouse-look speed - see `MIN_SENSITIVITY`/`MAX_SENSITIVITY`. */
  readonly lookSensitivity: number;
  /** 0 disables grass; 1 is the fullest cover. */
  readonly grassDensity: number;
}

/**
 * Volumes and sensitivity start at their tuned levels, with a fuller but
 * bounded grass cover. Saved preferences from before grass use this default.
 */
export const DEFAULT_PREFERENCES: Preferences = {
  musicVolume: 1,
  sfxVolume: 1,
  lookSensitivity: 1,
  grassDensity: 0.75,
};

const clampVolume = (value: number): number => clamp(value, 0, 1);
const clampSensitivity = (value: number): number => clamp(value, MIN_SENSITIVITY, MAX_SENSITIVITY);

/** Read back whatever was chosen last time, falling back to sensible defaults. */
export function readPreferences(storage: Storage): Preferences {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return DEFAULT_PREFERENCES;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_PREFERENCES;
    const { musicVolume, sfxVolume, lookSensitivity, grassDensity } = parsed as Record<
      string,
      unknown
    >;

    return {
      grassDensity:
        typeof grassDensity === 'number' && Number.isFinite(grassDensity)
          ? clamp(grassDensity, 0, 1)
          : DEFAULT_PREFERENCES.grassDensity,
      musicVolume:
        typeof musicVolume === 'number'
          ? clampVolume(musicVolume)
          : DEFAULT_PREFERENCES.musicVolume,
      sfxVolume:
        typeof sfxVolume === 'number' ? clampVolume(sfxVolume) : DEFAULT_PREFERENCES.sfxVolume,
      lookSensitivity:
        typeof lookSensitivity === 'number'
          ? clampSensitivity(lookSensitivity)
          : DEFAULT_PREFERENCES.lookSensitivity,
    };
  } catch {
    // Whatever was in storage was not our own JSON - start fresh rather than throw.
    return DEFAULT_PREFERENCES;
  }
}

export function writePreferences(storage: Storage, preferences: Preferences): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}
