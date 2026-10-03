import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PREFERENCES,
  MAX_SENSITIVITY,
  MIN_SENSITIVITY,
  readPreferences,
  writePreferences,
} from '../src/preferences/preferences';

const fakeStorage = (): Storage => {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    clear: () => map.clear(),
    key: (index) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  };
};

describe('remembering the Settings menu', () => {
  it('starts at the tuned defaults for a brand new visitor', () => {
    expect(readPreferences(fakeStorage())).toEqual(DEFAULT_PREFERENCES);
  });

  it('round-trips a real choice', () => {
    const storage = fakeStorage();
    const preferences = {
      grassDensity: 0.75,
      musicVolume: 0.4,
      sfxVolume: 0.7,
      lookSensitivity: 1.5,
    };
    writePreferences(storage, preferences);
    expect(readPreferences(storage)).toEqual(preferences);
  });

  it('clamps a volume outside 0 to 1, tampered with directly in storage', () => {
    const storage = fakeStorage();
    storage.setItem(
      'acorn.preferences',
      JSON.stringify({ musicVolume: -0.5, sfxVolume: 4, lookSensitivity: 1 }),
    );
    const preferences = readPreferences(storage);
    expect(preferences.musicVolume).toBe(0);
    expect(preferences.sfxVolume).toBe(1);
  });

  it('clamps a sensitivity outside its range, tampered with directly in storage', () => {
    const storage = fakeStorage();
    storage.setItem(
      'acorn.preferences',
      JSON.stringify({ musicVolume: 1, sfxVolume: 1, lookSensitivity: 99 }),
    );
    expect(readPreferences(storage).lookSensitivity).toBe(MAX_SENSITIVITY);

    storage.setItem(
      'acorn.preferences',
      JSON.stringify({ musicVolume: 1, sfxVolume: 1, lookSensitivity: -1 }),
    );
    expect(readPreferences(storage).lookSensitivity).toBe(MIN_SENSITIVITY);
  });

  it('falls back to the defaults for a value of the wrong type', () => {
    const storage = fakeStorage();
    storage.setItem(
      'acorn.preferences',
      JSON.stringify({ musicVolume: 'loud', sfxVolume: null, lookSensitivity: 1.2 }),
    );
    const preferences = readPreferences(storage);
    expect(preferences.musicVolume).toBe(DEFAULT_PREFERENCES.musicVolume);
    expect(preferences.sfxVolume).toBe(DEFAULT_PREFERENCES.sfxVolume);
    expect(preferences.lookSensitivity).toBe(1.2);
  });

  it('starts at the defaults rather than throw on storage that is not our own JSON', () => {
    const storage = fakeStorage();
    storage.setItem('acorn.preferences', 'not json at all');
    expect(readPreferences(storage)).toEqual(DEFAULT_PREFERENCES);
  });
});
