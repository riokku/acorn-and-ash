/**
 * What grows on the lake's islands: a few windswept trees and rocks round the
 * edge, with the middle left clear for whatever is built or found there later.
 *
 * Built from the world seed alone, like the rest of the wilderness, so every
 * browser and the server put the same trees on the same islands.
 */

import { createRng, hashSeed } from '../rng';
import type { PropKindId } from '../data/props';
import { islandDepthAt, type Lake, type LakeIsland } from './lake';
import type { PlacedProp } from './clearing';
import type { Terrain } from './terrain';

const ISLAND_TREES: readonly PropKindId[] = ['pine', 'birch', 'oak'];
const ISLAND_ROCKS: readonly PropKindId[] = ['boulder', 'mossyRock'];

/** Trees stand at least this far in from the water, so none are half on the beach. */
const SHORE_CLEARANCE = 1.3;
/** The middle of the island is kept open, in metres from its first circle's centre: at most this, and never more than half the circle. */
const HEART_CLEARANCE = 3.4;
/** No two things on an island stand closer than this. */
const SPACING = 2.8;
/** One tree or rock for roughly this many square metres of island. */
const AREA_PER_PROP = 42;
const MOST_PROPS_PER_ISLAND = 7;
const ATTEMPTS_PER_PROP = 30;
/** About one in four is a rock. */
const ROCK_CHANCE = 0.25;

/** Roughly how much ground an island covers, in square metres. The circles overlap, so this is a little generous. */
function islandArea(island: LakeIsland): number {
  return island.lobes.reduce((sum, lobe) => sum + Math.PI * lobe.radius * lobe.radius * 0.75, 0);
}

/**
 * The trees and rocks on every island of `lake`, numbered from `firstId` so
 * they never share a number with the rest of the wilderness.
 */
export function buildIslandProps(
  seed: number,
  lake: Lake,
  terrain: Terrain,
  firstId: number,
): PlacedProp[] {
  const props: PlacedProp[] = [];
  let nextId = firstId;

  for (const island of lake.islands) {
    const rng = createRng(hashSeed(seed, 'island', island.id));
    const heart = island.lobes[0];
    if (heart === undefined) continue;
    const wanted = Math.min(
      MOST_PROPS_PER_ISLAND,
      Math.max(2, Math.round(islandArea(island) / AREA_PER_PROP)),
    );
    const here: PlacedProp[] = [];
    const openMiddle = Math.min(HEART_CLEARANCE, heart.radius * 0.5);

    for (let attempt = 0; attempt < wanted * ATTEMPTS_PER_PROP && here.length < wanted; attempt++) {
      const lobe = rng.pick(island.lobes);
      const angle = rng.nextRange(0, Math.PI * 2);
      // Square root so spots are spread over the circle's area, not bunched at its middle.
      const reach = Math.sqrt(rng.nextFloat()) * lobe.radius;
      const x = lobe.x + Math.cos(angle) * reach;
      const z = lobe.z + Math.sin(angle) * reach;
      if (islandDepthAt(island, x, z) < SHORE_CLEARANCE) continue;
      if (Math.hypot(x - heart.x, z - heart.z) < openMiddle) continue;
      if (here.some((other) => Math.hypot(other.x - x, other.z - z) < SPACING)) continue;

      const isRock = rng.nextFloat() < ROCK_CHANCE;
      const kind = rng.pick(isRock ? ISLAND_ROCKS : ISLAND_TREES);
      here.push({
        id: nextId++,
        kind,
        x,
        z,
        y: terrain.heightAt(x, z),
        rotationY: rng.nextRange(0, Math.PI * 2),
        // Smaller than the forest's: the wind keeps them low.
        scale: isRock ? rng.nextRange(0.7, 1.2) : rng.nextRange(0.7, 1),
      });
    }
    props.push(...here);
  }
  return props;
}
