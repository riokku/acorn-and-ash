/**
 * The character table.
 *
 * Every player picks one on the Home screen, shown as Body 1 and Body 2 in the
 * order of `CHARACTER_ORDER` (decision 0112): a character is a body, and
 * outfits are gear to be found. The ids (`knight`, `barbarian`) are older
 * art's names and stay exactly as they are, because worlds and browsers have
 * already saved them. Bodies 3 to 6 were retired (decision 0273); characters
 * made with them play as Body 1 or Body 2 instead.
 */

export type CharacterId = 'knight' | 'barbarian';

export interface CharacterKind {
  readonly id: CharacterId;
  readonly displayName: string;
  readonly available: boolean;
}

export const CHARACTER_KINDS = {
  knight: { id: 'knight', displayName: 'Body 1', available: true },
  barbarian: { id: 'barbarian', displayName: 'Body 2', available: true },
} as const satisfies Record<CharacterId, CharacterKind>;

/** The order the bodies are offered in. */
export const CHARACTER_ORDER: readonly CharacterId[] = ['knight', 'barbarian'];

/**
 * What each saved number means, so a choice can be sent over the wire and saved
 * as one small number. 2 to 5 were Bodies 3 to 6 (decision 0273): the men,
 * Bodies 3 and 5, now play as Body 1 and the women, Bodies 4 and 6, as Body 2.
 *
 * Only ever add to the end, and never reuse 2 to 5 - the Home screen and the
 * server both save this number, so changing one would turn somebody into
 * another body.
 */
const SAVED_CHARACTERS: readonly CharacterId[] = [
  'knight',
  'barbarian',
  'knight',
  'barbarian',
  'knight',
  'barbarian',
];

/** The retired bodies' names, as browsers saved them, and who each plays as now. */
const RETIRED_CHARACTERS: Readonly<Record<string, CharacterId>> = {
  mage: 'knight',
  ranger: 'barbarian',
  rogue: 'knight',
  rogueHooded: 'barbarian',
};

export const DEFAULT_CHARACTER: CharacterId = 'knight';

export function characterIndex(id: CharacterId): number {
  const index = SAVED_CHARACTERS.indexOf(id);
  if (index < 0) throw new Error(`Unknown character: ${id}`);
  return index;
}

export function characterFromIndex(index: number): CharacterId | null {
  return SAVED_CHARACTERS[index] ?? null;
}

/** A saved character name, a retired body's included, or null for one never heard of. */
export function characterFromName(name: unknown): CharacterId | null {
  if (typeof name !== 'string') return null;
  if (Object.hasOwn(CHARACTER_KINDS, name)) return name as CharacterId;
  return Object.hasOwn(RETIRED_CHARACTERS, name) ? (RETIRED_CHARACTERS[name] ?? null) : null;
}

/**
 * The tint a player picks for their character - the one real per-player
 * customisation the game has today (see `colorForPlayer` in the client, which
 * this replaces for a player who has chosen one).
 */
export type TintColorId = 'amber' | 'moss' | 'clay' | 'teal' | 'plum' | 'birch';

export interface TintColor {
  readonly id: TintColorId;
  readonly displayName: string;
  /** As 0xRRGGBB, matching `ItemKind.placeholderColor`'s convention. */
  readonly hex: number;
}

export const TINT_COLORS = {
  amber: { id: 'amber', displayName: 'Amber', hex: 0xe2a23c },
  moss: { id: 'moss', displayName: 'Moss', hex: 0x6f9c5c },
  clay: { id: 'clay', displayName: 'Clay', hex: 0xc1794a },
  teal: { id: 'teal', displayName: 'Teal', hex: 0x4f8f8f },
  plum: { id: 'plum', displayName: 'Plum', hex: 0x93679c },
  birch: { id: 'birch', displayName: 'Birch', hex: 0xa98756 },
} as const satisfies Record<TintColorId, TintColor>;

/** Only ever add to the end - same reason the saved characters' numbers do. */
export const TINT_COLOR_ORDER: readonly TintColorId[] = [
  'amber',
  'moss',
  'clay',
  'teal',
  'plum',
  'birch',
];

export const DEFAULT_TINT_COLOR: TintColorId = 'amber';

export function tintColorIndex(id: TintColorId): number {
  const index = TINT_COLOR_ORDER.indexOf(id);
  if (index < 0) throw new Error(`Unknown tint colour: ${id}`);
  return index;
}

export function tintColorFromIndex(index: number): TintColorId | null {
  return TINT_COLOR_ORDER[index] ?? null;
}

/**
 * A gentle lighter or darker shade of a body's own skin, picked once when a
 * character is made (decision 0113). Only the skin changes: hair, eyes and
 * clothes keep their own colours.
 */
export type SkinToneId = 'lightest' | 'lighter' | 'natural' | 'darker' | 'darkest';

export interface SkinTone {
  readonly id: SkinToneId;
  readonly displayName: string;
  /**
   * How much each of red, green and blue is scaled from the body's own skin,
   * as painted (sRGB). Darker tones lose more blue than red, so they stay
   * warm rather than turning grey.
   */
  readonly shade: readonly [number, number, number];
}

export const SKIN_TONES = {
  lightest: { id: 'lightest', displayName: 'Lightest', shade: [1.07, 1.09, 1.12] },
  lighter: { id: 'lighter', displayName: 'Lighter', shade: [1.035, 1.045, 1.06] },
  natural: { id: 'natural', displayName: 'Natural', shade: [1, 1, 1] },
  darker: { id: 'darker', displayName: 'Darker', shade: [0.9, 0.83, 0.78] },
  darkest: { id: 'darkest', displayName: 'Darkest', shade: [0.78, 0.67, 0.59] },
} as const satisfies Record<SkinToneId, SkinTone>;

/**
 * The order sent over the wire and saved. `natural` is first so that every
 * character made before skin tones existed (saved as 0) keeps its own skin.
 * Only ever add to the end - same reason the saved characters' numbers do.
 */
export const SKIN_TONE_ORDER: readonly SkinToneId[] = [
  'natural',
  'lightest',
  'lighter',
  'darker',
  'darkest',
];

/** The order the swatches are shown in, lightest to darkest. */
export const SKIN_TONE_SWATCHES: readonly SkinToneId[] = [
  'lightest',
  'lighter',
  'natural',
  'darker',
  'darkest',
];

export const DEFAULT_SKIN_TONE: SkinToneId = 'natural';

export function skinToneIndex(id: SkinToneId): number {
  const index = SKIN_TONE_ORDER.indexOf(id);
  if (index < 0) throw new Error(`Unknown skin tone: ${id}`);
  return index;
}

export function skinToneFromIndex(index: number): SkinToneId | null {
  return SKIN_TONE_ORDER[index] ?? null;
}
