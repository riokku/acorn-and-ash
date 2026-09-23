import { CLEARING_TREE_LINE_INNER, CLEARING_TREE_LINE_OUTER, SPAWN_POSITION } from '../constants';
import { createRng } from '../rng';
import { PROP_KINDS, propHeight, stumpScaleFor, type PropKindId } from '../data/props';
import type { ItemId } from '../data/items';
import { cylinder, type Collider } from './colliders';
import { overlapsWater, waterColliders, type WaterCircle } from './water';

/** One piece of scenery standing in the world. */
export interface PlacedProp {
  readonly id: number;
  readonly kind: PropKindId;
  readonly x: number;
  readonly z: number;
  /**
   * Base height off the ground, in metres. Absent, or zero, everywhere in the
   * hand-built clearing, which is flat; the wilderness sets this from the
   * terrain so a tree on a hillside sits on the slope rather than floating
   * above or sinking into it.
   */
  readonly y?: number;
  readonly rotationY: number;
  readonly scale: number;
}

/**
 * Something lying in the world waiting to be picked up.
 *
 * Pickups are part of the seeded clearing, so the client already knows where
 * each one is and the server only has to say which ones are still there.
 */
export interface PlacedPickup {
  readonly id: number;
  readonly item: ItemId;
  readonly x: number;
  readonly z: number;
  /** How high off the ground to draw it. */
  readonly y: number;
}

/**
 * A patch anybody can gather from by hand, any time - fallen branches for a
 * stick, wildflowers for a flower. Unlike a pickup it is never used up, so it
 * carries no id and nothing about it is ever sent over the wire: every client
 * already knows it is always there, the same way it knows where every tree is.
 */
export interface GatherSpot {
  readonly x: number;
  readonly z: number;
  readonly item: ItemId;
}

export interface Clearing {
  readonly seed: number;
  readonly props: readonly PlacedProp[];
  readonly pickups: readonly PlacedPickup[];
  readonly gatherSpots: readonly GatherSpot[];
  /** The pond, as the overlapping circles it is made of. */
  readonly water: readonly WaterCircle[];
  /**
   * Everything you bump into: each prop's collider, in the same order as
   * `props`, followed by the walls around the water. Keeping the props first
   * means a prop's index finds its collider, which is how a felled tree swaps
   * its trunk for a stump.
   */
  readonly colliders: readonly Collider[];
  /**
   * Where each prop sits in `props` and `colliders`, by its id.
   *
   * Felling a tree has to find its collider to swap it for a stump, and this
   * saves scanning a hundred and forty trees to do it.
   */
  readonly indexById: ReadonlyMap<number, number>;
}

/**
 * Where the first axe is waiting: sunk into an old stump beside the big oak.
 *
 * It is far enough from the spawn point that you have to look around for it,
 * and next to the landmark you can actually navigate by.
 */
export const AXE_STUMP = { x: -8.2, z: -9.4 } as const;
export const AXE_PICKUP_ID = 1;

/**
 * The pond, on the open ground to the right of where you start.
 *
 * Three overlapping circles make a kidney shape rather than a perfect disc. It
 * sits clear of the landmarks and of the walk from the start to the axe, so the
 * clearing you already know keeps its shape.
 */
export const POND: readonly WaterCircle[] = [
  { x: 11, z: -5, radius: 4.2 },
  { x: 14.5, z: -3, radius: 3.2 },
  { x: 9.5, z: -8.2, radius: 2.6 },
];

/** Where the first fishing rod lies, on the bank nearest the start. */
export const ROD_SPOT = { x: 5.6, z: -4.2 } as const;
export const ROD_PICKUP_ID = 2;

/**
 * Fallen branches you can gather sticks from. One near the spawn point, so it
 * is the very first thing a new player finds, and one further out by the axe
 * stump, so a second player who missed out on the axe still has a reason to
 * walk that way.
 */
export const STICK_PATCHES: readonly { x: number; z: number }[] = [
  { x: 2.6, z: 1.8 },
  { x: -6.6, z: -13.6 },
];

/**
 * Wildflowers you can gather by hand, the same way as a stick patch. One a
 * short walk from spawn, one out by the pond, so there is a reason to wander
 * either way once building is worth doing.
 */
export const FLOWER_PATCHES: readonly { x: number; z: number }[] = [
  { x: -4, z: 13 },
  { x: 19, z: -8 },
];

/** Nothing is placed inside this circle, so players always spawn in the open. */
const SPAWN_CLEAR_RADIUS = 7;
/** How far into the tree line the wall of trunks runs. */
const TREE_LINE_INNER = CLEARING_TREE_LINE_INNER;
const TREE_LINE_OUTER = CLEARING_TREE_LINE_OUTER;

const TREE_KINDS: readonly PropKindId[] = ['pine', 'birch', 'oak'];
const ROCK_KINDS: readonly PropKindId[] = ['boulder', 'mossyRock'];
/** Room kept around the water's edge and around anything lying there to be found. */
const ROCK_CLEARANCE = 1.2;

/**
 * Build the hand-built home clearing: flat ground with a ring of trees around
 * the edge, a few landmark trees inside it and some scattered rocks.
 *
 * The same seed always produces the same clearing, on the server and on every
 * client, so nobody has to send the scenery over the network.
 */
