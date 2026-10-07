import { describe, expect, it } from 'vitest';

import {
  CHARACTER_DELETED_NOTICE,
  matchesCharacterName,
  rememberCharacterDeleted,
  takeCharacterDeletedNotice,
} from '../src/home/delete-character';

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

describe("typing the character's name to confirm a deletion", () => {
  it('counts when it is the name', () => {
    expect(matchesCharacterName('Acorn', 'Acorn')).toBe(true);
  });

  it('does not care about capitals or spaces at the edges', () => {
    expect(matchesCharacterName('  aCORN ', 'Acorn')).toBe(true);
  });

  it('does not count when nothing, or something else, was typed', () => {
    expect(matchesCharacterName('', 'Acorn')).toBe(false);
    expect(matchesCharacterName('Acor', 'Acorn')).toBe(false);
    expect(matchesCharacterName('Acorn Ash', 'Acorn')).toBe(false);
  });

  it('never counts for a character with no name, so an empty box cannot confirm', () => {
    expect(matchesCharacterName('', '')).toBe(false);
    expect(matchesCharacterName('   ', '  ')).toBe(false);
  });
});

describe('the note after a character was deleted', () => {
  it('waits for the next page load and is shown once', () => {
    const storage = fakeStorage();
    expect(takeCharacterDeletedNotice(storage)).toBeNull();

    rememberCharacterDeleted(storage);
    expect(takeCharacterDeletedNotice(storage)).toBe(CHARACTER_DELETED_NOTICE);
    expect(takeCharacterDeletedNotice(storage)).toBeNull();
  });

  it('tells the player how long the cabin lingers', () => {
    expect(CHARACTER_DELETED_NOTICE).toContain('30 minutes');
  });

  it('is simply skipped when the browser will not let us use storage', () => {
    const locked = {
      getItem: () => {
        throw new Error('storage is switched off');
      },
      setItem: () => {
        throw new Error('storage is switched off');
      },
    } as unknown as Storage;
    expect(() => rememberCharacterDeleted(locked)).not.toThrow();
    expect(takeCharacterDeletedNotice(locked)).toBeNull();
  });
});
