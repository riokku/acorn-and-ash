import {
  CHARACTER_KINDS,
  DEFAULT_CHARACTER,
  DEFAULT_TINT_COLOR,
  TINT_COLORS,
  sanitizePlayerName,
  type CharacterId,
  type TintColorId,
} from '@acorn/shared';

const STORAGE_KEY = 'acorn.identity';

/** What the Home screen collects before a player enters the clearing. */
export interface PlayerIdentity {
  readonly name: string;
  readonly character: CharacterId;
  readonly color: TintColorId;
}

/** What a brand new visitor sees on the Home screen before typing anything. */
export const BLANK_IDENTITY: PlayerIdentity = {
  name: '',
  character: DEFAULT_CHARACTER,
  color: DEFAULT_TINT_COLOR,
};

/** Read back whatever was chosen last time, falling back to sensible defaults. */
export function readIdentity(storage: Storage): PlayerIdentity {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return BLANK_IDENTITY;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return BLANK_IDENTITY;
    const { name, character, color } = parsed as Record<string, unknown>;

    return {
      name: typeof name === 'string' ? sanitizePlayerName(name) : '',
      character:
        typeof character === 'string' && character in CHARACTER_KINDS
          ? (character as CharacterId)
          : DEFAULT_CHARACTER,
      color:
        typeof color === 'string' && color in TINT_COLORS
          ? (color as TintColorId)
          : DEFAULT_TINT_COLOR,
    };
  } catch {
    // Whatever was in storage was not our own JSON - start fresh rather than throw.
    return BLANK_IDENTITY;
  }
}

export function writeIdentity(storage: Storage, identity: PlayerIdentity): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(identity));
}