export function buildTestClearing(seed: number): Clearing {
  const rng = createRng(seed);
  const props: PlacedProp[] = [];
  let nextId = 1;

  const add = (kind: PropKindId, x: number, z: number, scale: number): void => {
    props.push({ id: nextId++, kind, x, z, rotationY: rng.nextRange(0, Math.PI * 2), scale });
  };

  // Hand-placed landmarks, so the clearing has a shape you can navigate by.
  add('oak', -9, -11, 1.25);
  add('pine', 12, -14, 1.1);
  add('birch', 15, 4, 1);
  add('birch', 17.5, 6.5, 0.9);
  add('boulder', -14, 9, 1.2);
  add('boulder', -16.5, 7.5, 0.85);
  add('mossyRock', 6, 13, 1);
  add('mossyRock', 7.4, 14.2, 0.8);
  add('pine', -20, -18, 1.15);

  // A ring of trees marking the edge of the clearing.
  const ringCount = 132;
  for (let i = 0; i < ringCount; i++) {
    const angle = (i / ringCount) * Math.PI * 2 + rng.nextRange(-0.012, 0.012);
    const radius = rng.nextRange(TREE_LINE_INNER, TREE_LINE_OUTER);
    const kind = rng.pick(TREE_KINDS);
    add(kind, Math.cos(angle) * radius, Math.sin(angle) * radius, rng.nextRange(0.85, 1.3));
  }

  // Rocks scattered across the open ground, kept away from the spawn point.
  for (let i = 0; i < 26; i++) {
    const x = rng.nextRange(-TREE_LINE_INNER + 3, TREE_LINE_INNER - 3);
    const z = rng.nextRange(-TREE_LINE_INNER + 3, TREE_LINE_INNER - 3);
    if (isNearSpawn(x, z)) continue;
    add(rng.pick(ROCK_KINDS), x, z, rng.nextRange(0.7, 1.35));
  }

  // Added last so that everything above keeps the layout it had before there
  // was an axe: the same seed still grows the same clearing.
  add('stump', AXE_STUMP.x, AXE_STUMP.z, 1);

  const pickups: PlacedPickup[] = [
    {
      id: AXE_PICKUP_ID,
      item: 'axe',
      x: AXE_STUMP.x,
      z: AXE_STUMP.z,
      // Resting in the top of the stump rather than on the ground.
      y: PROP_KINDS.stump.shape.height,
    },
    { id: ROD_PICKUP_ID, item: 'rod', x: ROD_SPOT.x, z: ROD_SPOT.z, y: 0 },
  ];
  const gatherSpots: GatherSpot[] = [
    ...STICK_PATCHES.map((spot) => ({ ...spot, item: 'stick' as const })),
    ...FLOWER_PATCHES.map((spot) => ({ ...spot, item: 'flower' as const })),
  ];

  const water = POND;
  // Scattered rocks were placed before there was a pond, so a few land in it or
  // on top of something waiting to be found. They are taken out afterwards
  // rather than never placed: skipping one while placing would shift every id
  // after it, and trees are saved by their ids.
  const spotsToKeepClear = [...pickups, ...gatherSpots];
  const kept = props.filter((prop) => !isRockInTheWay(prop, water, spotsToKeepClear));

  const indexById = new Map<number, number>();
  kept.forEach((prop, index) => indexById.set(prop.id, index));

  return {
    seed,
    props: kept,
    pickups,
    gatherSpots,
    water,
    colliders: [...kept.map(colliderForProp), ...waterColliders(water)],
    indexById,
  };
}

/** A rock sitting in the pond, or on top of something you are meant to find. */
function isRockInTheWay(
  prop: PlacedProp,
  water: readonly WaterCircle[],
  spots: readonly { readonly x: number; readonly z: number }[],
): boolean {
  if (!ROCK_KINDS.includes(prop.kind)) return false;
  const footprint = PROP_KINDS[prop.kind].colliderRadius * prop.scale + ROCK_CLEARANCE;
  if (overlapsWater(water, prop.x, prop.z, footprint)) return true;
  return spots.some((spot) => Math.hypot(spot.x - prop.x, spot.z - prop.z) < footprint);
}

function isNearSpawn(x: number, z: number): boolean {
  const dx = x - SPAWN_POSITION.x;
  const dz = z - SPAWN_POSITION.z;
  return dx * dx + dz * dz < SPAWN_CLEAR_RADIUS * SPAWN_CLEAR_RADIUS;
}

/** Everything in the clearing is a cylinder you cannot walk through. */
export function colliderForProp(prop: PlacedProp): Collider {
  const kind = PROP_KINDS[prop.kind];
  return cylinder(
    prop.x,
    prop.z,
    kind.colliderRadius * prop.scale,
    propHeight(kind) * prop.scale,
    prop.y ?? 0,
  );
}

/** The stump left where a tree used to stand. */
export function stumpFor(tree: PlacedProp): PlacedProp {
  return {
    ...tree,
    kind: 'stump',
    scale: stumpScaleFor(PROP_KINDS[tree.kind], tree.scale),
  };
}

/** What the player bumps into once a tree is down: the stump, not the trunk. */
export function stumpColliderFor(tree: PlacedProp): Collider {
  return colliderForProp(stumpFor(tree));
}
