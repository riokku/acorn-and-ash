/**
 * The named places of the world (decision 0293): the two regions, the
 * landmarks in them, the dangerous places, home, and one far-off sight.
 *
 * `whereaboutsAt` says which region a point is in and which named spot, if
 * any, it stands on. A game shows a place's name as a banner on walking into
 * it, and the map labels the ones that have been explored.
 *
 * Names are scenery: nothing here changes a rule, and the server does not
 * need to know where a player thinks they are.
 */

import { CLEARING_HALF, MOUNTAINS } from '../constants';
import { HIGH_PLAINS, PLAINS_LANDMARKS } from '../world/high-plains';
import { CROWNBREAKER_HOLD } from '../world/hollow-king';
import { kingsRoadCoverage } from '../world/kings-road';
import { LAKE, overlapsLake } from '../world/lake';
import { distanceToRidge, mountainWeight } from '../world/mountains';
import { SKELETON_TOWN } from '../world/skeleton-town';
import { STREAM, nearStream, streamPointAt } from '../world/stream';
import type { WaterCircle } from '../world/water';
import { WORLD_ZONES, worldZoneAt } from '../world/zones';

/**
 * What sort of place it is, which decides how its banner looks: a region is
 * the largest, a danger is in a warning colour, and a sight is somewhere you
 * can see but not walk to.
 */
export type PlaceKind = 'region' | 'landmark' | 'danger' | 'home' | 'sight';

export type PlaceId =
  | 'evergreenMountains'
  | 'sunreachHighPlains'
  | 'acornHollow'
  | 'otterPond'
  | 'mirrormere'
  | 'alderwash'
  | 'greywatchRange'
  | 'oldGreywatch'
  | 'whisperFalls'
  | 'windbreakPass'
  | 'amberDunes'
  | 'crownMesa'
  | 'bonehollow'
  | 'kingsRoad'
  | 'crownbreakerHold'
  | 'ashPeak';

export interface Place {
  readonly id: PlaceId;
  readonly name: string;
  readonly kind: PlaceKind;
  /** Where its name sits on the map, if it has a fixed spot there. */
  readonly x?: number;
  readonly z?: number;
}

const ridgeMiddle = {
  x: (MOUNTAINS.ridgeStart.x + MOUNTAINS.ridgeEnd.x) / 2,
  z: (MOUNTAINS.ridgeStart.z + MOUNTAINS.ridgeEnd.z) / 2,
};

/** Each waterfall on the Alderwash, as a point on the ground. */
const FALLS: readonly { readonly x: number; readonly z: number; readonly drop: number }[] =
  STREAM.falls.map((fall) => {
    const step = STREAM.length / (STREAM.count - 1);
    return { ...streamPointAt(STREAM, Math.round(fall.at / step)), drop: fall.drop };
  });
/** The tallest fall carries the name on the map. */
const TALLEST_FALL = FALLS.reduce((tallest, fall) => (fall.drop > tallest.drop ? fall : tallest));
/** Half-way down the river, for its name on the map. */
const RIVER_MIDDLE = streamPointAt(STREAM, Math.round(STREAM.count * 0.62));

export const PLACES = {
  evergreenMountains: {
    id: 'evergreenMountains',
    name: WORLD_ZONES.mountains.name,
    kind: 'region',
  },
  sunreachHighPlains: {
    id: 'sunreachHighPlains',
    name: HIGH_PLAINS.name,
    kind: 'region',
    x: HIGH_PLAINS.x,
    z: HIGH_PLAINS.z,
  },
  acornHollow: { id: 'acornHollow', name: 'Acorn Hollow', kind: 'home', x: 0, z: 0 },
  otterPond: { id: 'otterPond', name: 'Otter Pond', kind: 'home' },
  mirrormere: { id: 'mirrormere', name: 'Mirrormere', kind: 'landmark', x: 88, z: -88 },
  alderwash: {
    id: 'alderwash',
    name: 'The Alderwash',
    kind: 'landmark',
    x: RIVER_MIDDLE.x,
    z: RIVER_MIDDLE.z,
  },
  greywatchRange: {
    id: 'greywatchRange',
    name: 'The Greywatch Range',
    kind: 'landmark',
    // Down the north-east flank from the crest, so it does not sit on the summit's name.
    x: ridgeMiddle.x + 38,
    z: ridgeMiddle.z - 38,
  },
  oldGreywatch: {
    id: 'oldGreywatch',
    name: 'Old Greywatch',
    kind: 'landmark',
    x: ridgeMiddle.x,
    z: ridgeMiddle.z,
  },
  whisperFalls: {
    id: 'whisperFalls',
    name: 'Whisper Falls',
    kind: 'landmark',
    x: TALLEST_FALL.x,
    z: TALLEST_FALL.z,
  },
  windbreakPass: { id: 'windbreakPass', kind: 'landmark', ...PLAINS_LANDMARKS[0] },
  amberDunes: { id: 'amberDunes', kind: 'landmark', ...PLAINS_LANDMARKS[1] },
  crownMesa: { id: 'crownMesa', kind: 'landmark', ...PLAINS_LANDMARKS[2] },
  bonehollow: {
    id: 'bonehollow',
    name: SKELETON_TOWN.name,
    kind: 'danger',
    x: SKELETON_TOWN.x,
    z: SKELETON_TOWN.z,
  },
  kingsRoad: { id: 'kingsRoad', name: 'The King’s Road', kind: 'danger' },
  crownbreakerHold: {
    id: 'crownbreakerHold',
    name: CROWNBREAKER_HOLD.name,
    kind: 'danger',
    x: CROWNBREAKER_HOLD.x,
    z: CROWNBREAKER_HOLD.z,
  },
  ashPeak: { id: 'ashPeak', name: 'Ash Peak', kind: 'sight' },
} as const satisfies Record<PlaceId, Place>;

