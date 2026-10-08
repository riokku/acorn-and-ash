import * as THREE from 'three/webgpu';

import { SKIN_TONES, type CharacterId, type SkinToneId } from '@acorn/shared';

/**
 * Skin tones (decision 0113). Each body's skin is a material of its own,
 * marked `userData.skin` in the model (see tools/art/plain_bodies.py), so a
 * tone only ever lightens or darkens the skin: hair, eyes and clothes keep
 * their colours.
 */

/** Each body's own skin as painted, for the swatches on the character screen. */
const BODY_SKIN: Record<CharacterId, string> = {
  knight: '#f5b58f',
  barbarian: '#f5c29e',
  mage: '#f5b58f',
  ranger: '#f5b58f',
  rogue: '#f5b58f',
  rogueHooded: '#f5b58f',
};

/** Whether a material is one of a body's skin materials. */
export function isSkinMaterial(material: THREE.Material): boolean {
  return material.userData.skin === true;
}

/**
 * How much to scale a skin material's colour by for this tone. The shade is
 * given as painted (sRGB), so it is converted, the same as any colour picked
 * by eye.
 */
export function skinShade(tone: SkinToneId): THREE.Color {
  const [r, g, b] = SKIN_TONES[tone].shade;
  return new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
}

/** This body's skin in this tone, as a CSS colour, for a swatch. */
export function skinSwatch(character: CharacterId, tone: SkinToneId): string {
  const own = new THREE.Color(BODY_SKIN[character]);
  const [r, g, b] = SKIN_TONES[tone].shade;
  const shaded = own.getRGB({ r: 0, g: 0, b: 0 }, THREE.SRGBColorSpace);
  const channel = (value: number, scale: number): string =>
    Math.round(Math.min(1, value * scale) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(shaded.r, r)}${channel(shaded.g, g)}${channel(shaded.b, b)}`;
}
