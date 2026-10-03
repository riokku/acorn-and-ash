import { WOODLAND_ENCOUNTERS } from './tracking';
import type { Terrain } from '../world/terrain';
import { box, cylinder, type Collider } from '../world/colliders';
import type { ItemId } from './items';
import type { EncounterSite } from '../world/encounters';
import type { GatherSpot } from '../world/clearing';

export type DiscoveryKind =
  'camp' | 'logging' | 'grove' | 'shrine' | 'elkGrove' | 'raccoonHollow' | 'guardianHollow';
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
  {
    id: 4,
    kind: 'elkGrove',
    name: 'The elk grove',
    clue: 'Split hoofprints lead northwest. Approach quietly and give the elk room.',
    note: 'A Roosevelt elk grazes beneath its branching crown. Its silhouette belongs in these pages.',
    recipe: null,
    reward: [],
  },
  {
    id: 5,
    kind: 'raccoonHollow',
    name: 'The raccoon hollow',
    clue: 'Tiny hand-shaped prints wind southeast. A curious neighbor knows a hidden cache.',
    note: 'A ring-tailed guide has gathered a little stash beneath a fallen root.',
    recipe: null,
    reward: [
      { item: 'berry', count: 4 },
      { item: 'mushroom', count: 3 },
    ],
  },
  {
    id: 6,
    kind: 'guardianHollow',
    name: 'The guardian hollow',
    clue: 'Heavy root-shaped furrows lead southwest. Something ancient keeps watch among the moss.',
    note: 'You helped overcome the woodland guardian. A branch-crowned trophy awaits at its hollow.',
    recipe: null,
    reward: [{ item: 'guardianTrophy', count: 1 }],
  },
];
export const DISCOVERY_MASK = 127;
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
    ...WOODLAND_ENCOUNTERS,
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
export type DiscoveryNotice = 'none' | 'guarded' | 'full' | 'quiet' | 'guardian';
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
    if (site.kind === 'raccoonHollow') {
      const floor = terrain.heightAt(site.x + 0.75, site.z);
      return [
        box(site.x + 0.75, floor + 0.24, site.z, 0.75, 0.24, 0.22, 0.7),
        box(site.x + 0.3, floor + 0.1, site.z + 0.45, 0.175, 0.1, 0.15),
      ];
    }
    if (site.kind === 'camp')
      return [
        box(site.x - 0.8, terrain.heightAt(site.x - 0.8, site.z) + 0.12, site.z, 0.19, 0.12, 0.15),
      ];
    if (site.kind === 'logging') return [box(x, y + 0.23, z + 0.25, 0.9, 0.23, 0.47)];
    if (site.kind === 'shrine') return [cylinder(x, z, 0.63, 0.65, y)];
    return [];
  });
}
