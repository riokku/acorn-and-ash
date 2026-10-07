import { describe, expect, it } from 'vitest';

import {
  CHARACTER_KINDS,
  CHARACTER_ORDER,
  characterFromIndex,
  characterIndex,
} from '../src/data/characters';

describe('the characters, as bodies', () => {
  it('are shown as Body 1 to Body 6, in the order they are saved', () => {
    expect(CHARACTER_ORDER.map((id) => CHARACTER_KINDS[id].displayName)).toEqual([
      'Body 1',
      'Body 2',
      'Body 3',
      'Body 4',
      'Body 5',
      'Body 6',
    ]);
  });

  it('keep the ids that worlds and browsers have already saved', () => {
    expect(CHARACTER_ORDER).toEqual([
      'knight',
      'barbarian',
      'mage',
      'ranger',
      'rogue',
      'rogueHooded',
    ]);
    for (const id of CHARACTER_ORDER) {
      expect(characterFromIndex(characterIndex(id))).toBe(id);
    }
  });
});
