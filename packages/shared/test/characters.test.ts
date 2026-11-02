import { describe, expect, it } from 'vitest';

import {
  CHARACTER_KINDS,
  CHARACTER_ORDER,
  DEFAULT_SKIN_TONE,
  SKIN_TONES,
  SKIN_TONE_ORDER,
  SKIN_TONE_SWATCHES,
  characterFromIndex,
  characterFromName,
  characterIndex,
  skinToneFromIndex,
  skinToneIndex,
} from '../src/data/characters';

describe('the characters, as bodies', () => {
  it('are offered as Body 1 and Body 2', () => {
    expect(CHARACTER_ORDER.map((id) => CHARACTER_KINDS[id].displayName)).toEqual([
      'Body 1',
      'Body 2',
    ]);
  });

  it('keep the numbers that worlds and browsers have already saved', () => {
    expect(characterIndex('knight')).toBe(0);
    expect(characterIndex('barbarian')).toBe(1);
    for (const id of CHARACTER_ORDER) {
      expect(characterFromIndex(characterIndex(id))).toBe(id);
    }
    expect(characterFromIndex(200)).toBeNull();
  });

  it('load the retired Bodies 3 to 6 as Body 1 (the men) and Body 2 (the women)', () => {
    expect([2, 3, 4, 5].map(characterFromIndex)).toEqual([
      'knight',
      'barbarian',
      'knight',
      'barbarian',
    ]);
    expect(['mage', 'ranger', 'rogue', 'rogueHooded'].map(characterFromName)).toEqual([
      'knight',
      'barbarian',
      'knight',
      'barbarian',
    ]);
  });

  it('know a saved name, and refuse one never heard of', () => {
    expect(characterFromName('knight')).toBe('knight');
    expect(characterFromName('barbarian')).toBe('barbarian');
    expect(characterFromName('toString')).toBeNull();
    expect(characterFromName('wizard')).toBeNull();
    expect(characterFromName(3)).toBeNull();
  });
});

describe('the skin tones', () => {
  it("save the body's own skin as 0, so characters made before tones existed keep it", () => {
    expect(DEFAULT_SKIN_TONE).toBe('natural');
    expect(skinToneIndex('natural')).toBe(0);
    expect(skinToneFromIndex(0)).toBe('natural');
  });

  it('keep the order they are saved in, and survive a round trip', () => {
    expect(SKIN_TONE_ORDER).toEqual(['natural', 'lightest', 'lighter', 'darker', 'darkest']);
    for (const id of SKIN_TONE_ORDER) expect(skinToneFromIndex(skinToneIndex(id))).toBe(id);
    expect(skinToneFromIndex(SKIN_TONE_ORDER.length)).toBeNull();
  });

  it('are shown lightest to darkest, every tone once', () => {
    const brightness = (id: keyof typeof SKIN_TONES): number =>
      SKIN_TONES[id].shade.reduce((sum, channel) => sum + channel, 0);
    const shown = SKIN_TONE_SWATCHES.map(brightness);
    expect([...shown].sort((a, b) => b - a)).toEqual(shown);
    expect([...SKIN_TONE_SWATCHES].sort()).toEqual([...SKIN_TONE_ORDER].sort());
  });

  it('only ever change the skin gently', () => {
    for (const id of SKIN_TONE_ORDER) {
      for (const channel of SKIN_TONES[id].shade) {
        expect(channel).toBeGreaterThan(0.55);
        expect(channel).toBeLessThan(1.2);
      }
    }
  });
});
