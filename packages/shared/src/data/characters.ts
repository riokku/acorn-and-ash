/**
 * The character table.
 *
 * Every player picks one on the Home screen. All six of the pack's characters
 * now have real animated art (see decision 0036 and decision 0044), so
 * `available` is true across the board - kept on each row rather than
 * removed, since it is exactly how the picker will lock a future seventh
 * character the same way it locked these five at first.
 *
 * Players see these as Body 1 to Body 6, in the order of `CHARACTER_ORDER`
 * (decision 0112): a character is a body, and the outfits the pack drew on
 * them are gear to be found. The ids (`knight`, `mage`, ...) are the art's
 * names and stay exactly as they are, because worlds and browsers have
 * already saved them.
 */

export type CharacterId = 'knight' | 'barbarian' | 'mage' | 'ranger' | 'rogue' | 'rogueHooded';

export interface CharacterKind {
  readonly id: CharacterId;
  readonly displayName: string;
  readonly available: boolean;
}

export const CHARACTER_KINDS = {
  knight: { id: 'knight', displayName: 'Body 1', available: true },
  barbarian: { id: 'barbarian', displayName: 'Body 2', available: true },
  mage: { id: 'mage', displayName: 'Body 3', available: true },
  ranger: { id: 'ranger', displayName: 'Body 4', available: true },
  rogue: { id: 'rogue', displayName: 'Body 5', available: true },
  rogueHooded: { id: 'rogueHooded', displayName: 'Body 6', available: true },
} as const satisfies Record<CharacterId, CharacterKind>;

/**
 * A stable order, so a choice can be sent over the wire as a small number.
 *
 * Only ever add to the end - the Home screen and the server both save this
 * number, so reordering would turn somebody's Mage into a Rogue.
 */
export const CHARACTER_ORDER: readonly CharacterId[] = [
  'knight',
  'barbarian',
  'mage',
  'ranger',
  'rogue',
  'rogueHooded',
];

export const DEFAULT_CHARACTER: CharacterId = 'knight';

export function characterIndex(id: CharacterId): number {
  const index = CHARACTER_ORDER.indexOf(id);
  if (index < 0) throw new Error(`Unknown character: ${id}`);
  return index;
}

export function characterFromIndex(index: number): CharacterId | null {
  return CHARACTER_ORDER[index] ?? null;
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

/** Only ever add to the end - same reason `CHARACTER_ORDER` does. */
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
