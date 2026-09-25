import { describe, expect, it } from 'vitest';

import { BLANK_IDENTITY, readIdentity, writeIdentity } from '../src/home/identity';

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

describe('remembering who you picked to be', () => {
  it('starts blank for a brand new visitor', () => {
    expect(readIdentity(fakeStorage())).toEqual(BLANK_IDENTITY);
  });

  it('round-trips a real choice', () => {
    const storage = fakeStorage();
    const identity = { name: 'Acorn', character: 'knight', color: 'moss' } as const;
    writeIdentity(storage, identity);
    expect(readIdentity(storage)).toEqual(identity);
  });

  it('falls back to Knight for a character this build no longer knows', () => {
    const storage = fakeStorage();
    storage.setItem(
      'acorn.identity',
      JSON.stringify({ name: 'Acorn', character: 'not-a-real-one', color: 'amber' }),
    );
    expect(readIdentity(storage).character).toBe('knight');
  });

  it('falls back to the default tint for a colour this build no longer knows', () => {
    const storage = fakeStorage();
    storage.setItem(
      'acorn.identity',
      JSON.stringify({ name: 'Acorn', character: 'knight', color: 'ultraviolet' }),
    );
    expect(readIdentity(storage).color).toBe('amber');
  });

  it('sanitises a name that was tampered with directly in storage', () => {
    const storage = fakeStorage();
    storage.setItem(
      'acorn.identity',
      JSON.stringify({ name: '  Acorn  ', character: 'knight', color: 'amber' }),
    );
    expect(readIdentity(storage).name).toBe('Acorn');
  });

  it('starts blank rather than throw on storage that is not our own JSON', () => {
    const storage = fakeStorage();
    storage.setItem('acorn.identity', 'not json at all');
    expect(readIdentity(storage)).toEqual(BLANK_IDENTITY);
  });
});
