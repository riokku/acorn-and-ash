import { describe, expect, it } from 'vitest';

import {
  firstTab,
  hasPassedFrontDoor,
  markFrontDoorPassed,
  resetFrontDoor,
} from '../src/home/front-door';

/** A tab's memory that works like the real thing, so a test can watch what is kept. */
function memory(): Storage {
  const kept = new Map<string, string>();
  return {
    getItem: (key) => kept.get(key) ?? null,
    setItem: (key, value) => void kept.set(key, value),
    removeItem: (key) => void kept.delete(key),
    clear: () => kept.clear(),
    key: (index) => [...kept.keys()][index] ?? null,
    get length() {
      return kept.size;
    },
  };
}

/** A tab that will not remember anything, like a browser with storage switched off. */
function forgetful(): Storage {
  const refuse = (): never => {
    throw new Error('Storage is switched off');
  };
  return {
    getItem: refuse,
    setItem: refuse,
    removeItem: refuse,
    clear: refuse,
    key: refuse,
    length: 0,
  };
}

describe('having pressed Play in this tab', () => {
  it('is not so on a fresh visit', () => {
    expect(hasPassedFrontDoor(memory())).toBe(false);
  });

  it('is remembered once Play is pressed, so coming back from Google skips it', () => {
    const tab = memory();
    markFrontDoorPassed(tab);
    expect(hasPassedFrontDoor(tab)).toBe(true);
  });

  it('is forgotten on sign out, so the front page greets the next visitor', () => {
    const tab = memory();
    markFrontDoorPassed(tab);
    resetFrontDoor(tab);
    expect(hasPassedFrontDoor(tab)).toBe(false);
  });

  it('just shows the front page again when the browser will not remember', () => {
    const tab = forgetful();
    expect(() => markFrontDoorPassed(tab)).not.toThrow();
    expect(() => resetFrontDoor(tab)).not.toThrow();
    expect(hasPassedFrontDoor(tab)).toBe(false);
  });
});

describe('which way in comes first', () => {
  it('is "Create account" for somebody who has never played here', () => {
    expect(firstTab('')).toBe('create');
  });

  it('is "Log in" for somebody who has played here before', () => {
    expect(firstTab('Hazel')).toBe('login');
  });
});
