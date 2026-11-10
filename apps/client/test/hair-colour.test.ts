import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';

import { HAIR_COLORS } from '@acorn/shared';

import { greyHairGeometry, hairLook, isHairMaterial } from '../src/scene/hair-colour';

/** Hair as the models carry it: a colour on every corner, as whole numbers out of 255. */
function paintedHair(colours: readonly THREE.Color[]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(colours.length * 3), 3),
  );
  const bytes = new Uint8Array(colours.flatMap((c) => [c.r, c.g, c.b].map((v) => v * 255)));
  geometry.setAttribute('color', new THREE.BufferAttribute(bytes, 3, true));
  return geometry;
}

describe('hair colours', () => {
  const copper = HAIR_COLORS.copper.hex;

  it("leave a body's own hair alone, and name the colour picked otherwise", () => {
    expect(hairLook('knight', 'own')).toEqual({ own: copper, chosen: null });
    expect(hairLook('knight', 'coal')).toEqual({ own: copper, chosen: HAIR_COLORS.coal.hex });
    expect(hairLook('barbarian', 'own').own).toBe(HAIR_COLORS.wheat.hex);
  });

  it('know hair by the mark the models carry', () => {
    const hair = new THREE.MeshStandardMaterial();
    hair.userData.hair = true;
    expect(isHairMaterial(hair)).toBe(true);
    expect(isHairMaterial(new THREE.MeshStandardMaterial())).toBe(false);
  });

  it('take the red out of the hair but keep its light and dark', () => {
    const base = new THREE.Color(copper);
    const darker = base.clone().multiplyScalar(0.6);
    const painted = paintedHair([base, darker]);
    const grey = greyHairGeometry(painted, copper).getAttribute('color');

    for (let i = 0; i < grey.count; i++) {
      expect(grey.getY(i)).toBeCloseTo(grey.getX(i), 5);
      expect(grey.getZ(i)).toBeCloseTo(grey.getX(i), 5);
    }
    expect(grey.getX(0)).toBeCloseTo(1, 1);
    expect(grey.getX(1)).toBeCloseTo(0.6, 1);
  });

  it('leave the modelled hair as it was, and make each grey copy once', () => {
    const painted = paintedHair([new THREE.Color(copper)]);
    const before = Array.from(painted.getAttribute('color').array);
    const grey = greyHairGeometry(painted, copper);
    expect(grey).not.toBe(painted);
    expect(Array.from(painted.getAttribute('color').array)).toEqual(before);
    expect(greyHairGeometry(painted, copper)).toBe(grey);
  });
});
