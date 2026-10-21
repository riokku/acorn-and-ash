import { expect, it } from 'vitest';
import { RAIDER_KIND_ORDER, SKELETON_WEAPON_DROPS } from '@acorn/shared';
import { wornWeapon } from '../src/scene/gear-models';
import { raiderWeapon } from '../src/scene/raider-weapons';

it('uses the carried skeleton model for every equippable weapon drop', () => {
  for (const kind of RAIDER_KIND_ORDER) {
    const player = wornWeapon(SKELETON_WEAPON_DROPS[kind].item)!;
    const skeleton = raiderWeapon(kind);
    expect(player.length).toBe(skeleton.length);
    // Both bosses carry the same greatsword; their cached meshes need not be the same objects.
    expect(player.parts.map((p) => p.geometry.getAttribute('position').count)).toEqual(
      skeleton.parts.map((p) => p.geometry.getAttribute('position').count),
    );
    expect(player.parts.map((p) => Array.from(p.geometry.getAttribute('position').array))).toEqual(
      skeleton.parts.map((p) => Array.from(p.geometry.getAttribute('position').array)),
    );
  }
});
