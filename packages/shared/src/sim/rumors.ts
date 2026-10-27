import { hashSeed } from '../rng';
import type { ItemId } from '../data/items';
import type { DiscoveryKind, DiscoverySite } from '../data/discoveries';
import type { ExpeditionDefinition, ExpeditionState } from './expeditions';

export const RUMOR_IDS = [12, 13, 14] as const;
export interface RumorOutcome {
  readonly title: string;
  readonly story: string;
  readonly rewards: readonly { item: ItemId; count: number }[];
}
export interface RumorDefinition {
  readonly id: number;
  readonly name: string;
  readonly introduction: string;
  readonly route: readonly [DiscoveryKind, DiscoveryKind, DiscoveryKind];
  readonly clues: readonly [string, string];
  readonly outcomes: readonly RumorOutcome[];
}
export const RUMORS: readonly RumorDefinition[] = [
  {
    id: 12,
    name: 'The pack beneath the rain',
    introduction:
      'A rain-stained scrap on the board reads: “My pack never made it home.” Start at the forgotten camp. Read the abandoned notes with E; take a shovel, food and a weapon for the ruins.',
    route: ['camp', 'logging', 'grove'],
    clues: [
      'The bedroll holds a timber tally: “Left the pack with the cutters. Look for the old logging stack.”',
      'Under the timber: “The grove stayed dry. I hid it where the frayed pennant watches over the mushrooms.”',
    ],
    outcomes: [
      {
        title: 'An herbalist’s dry bundle',
        story:
          'Oilcloth kept the old forager’s tunic and supper dry. A pressed fern marks the last page: “There is always another way home.”',
        rewards: [
          { item: 'travelerTunic', count: 1 },
          { item: 'forestStew', count: 2 },
          { item: 'mushroom', count: 6 },
        ],
      },
      {
        title: 'A winter walker’s kit',
        story:
          'A wool-lined hat, worn boots and carefully wrapped rations. Their owner knew how quickly the mountain could turn cold.',
        rewards: [
          { item: 'bearHat', count: 1 },
          { item: 'leatherBoots', count: 1 },
          { item: 'trailRation', count: 3 },
        ],
      },
      {
        title: 'A timberwright’s spare pack',
        story:
          'A folded bag protects a handful of ore and a trail supper. The buckle is scratched with a tiny drawing of a cabin.',
        rewards: [
          { item: 'bag', count: 1 },
          { item: 'ironOre', count: 4 },
          { item: 'trailRation', count: 2 },
        ],
      },
    ],
  },
  {
    id: 13,
    name: 'A lantern beyond the ferns',
    introduction:
      'Someone saw a lantern moving beyond the mushroom grove long after dusk. Begin at its frayed pennant. Follow the notes with E; bring a shovel, food and a weapon.',
    route: ['grove', 'shrine', 'camp'],
    clues: [
      'A damp note: “The light belongs to the keeper of the mossy shrine. Follow the old offering trail.”',
      'Behind the offering stone: “The keeper has gone. Their traveling bundle lies at the forgotten camp, beneath the old bedroll.”',
    ],
    outcomes: [
      {
        title: 'The nightfisher’s provisions',
        story:
          'The lantern belonged to a fisher, following the river by starlight. A spare rod and fragrant tea wait in the bundle.',
        rewards: [
          { item: 'rod', count: 1 },
          { item: 'berryTea', count: 3 },
          { item: 'flower', count: 6 },
        ],
      },
      {
        title: 'The keeper’s traveling clothes',
        story:
          'Mended trousers and two jars of supper. A final note says the keeper left to see the far side of the mountains.',
        rewards: [
          { item: 'travelerTrousers', count: 1 },
          { item: 'forestStew', count: 2 },
          { item: 'reed', count: 8 },
        ],
      },
      {
        title: 'A messenger’s forgotten satchel',
        story:
          'The letters have faded, but the spare bag and wrapped rations are sound. A few dried flowers still keep their color.',
        rewards: [
          { item: 'bag', count: 1 },
          { item: 'trailRation', count: 3 },
          { item: 'flower', count: 6 },
        ],
      },
    ],
  },
  {
    id: 14,
    name: 'The old forester’s promise',
    introduction:
      'A penciled promise: “For whoever keeps the trail alive.” Search the timber at the old logging site. Read each clue with E; bring a shovel, food and a weapon for the guarded ruins.',
    route: ['logging', 'camp', 'shrine'],
    clues: [
      'Carved in the tally board: “Rest where the last traveler slept. My promise waits in their notes.”',
      'The camp note reads: “One last offering at the mossy shrine. The forest gave us a home; leave the path better than you found it.”',
    ],
    outcomes: [
      {
        title: 'The forester’s working clothes',
        story:
          'A stout tunic, good boots and sound timber. The forester’s promise was simple: help the next home take root.',
        rewards: [
          { item: 'travelerTunic', count: 1 },
          { item: 'leatherBoots', count: 1 },
          { item: 'log', count: 8 },
        ],
      },
      {
        title: 'A winter gift for the next traveler',
        story:
          'A warm jacket and tea, folded beside a cedar shaving. Someone prepared for a stranger’s coldest evening.',
        rewards: [
          { item: 'winterJacket', count: 1 },
          { item: 'berryTea', count: 2 },
        ],
      },
      {
        title: 'The last trail supper',
        story:
          'A well-used bag holds carefully preserved suppers and dry firewood. The note ends: “Share a meal when you get home.”',
        rewards: [
          { item: 'bag', count: 1 },
          { item: 'forestStew', count: 3 },
          { item: 'log', count: 4 },
        ],
      },
    ],
  },
];
export function rumorDefinition(id: number | null): RumorDefinition | undefined {
  return RUMORS.find((r) => r.id === id);
}
export const RUMOR_EXPEDITIONS: readonly ExpeditionDefinition[] = RUMORS.map((r) => ({
  id: r.id,
  name: r.name,
  hint: r.introduction,
  tier: 0,
  objectives: [0, 1, 2].map((step) => ({
    kind: 'rumor' as const,
    step,
    goal: 1,
    label:
      step === 2
        ? 'Uncover the hidden bundle with a shovel'
        : step === 0
          ? 'Read the first landmark clue'
          : 'Follow the note to the second landmark',
  })),
  rewards: r.outcomes[0]!.rewards,
}));
export function rumorOutcome(state: Readonly<ExpeditionState>, seed: number): RumorOutcome | null {
  const rumor = rumorDefinition(state.active);
  return (
    rumor?.outcomes[
      hashSeed(seed, 'rumor-outcome', state.cycle, rumor.id) % rumor.outcomes.length
    ] ?? null
  );
}
export function rumorStage(state: Readonly<ExpeditionState>): number {
  return rumorDefinition(state.active) ? state.progress.findIndex((n) => n < 1) : -1;
}
export function rumorRoute(
  state: Readonly<ExpeditionState>,
  sites: readonly DiscoverySite[],
): DiscoverySite[] {
  return (
    rumorDefinition(state.active)?.route.flatMap((kind) => {
      const site = sites.find((s) => s.kind === kind);
      return site ? [site] : [];
    }) ?? []
  );
}
export function rumorInteraction(
  state: Readonly<ExpeditionState>,
  sites: readonly DiscoverySite[],
  position: { x: number; z: number },
  held: ItemId | null,
) {
  const next = rumorStage(state),
    route = rumorRoute(state, sites);
  if (next < 0 || route.length !== 3) return null;
  const index = route.findIndex((s) => Math.hypot(s.x - position.x, s.z - position.z) < 2.7);
  if (index < 0) return null;
  return {
    index,
    site: route[index]!,
    ready: index === next && (index !== 2 || held === 'shovel'),
    hint:
      index !== next
        ? 'Follow the rumor’s clues in order.'
        : index === 2
          ? held === 'shovel'
            ? 'Uncover the hidden bundle'
            : 'Equip a shovel to uncover the hidden bundle.'
          : 'Read the rumor’s clue',
  };
}
