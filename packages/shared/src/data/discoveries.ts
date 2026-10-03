import type { Terrain } from '../world/terrain';
import { box, cylinder, type Collider } from '../world/colliders';
import type { ItemId } from './items';
import type { EncounterSite } from '../world/encounters';
import type { GatherSpot } from '../world/clearing';

export type DiscoveryKind = 'camp' | 'logging' | 'grove' | 'shrine';
export interface DiscoveryDefinition {
  readonly id: number;
  readonly kind: DiscoveryKind;
  readonly name: string;
  readonly clue: string;
  readonly note: string;
  readonly recipe: ItemId | null;
  readonly reward: readonly { item: ItemId; count: number }[];
}
export const DISCOVERIES: readonly DiscoveryDefinition[] = [
  {
    id: 0,
    kind: 'camp',
    name: 'The forgotten camp',
    clue: 'Beyond the clearing, look for an old trail cairn and a weathered bedroll.',
    note: 'Someone left a recipe for food that travels well. A good place to begin an expedition.',
    recipe: 'trailRation',
    reward: [{ item: 'berry', count: 4 }],
  },
  {
    id: 1,
    kind: 'logging',
    name: 'The old logging site',
    clue: 'Broken masonry shelters a long-abandoned timber stack. Its guards still linger.',
    note: 'The timber is sound beneath its weathered edges. Useful work was done here once.',
    recipe: null,
    reward: [
      { item: 'log', count: 6 },
      { item: 'stick', count: 4 },
    ],
  },
  {
    id: 2,
    kind: 'grove',
    name: 'The mushroom grove',
    clue: 'Follow a frayed trail pennant to a small glade. Visit in daylight for a quiet forage.',
    note: 'Sheltered caps grow beneath a fallen branch. An old cooking note teaches a filling forest stew.',
    recipe: 'forestStew',
    reward: [{ item: 'mushroom', count: 6 }],
  },
  {
    id: 3,
    kind: 'shrine',
    name: 'The mossy shrine',
    clue: 'Farther into the trees, a second ruin holds a small moss-covered offering stone.',
    note: 'A faded inscription describes a fragrant berry tea. The quiet here feels worth protecting.',
    recipe: 'berryTea',
    reward: [
      { item: 'berry', count: 4 },
      { item: 'flower', count: 2 },
    ],
  },
];
export const DISCOVERY_MASK = 15;
export interface DiscoverySite extends DiscoveryDefinition {
  readonly x: number;
  readonly z: number;
}
export function buildDiscoverySites(encounters: readonly EncounterSite[]): DiscoverySite[] {
  const sources = [
    encounters.find((s) => s.kind === 'wanderer'),
    encounters.find((s) => s.kind === 'ruins'),
    encounters.find((s) => s.kind === 'patrol'),
    encounters.filter((s) => s.kind === 'ruins')[1],
  ];
  return DISCOVERIES.flatMap((definition, index) => {
    const source = sources[index];
    return source === undefined ? [] : [{ ...definition, x: source.x, z: source.z }];
  });
}
export function discoveryKnown(mask: number, id: number): boolean {
  return (mask & (1 << id)) !== 0;
}
export function discoveryForageSpots(sites: readonly DiscoverySite[]): GatherSpot[] {
  return sites
    .filter((s) => s.kind === 'camp' || s.kind === 'grove')
    .flatMap((site) => [
      // Patch IDs are one byte on the established wire format. Reserve 200–207.
      { id: 200 + site.id * 2, x: site.x - 1.8, z: site.z + 1.5, item: 'berry' as const },
      { id: 201 + site.id * 2, x: site.x + 1.8, z: site.z + 1.5, item: 'mushroom' as const },
    ]);
}
export type DiscoveryNotice = 'none' | 'guarded' | 'full';
export interface DiscoveryState {
  readonly found: number;
  readonly claimed: number;
  readonly notice: DiscoveryNotice;
}

export function discoveryColliders(sites: readonly DiscoverySite[], terrain: Terrain): Collider[] {
  return sites.flatMap<Collider>((site) => {
    const x = site.x + 1.6,
      z = site.z - 1.6,
      y = terrain.heightAt(x, z);
    if (site.kind === 'camp')
      return [
        box(site.x - 0.8, terrain.heightAt(site.x - 0.8, site.z) + 0.12, site.z, 0.19, 0.12, 0.15),
      ];
    if (site.kind === 'logging') return [box(x, y + 0.23, z + 0.25, 0.9, 0.23, 0.47)];
    if (site.kind === 'shrine') return [cylinder(x, z, 0.63, 0.65, y)];
    return [];
  });
}
