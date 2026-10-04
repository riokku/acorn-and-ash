import type { ItemId } from '../data/items';
import type { DiscoveryKind } from '../data/discoveries';
import type { HomeKind } from '../data/housing';
import { cabinDoorstep, type HomePlacement } from '../world/home';
import { hashSeed } from '../rng';

export type ExpeditionEvent =
  | { readonly kind: 'gather'; readonly item: ItemId }
  | { readonly kind: 'chop' | 'fish' | 'defeat' }
  | { readonly kind: 'visit'; readonly site: DiscoveryKind };
export type ExpeditionObjective = ExpeditionEvent & {
  readonly goal: number;
  readonly label: string;
};
export interface ExpeditionDefinition {
  readonly id: number;
  readonly name: string;
  readonly hint: string;
  readonly tier: number;
  readonly objectives: readonly ExpeditionObjective[];
  readonly rewards: readonly { readonly item: ItemId; readonly count: number }[];
}
export const EXPEDITIONS: readonly ExpeditionDefinition[] = [
  {
    id: 0,
    name: 'A forester’s round',
    hint: 'Seek the old logging site, and bring fresh timber work to your journal.',
    tier: 0,
    objectives: [
      { kind: 'chop', goal: 4, label: 'Fell trees' },
      { kind: 'gather', item: 'stick', goal: 12, label: 'Gather sticks' },
      { kind: 'visit', site: 'logging', goal: 1, label: 'Visit the old logging site' },
    ],
    rewards: [
      { item: 'log', count: 6 },
      { item: 'stick', count: 4 },
    ],
  },
  {
    id: 1,
    name: 'Beneath the fern canopy',
    hint: 'Follow the grove’s frayed pennant. Sheltered caps and berries make a good trail pantry.',
    tier: 0,
    objectives: [
      { kind: 'gather', item: 'mushroom', goal: 10, label: 'Gather mushrooms' },
      { kind: 'gather', item: 'berry', goal: 12, label: 'Gather berries' },
      { kind: 'visit', site: 'grove', goal: 1, label: 'Visit the mushroom grove' },
    ],
    rewards: [
      { item: 'log', count: 4 },
      { item: 'flower', count: 4 },
    ],
  },
  {
    id: 2,
    name: 'The forgotten trail',
    hint: 'An abandoned bedroll marks a camp beyond the clearing. Gather supplies along the way.',
    tier: 0,
    objectives: [
      { kind: 'gather', item: 'stick', goal: 16, label: 'Gather sticks' },
      { kind: 'gather', item: 'flower', goal: 8, label: 'Gather flowers' },
      { kind: 'visit', site: 'camp', goal: 1, label: 'Visit the forgotten camp' },
    ],
    rewards: [
      { item: 'log', count: 5 },
      { item: 'berry', count: 6 },
    ],
  },
  {
    id: 3,
    name: 'A quiet waterside outing',
    hint: 'Take your rod to the water, then look for the mossy shrine farther into the forest.',
    tier: 0,
    objectives: [
      { kind: 'fish', goal: 3, label: 'Catch fish' },
      { kind: 'gather', item: 'berry', goal: 10, label: 'Gather berries' },
      { kind: 'visit', site: 'shrine', goal: 1, label: 'Visit the mossy shrine' },
    ],
    rewards: [
      { item: 'stick', count: 8 },
      { item: 'mushroom', count: 4 },
    ],
  },
  {
    id: 4,
    name: 'Watch over the old ruins',
    hint: 'Clear lingering skeletons and inspect the logging ruins. Bring a prepared meal.',
    tier: 1,
    objectives: [
      { kind: 'defeat', goal: 3, label: 'Help defeat skeletons' },
      { kind: 'chop', goal: 6, label: 'Fell trees' },
      { kind: 'visit', site: 'logging', goal: 1, label: 'Visit the old logging site' },
    ],
    rewards: [
      { item: 'log', count: 10 },
      { item: 'bone', count: 4 },
    ],
  },
  {
    id: 5,
    name: 'The cabin pantry',
    hint: 'A longer forage through grove and water will stock a welcoming home.',
    tier: 1,
    objectives: [
      { kind: 'gather', item: 'mushroom', goal: 18, label: 'Gather mushrooms' },
      { kind: 'fish', goal: 5, label: 'Catch fish' },
      { kind: 'visit', site: 'grove', goal: 1, label: 'Visit the mushroom grove' },
    ],
    rewards: [
      { item: 'log', count: 8 },
      { item: 'flower', count: 6 },
    ],
  },
  {
    id: 6,
    name: 'A guardian’s neighborhood',
    hint: 'Read the heavy tracks toward the hollow. Approach prepared, and keep the nearby trails safe.',
    tier: 2,
    objectives: [
      { kind: 'defeat', goal: 5, label: 'Help defeat skeletons' },
      { kind: 'gather', item: 'flower', goal: 16, label: 'Gather flowers' },
      { kind: 'visit', site: 'guardianHollow', goal: 1, label: 'Visit the guardian hollow' },
    ],
    rewards: [
      { item: 'log', count: 14 },
      { item: 'bone', count: 6 },
    ],
  },
  {
    id: 7,
    name: 'Timber for a growing home',
    hint: 'Plan a circuit through the logging site and the surrounding timber stands.',
    tier: 2,
    objectives: [
      { kind: 'chop', goal: 10, label: 'Fell trees' },
      { kind: 'gather', item: 'stick', goal: 24, label: 'Gather sticks' },
      { kind: 'visit', site: 'logging', goal: 1, label: 'Visit the old logging site' },
    ],
    rewards: [
      { item: 'log', count: 16 },
      { item: 'stick', count: 8 },
    ],
  },
];
export interface ExpeditionState {
  cycle: number;
  completed: number;
  active: number | null;
  progress: number[];
  cosmetics: number;
}
export const EXPEDITION_NOTICES = [
  'none',
  'away',
  'busy',
  'active',
  'choice',
  'unfinished',
  'full',
  'accepted',
  'claimed',
] as const;
export type ExpeditionNotice = (typeof EXPEDITION_NOTICES)[number];
export interface ExpeditionView extends ExpeditionState {
  readonly offers: readonly number[];
  readonly notice: ExpeditionNotice;
}
export type ExpeditionRequest =
  { readonly action: 'accept'; readonly index: number } | { readonly action: 'claim' };
