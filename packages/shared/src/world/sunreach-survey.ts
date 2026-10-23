import type { ExpeditionState } from '../sim/expeditions';
import { SUNREACH_EXPEDITION_ID } from '../sim/expeditions';
import type { ItemId } from '../data/items';
import type { DiscoverySite } from '../data/discoveries';
import type { EncounterSite } from './encounters';

/** Personal interactions; no shared chest to race or empty for somebody else. */
export const SUNREACH_SURVEY = [
  {
    x: -203,
    z: -192,
    name: 'Windbreak ranger outpost',
    action: 'Read the ranger’s notes',
    clue: 'The last survey: “Our banner still stands among Amber Dunes, southwest of this post. Look for the small cairn beneath it.”',
  },
  {
    x: -226,
    z: -229,
    name: 'Amber Dunes survey cairn',
    action: 'Read the dune cairn',
    clue: 'Beneath the cairn: “Turn northwest toward Crown Mesa. Southeast of the mesa, between its slopes and the dunes, search for a low mound. Bring a shovel; our survey flag rests there.”',
  },
  {
    x: -245,
    z: -213,
    name: 'Sunreach survey vault',
    action: 'Dig up the survey vault',
    clue: 'The survey flag is safe. Return to your home board to collect the pennant and trail equipment.',
  },
] as const;
export const SUNREACH_REACH = 2.7;
export function surveyStage(state: Readonly<ExpeditionState>): number {
  return state.active === SUNREACH_EXPEDITION_ID
    ? state.progress.findIndex((value) => value < 1)
    : -1;
}
export function surveyInteraction(
  state: Readonly<ExpeditionState>,
  position: { x: number; z: number },
  held: ItemId | null,
) {
  const next = surveyStage(state);
  if (next < 0) return null;
  const index = SUNREACH_SURVEY.findIndex(
    (site) => Math.hypot(position.x - site.x, position.z - site.z) < SUNREACH_REACH,
  );
  if (index < 0) return null;
  return {
    index,
    ready: index === next && (index !== 2 || held === 'shovel'),
    hint:
      index !== next
        ? 'Follow the ranger’s clues in order.'
        : index === 2 && held !== 'shovel'
          ? 'Equip a shovel to open the survey vault.'
          : SUNREACH_SURVEY[index]!.action,
  };
}
/** Reuse the existing ruin, camp notes and pennant assets, with matching shared colliders. */
export const SUNREACH_REMNANTS: readonly EncounterSite[] = [
  { id: 701, kind: 'ruins', x: -203, z: -192, yaw: 0 },
  { id: 702, kind: 'patrol', x: -228.8, z: -231.7, yaw: 0 },
];
export const SUNREACH_NOTES: readonly DiscoverySite[] = [
  {
    id: 70,
    kind: 'camp',
    name: 'Ranger’s notes',
    clue: '',
    note: '',
    recipe: null,
    reward: [],
    x: -203,
    z: -192,
  },
];
export function nearSurveySite(x: number, z: number, padding = 0): boolean {
  return SUNREACH_SURVEY.some((site) => Math.hypot(x - site.x, z - site.z) < 6 + padding);
}
