import { describe, expect, it } from 'vitest';

import {
  MAX_PLAYER_NAME_LENGTH,
  MIN_PLAYER_NAME_LENGTH,
  isValidPlayerName,
  sanitizePlayerName,
} from '../src/sim/identity';

describe('a player name', () => {
  it('trims the edges', () => {
    expect(sanitizePlayerName('  Acorn  ')).toBe('Acorn');
  });

  it('drops control characters', () => {
    expect(sanitizePlayerName('Ac\u0000orn\u007f')).toBe('Acorn');
  });

  it('clamps to the maximum length', () => {
    const tooLong = 'a'.repeat(MAX_PLAYER_NAME_LENGTH + 10);
    expect(sanitizePlayerName(tooLong)).toHaveLength(MAX_PLAYER_NAME_LENGTH);
  });

  it('leaves real unicode alone', () => {
    expect(sanitizePlayerName('Amélie 🌲')).toBe('Amélie 🌲');
  });

  it('never throws, whatever it is given', () => {
    expect(() => sanitizePlayerName('')).not.toThrow();
  });

  it('is valid once it is long enough and not too long', () => {
    expect(isValidPlayerName('Ac')).toBe(true);
    expect(isValidPlayerName('A'.repeat(MAX_PLAYER_NAME_LENGTH))).toBe(true);
  });

  it('is invalid when shorter than the minimum', () => {
    expect(isValidPlayerName('A'.repeat(MIN_PLAYER_NAME_LENGTH - 1))).toBe(false);
    expect(isValidPlayerName('')).toBe(false);
  });

  it('is invalid when longer than the maximum', () => {
    expect(isValidPlayerName('A'.repeat(MAX_PLAYER_NAME_LENGTH + 1))).toBe(false);
  });
});
