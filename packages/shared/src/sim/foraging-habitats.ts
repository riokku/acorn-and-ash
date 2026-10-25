import { PROP_KINDS } from '../data/props';
import type { DiscoverySite } from '../data/discoveries';
import type { PlacedProp, GatherSpot } from '../world/clearing';
import type { Terrain } from '../world/terrain';
import { createRng, hashSeed } from '../rng';
import { GATHER_PATCH_MAX_COUNT } from '../constants';
import { patchCount, type GatherPatchView } from './gathering';

/** Reserved after seasonal flushes (240–242); existing patch IDs never change. */
export const FORAGE_HABITAT_IDS = [243, 244, 245, 246, 247, 248] as const;
export const isForageHabitat = (id: number): boolean =>
  FORAGE_HABITAT_IDS.some((key) => key === id);
export interface ForageHabitat extends GatherSpot {
  readonly item: 'berry' | 'mushroom';
  readonly habitat: 'wood' | 'sun';
  readonly timber?: { readonly x: number; readonly z: number };
}

/** Index the original canopy once; sunlight is a stable property of each colony's chosen clearing. */
export function forestCanopy(props: readonly PlacedProp[]): (x: number, z: number) => boolean {
  const cells = new Map<string, { x: number; z: number; radius: number }[]>();
  for (const prop of props) {
    const shape = PROP_KINDS[prop.kind].shape;
    if (shape.family !== 'tree') continue;
    const radius = shape.canopyRadius * prop.scale + 1.5;
    const tree = { x: prop.x, z: prop.z, radius };
    for (let x = Math.floor((prop.x - radius) / 16); x <= Math.floor((prop.x + radius) / 16); x++)
      for (
        let z = Math.floor((prop.z - radius) / 16);
        z <= Math.floor((prop.z + radius) / 16);
        z++
      ) {
        const key = `${x},${z}`,
          bucket = cells.get(key);
        if (bucket) bucket.push(tree);
        else cells.set(key, [tree]);
      }
  }
  return (x, z) =>
    (cells.get(`${Math.floor(x / 16)},${Math.floor(z / 16)}`) ?? []).some(
      (tree) => Math.hypot(tree.x - x, tree.z - z) < tree.radius,
    );
}

/** Colonies reuse recognizable existing timber and the forest's natural canopy gaps. */
export function buildForageHabitats(
  seed: number,
  sites: readonly DiscoverySite[],
  props: readonly PlacedProp[],
  terrain: Terrain,
  clear: (x: number, z: number) => boolean,
): ForageHabitat[] {
  const homes: ForageHabitat[] = [];
  const flat = (x: number, z: number) => {
    const y = terrain.heightAt(x, z);
    return (
      Math.abs(terrain.heightAt(x + 0.8, z) - y) < 0.3 &&
      Math.abs(terrain.heightAt(x, z + 0.8) - y) < 0.3 &&
      clear(x, z)
    );
  };
  for (const [index, kind] of (['grove', 'logging', 'raccoonHollow'] as const).entries()) {
    const site = sites.find((site) => site.kind === kind);
    if (!site) continue;
    const wood = {
      x: site.x + (kind === 'raccoonHollow' ? 0.75 : 1.6),
      z: site.z - (kind === 'raccoonHollow' ? 0 : 1.6),
    };
    const rng = createRng(hashSeed(seed, 'wood-colony', index));
    for (let attempt = 0; attempt < 64; attempt++) {
      const angle = attempt === 0 ? -Math.PI / 2 : rng.nextRange(-Math.PI, Math.PI);
      const radius = attempt === 0 ? 3 : rng.nextRange(2.2, 3.6);
      const x = wood.x + Math.cos(angle) * radius,
        z = wood.z + Math.sin(angle) * radius;
      if (!flat(x, z)) continue;
      homes.push({
        id: FORAGE_HABITAT_IDS[index]!,
        item: 'mushroom',
        habitat: 'wood',
        timber: wood,
        x,
        z,
      });
      break;
    }
  }
  const covered = forestCanopy(props);
  const rng = createRng(hashSeed(seed, 'sunny-berry-colonies'));
  for (let index = 0; index < 3; index++) {
    for (let attempt = 0; attempt < 512; attempt++) {
      const angle = rng.nextRange(-Math.PI, Math.PI),
        radius = rng.nextRange(42, 115);
      const x = Math.cos(angle) * radius,
        z = Math.sin(angle) * radius;
      if (
        covered(x, z) ||
        homes.some((home) => Math.hypot(home.x - x, home.z - z) < 18) ||
        !flat(x, z)
      )
        continue;
      homes.push({ id: FORAGE_HABITAT_IDS[index + 3]!, item: 'berry', habitat: 'sun', x, z });
      break;
    }
  }
  return homes;
}

export function forageRegrowSpot(
  seed: number,
  home: ForageHabitat,
  generation: number,
  clear: (x: number, z: number) => boolean,
): { x: number; z: number } | null {
  const rng = createRng(hashSeed(seed, 'colony-regrowth', home.id, generation));
  for (let attempt = 0; attempt < 32; attempt++) {
    const angle = rng.nextRange(-Math.PI, Math.PI),
      radius = rng.nextRange(0, 1.5);
    const x = home.x + Math.cos(angle) * radius,
      z = home.z + Math.sin(angle) * radius;
    if ((!home.timber || Math.hypot(x - home.timber.x, z - home.timber.z) >= 2.2) && clear(x, z))
      return { x, z };
  }
  return clear(home.x, home.z) ? { x: home.x, z: home.z } : null;
}
export function forageHabitatCount(seed: number, id: number, generation: number): number {
  return Math.min(GATHER_PATCH_MAX_COUNT, patchCount(seed, id, generation) + 1);
}
export function forageHabitatHint(
  patches: readonly GatherPatchView[],
  x: number,
  z: number,
): string | null {
  const patch = patches
    .filter((p) => isForageHabitat(p.id) && Math.hypot(p.x - x, p.z - z) < 6)
    .sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
  if (!patch) return null;
  const habitat =
    patch.item === 'mushroom'
      ? 'Damp wood · a mushroom colony'
      : 'A sunny opening · a wild berry colony';
  return patch.remaining > 0
    ? `${habitat}. Remember this spot; it grows back nearby.`
    : `${habitat}, picked clean. Give it time to grow back.`;
}
