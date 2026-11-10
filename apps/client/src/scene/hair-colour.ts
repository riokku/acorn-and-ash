import * as THREE from 'three/webgpu';

import { hairColorHex, type CharacterId, type HairColorId } from '@acorn/shared';

/**
 * Hair colours (decision 0289). Hair, brows and beards share a material of
 * their own, marked `userData.hair` in the model (see
 * tools/art/heroic_dwarves.py), so a hair colour never touches skin or
 * clothes.
 *
 * The models carry their colour on every facet, a little lighter here and
 * darker there. Another colour cannot simply be multiplied over that: red
 * times anything stays reddish. So a chosen colour is drawn over a grey copy
 * of the same facets, which keeps the light and dark and drops the red.
 */

/** Whether a material is one of a body's hair materials. */
export function isHairMaterial(material: THREE.Material): boolean {
  return material.userData.hair === true;
}

/** The hair a model was painted with, and the colour to show instead (null for its own). */
export interface HairLook {
  readonly own: number;
  readonly chosen: number | null;
}

/** What this body's hair looks like in this colour. */
export function hairLook(character: CharacterId, hair: HairColorId): HairLook {
  return {
    own: hairColorHex(character, 'own'),
    chosen: hair === 'own' ? null : hairColorHex(character, hair),
  };
}

/** How bright a colour is to the eye, from its linear red, green and blue. */
function brightness(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const greyCopies = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();

/**
 * The same hair with its colour taken out: each facet keeps how light or dark
 * it was against the hair's own colour, as a grey, so a chosen colour drawn
 * over it is shaded the same way. Made once for each piece and shared.
 */
export function greyHairGeometry(
  geometry: THREE.BufferGeometry,
  own: number,
): THREE.BufferGeometry {
  const made = greyCopies.get(geometry);
  if (made !== undefined) return made;

  const painted = geometry.getAttribute('color');
  const grey = geometry.clone();
  if (painted !== undefined) {
    const base = new THREE.Color(own);
    const baseBrightness = Math.max(brightness(base.r, base.g, base.b), 1e-4);
    const shades = new Float32Array(painted.count * 3);
    for (let i = 0; i < painted.count; i++) {
      const shade = brightness(painted.getX(i), painted.getY(i), painted.getZ(i)) / baseBrightness;
      shades.fill(Math.min(shade, MOST_LIGHTER), i * 3, i * 3 + 3);
    }
    grey.setAttribute('color', new THREE.BufferAttribute(shades, 3));
  }
  greyCopies.set(geometry, grey);
  return grey;
}

/** A facet is never drawn more than this much lighter than the colour picked. */
const MOST_LIGHTER = 1.6;

/**
 * Draws this hair on a model nothing else colours, such as one in the
 * gallery. The game's own characters do the same alongside their tint (see
 * character.ts).
 */
export function dyeHair(model: THREE.Object3D, look: HairLook): void {
  const chosen = look.chosen;
  if (chosen === null) return;
  const dyed = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const material: unknown = child.material;
    if (!(material instanceof THREE.MeshStandardMaterial) || !isHairMaterial(material)) return;
    let next = dyed.get(material);
    if (next === undefined) {
      // clone() is not narrowed to the class it is called on, but it is one.
      next = material.clone() as THREE.MeshStandardMaterial;
      next.color.set(chosen);
      dyed.set(material, next);
    }
    child.material = next;
    child.geometry = greyHairGeometry(child.geometry, look.own);
  });
}
