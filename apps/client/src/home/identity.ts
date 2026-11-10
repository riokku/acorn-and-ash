import {
  BEARDS,
  characterFromName,
  DEFAULT_BEARD,
  DEFAULT_CHARACTER,
  DEFAULT_HAIR_COLOR,
  DEFAULT_SKIN_TONE,
  DEFAULT_TINT_COLOR,
  HAIR_COLORS,
  hairColorOn,
  SKIN_TONES,
  TINT_COLORS,
  sanitizePlayerName,
  type BeardId,
  type CharacterId,
  type HairColorId,
  type SkinToneId,
  type TintColorId,
} from '@acorn/shared';

const STORAGE_KEY = 'acorn.identity';

/** What the Home screen collects before a player enters the clearing. */
export interface PlayerIdentity {
  readonly name: string;
  readonly character: CharacterId;
  readonly color: TintColorId;
  readonly skin: SkinToneId;
  readonly hair: HairColorId;
  /** Worn only by a body that has beards. */
  readonly beard: BeardId;
}

/** What a brand new visitor sees on the Home screen before typing anything. */
export const BLANK_IDENTITY: PlayerIdentity = {
  name: '',
  character: DEFAULT_CHARACTER,
  color: DEFAULT_TINT_COLOR,
  skin: DEFAULT_SKIN_TONE,
  hair: DEFAULT_HAIR_COLOR,
  beard: DEFAULT_BEARD,
};

/** Read back whatever was chosen last time, falling back to sensible defaults. */
export function readIdentity(storage: Storage): PlayerIdentity {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return BLANK_IDENTITY;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return BLANK_IDENTITY;
    const { name, character, color, skin, hair, beard } = parsed as Record<string, unknown>;
    const body = characterFromName(character) ?? DEFAULT_CHARACTER;

    return {
      name: typeof name === 'string' ? sanitizePlayerName(name) : '',
      character: body,
      color:
        typeof color === 'string' && color in TINT_COLORS
          ? (color as TintColorId)
          : DEFAULT_TINT_COLOR,
      skin: readSkinTone(skin),
      hair: hairColorOn(body, readHairColor(hair)),
      beard: readBeard(beard),
    };
  } catch {
    // Whatever was in storage was not our own JSON - start fresh rather than throw.
    return BLANK_IDENTITY;
  }
}

/** A skin tone this build knows, or the body's own skin (also for anything saved before tones existed). */
export function readSkinTone(skin: unknown): SkinToneId {
  return typeof skin === 'string' && skin in SKIN_TONES ? (skin as SkinToneId) : DEFAULT_SKIN_TONE;
}

/** A hair colour this build knows, or the body's own (also for anything saved before hair colours existed). */
export function readHairColor(hair: unknown): HairColorId {
  return typeof hair === 'string' && Object.hasOwn(HAIR_COLORS, hair)
    ? (hair as HairColorId)
    : DEFAULT_HAIR_COLOR;
}

/** A beard this build knows, or the braids (also for anything saved before beards could be chosen). */
export function readBeard(beard: unknown): BeardId {
  return typeof beard === 'string' && Object.hasOwn(BEARDS, beard)
    ? (beard as BeardId)
    : DEFAULT_BEARD;
}

export function writeIdentity(storage: Storage, identity: PlayerIdentity): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(identity));
}

/** Forget the name and look chosen last time, so a new character starts from a blank card. */
export function clearIdentity(storage: Storage): void {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Storage switched off: there was nothing remembered to forget.
  }
}