export const TRAIL_PENNANT_SKILL = 1;
export function emptyExpedition(): ExpeditionState {
  return { cycle: 0, completed: 0, active: null, progress: [0, 0, 0], cosmetics: 0 };
}
export function expeditionFromSaved(value: unknown): ExpeditionState {
  const fresh = emptyExpedition();
  if (typeof value !== 'object' || value === null) return fresh;
  const v = value as Record<string, unknown>;
  const integer = (n: unknown, max: number): n is number =>
    typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= max;
  if (
    !integer(v.cycle, 0xffffffff) ||
    !integer(v.completed, 0xffffffff) ||
    !integer(v.cosmetics, 1) ||
    !(v.active === null || integer(v.active, EXPEDITIONS.length - 1)) ||
    !Array.isArray(v.progress) ||
    v.progress.length !== 3 ||
    !v.progress.every((n) => integer(n, 65535))
  )
    return fresh;
  const definition = v.active === null ? null : EXPEDITIONS[v.active];
  return {
    cycle: v.cycle,
    completed: v.completed,
    active: v.active,
    progress: v.progress.map((n, i) => Math.min(n, definition?.objectives[i]?.goal ?? 0)),
    cosmetics: v.cosmetics,
  };
}
export function expeditionComplete(state: Readonly<ExpeditionState>): boolean {
  const mission = state.active === null ? undefined : EXPEDITIONS[state.active];
  return (
    mission !== undefined &&
    mission.objectives.every((goal, i) => (state.progress[i] ?? 0) >= goal.goal)
  );
}
export function expeditionOffers(
  home: HomeKind | null,
  state: Readonly<ExpeditionState>,
  seed: number,
  owner: string,
): number[] {
  const tier = home === 'largeCabin' ? 3 : home === 'cabin' ? 2 : home === 'teepee' ? 1 : 0;
  const eligible = EXPEDITIONS.filter((def) => def.tier <= tier).map((def) => def.id);
  const start = hashSeed(seed, 'expeditions', owner, state.cycle) % eligible.length;
  return [0, 1, 2].map((i) => eligible[(start + i) % eligible.length]!);
}
export function progressExpedition(
  state: ExpeditionState,
  event: ExpeditionEvent,
  count = 1,
): boolean {
  if (!Number.isInteger(count) || count <= 0 || state.active === null) return false;
  const mission = EXPEDITIONS[state.active];
  if (!mission) return false;
  let changed = false;
  mission.objectives.forEach((goal, i) => {
    if (
      goal.kind !== event.kind ||
      ('item' in goal && (!('item' in event) || goal.item !== event.item)) ||
      ('site' in goal && (!('site' in event) || goal.site !== event.site))
    )
      return;
    const next = Math.min(goal.goal, (state.progress[i] ?? 0) + count);
    if (next !== state.progress[i]) {
      state.progress[i] = next;
      changed = true;
    }
  });
  return changed;
}
export function expeditionBoardSpot(home: HomePlacement): { x: number; z: number } {
  const door = cabinDoorstep(home);
  return {
    x: door.x + Math.cos(home.yaw) * 1.8 + Math.sin(home.yaw) * 0.65,
    z: door.z - Math.sin(home.yaw) * 1.8 + Math.cos(home.yaw) * 0.65,
  };
}
