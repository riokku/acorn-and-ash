import * as THREE from 'three/webgpu';

import type { SeasonMix } from '@acorn/shared';

import { seasonUniforms } from '../art/season-uniforms';
import { lookFor } from '../art/season-look';
import type { DaylightRig } from './lighting';
import { treeFoliageMaterials } from './prop-models';

/** Frost on the needles: how far a tree is pulled towards this colour when snow is deep. */
const FROST = new THREE.Color(0xe4edf2);
const FROST_AMOUNT = 0.42;

/** Moves less than this are not worth redoing a whole forest's colours for. */
const WORTHWHILE = 0.002;

export interface SeasonRig {
  /** Dress the forest for this season, or this point on the way into the next. */
  apply(mix: SeasonMix, daylight: DaylightRig | null, blizzard?: boolean): void;
}

/**
 * Turns what the calendar says into how the world looks (see decision 0089):
 * the sky and sun, the ground and the grass (through their shared colour
 * controls), and the needles of every tree (through their shared materials).
 */
export function createSeasonRig(): SeasonRig {
  const trees: { material: THREE.MeshStandardMaterial; base: THREE.Color }[] = [];
  const tint = new THREE.Color();
  let treesKnown = 0;
  let lastKey = '';

  /** Tree models load before a world is built, so look for them each time until some turn up. */
  function gatherTrees(): void {
    const materials = treeFoliageMaterials();
    if (materials.length === treesKnown) return;
    for (const material of materials) {
      if (trees.some((tree) => tree.material === material)) continue;
      trees.push({ material, base: material.color.clone() });
    }
    treesKnown = materials.length;
    lastKey = '';
  }

  return {
    apply(mix, daylight, blizzard = false) {
      gatherTrees();
      const key = `${mix.from}:${mix.to}:${Math.round(mix.amount / WORTHWHILE)}:${trees.length}:${blizzard}`;
      const look = lookFor(mix);
      // The sky is cheap and the daylight rig is rebuilt each world, so it always follows.
      daylight?.setSeason(look);
      if (key === lastKey) return;
      lastKey = key;

      seasonUniforms.ground.value.setRGB(look.ground[0], look.ground[1], look.ground[2]);
      seasonUniforms.blades.value.setRGB(look.blades[0], look.blades[1], look.blades[2]);
      seasonUniforms.snow.value = blizzard ? 1 : look.snow;
      seasonUniforms.blizzard.value = blizzard ? 1 : 0;

      tint.setRGB(look.foliage[0], look.foliage[1], look.foliage[2]);
      for (const tree of trees) {
        tree.material.color
          .copy(tree.base)
          .multiply(tint)
          .lerp(FROST, look.snow * FROST_AMOUNT);
      }
    },
  };
}