/** The far-off sights, and the place each is first seen from. */
export const SIGHTS: readonly {
  readonly sight: PlaceId;
  readonly from: PlaceId;
  readonly line: string;
}[] = [{ sight: 'ashPeak', from: 'mirrormere', line: 'Far to the north-east' }];

/** How near a waterfall counts as standing at the falls, in metres. */
const FALLS_REACH = 11;
/** How far back from the lake's edge its name still holds. */
const LAKE_SHORE = 6;
/** How far from the river's water its name still holds. */
const RIVER_BANK = 5;
/** How far from the pond's water its name still holds. */
const POND_BANK = 2.5;
/** How far up a flank the mountains begin, as a share of their full height. */
const RANGE_STARTS = 0.3;
/** How near each plains landmark its name holds. */
const PLAINS_REACH: Readonly<Record<'windbreakPass' | 'amberDunes' | 'crownMesa', number>> = {
  windbreakPass: 24,
  amberDunes: 32,
  crownMesa: 28,
};

function within(
  place: { readonly x: number; readonly z: number },
  x: number,
  z: number,
  reach: number,
) {
  const dx = x - place.x;
  const dz = z - place.z;
  return dx * dx + dz * dz <= reach * reach;
}

export interface Whereabouts {
  readonly region: Place;
  /** The named spot stood on, if any: the most particular one that holds here. */
  readonly spot: Place | null;
}

/**
 * Where a point is. `pond` is the home pond's water, which is laid out from
 * the world's seed with the clearing.
 *
 * Where spots overlap, the smaller or more pressing one wins: the pond inside
 * the hollow, a waterfall on the river, the summit on the range, a stronghold
 * on its road.
 */
export function whereaboutsAt(x: number, z: number, pond: readonly WaterCircle[]): Whereabouts {
  const zone = worldZoneAt(x, z);
  const region = zone.id === 'highPlains' ? PLACES.sunreachHighPlains : PLACES.evergreenMountains;
  return { region, spot: spotAt(x, z, pond) };
}

function spotAt(x: number, z: number, pond: readonly WaterCircle[]): Place | null {
  if (pond.some((circle) => within(circle, x, z, circle.radius + POND_BANK)))
    return PLACES.otterPond;
  if (Math.max(Math.abs(x), Math.abs(z)) <= CLEARING_HALF) return PLACES.acornHollow;

  if (within(CROWNBREAKER_HOLD, x, z, CROWNBREAKER_HOLD.radius)) return PLACES.crownbreakerHold;
  if (within(SKELETON_TOWN, x, z, SKELETON_TOWN.radius)) return PLACES.bonehollow;
  if (kingsRoadCoverage(x, z) > 0.5) return PLACES.kingsRoad;

  if (FALLS.some((fall) => within(fall, x, z, FALLS_REACH))) return PLACES.whisperFalls;
  if (distanceToRidge(x, z) <= MOUNTAINS.coreRadius) return PLACES.oldGreywatch;

  for (const id of ['windbreakPass', 'crownMesa', 'amberDunes'] as const)
    if (within(PLACES[id], x, z, PLAINS_REACH[id])) return PLACES[id];

  if (overlapsLake(LAKE, x, z, LAKE_SHORE)) return PLACES.mirrormere;
  if (nearStream(STREAM, x, z, RIVER_BANK)) return PLACES.alderwash;
  if (mountainWeight(x, z) >= RANGE_STARTS) return PLACES.greywatchRange;
  return null;
}

/** Every place with a fixed spot for its name on the map. */
export const MAPPED_PLACES: readonly (Place & { readonly x: number; readonly z: number })[] = (
  Object.values(PLACES) as readonly Place[]
).filter(
  (place): place is Place & { readonly x: number; readonly z: number } =>
    place.x !== undefined && place.z !== undefined,
);
