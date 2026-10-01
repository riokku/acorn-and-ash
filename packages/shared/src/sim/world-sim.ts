import { createWorld, type Entity, type World } from 'koota';

import {
  ANIMAL_RESPAWN_SECONDS,
  BUILD_REACH,
  BUILD_REACH_SLACK,
  CAMPFIRE_BURN_SECONDS,
  GATHER_PATCH_MAX_COUNT,
  HEALTH_MAX,
  HUNGER_EMPTY_AFTER_SECONDS,
  HUNGER_MAX,
  INPUT_BACKLOG_CATCHUP_THRESHOLD,
  INTEREST_RADIUS,
  LAG_COMPENSATION_TICKS,
  LIGHT_SAFETY_RADIUS,
  MAX_DROPPED_PILES,
  MAX_INPUTS_PER_TICK,
  MAX_QUEUED_INPUTS_PER_PLAYER,
  MAX_TREE_GENERATION,
  PATCH_CLEARANCE,
  PATCH_REGROW_MIN_SECONDS,
  PATCH_SPACING,
  PATCH_SPAWN_CLEARANCE,
  PREDATOR_CATCH_RADIUS,
  REGROW_MIN_SECONDS,
  SPAWN_POSITION,
  SPAWN_RING_RADIUS,
  SPRINT_REPORTING_SPEED,
  SWING_COOLDOWN_TICKS,
  TICK_SECONDS,
} from '../constants';
import { createCollisionWorld, type CollisionWorld } from '../collision/capsule';
import {
  AimYaw,
  AnimalTag,
  Facing,
  Grounded,
  LastProcessedInput,
  NetworkId,
  PlayerTag,
  Position,
  Prop,
  StaticTag,
  Velocity,
} from '../ecs/traits';
import { PROP_KINDS, choppingRuleFor, propKindIndex } from '../data/props';
import {
  ANIMAL_KINDS,
  type AnimalKind,
  type AnimalKindId,
  type ThreatBehavior,
} from '../data/animals';
import { BUILDABLE_KINDS, type BuildableKindId } from '../data/buildables';
import { colliderFootprintRadius } from '../world/colliders';
import { isFood, ITEM_KINDS, TOOL_ITEMS, type ItemId } from '../data/items';
import { replaceCollider } from '../collision/capsule';
import { horizontalDistance, type Vec3 } from '../math/vec3';
import {
  buildTestClearing,
  colliderForProp,
  stumpColliderFor,
  type Clearing,
  type PlacedPickup,
  type PlacedProp,
} from '../world/clearing';
import { createFlatTerrain, createWildernessTerrain, type Terrain } from '../world/terrain';
import {
  HOME_ENTRY,
  HOME_ROOM,
  HOME_WAKE_SPOT,
  cabinCollider,
  cabinDoorstep,
  homeRoomColliders,
  isEnteringDoorway,
  isLeavingRoom,
  restingPlaceInReach,
  type PlacedSpot,
  type RestingPlace,
} from '../world/home';
import { castLanding, overlapsWater } from '../world/water';
import { buildWilderness, type Wilderness } from '../world/wilderness';
import { ANIMAL_DENS, type AnimalDen } from '../world/animals';
import {
  fleeDirection,
  hasReachedTarget,
  nightDetection,
  shouldFlee,
  towardDirection,
  wanderTarget,
  type Direction2D,
} from './animals';
import { dayProgress, isNight } from './day-night';
import { exploreCellAt, exploredMapFrom, revealAround } from './exploring';
import {
  addItem,
  countOf,
  hasItem,
  removeItem,
  createInventory,
  inventoryEntries,
  inventoryFromEntries,
  type Inventory,
} from './inventory';
import { pickupInReach } from './pickups';
import {
  freshPatch,
  gatherSpotInReach,
  patchCount,
  patchIsDue,
  patchRegrowSpot,
  patchView,
  type GatherPatch,
  type GatherPatchView,
} from './gathering';
import {
  dropSpot,
  droppedPileInReach,
  isDiscardable,
  pileFadesAtMs,
  pileToMergeInto,
  pileView,
  type DroppedPile,
  type DroppedPileView,
} from './dropping';
import { buryHalf, nearestBuriedCache } from './burying';
import { canAfford, craft } from './crafting';
import { treeInReach, type ChopTarget } from './chopping';
import { animalInReach, type CatchCandidate } from './hunting';
import {
  buildableFootprint,
  checkBuildSpot,
  footprintGap,
  nearestCampfire,
  roundFootprint,
  type Footprint,
} from './building';
import {
  CAST_COOLDOWN_TICKS,
  readCastInput,
  startCast,
  tickCast,
  type Cast,
  type CastEnd,
  type CastInput,
} from './fishing';
import { drainHunger, eat, foodToEat, hungerDrainPerSecond } from './hunger';
import { regrowDueAtMs, spotIsClear, treeAtGeneration } from './regrowth';
import {
  PlayerButton,
  createPlayerMotion,
  idleInput,
  isHeld,
  stepPlayer,
  worldMoveDirection,
  type PlayerInput,
  type PlayerMotion,
} from './player';
import {
  ActionKind,
  RiseFrom,
  advanceAction,
  beginAction,
  createActionState,
  footedInput,
  isFreeToInteract,
  isUntouchable,
  packActionByte,
  stepDodge,
  Gesture,
  type ActionContext,
  type ActionState,
  type GestureEvent,
  type Impact,
} from './actions';
import { DODGE, KNOCKED_OUT_TICKS, LIGHT_COMBO, STRIKE } from '../data/moves';

export interface WorldSimulationOptions {
  readonly seed: number;
  /** Defaults to the generated wilderness terrain, built from `seed`. */
  readonly terrain?: Terrain;
  /** Skip spawning scenery entities. Only used by benchmarks. */
  readonly withProps?: boolean;
  /**
   * The shortest a felled tree takes to come back, in seconds. Trees return
   * somewhere between this and twice it.
   *
   * Turned right down for previews and local runs, so a tree growing back can
   * be watched rather than waited out. Left alone everywhere real.
   */
  readonly regrowMinSeconds?: number;
  /**
   * The shortest a picked-clean stick or flower patch takes to grow back, in
   * seconds. Patches return somewhere between this and twice it.
   *
   * Turned down for previews and local runs the same way `regrowMinSeconds`
   * is, so a patch moving can be watched rather than waited out.
   */
  readonly patchRegrowMinSeconds?: number;
  /**
   * How long a full hunger meter takes to empty, in seconds, if nothing is
   * eaten.
   *
   * Turned right down for previews and local runs, so it can be watched
   * rather than waited out. Left alone everywhere real.
   */
  readonly hungerEmptyAfterSeconds?: number;
}

/**
 * One player or animal as it appears in a snapshot.
 *
 * `netId` is that entity's own id, from a player's `netId` or an animal's -
 * the `Animal` flag says which, and the two are never compared against each
 * other. Velocity travels too. The client that owns this player needs it to
 * re-run its own movement from the server's answer, and for everybody else -
 * player or animal - it lets the client keep a late one gliding instead of
 * freezing.
 */
export interface SnapshotEntity {
  netId: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  flags: number;
  /**
   * What a player is in the middle of - a swing, a roll, sitting down - as
   * `packActionByte` packs it, with how far into it they are, which way a
   * roll is going and how long before they may roll again (see
   * `sim/actions.ts`). Every browser plays other players' moves from these,
   * and a player's own browser picks up from them when it is corrected.
   * All zero for an animal.
   */
  action: number;
  actionAge: number;
  actionHeading: number;
}

export const SnapshotFlag = {
  Moving: 1 << 0,
  Airborne: 1 << 1,
  /** Moving at sprint pace. Derived from speed, so shoving a tree is not a sprint. */
  Sprinting: 1 << 2,
  /**
   * This entity is wildlife, not a player. Its id is that animal's own,
   * never a player's `netId`: the two are only ever compared within the
   * same flag, never against each other.
   */
  Animal: 1 << 3,
} as const;

/** A player's saved state, as it goes into and comes out of storage. */
export interface PersistedPlayer {
  readonly netId: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly facingYaw: number;
  readonly items: readonly { readonly item: ItemId; readonly count: number }[];
  readonly hunger: number;
  /**
   * Optional, and defaults to full: added after every existing save already
   * had a player in it, the same reason `addPlayer`'s `playerKey` is its own
   * optional trailing argument rather than a required one everything else
   * would have needed to change for.
   */
  readonly health?: number;
  /**
   * Optional, the same reason `health` is: added after saves already
   * existed. Re-validated against `items` on load rather than trusted
   * outright, so a save from before an item existed - or one missing
   * whatever this named, however that happened - never crashes, it just
   * falls back to the same default a brand new player gets.
   */
  readonly equippedItem?: ItemId | null;
  /**
   * Which parts of the world they have seen (see decision 0054). Optional,
   * the same reason `health` is; a save without one, or one of the wrong
   * size, starts a fresh map.
   */
  readonly explored?: Uint8Array | null;
}

/** Somebody picked something up. The world server turns these into messages. */
export interface PickupTaken {
  readonly netId: number;
  readonly pickupId: number;
  readonly item: ItemId;
}

/** A swing landed on a tree. */
export interface TreeChopped {
  readonly netId: number;
  readonly treeId: number;
  /** Swings still to go. Zero means it came down. */
  readonly swingsLeft: number;
  /** Logs that went into the chopper's pack, once it did. */
  readonly logsGained: number;
}

/** An animal a swing would land on right now. */
export interface CatchTarget {
  readonly id: number;
  readonly kind: AnimalKindId;
}

/**
 * A swing landed on an animal instead of a tree.
 *
 * Only the catcher is ever told: the animal disappearing is already plain to
 * everybody else from the next snapshot, the same way a felled tree needs no
 * message of its own beyond `TreeChopped`.
 */
export interface AnimalCaught {
  readonly netId: number;
  /** Null for a threat defeated with nothing to show for it - see `ThreatHit`. */
  readonly item: ItemId | null;
  /** How many went into the pack. Zero means there was no room, or nothing to gain. */
  readonly added: number;
}

/**
 * A swing landed on a threat that is still standing, or one just came back
 * from being defeated.
 *
 * Told to everybody, the same as a tree shaking: whoever is fighting it
 * benefits from seeing it react, but so does anyone else nearby.
 */
export interface ThreatHit {
  readonly animalId: number;
  /** Swings still needed to defeat it. A fresh arrival, or one just back from being defeated, reports its full count. */
  readonly hitsLeft: number;
  /** Whose swing it was, so their own browser, which already showed it land, does not show it twice. Null when nobody's. */
  readonly netId: number | null;
}

/**
 * A threat's attack landed, or a player was otherwise knocked out.
 *
 * Only the one it happened to is ever told: nobody else's business how hurt
 * anybody else is, the same reason a `HungerEvent` is private.
 */
export interface HealthEvent {
  readonly netId: number;
  readonly health: number;
  /** Whether this took them all the way to zero - see the next snapshot for where they woke up. */
  readonly knockedOut: boolean;
  /** Whether a dodge is the only reason this did not cost any health. */
  readonly dodged: boolean;
}

/** Something a player has placed in the world. */
export interface BuiltProp {
  readonly id: number;
  readonly kind: BuildableKindId;
  readonly x: number;
  readonly z: number;
  /**
   * Which way it was turned when placed, the same way a model's `rotation.y`
   * reads. Zero for everything built before pieces could be turned.
   */
  readonly yaw: number;
  /**
   * Only meaningful for a campfire - always false for every other kind.
   * Atmosphere only: it burns down on its own after `CAMPFIRE_BURN_SECONDS`,
   * or a player can put it out early by hand. Mutable, unlike the fields
   * above: a campfire's identity never changes once built, but this does.
   */
  lit: boolean;
  /**
   * Only meaningful for a home: whether its owner has locked the door to
   * visitors (see decision 0055). Absent, like false, for anything built
   * before doors could be locked, and for every other kind.
   */
  locked?: boolean;
}

/** Outdoors: where every player is unless they have gone inside a home. */
export const OUTDOORS = 0;

/** Once through a door, this many ticks before it will take you back: one push is one trip. */
const DOOR_COOLDOWN_TICKS = 12;

/**
 * Somebody went in through a door or came back out of one (see decision
 * 0055): where they now are, in whichever space they are now in - the world
 * outside (`OUTDOORS`), or the inside of the home whose built-prop id this is.
 */
export interface SpaceChange {
  readonly netId: number;
  readonly space: number;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
}

/**
 * Word that a campfire was lit or put out, whether by a player's hand or by
 * burning down on its own - for deciding whether to broadcast the built-prop
 * list again and persist the change, the same reason a build event exists.
 */
export interface CampfireLitEvent {
  readonly propId: number;
  readonly lit: boolean;
}

/**
 * A player placed something.
 *
 * Everybody hears about the build itself from the next `builtPropsList` -
 * the same way a felled tree needs no message of its own beyond
 * `TreeChopped` - so this is only for the builder's own pack changing.
 *
 * `ownerKey` is null for anything communal, and for a home built by a guest
 * with no persistent key to remember it by. It never goes to the client - it
 * only exists so the game server can save who a home belongs to.
 */
export interface BuildEvent {
  readonly netId: number;
  readonly prop: BuiltProp;
  readonly ownerKey: string | null;
}

/**
 * What a player asked to build, and exactly where: wherever their preview
 * stood when they clicked (see decision 0052). Only a request - the server
 * still checks every part of it.
 */
export interface BuildRequest {
  readonly kind: BuildableKindId;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
}

/** Half of what a player was carrying, left where a knockout took them down. */
export interface BuriedCache {
  readonly id: number;
  /**
   * The stable key of whoever buried it, not their network id - a network id
   * only lasts as long as one connection, and a cache has to survive its
   * owner reconnecting, or the whole world sleeping and waking again, to be
   * worth persisting at all. Null the same way a guest's home has none: with
   * no key to recognise them by next time, nobody can dig this one back up.
   */
  readonly ownerPlayerKey: string | null;
  readonly x: number;
  readonly z: number;
  readonly items: readonly { readonly item: ItemId; readonly count: number }[];
}

/**
 * A `BuriedCache` as the wire says it: the owner's current network id in
 * place of their stable key, resolved fresh every time this is sent, since a
 * reconnect changes it, and no contents - nothing needs to say what is in
 * one, only that it is there and whose. Null while the owner is not
 * connected - nobody needs a hint lit up for a cache with nobody to dig it.
 */
export interface BuriedCacheView {
  readonly id: number;
  readonly ownerNetId: number | null;
  readonly x: number;
  readonly z: number;
}

/**
 * Word that a player's own buried cache changed - a knockout burying
 * something, or digging it back up - for that player alone. Everybody else
 * hears about the cache itself appearing or disappearing from the next
 * `buriedCachesList`, the same way a built prop needs no message of its own
 * beyond that list.
 */
export interface CacheEvent {
  readonly netId: number;
  readonly kind: 'buried' | 'dugUp';
}

/**
 * `CacheEvent` plus what the game server needs to persist it - the full
 * cache for a fresh burial, or just the id to delete for a dig-up - which
 * never goes to a client and so never needs to be a `CacheEvent` itself.
 */
export type CacheChange =
  | { readonly netId: number; readonly kind: 'buried'; readonly cache: BuriedCache }
  | { readonly netId: number; readonly kind: 'dugUp'; readonly cacheId: number };

/** A tree's state, as it goes into and comes out of storage. */
export interface PersistedTree {
  readonly treeId: number;
  readonly swingsTaken: number;
  readonly felled: boolean;
  /**
   * When it was felled, in real time.
   *
   * Real time rather than ticks, because a world with nobody in it stops
   * ticking: a tree felled at midnight has to be back when somebody logs in at
   * one, having counted nothing in between.
   */
  readonly felledAtMs: number;
  /** How many times this spot has grown back. It decides the tree's size. */
  readonly generation: number;
}

/**
 * The turn after this one.
 *
 * The count is what both ends work the tree's size out from and it travels in
 * one byte, so a spot chopped hundreds of times stops counting rather than
 * growing a tree every browser would draw at a different size.
 */
function nextGeneration(generation: number): number {
  return Math.min(generation + 1, MAX_TREE_GENERATION);
}

/**
 * What a player should start out holding.
 *
 * A save's own choice wins if they still actually have it - re-validated
 * rather than trusted, the same reason a saved pack is re-clamped to its
 * current limit on load. Failing that, the first tool this pack holds, so
 * returning to a world with an axe already found still shows it in hand
 * without anybody having to press anything. Never a food item: nothing
 * should default to already holding up a fish.
 */
function initialEquippedItem(inventory: Inventory, requested: ItemId | null): ItemId | null {
  if (requested !== null && hasItem(inventory, requested)) return requested;
  return TOOL_ITEMS.find((item) => hasItem(inventory, item)) ?? null;
}

/**
 * Something that happened at the water, for everybody to see.
 *
 * Everyone is told, not only the one fishing, so a float bobbing in the pond is
 * the same float for everybody standing round it.
 */
export type FishingEvent =
  | { readonly kind: 'cast'; readonly netId: number; readonly x: number; readonly z: number }
  | { readonly kind: 'bite'; readonly netId: number }
  /** `added` is how many went into the pack: none when it was already full. */
  | {
      readonly kind: 'caught';
      readonly netId: number;
      readonly item: ItemId;
      readonly added: number;
    }
  | { readonly kind: 'tooSoon' | 'tooLate' | 'walkedAway'; readonly netId: number };

/**
 * Word that a player's hunger changed, for that player alone: nobody else
 * needs to know how hungry somebody is or what they just ate.
 */
export interface HungerEvent {
  readonly netId: number;
  readonly hunger: number;
  /** What was just eaten, for a HUD toast. Null when this is only the meter running down. */
  readonly ate: ItemId | null;
}

/**
 * Word that a player crafted something, for that player alone: nobody else
 * needs to know what somebody else just made.
 */
export interface CraftedEvent {
  readonly netId: number;
  readonly item: ItemId;
}

/**
 * A player dropped or destroyed something from their pack, for their own HUD
 * alone: everybody else sees a dropped pile turn up from the next pile list.
 */
export interface DiscardedEvent {
  readonly netId: number;
  readonly item: ItemId;
  readonly count: number;
  /** Destroyed, rather than dropped on the ground. */
  readonly destroyed: boolean;
}

/** What a client asks to drop or destroy (see decision 0061). */
export interface DiscardRequest {
  readonly item: ItemId;
  /** How many. More than they hold just means all of it. */
  readonly amount: number;
  readonly destroy: boolean;
}

/** A stick or flower patch as it goes into and comes out of storage. */
export interface PersistedPatch {
  readonly id: number;
  readonly x: number;
  readonly z: number;
  readonly remaining: number;
  readonly generation: number;
  readonly emptiedAtMs: number;
}

/** A dropped pile as it goes into and comes out of storage. */
export interface PersistedPile {
  readonly id: number;
  readonly item: ItemId;
  readonly count: number;
  readonly x: number;
  readonly z: number;
  readonly droppedAtMs: number;
}

/** A tree that has come back. */
export interface TreeRegrown {
  readonly treeId: number;
  readonly generation: number;
}

/** Everything the world knows about one tree. */
interface TreeState {
  swingsTaken: number;
  felled: boolean;
  felledAtMs: number;
  generation: number;
}

interface PlayerRuntime {
  readonly netId: number;
  /**
   * The stable identity this player's session was opened with, or null for a
   * guest with nothing to remember them by. Unlike `netId` - a fresh slot
   * every reconnect - this is what a home belongs to.
   */
  readonly playerKey: string | null;
  readonly entity: Entity;
  readonly queue: PlayerInput[];
  readonly inventory: Inventory;
  /** Ticks left before this player may swing, cast or gather again. */
  swingCooldownTicks: number;
  /**
   * Whether the button was down in the last input, so a fresh press can be told
   * from one being held. Chopping is happy with a held button; a cast wants a
   * click.
   */
  swingWasHeld: boolean;
  /**
   * Whether interact was down in the last input - same idea as `swingWasHeld`.
   * Picking up, gathering and digging up a cache are all happy with a held
   * button (they are self-limiting: there is nothing left to find on the next
   * tick), but lighting or putting out a campfire is a toggle, so it needs an
   * actual fresh press or holding the button would flicker it on and off.
   */
  interactWasHeld: boolean;
  /**
   * What to build on the next tick, and where, or null when nothing is
   * waiting. A discrete request rather than a held button - like crafting,
   * it is settled the moment it arrives - so there is no held/clicked edge
   * to track here the way there is for a swing.
   */
  pendingBuild: BuildRequest | null;
  /** Their line in the water, if they have one out. */
  cast: Cast | null;
  lastProcessedSeq: number;
  /** Inputs thrown away because the client was sending faster than it should. */
  droppedInputs: number;
  /** How hungry they are, from `HUNGER_MAX` (full) down to zero. */
  hunger: number;
  /**
   * The last whole number of hunger this player was actually sent, so a
   * message only goes out when it would show something different.
   */
  lastSentHunger: number;
  /** How much a threat has left to take before they are knocked out. */
  health: number;
  /**
   * What they are busy doing: a swing, a charge, a dodge, a flinch, being
   * down, sitting... - see `sim/actions.ts`, which their browser runs too.
   */
  readonly action: ActionState;
  /** The buttons on the last input, so the next one can tell a fresh press. */
  previousButtons: number;
  /** The tick they were knocked out on, so they wake up a while later. */
  knockedOutAtTick: number;
  /**
   * The tick their last dodge began on. How long a roll leaves you
   * untouchable is counted on the server's own clock, not in inputs, so
   * a browser that stops sending mid-roll cannot stay untouchable.
   */
  dodgeStartedAtTick: number;
  /**
   * What this player last chose to hold, or null if they never have. Read
   * through `equippedItemOf`, never directly - the pack can empty this out
   * from under them (eating the last of it, a knockout burying it) without
   * anything here clearing the field itself.
   */
  equippedItem: ItemId | null;
  /** Which parts of the world this player has seen - see `exploring.ts`. */
  readonly explored: Uint8Array;
  /** The square they were last in, so the map only needs looking at when they move into a new one. */
  exploredCell: number | null;
  /** Whether `explored` has grown since the player was last told. */
  exploredChanged: boolean;
  /**
   * Where they are: `OUTDOORS`, or inside the home with this built-prop id,
   * whose room has its own coordinates (see `world/home.ts`).
   */
  space: number;
  /** Ticks before a door will take them through again, so one push is one trip. */
  doorCooldownTicks: number;
}

/** Everything the world keeps about one wild animal, between ticks. */
interface AnimalRuntime {
  readonly id: number;
  readonly entity: Entity;
  readonly kind: AnimalKindId;
  readonly denX: number;
  readonly denZ: number;
  /** Aware of, and reacting to, the nearest player - fleeing for prey, chasing for a threat. */
  engaged: boolean;
  /** Where it is ambling toward, while calm. Meaningless while engaged. */
  targetX: number;
  targetZ: number;
  /** How many wander targets it has drawn before, so the next one is a fresh hash. */
  decisionSeq: number;
  /** Caught, or a threat defeated, and waiting out `ANIMAL_RESPAWN_SECONDS` before it is back at its den. */
  caught: boolean;
  /** When it is due back, in real time. Meaningless unless `caught`. */
  respawnAtMs: number;
  /**
   * A threat's own attack, mid-sequence: standing still to wind up, then
   * recovering afterward either way. Meaningless on prey, which has no
   * `threat` to read a duration from.
   */
  attackState: 'none' | 'windup' | 'cooldown';
  /** When the current `attackState` resolves, in real time. Meaningless while `attackState` is 'none'. */
  attackStateEndsAtMs: number;
  /** Swings landed on a threat since it last came back from being defeated. */
  hitsTaken: number;
  /**
   * Where it has been over the last few ticks, newest at `trailHead`, so a
   * blow can land on it where it was when the swing began (see
   * `landBlow`). Emptied whenever it jumps somewhere, so nothing counts
   * from before.
   */
  readonly trailX: Float32Array;
  readonly trailZ: Float32Array;
  trailHead: number;
  trailCount: number;
}

/** How many ticks of an animal's recent path are kept for a blow to look back over. */
const ANIMAL_TRAIL_TICKS = 10;

/**
 * The authoritative world.
 *
 * This is the server's copy of the truth. It is plain TypeScript with no Worker
 * or browser APIs in it, so the same class runs inside the World Durable Object,
 * inside tests and inside the load-test benchmark.
 */
export class WorldSimulation {
  readonly world: World;
  readonly seed: number;
  readonly clearing: Clearing;
  /**
   * The generated forest beyond the clearing. Built once from the seed and
   * never touched again: none of it is ever chopped or picked up, so unlike
   * `clearing` it has no state worth keeping past construction.
   */
  readonly wilderness: Wilderness;
  readonly collision: CollisionWorld;
  /**
   * Inside a home. Every room is laid out the same, so one set of walls and
   * furniture serves them all, in the room's own coordinates.
   */
  readonly roomCollision: CollisionWorld = createCollisionWorld(
    createFlatTerrain(0),
    homeRoomColliders(),
    HOME_ROOM.halfWidth + HOME_ROOM.wallThickness,
  );
  readonly regrowMinSeconds: number;
  readonly patchRegrowMinSeconds: number;
  readonly hungerDrainPerSecond: number;

  /** How many ticks have been simulated since the world was created. */
  tick = 0;

  /** Real time as of the tick being simulated, supplied by the caller. */
  private nowMs = 0;

  private readonly players = new Map<number, PlayerRuntime>();
  private readonly animals = new Map<number, AnimalRuntime>();
  /** Pickups that somebody has already taken, by id. */
  private readonly takenPickups = new Set<number>();
  /** Drained by the world server each tick and turned into messages. */
  private readonly pickupEvents: PickupTaken[] = [];
  /** Every tree anybody has touched, by prop id. Untouched trees are not here. */
  private readonly trees = new Map<number, TreeState>();
  private readonly chopEvents: TreeChopped[] = [];
  private readonly catchEvents: AnimalCaught[] = [];
  private readonly threatHitEvents: ThreatHit[] = [];
  private readonly regrowthEvents: TreeRegrown[] = [];
  private readonly fishingEvents: FishingEvent[] = [];
  /** Every cast in this world gets its own number, so no two share a roll. */
  private castCounter = 0;
  private readonly hungerEvents: HungerEvent[] = [];
  private readonly healthEvents: HealthEvent[] = [];
  private readonly gestureEvents: GestureEvent[] = [];
  private readonly craftEvents: CraftedEvent[] = [];
  /** Who gathered something this tick, so the world server knows whose pack to send. */
  private readonly gatherEvents: number[] = [];
  /** Every stick and flower patch: where it is now and how many it has left (see decision 0061). */
  private readonly patches: GatherPatch[];
  /** Patches gathered from, grown back or moved since this was last asked, by id. */
  private readonly patchChanges = new Set<number>();
  /** Everything lying where somebody dropped it, oldest first. */
  private readonly droppedPiles: DroppedPile[] = [];
  private nextDroppedPileId = 1;
  /** Piles dropped, added to, picked from or faded since this was last asked, by id. */
  private readonly pileChanges = new Set<number>();
  private readonly discardEvents: DiscardedEvent[] = [];
  /** Who changed what they have equipped since this was last asked - a signal to resend the whole list, not a diff. */
  private readonly equipEvents: number[] = [];
  /** Everything anybody has ever built. Nothing is ever removed from it yet. */
  private readonly builtProps: BuiltProp[] = [];
  /** Same props, by id - campfires have no cap, so looking one up by id must not mean scanning all of them. */
  private readonly builtPropsById = new Map<number, BuiltProp>();
  private nextBuiltPropId = 1;
  private readonly buildEvents: BuildEvent[] = [];
  /** When each currently-lit campfire should go out on its own, by prop id. Absent while unlit. */
  private readonly campfireLitUntilMs = new Map<number, number>();
  private readonly campfireLitEvents: CampfireLitEvent[] = [];
  /** Built-prop id -> whoever it belongs to, for anything capped per player. */
  private readonly ownedBuiltProps = new Map<number, string>();
  /** Everything currently buried, waiting to be dug back up. */
  private readonly buriedCaches: BuriedCache[] = [];
  private nextBuriedCacheId = 1;
  private readonly cacheEvents: CacheChange[] = [];
  /** Who went in or out through a door since this was last asked. */
  private readonly spaceChanges: SpaceChange[] = [];
  /**
   * The props as they stand right now.
   *
   * A tree that has grown back is a different size from the one the clearing
   * was built with, and reach, collision and drawing all have to agree about
   * which one is there.
   */
  private readonly standing: PlacedProp[];
  private spawnCounter = 0;
  /** Reused every tick so a busy world does not allocate per player. */
  private readonly scratch: PlayerMotion = createPlayerMotion(SPAWN_POSITION);

  constructor(options: WorldSimulationOptions) {
    this.seed = options.seed;
    this.regrowMinSeconds = options.regrowMinSeconds ?? REGROW_MIN_SECONDS;
    this.patchRegrowMinSeconds = options.patchRegrowMinSeconds ?? PATCH_REGROW_MIN_SECONDS;
    this.hungerDrainPerSecond = hungerDrainPerSecond(
      options.hungerEmptyAfterSeconds ?? HUNGER_EMPTY_AFTER_SECONDS,
    );
    this.clearing = buildTestClearing(options.seed);
    this.patches = this.clearing.gatherSpots.map((spot) => freshPatch(options.seed, spot));
    const terrain = options.terrain ?? createWildernessTerrain(options.seed);
    this.wilderness = buildWilderness(options.seed, terrain);
    this.collision = createCollisionWorld(terrain, [
      ...this.clearing.colliders,
      ...this.wilderness.colliders,
    ]);
    this.standing = [...this.clearing.props];
    this.world = createWorld();

    if (options.withProps !== false) {
      for (const prop of this.clearing.props) {
        this.world.spawn(
          Position({ x: prop.x, y: 0, z: prop.z }),
          Prop({
            kindIndex: propKindIndex(prop.kind),
            rotationY: prop.rotationY,
            scale: prop.scale,
          }),
          StaticTag,
        );
      }
    }

    for (const den of ANIMAL_DENS) {
      this.spawnAnimal(den, terrain);
    }
  }

  private spawnAnimal(den: AnimalDen, terrain: Terrain): void {
    const y = terrain.heightAt(den.x, den.z);
    const entity = this.world.spawn(
      AnimalTag,
      Position({ x: den.x, y, z: den.z }),
      Velocity({ x: 0, y: 0, z: 0 }),
      Facing({ yaw: 0 }),
      NetworkId({ value: den.id }),
    );
    this.animals.set(den.id, {
      id: den.id,
      entity,
      kind: den.kind,
      denX: den.x,
      denZ: den.z,
      engaged: false,
      // Starting already "arrived" makes the first tick draw a real wander
      // target rather than needing a special case for a fresh spawn.
      targetX: den.x,
      targetZ: den.z,
      decisionSeq: 0,
      caught: false,
      respawnAtMs: 0,
      attackState: 'none',
      attackStateEndsAtMs: 0,
      hitsTaken: 0,
      trailX: new Float32Array(ANIMAL_TRAIL_TICKS),
      trailZ: new Float32Array(ANIMAL_TRAIL_TICKS),
      trailHead: 0,
      trailCount: 0,
    });
  }

  /**
   * Let go of the ECS world.
   *
   * Koota hands out a fixed number of world ids per process, so anything that
   * builds more than one world in a row (tests, the load-test benchmark) has to
   * give them back. A Durable Object holds exactly one for its whole life.
   */
  dispose(): void {
    this.players.clear();
    this.animals.clear();
    this.world.destroy();
  }

  get playerCount(): number {
    return this.players.size;
  }

  hasPlayer(netId: number): boolean {
    return this.players.has(netId);
  }

  playerIds(): number[] {
    return [...this.players.keys()];
  }

  /**
   * Put a player into the world, either fresh or restored from storage.
   *
   * `playerKey` is optional and defaults to no persistent identity, so every
   * existing call site that only ever cared about `netId` and `saved` still
   * behaves exactly as it did before homes existed.
   */
  addPlayer(netId: number, saved?: PersistedPlayer, playerKey: string | null = null): void {
    if (this.players.has(netId)) return;

    // A home beats both: wherever they physically stood before beats the
    // shared clearing, but waking up at home, by their own bed, beats that
    // too, every time (see decision 0055).
    const home = playerKey !== null ? this.homeOf(playerKey) : null;
    const spawn =
      home !== null
        ? { x: HOME_WAKE_SPOT.x, y: 0, z: HOME_WAKE_SPOT.z }
        : saved
          ? { x: saved.x, y: saved.y, z: saved.z }
          : this.nextSpawnPosition();
    const facingYaw = home !== null ? HOME_WAKE_SPOT.yaw : (saved?.facingYaw ?? 0);

    const entity = this.world.spawn(
      PlayerTag,
      Position({ x: spawn.x, y: spawn.y, z: spawn.z }),
      Velocity({ x: 0, y: 0, z: 0 }),
      Facing({ yaw: facingYaw }),
      Grounded({ value: true }),
      NetworkId({ value: netId }),
      LastProcessedInput({ seq: 0 }),
      AimYaw({ yaw: facingYaw }),
    );

    const hunger = saved?.hunger ?? HUNGER_MAX;
    const inventory = saved ? inventoryFromEntries(saved.items) : createInventory();
    this.players.set(netId, {
      netId,
      playerKey,
      entity,
      queue: [],
      inventory,
      swingCooldownTicks: 0,
      swingWasHeld: false,
      interactWasHeld: false,
      pendingBuild: null,
      cast: null,
      lastProcessedSeq: 0,
      droppedInputs: 0,
      hunger,
      // Matches what `addPlayer`'s caller is about to be told separately, on
      // arrival, so the tick loop does not repeat itself the moment it runs.
      lastSentHunger: Math.round(hunger),
      health: saved?.health ?? HEALTH_MAX,
      action: createActionState(),
      previousButtons: 0,
      knockedOutAtTick: 0,
      dodgeStartedAtTick: -Infinity,
      equippedItem: initialEquippedItem(inventory, saved?.equippedItem ?? null),
      explored: exploredMapFrom(saved?.explored),
      exploredCell: null,
      // Always worth sending once on arrival, whether or not anything new
      // gets seen: it is how a returning player's map comes back.
      exploredChanged: true,
      space: home?.id ?? OUTDOORS,
      doorCooldownTicks: 0,
    });
  }

  /** Ask to build something at a particular spot, next tick. */
  requestBuild(netId: number, request: BuildRequest): void {
    const runtime = this.players.get(netId);
    if (runtime === undefined) return;
    runtime.pendingBuild = request;
  }

  /**
   * The same player, back on a new connection while their body was still
   * here (see decision 0057): they carry on in it exactly as it stands. Only
   * what the old connection was in the middle of sending is forgotten - a
   * reloaded page counts its inputs from one again, and anything at or below
   * the old count would otherwise be thrown away as already done.
   */
  handOver(netId: number): void {
    const runtime = this.players.get(netId);
    if (runtime === undefined) return;
    runtime.queue.length = 0;
    runtime.lastProcessedSeq = 0;
    runtime.previousButtons = 0;
    runtime.swingWasHeld = false;
    runtime.interactWasHeld = false;
  }

  removePlayer(netId: number): boolean {
    const runtime = this.players.get(netId);
    if (!runtime) return false;
    runtime.entity.destroy();
    this.players.delete(netId);
    return true;
  }

  /**
   * Accept inputs from a client.
   *
   * Anything older than what we have already simulated is dropped, and a client
   * that floods us simply loses its oldest inputs instead of growing our memory.
   */
  queueInput(netId: number, input: PlayerInput): void {
    const runtime = this.players.get(netId);
    if (!runtime) return;
    if (input.seq <= runtime.lastProcessedSeq) return;

    const queued = runtime.queue;
    const newest = queued[queued.length - 1];
    if (newest !== undefined && input.seq <= newest.seq) return;

    queued.push(input);
    while (queued.length > MAX_QUEUED_INPUTS_PER_PLAYER) {
      queued.shift();
      runtime.droppedInputs += 1;
    }
  }

  queueInputs(netId: number, inputs: readonly PlayerInput[]): void {
    for (const input of inputs) this.queueInput(netId, input);
  }

  lastProcessedSeq(netId: number): number {
    return this.players.get(netId)?.lastProcessedSeq ?? 0;
  }

  droppedInputs(netId: number): number {
    return this.players.get(netId)?.droppedInputs ?? 0;
  }

  /**
   * Simulate a single 20 Hz tick.
   *
   * `nowMs` is real time, and it is here rather than read from a clock because
   * shared code must stay deterministic and because Workers freeze the clock
   * between I/O anyway. Only regrowth uses it, and only to stamp the moment a
   * tree came down.
   */
  step(nowMs: number): void {
    this.nowMs = nowMs;
    this.tick += 1;
    const scratch = this.scratch;

    // Anybody who has been down long enough wakes up at home, before anybody
    // moves this tick - moving a player from outside the loop below is the
    // only way that sticks (see decision 0024).
    for (const runtime of this.players.values()) {
      if (
        runtime.action.kind === ActionKind.KnockedOut &&
        this.tick - runtime.knockedOutAtTick >= KNOCKED_OUT_TICKS
      ) {
        this.wakeUp(runtime);
      }
    }

    this.world
      .query(PlayerTag, Position, Velocity, Facing, Grounded, NetworkId, LastProcessedInput, AimYaw)
      .updateEach(([position, velocity, facing, grounded, networkId, lastProcessed, aim]) => {
        const runtime = this.players.get(networkId.value);
        if (runtime === undefined) return;

        runtime.hunger = drainHunger(runtime.hunger, TICK_SECONDS, this.hungerDrainPerSecond);

        scratch.position.x = position.x;
        scratch.position.y = position.y;
        scratch.position.z = position.z;
        scratch.velocity.x = velocity.x;
        scratch.velocity.y = velocity.y;
        scratch.velocity.z = velocity.z;
        scratch.facingYaw = facing.yaw;
        scratch.grounded = grounded.value;

        let wantsToInteract = false;
        let wantsToToggleCampfire = false;
        let wantsToCast = false;
        let aimedYaw = aim.yaw;
        // Which way the last input was walking, as a world direction: walking
        // into a doorway is how you go through it (see decision 0055).
        let walkX = 0;
        let walkZ = 0;
        // Blows that land this tick, judged once the player has finished
        // moving, the same as every other reach.
        const impacts: Impact[] = [];
        // Inside a home only its own walls and furniture are there to bump
        // into, and nothing out in the world is in reach.
        const outdoors = runtime.space === OUTDOORS;
        const collision = outdoors ? this.collision : this.roomCollision;

        // A line in the water keeps its own time: the fish bites when it bites,
        // and wandering off brings the line in, whether or not inputs arrived.
        if (runtime.cast !== null) this.tickLine(runtime, runtime.cast, scratch.position);

        const steps = inputsToConsume(runtime.queue.length);
        if (steps === 0) {
          // No packet arrived in time: the player coasts to a stop where they
          // are, and whatever they were doing waits for the next one, the same
          // way it waits in their own browser.
          const idle = idleInput(runtime.lastProcessedSeq, aim.yaw, aim.yaw);
          if (runtime.action.kind === ActionKind.Idle) {
            stepPlayer(scratch, idle, TICK_SECONDS, collision);
          } else if (runtime.action.kind !== ActionKind.Dodge) {
            stepPlayer(
              scratch,
              footedInput(idle, 'still', scratch.facingYaw),
              TICK_SECONDS,
              collision,
            );
          }
        } else {
          for (let i = 0; i < steps; i++) {
            const input = runtime.queue.shift();
            if (input === undefined) break;

            const context = this.actionContext(runtime, scratch.position, input.aimYaw);
            const tick = advanceAction(runtime.action, input, runtime.previousButtons, context);
            runtime.previousButtons = input.buttons;
            if (runtime.action.kind === ActionKind.Dodge && runtime.action.age === 0) {
              runtime.dodgeStartedAtTick = this.tick;
            }
            if (tick.footing === 'dodging') {
              stepDodge(scratch, runtime.action, collision);
            } else {
              stepPlayer(
                scratch,
                footedInput(input, tick.footing, scratch.facingYaw),
                TICK_SECONDS,
                collision,
              );
            }
            if (tick.footing === 'free') {
              const walk = worldMoveDirection(input.moveX, input.moveZ, input.yaw);
              walkX = walk.x;
              walkZ = walk.z;
            } else {
              walkX = 0;
              walkZ = 0;
            }
            if (tick.impact !== null) impacts.push(tick.impact);
            if (tick.cast) wantsToCast = true;

            const interactHeld = isHeld(input, PlayerButton.Interact);
            const freshInteract = interactHeld && !runtime.interactWasHeld;
            runtime.interactWasHeld = interactHeld;
            const swingHeld = isHeld(input, PlayerButton.Swing);
            const clicked = swingHeld && !runtime.swingWasHeld;
            runtime.swingWasHeld = swingHeld;
            // Reaching for things is only for somebody free to do it: not
            // mid-swing, mid-roll, down, or sat down.
            if (isFreeToInteract(runtime.action)) {
              if (interactHeld) wantsToInteract = true;
              if (freshInteract) wantsToToggleCampfire = true;
            }
            if (runtime.cast !== null) {
              // With a line out, the button is for the fish and nothing else,
              // and each input is read in turn: when the click was made matters.
              this.readLine(runtime, runtime.cast, {
                seq: input.seq,
                clicked,
                sawBite: isHeld(input, PlayerButton.SawBite),
              });
            }
            runtime.lastProcessedSeq = input.seq;
            aim.yaw = input.aimYaw;
            aimedYaw = input.aimYaw;
          }
        }

        // Going through a door comes first: a press at the doorway is for the
        // door, and nothing else happens on the tick you go through one.
        if (runtime.doorCooldownTicks > 0) runtime.doorCooldownTicks -= 1;
        else if (this.tryDoor(runtime, scratch, walkX, walkZ, wantsToToggleCampfire)) {
          wantsToInteract = false;
          wantsToCast = false;
          impacts.length = 0;
          runtime.pendingBuild = null;
          aim.yaw = scratch.facingYaw;
          aimedYaw = scratch.facingYaw;
        }

        // Reaching and swinging are judged where the player ended up, not where
        // they started, and only the server ever decides what happens. Inside
        // a home, there is nothing out in the world in reach: only the chair
        // and the bed, and your own pack, to eat from. Food picked out and
        // room for it comes first, even beside them: that is what it was
        // picked out for.
        if (wantsToInteract && runtime.space !== OUTDOORS) {
          const place = wantsToToggleCampfire
            ? restingPlaceInReach(scratch.position.x, scratch.position.z)
            : null;
          const hungryWithFood =
            foodToEat(runtime.inventory, runtime.hunger, runtime.equippedItem) !== null;
          if (!hungryWithFood && place !== null && this.isRestingPlaceFree(runtime, place)) {
            this.settleInto(runtime, scratch, place);
            aim.yaw = scratch.facingYaw;
          } else {
            this.tryEat(runtime);
          }
        } else if (wantsToInteract) {
          // The same button reaches for what is at your feet first - a tool
          // lying there, then anything somebody dropped - then for a patch
          // of sticks, then for a cache of your own buried nearby, then a
          // nearby campfire to light or put out, and only failing all of
          // those reaches into your own pack instead.
          const pickedUp =
            this.tryPickup(runtime, scratch.position) ||
            this.tryPickUpPile(runtime, scratch.position);
          if (!pickedUp) {
            const gathered = this.tryGather(runtime, scratch.position);
            if (!gathered) {
              const dugUp = this.tryDigUpCache(runtime, scratch.position);
              if (!dugUp) {
                // A campfire in reach always claims the button, whether or not
                // this tick is the fresh press that actually toggles it -
                // otherwise holding the button down to "keep warm" would fall
                // through and eat from the pack on every tick after the first.
                const nearCampfire = this.tryToggleCampfire(
                  runtime,
                  scratch.position,
                  this.nowMs,
                  wantsToToggleCampfire,
                );
                if (!nearCampfire) this.tryEat(runtime);
              }
            }
          }
        }

        if (runtime.swingCooldownTicks > 0) runtime.swingCooldownTicks -= 1;
        if (runtime.space !== OUTDOORS) {
          // Nothing to chop, catch, cast at or build on in here.
          runtime.pendingBuild = null;
        } else {
          for (const impact of impacts) this.landBlow(runtime, scratch.position, aimedYaw, impact);
          if (wantsToCast && runtime.cast === null) {
            this.tryCast(runtime, scratch.position, aimedYaw);
          }
          if (runtime.pendingBuild !== null) {
            const request = runtime.pendingBuild;
            runtime.pendingBuild = null;
            this.tryBuild(runtime, scratch.position, request);
          }
        }
        position.x = scratch.position.x;
        position.y = scratch.position.y;
        position.z = scratch.position.z;
        velocity.x = scratch.velocity.x;
        velocity.y = scratch.velocity.y;
        velocity.z = scratch.velocity.z;
        facing.yaw = scratch.facingYaw;
        grounded.value = scratch.grounded;
        lastProcessed.seq = runtime.lastProcessedSeq;
        // A room has its own coordinates, nowhere on the map.
        if (runtime.space === OUTDOORS) this.exploreAround(runtime, position.x, position.z);

        // Catches the meter crossing a whole point on its own, if eating did
        // not already say something this tick.
        this.queueHungerEvent(runtime, null);
      });

    this.stepAnimals();
  }

  /**
   * Take a player through a door, if they are walking into one or pressed
   * interact right at it (see decision 0055): outside, in through the door
   * of a home they may enter; inside, back out the way they came. Moves them
   * in `motion` and says so, so the rest of this tick knows.
   */
  private tryDoor(
    runtime: PlayerRuntime,
    motion: PlayerMotion,
    walkX: number,
    walkZ: number,
    freshInteract: boolean,
  ): boolean {
    const { position } = motion;
    if (runtime.space !== OUTDOORS) {
      if (!isLeavingRoom(position.x, position.z, walkX, walkZ, freshInteract)) return false;
      const home = this.builtPropsById.get(runtime.space);
      const out =
        home === undefined
          ? { ...this.nextSpawnPosition(), yaw: motion.facingYaw }
          : cabinDoorstep(home);
      this.moveBetweenSpaces(runtime, motion, OUTDOORS, out);
      return true;
    }

    for (const home of this.builtProps) {
      if (!BUILDABLE_KINDS[home.kind].isHome) continue;
      if (!isEnteringDoorway(home, position.x, position.z, walkX, walkZ, freshInteract)) continue;
      // A locked door only opens for its owner; everybody else just bumps
      // into it, and their browser says whose it is.
      if (home.locked === true && this.ownedBuiltProps.get(home.id) !== runtime.playerKey) {
        return false;
      }
      this.moveBetweenSpaces(runtime, motion, home.id, HOME_ENTRY);
      return true;
    }
    return false;
  }

  /** Put a player somewhere else entirely, in another space, and tell them. */
  private moveBetweenSpaces(
    runtime: PlayerRuntime,
    motion: PlayerMotion,
    space: number,
    spot: PlacedSpot,
  ): void {
    runtime.space = space;
    runtime.doorCooldownTicks = DOOR_COOLDOWN_TICKS;
    // A line out comes in, and whatever they were in the middle of is let
    // go: neither survives a doorway.
    if (runtime.cast !== null) this.endCast(runtime, { outcome: 'walkedAway' });
    if (runtime.action.kind !== ActionKind.Idle) beginAction(runtime.action, ActionKind.Idle);
    motion.position.x = spot.x;
    motion.position.z = spot.z;
    motion.position.y = space === OUTDOORS ? this.collision.terrain.heightAt(spot.x, spot.z) : 0;
    motion.velocity.x = 0;
    motion.velocity.y = 0;
    motion.velocity.z = 0;
    motion.facingYaw = spot.yaw;
    motion.grounded = true;
    this.spaceChanges.push({ netId: runtime.netId, space, x: spot.x, z: spot.z, yaw: spot.yaw });
  }

  /** Where a player is: `OUTDOORS`, or the built-prop id of the home they are inside. */
  spaceOf(netId: number): number {
    return this.players.get(netId)?.space ?? OUTDOORS;
  }

  /** Hand over everybody who went through a door since this was last asked. */
  drainSpaceChanges(): SpaceChange[] {
    return this.spaceChanges.splice(0);
  }

  /**
   * Lock or unlock this player's own front door (see decision 0055). Only
   * ever their own: returns the home it changed, or null if they have none,
   * or it was already that way.
   */
  setHomeLocked(netId: number, locked: boolean): BuiltProp | null {
    const runtime = this.players.get(netId);
    if (runtime === undefined || runtime.playerKey === null) return null;
    const home = this.homeOf(runtime.playerKey);
    if (home === null || (home.locked === true) === locked) return null;
    home.locked = locked;
    return home;
  }

  /**
   * Where a player would come back to, in the world outside: where they
   * stand, or the doorstep of the home they are inside - a room's own
   * coordinates mean nothing out in the world.
   */
  outdoorPositionOf(netId: number): (Vec3 & { readonly yaw: number }) | null {
    const runtime = this.players.get(netId);
    if (runtime === undefined) return null;
    const position = runtime.entity.get(Position);
    const facing = runtime.entity.get(Facing);
    if (position === undefined || facing === undefined) return null;
    if (runtime.action.kind === ActionKind.KnockedOut) {
      // Down and about to wake up somewhere else: that is where they come back.
      const home = runtime.playerKey !== null ? this.homeOf(runtime.playerKey) : null;
      if (home !== null) {
        const doorstep = cabinDoorstep(home);
        return {
          x: doorstep.x,
          y: this.collision.terrain.heightAt(doorstep.x, doorstep.z),
          z: doorstep.z,
          yaw: doorstep.yaw,
        };
      }
      return { ...SPAWN_POSITION, yaw: facing.yaw };
    }
    if (runtime.space === OUTDOORS) return { ...position, yaw: facing.yaw };
    const home = this.builtPropsById.get(runtime.space);
    const out = home === undefined ? this.nextSpawnPosition() : cabinDoorstep(home);
    return {
      x: out.x,
      y: this.collision.terrain.heightAt(out.x, out.z),
      z: out.z,
      yaw: home === undefined ? facing.yaw : cabinDoorstep(home).yaw,
    };
  }

  /**
   * Mark what is around a player as seen, but only when they step into a new
   * square: standing still, or wandering about inside one square, cannot
   * reveal anything the last look did not.
   */
  private exploreAround(runtime: PlayerRuntime, x: number, z: number): void {
    const cell = exploreCellAt(x, z);
    if (cell === runtime.exploredCell) return;
    runtime.exploredCell = cell;
    if (revealAround(runtime.explored, x, z) > 0) runtime.exploredChanged = true;
  }

  /**
   * Every player whose map has grown since they were last told, with that
   * map, whole - it is small enough that sending all of it beats keeping
   * track of which squares are new.
   */
  drainExploredChanges(): { readonly netId: number; readonly explored: Uint8Array }[] {
    const changes: { netId: number; explored: Uint8Array }[] = [];
    for (const runtime of this.players.values()) {
      if (!runtime.exploredChanged) continue;
      runtime.exploredChanged = false;
      changes.push({ netId: runtime.netId, explored: runtime.explored });
    }
    return changes;
  }

  /** Which parts of the world this player has seen, or null for somebody not here. */
  exploredMapOf(netId: number): Uint8Array | null {
    return this.players.get(netId)?.explored ?? null;
  }

  /** Amble, react to the nearest player, or wait out a catch - whichever this tick calls for. */
  private stepAnimals(): void {
    this.world
      .query(AnimalTag, Position, Velocity, Facing, NetworkId)
      .updateEach(([position, velocity, facing, networkId]) => {
        const runtime = this.animals.get(networkId.value);
        if (runtime === undefined) return;
        // Widened from the narrow per-kind literal `as const` gives it, so an
        // optional field like `threat` reads the same regardless of which
        // kind this happens to be.
        const kind: AnimalKind = ANIMAL_KINDS[runtime.kind];

        if (runtime.caught) {
          if (this.nowMs < runtime.respawnAtMs) {
            velocity.x = 0;
            velocity.z = 0;
            return;
          }
          // Time is up: back at the den, as if it had never left.
          runtime.caught = false;
          runtime.trailCount = 0;
          runtime.engaged = false;
          runtime.attackState = 'none';
          runtime.targetX = runtime.denX;
          runtime.targetZ = runtime.denZ;
          position.x = runtime.denX;
          position.z = runtime.denZ;
          position.y = this.collision.terrain.heightAt(runtime.denX, runtime.denZ);
          velocity.x = 0;
          velocity.z = 0;
          // A threat back from being defeated is worth full hits again - the
          // same reason a client needs telling, not just assuming, when a
          // built prop reappears.
          if (kind.threat !== undefined) {
            this.threatHitEvents.push({
              animalId: runtime.id,
              hitsLeft: kind.threat.hitsToDefeat,
              netId: null,
            });
          }
          return;
        }

        const nearestPlayer = this.nearestPlayerRuntime(position);
        const nearestPosition = nearestPlayer?.entity.get(Position) ?? null;
        const nearestDistance =
          nearestPosition === null ? Infinity : horizontalDistance(position, nearestPosition);

        if (kind.threat !== undefined) {
          this.stepThreatAnimal(
            runtime,
            kind,
            kind.threat,
            position,
            velocity,
            facing,
            nearestPlayer,
            nearestPosition,
            nearestDistance,
          );
          return;
        }

        // A fox hunting a rabbit is exactly as alarming to that rabbit as a
        // player would be, so fleeing weighs whichever of the two is nearer.
        const nearestPredator = this.nearestPredatorRuntime(runtime.kind, position);
        const predatorPosition = nearestPredator?.entity.get(Position) ?? null;
        const predatorDistance =
          predatorPosition === null ? Infinity : horizontalDistance(position, predatorPosition);
        const fleeFromPlayer = nearestDistance <= predatorDistance;
        const alarmDistance = Math.min(nearestDistance, predatorDistance);
        const alarmPosition = fleeFromPlayer ? nearestPosition : predatorPosition;

        runtime.engaged = shouldFlee(runtime.engaged, alarmDistance, kind);

        let direction: Direction2D;
        let speed: number;
        if (runtime.engaged && alarmPosition !== null) {
          direction = fleeDirection(position.x, position.z, alarmPosition.x, alarmPosition.z);
          speed = kind.fleeSpeed ?? 0;
        } else if (kind.preysOn !== undefined) {
          ({ direction, speed } = this.stepHunt(runtime, kind, position));
        } else {
          direction = this.wanderStep(runtime, kind, position);
          speed = kind.wanderSpeed;
        }

        velocity.x = direction.x * speed;
        velocity.z = direction.z * speed;
        position.x += velocity.x * TICK_SECONDS;
        position.z += velocity.z * TICK_SECONDS;
        position.y = this.collision.terrain.heightAt(position.x, position.z);
        // Standing still keeps whichever way it was last facing, rather than
        // snapping to face the den the instant it stops.
        if (speed > 0) facing.yaw = Math.atan2(-direction.x, -direction.z);
      });

    // Every animal's path, for a blow to look back over (see `landBlow`).
    for (const runtime of this.animals.values()) {
      if (runtime.caught) continue;
      const position = runtime.entity.get(Position);
      if (position === undefined) continue;
      runtime.trailHead = (runtime.trailHead + 1) % ANIMAL_TRAIL_TICKS;
      runtime.trailX[runtime.trailHead] = position.x;
      runtime.trailZ[runtime.trailHead] = position.z;
      runtime.trailCount = Math.min(runtime.trailCount + 1, ANIMAL_TRAIL_TICKS);
    }
  }

  /**
   * A hostile animal's tick: wander when nothing is near, close the distance
   * once it notices a player, then stand dead still to wind up - so the
   * attack is plainly telegraphed - before landing a hit if they are still
   * this close when it resolves.
   */
  private stepThreatAnimal(
    runtime: AnimalRuntime,
    kind: AnimalKind,
    threat: ThreatBehavior,
    position: { x: number; y: number; z: number },
    velocity: { x: number; z: number },
    facing: { yaw: number },
    nearestPlayer: PlayerRuntime | null,
    nearestPosition: Readonly<Vec3> | null,
    nearestDistance: number,
  ): void {
    if (runtime.attackState !== 'none') {
      velocity.x = 0;
      velocity.z = 0;
      if (this.nowMs < runtime.attackStateEndsAtMs) return;

      if (runtime.attackState === 'windup') {
        if (nearestPlayer !== null && nearestDistance <= threat.attackRadius) {
          this.damagePlayer(nearestPlayer, threat.damage);
        }
        runtime.attackState = 'cooldown';
        runtime.attackStateEndsAtMs = this.nowMs + threat.attackCooldownSeconds * 1000;
        return;
      }
      // Cooldown just ended: free to close the distance or wind up again.
      runtime.attackState = 'none';
    }

    // Bolder in the dark, unless the nearest player is lit - see decision
    // 0049. Only how far away it notices someone changes; the fight itself,
    // once engaged, is identical at any hour.
    const boldInTheDark =
      isNight(dayProgress(this.nowMs)) &&
      !(
        nearestPlayer !== null &&
        nearestPosition !== null &&
        this.isPlayerLit(nearestPlayer, nearestPosition)
      );
    const detection = nightDetection(kind, boldInTheDark);
    runtime.engaged = shouldFlee(runtime.engaged, nearestDistance, detection);

    let direction: Direction2D;
    let speed: number;
    if (runtime.engaged && nearestPosition !== null) {
      if (nearestDistance <= threat.attackRadius) {
        runtime.attackState = 'windup';
        runtime.attackStateEndsAtMs = this.nowMs + threat.windupSeconds * 1000;
        velocity.x = 0;
        velocity.z = 0;
        facing.yaw = Math.atan2(
          -(nearestPosition.x - position.x),
          -(nearestPosition.z - position.z),
        );
        return;
      }
      direction = towardDirection(position.x, position.z, nearestPosition.x, nearestPosition.z);
      speed = threat.chaseSpeed;
    } else {
      direction = this.wanderStep(runtime, kind, position);
      speed = kind.wanderSpeed;
    }

    velocity.x = direction.x * speed;
    velocity.z = direction.z * speed;
    position.x += velocity.x * TICK_SECONDS;
    position.z += velocity.z * TICK_SECONDS;
    position.y = this.collision.terrain.heightAt(position.x, position.z);
    if (speed > 0) facing.yaw = Math.atan2(-direction.x, -direction.z);
  }

  /** Amble toward a fresh point near the den once the last one is reached - calm prey and a calm threat alike. */
  private wanderStep(
    runtime: AnimalRuntime,
    kind: AnimalKind,
    position: Readonly<Vec3>,
  ): Direction2D {
    if (hasReachedTarget(position.x, position.z, runtime.targetX, runtime.targetZ)) {
      runtime.decisionSeq += 1;
      const next = wanderTarget(
        this.seed,
        runtime.id,
        runtime.decisionSeq,
        runtime.denX,
        runtime.denZ,
        kind.leashRadius,
      );
      runtime.targetX = next.x;
      runtime.targetZ = next.z;
    }
    return towardDirection(position.x, position.z, runtime.targetX, runtime.targetZ);
  }

  /** The nearest connected player to a point, as their whole runtime, or null in an empty world. */
  private nearestPlayerRuntime(from: Readonly<Vec3>): PlayerRuntime | null {
    let best: PlayerRuntime | null = null;
    let bestDistance = Infinity;
    for (const runtime of this.players.values()) {
      // Somebody indoors is nowhere out in the world at all, and somebody
      // down, or getting back up, is left alone.
      if (runtime.space !== OUTDOORS) continue;
      if (
        runtime.action.kind === ActionKind.KnockedOut ||
        (runtime.action.kind === ActionKind.Rise && runtime.action.step !== RiseFrom.Chair)
      ) {
        continue;
      }
      const position = runtime.entity.get(Position);
      if (position === undefined) continue;
      const distance = horizontalDistance(from, position);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = runtime;
      }
    }
    return best;
  }

  /** The nearest live animal that hunts this kind, or null - so prey knows to flee it, the same as a player. */
  private nearestPredatorRuntime(
    preyKind: AnimalKindId,
    from: Readonly<Vec3>,
  ): AnimalRuntime | null {
    let best: AnimalRuntime | null = null;
    let bestDistance = Infinity;
    for (const runtime of this.animals.values()) {
      if (runtime.caught) continue;
      // Widened the same way `stepAnimals` does: an optional field like
      // `preysOn` reads the same regardless of which kind this happens to be.
      const candidateKind: AnimalKind = ANIMAL_KINDS[runtime.kind];
      if (!(candidateKind.preysOn ?? []).includes(preyKind)) continue;
      const position = runtime.entity.get(Position);
      if (position === undefined) continue;
      const distance = horizontalDistance(from, position);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = runtime;
      }
    }
    return best;
  }

  /** The nearest live animal of a hunted kind, or null in reach of nothing worth chasing. */
  private nearestPreyRuntime(
    preyKinds: readonly AnimalKindId[],
    from: Readonly<Vec3>,
  ): AnimalRuntime | null {
    let best: AnimalRuntime | null = null;
    let bestDistance = Infinity;
    for (const runtime of this.animals.values()) {
      if (runtime.caught) continue;
      if (!preyKinds.includes(runtime.kind)) continue;
      const position = runtime.entity.get(Position);
      if (position === undefined) continue;
      const distance = horizontalDistance(from, position);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = runtime;
      }
    }
    return best;
  }

  /**
   * A calm hunter's tick: chase the nearest thing it preys on once one comes
   * within `preyDetectionRadius`, catching it exactly the way a knockout
   * catch works once close enough - gone until it respawns at its own den.
   * Ambles like anything else calm when nothing is worth chasing.
   */
  private stepHunt(
    runtime: AnimalRuntime,
    kind: AnimalKind,
    position: Readonly<Vec3>,
  ): { direction: Direction2D; speed: number } {
    const preyKinds = kind.preysOn ?? [];
    const prey = this.nearestPreyRuntime(preyKinds, position);
    const preyPosition = prey?.entity.get(Position) ?? null;
    const preyDistance =
      preyPosition === null ? Infinity : horizontalDistance(position, preyPosition);

    if (prey === null || preyPosition === null || preyDistance > (kind.preyDetectionRadius ?? 0)) {
      return { direction: this.wanderStep(runtime, kind, position), speed: kind.wanderSpeed };
    }

    if (preyDistance <= PREDATOR_CATCH_RADIUS) {
      prey.caught = true;
      prey.respawnAtMs = this.nowMs + ANIMAL_RESPAWN_SECONDS * 1000;
      return { direction: { x: 0, z: 0 }, speed: 0 };
    }

    return {
      direction: towardDirection(position.x, position.z, preyPosition.x, preyPosition.z),
      speed: kind.preyChaseSpeed ?? kind.wanderSpeed,
    };
  }

  /**
   * Take whatever this player is standing next to.
   *
   * Nothing happens if there is nothing in reach or their pack is already full,
   * and a pickup only ever leaves the world once however many people reach for
   * it in the same tick. Returns whether it happened, so the caller can fall
   * back to something else the same button might mean.
   */
  private tryPickup(runtime: PlayerRuntime, position: Readonly<Vec3>): boolean {
    const pickup = pickupInReach(position, this.clearing.pickups, (id) =>
      this.takenPickups.has(id),
    );
    if (pickup === null) return false;
    if (addItem(runtime.inventory, pickup.item) === 0) return false;

    this.takenPickups.add(pickup.id);
    this.pickupEvents.push({
      netId: runtime.netId,
      pickupId: pickup.id,
      item: pickup.item,
    });
    this.gestureEvents.push({ netId: runtime.netId, gesture: Gesture.PickUp, item: pickup.item });
    return true;
  }

  /**
   * Pick up the nearest pile somebody dropped, if there is one in reach - as
   * much of it as fits, leaving the rest lying there. Returns whether
   * anything was picked up.
   */
  private tryPickUpPile(runtime: PlayerRuntime, position: Readonly<Vec3>): boolean {
    const pile = droppedPileInReach(position, this.droppedPiles);
    if (pile === null) return false;
    const taken = addItem(runtime.inventory, pile.item, pile.count);
    if (taken === 0) return false;

    pile.count -= taken;
    if (pile.count === 0) this.droppedPiles.splice(this.droppedPiles.indexOf(pile), 1);
    this.pileChanges.add(pile.id);
    this.gatherEvents.push(runtime.netId);
    this.gestureEvents.push({ netId: runtime.netId, gesture: Gesture.PickUp, item: pile.item });
    return true;
  }

  /**
   * Gather one from a nearby patch - sticks or flowers, whatever it offers -
   * if there is one in reach with any left and this player is not still
   * catching their breath from a swing, a cast or a gather of their own.
   * Taking the last one leaves the patch picked clean until it grows back
   * somewhere else (see `regrowPatches`). Returns whether it happened.
   */
  private tryGather(runtime: PlayerRuntime, position: Readonly<Vec3>): boolean {
    if (runtime.swingCooldownTicks > 0) return false;
    const patch = gatherSpotInReach(position, this.patches);
    if (patch === null) return false;
    if (addItem(runtime.inventory, patch.item) === 0) return false;

    patch.remaining -= 1;
    if (patch.remaining === 0) patch.emptiedAtMs = this.nowMs;
    this.patchChanges.add(patch.id);
    runtime.swingCooldownTicks = SWING_COOLDOWN_TICKS;
    this.gatherEvents.push(runtime.netId);
    this.gestureEvents.push({ netId: runtime.netId, gesture: Gesture.PickUp, item: patch.item });
    return true;
  }

  /**
   * Bring back every picked-clean patch whose time is up, each at a fresh
   * spot with a fresh count.
   *
   * Called with real time, the same reason `regrowTrees` is: on waking,
   * anything picked clean long enough ago comes back at once.
   */
  regrowPatches(nowMs: number): void {
    for (const patch of this.patches) {
      if (!patchIsDue(this.seed, patch, nowMs, this.patchRegrowMinSeconds)) continue;
      const generation = patch.generation + 1;
      this.movePatch(patch, generation);
      patch.remaining = patchCount(this.seed, patch.id, generation);
      patch.emptiedAtMs = 0;
    }
  }

  /**
   * Put a patch somewhere new: the first open spot its seed offers for this
   * generation, or back where the clearing first laid it if somehow none of
   * them is.
   */
  private movePatch(patch: GatherPatch, generation: number): void {
    const footprints = this.buildFootprints();
    const spot =
      patchRegrowSpot(this.seed, patch.id, generation, (x, z) =>
        this.patchSpotIsClear(patch.id, x, z, footprints),
      ) ?? this.clearing.gatherSpots.find((original) => original.id === patch.id);
    if (spot !== undefined) {
      patch.x = spot.x;
      patch.z = spot.z;
    }
    patch.generation = generation;
    this.patchChanges.add(patch.id);
  }

  /**
   * Whether a patch could grow here: on open ground, not in the pond, not on
   * a tree, rock or anything built, not right where people arrive, and not
   * so close to anything else waiting to be picked up that one press of the
   * button could mean either.
   */
  private patchSpotIsClear(
    patchId: number,
    x: number,
    z: number,
    footprints: readonly Footprint[],
  ): boolean {
    if (Math.hypot(x - SPAWN_POSITION.x, z - SPAWN_POSITION.z) < PATCH_SPAWN_CLEARANCE) {
      return false;
    }
    if (overlapsWater(this.clearing.water, x, z, PATCH_CLEARANCE)) return false;
    const here = roundFootprint(x, z, PATCH_CLEARANCE, 'patch');
    if (footprints.some((footprint) => footprintGap(here, footprint) < 0)) return false;

    const tooClose = (other: { x: number; z: number }): boolean =>
      Math.hypot(other.x - x, other.z - z) < PATCH_SPACING;
    for (const other of this.patches) {
      if (other.id !== patchId && other.remaining > 0 && tooClose(other)) return false;
    }
    for (const pickup of this.clearing.pickups) {
      if (!this.takenPickups.has(pickup.id) && tooClose(pickup)) return false;
    }
    if (this.droppedPiles.some(tooClose)) return false;
    return !this.buriedCaches.some(tooClose);
  }

  /**
   * Move any patch a new piece was just built on top of, keeping however
   * many it had left: a patch under a cabin would be out of reach for good,
   * and never picked clean, never grow back anywhere else either.
   */
  private movePatchesFrom(piece: Footprint): void {
    for (const patch of this.patches) {
      if (patch.remaining === 0) continue;
      const here = roundFootprint(patch.x, patch.z, PATCH_CLEARANCE, 'patch');
      if (footprintGap(here, piece) < 0) this.movePatch(patch, patch.generation + 1);
    }
  }

  /**
   * Drop or destroy some of what this player is carrying, to make room.
   *
   * Dropped things land just in front of them - or at their feet, if in
   * front is water or a tree - added to a pile of the same thing already
   * there, or starting a new one. Never a bag, never more than they hold,
   * and never dropped indoors, where there is nowhere for a pile to lie;
   * destroying works anywhere. Not tied to the tick loop, the same as
   * crafting: settled the moment it arrives, so the caller says what time
   * it is - a pile's fading is counted from then. Returns whether anything
   * changed.
   */
  discardItem(netId: number, request: DiscardRequest, nowMs: number): boolean {
    const runtime = this.players.get(netId);
    if (runtime === undefined) return false;
    const { item, destroy } = request;
    if (!isDiscardable(item) || !Number.isInteger(request.amount) || request.amount < 1) {
      return false;
    }
    const count = Math.min(request.amount, countOf(runtime.inventory, item));
    if (count === 0) return false;

    if (!destroy) {
      if (runtime.space !== OUTDOORS) return false;
      const position = runtime.entity.get(Position);
      if (position === undefined) return false;
      this.dropPile(item, count, position, runtime.entity.get(Facing)?.yaw ?? 0, nowMs);
      this.gestureEvents.push({ netId, gesture: Gesture.PickUp, item: null });
    }

    const wasHolding = this.equippedItemOf(netId);
    removeItem(runtime.inventory, item, count);
    if (item === 'rod' && runtime.cast !== null && !hasItem(runtime.inventory, 'rod')) {
      this.endCast(runtime, { outcome: 'walkedAway' });
    }
    if (wasHolding !== this.equippedItemOf(netId)) this.equipEvents.push(netId);
    this.discardEvents.push({ netId, item, count, destroyed: destroy });
    return true;
  }

  /** Lay down a pile, or add to one of the same thing right there. */
  private dropPile(
    item: ItemId,
    count: number,
    position: Readonly<Vec3>,
    facingYaw: number,
    nowMs: number,
  ): void {
    const ahead = dropSpot(position, facingYaw);
    const landsInFront = this.dropSpotIsClear(ahead.x, ahead.z);
    const x = landsInFront ? ahead.x : position.x;
    const z = landsInFront ? ahead.z : position.z;

    const existing = pileToMergeInto(this.droppedPiles, item, count, x, z);
    if (existing !== null) {
      existing.count += count;
      existing.droppedAtMs = nowMs;
      // Freshly added to, so it is the newest now: the last to fade early.
      this.droppedPiles.splice(this.droppedPiles.indexOf(existing), 1);
      this.droppedPiles.push(existing);
      this.pileChanges.add(existing.id);
      return;
    }

    if (this.droppedPiles.length >= MAX_DROPPED_PILES) {
      const oldest = this.droppedPiles.shift();
      if (oldest !== undefined) this.pileChanges.add(oldest.id);
    }
    const pile: DroppedPile = {
      id: this.claimPileId(),
      item,
      count,
      x,
      z,
      droppedAtMs: nowMs,
    };
    this.droppedPiles.push(pile);
    this.pileChanges.add(pile.id);
  }

  /**
   * A fresh pile id. Ids travel in two bytes, so after the last one they
   * start again from one, stepping over any still lying about.
   */
  private claimPileId(): number {
    for (;;) {
      const id = this.nextDroppedPileId;
      this.nextDroppedPileId = id >= 0xffff ? 1 : id + 1;
      if (!this.droppedPiles.some((pile) => pile.id === id)) return id;
    }
  }

  /** Whether something dropped here would lie on open ground, not in the pond or inside a trunk. */
  private dropSpotIsClear(x: number, z: number): boolean {
    if (overlapsWater(this.clearing.water, x, z, 0)) return false;
    const here = roundFootprint(x, z, 0, 'pile');
    return !this.buildFootprints().some((footprint) => footprintGap(here, footprint) < 0);
  }

  /**
   * Let every pile whose time is up fade away.
   *
   * Called with real time, the same reason `regrowTrees` is: on waking,
   * anything that should have faded while nobody was here is gone at once.
   */
  fadeDroppedPiles(nowMs: number): void {
    for (let index = this.droppedPiles.length - 1; index >= 0; index--) {
      const pile = this.droppedPiles[index];
      if (pile === undefined || nowMs < pileFadesAtMs(pile)) continue;
      this.droppedPiles.splice(index, 1);
      this.pileChanges.add(pile.id);
    }
  }

  /**
   * Dig up this player's own buried cache, if one is in reach. Unlike a
   * pickup a cache belongs to exactly one player, so being close enough is
   * not by itself enough - it also has to be theirs. Returns whether it
   * happened.
   */
  private tryDigUpCache(runtime: PlayerRuntime, position: Readonly<Vec3>): boolean {
    const cache = nearestBuriedCache(
      position,
      this.buriedCaches,
      (candidate) => runtime.playerKey !== null && candidate.ownerPlayerKey === runtime.playerKey,
    );
    if (cache === null) return false;

    for (const entry of cache.items) addItem(runtime.inventory, entry.item, entry.count);
    this.buriedCaches.splice(this.buriedCaches.indexOf(cache), 1);
    this.cacheEvents.push({ netId: runtime.netId, kind: 'dugUp', cacheId: cache.id });
    this.gestureEvents.push({ netId: runtime.netId, gesture: Gesture.Dig, item: null });
    return true;
  }

  /**
   * Light or put out the nearest campfire in reach.
   *
   * Returns whether a campfire was found at all, regardless of `isFreshPress`
   * - a campfire in reach always claims the interact button, so the caller
   * knows not to fall through to eating. It only actually flips lit state
   * when `isFreshPress` is true, so holding the button down toggles it once
   * rather than flickering it every tick.
   */
  private tryToggleCampfire(
    runtime: PlayerRuntime,
    position: Readonly<Vec3>,
    nowMs: number,
    isFreshPress: boolean,
  ): boolean {
    const campfire = nearestCampfire(position, this.builtProps);
    if (campfire === null) return false;
    if (!isFreshPress) return true;

    campfire.lit = !campfire.lit;
    if (campfire.lit) {
      this.campfireLitUntilMs.set(campfire.id, nowMs + CAMPFIRE_BURN_SECONDS * 1000);
    } else {
      this.campfireLitUntilMs.delete(campfire.id);
    }
    this.campfireLitEvents.push({ propId: campfire.id, lit: campfire.lit });
    this.gestureEvents.push({ netId: runtime.netId, gesture: Gesture.Reach, item: null });
    return true;
  }

  /**
   * Put out every campfire whose time is up.
   *
   * Called with real time, the same reason `regrowTrees` is: a world with
   * nobody in it does not tick, so on waking, anything that should have
   * burned out while nobody was here goes out at once.
   */
  extinguishBurnedOutCampfires(nowMs: number): CampfireLitEvent[] {
    for (const [propId, dueAt] of this.campfireLitUntilMs) {
      if (nowMs < dueAt) continue;
      const campfire = this.builtPropsById.get(propId);
      if (campfire === undefined) continue;

      campfire.lit = false;
      this.campfireLitUntilMs.delete(propId);
      this.campfireLitEvents.push({ propId, lit: false });
    }
    return this.campfireLitEvents.splice(0);
  }

  /** When this campfire should go out on its own, or null while it isn't lit. Used for persistence. */
  campfireLitUntilMsFor(propId: number): number | null {
    return this.campfireLitUntilMs.get(propId) ?? null;
  }

  /**
   * Eat whatever is active, if it is food, it is still held, and it would
   * actually help. Carrying other food that is not the active item does
   * nothing - see `isActiveItem`.
   */
  private tryEat(runtime: PlayerRuntime): void {
    const item = foodToEat(runtime.inventory, runtime.hunger, runtime.equippedItem);
    if (item === null) return;
    this.eatItem(runtime, item);
  }

  private eatItem(runtime: PlayerRuntime, item: ItemId): void {
    removeItem(runtime.inventory, item);
    runtime.hunger = eat(runtime.hunger, item);
    this.queueHungerEvent(runtime, item);
    this.gestureEvents.push({ netId: runtime.netId, gesture: Gesture.Eat, item });
  }

  /**
   * Tell this player their hunger, but only when it is worth a message: right
   * after eating, or once the passing seconds have moved it by a whole point.
   */
  private queueHungerEvent(runtime: PlayerRuntime, ate: ItemId | null): void {
    const rounded = Math.round(runtime.hunger);
    if (ate === null && rounded === runtime.lastSentHunger) return;
    runtime.lastSentHunger = rounded;
    this.hungerEvents.push({ netId: runtime.netId, hunger: rounded, ate });
  }

  /**
   * Whether this player can act with this item right now: it is not just
   * somewhere in the pack, it is the one the hotbar has selected.
   *
   * Chopping, casting and eating all gate on this instead of `hasItem`
   * alone, so having several tools in the pack never lets a click do more
   * than one of them - whichever is active decides. Re-checks `hasItem` the
   * same reason `equippedItemOf` does: eating the last of an equipped fish,
   * or a knockout burying it away, empties a hand out on its own with
   * nothing here having to notice and clear the field itself.
   */
  private isActiveItem(runtime: PlayerRuntime, item: ItemId): boolean {
    return runtime.equippedItem === item && hasItem(runtime.inventory, item);
  }

  /**
   * Whether this player currently counts as lit: carrying a lit torch, or
   * close enough to a lit campfire or a built lantern. Cancels a threat's
   * own night bonus - see `NIGHT_ALERT_RADIUS_MULTIPLIER`.
   *
   * An unlit campfire does not count - only a lantern needs no check of its
   * own, since it has no off state to begin with (decision 0047).
   */
  private isPlayerLit(runtime: PlayerRuntime, position: Readonly<Vec3>): boolean {
    if (this.equippedItemOf(runtime.netId) === 'torch') return true;

    const reachSquared = LIGHT_SAFETY_RADIUS * LIGHT_SAFETY_RADIUS;
    for (const prop of this.builtProps) {
      if (prop.kind !== 'campfire' && prop.kind !== 'lantern') continue;
      if (prop.kind === 'campfire' && !prop.lit) continue;
      const dx = prop.x - position.x;
      const dz = prop.z - position.z;
      if (dx * dx + dz * dz <= reachSquared) return true;
    }
    return false;
  }

  /**
   * What a move needs to know about this player's situation right now (see
   * `sim/actions.ts`): whether they have anything in hand to swing, out in
   * the world with no line in the water, and whether a click with the rod
   * would cast instead - water decides.
   */
  private actionContext(
    runtime: PlayerRuntime,
    position: Readonly<Vec3>,
    aimYaw: number,
  ): ActionContext {
    const held = this.equippedItemOf(runtime.netId);
    const canAttack = held !== null && runtime.space === OUTDOORS && runtime.cast === null;
    const castInstead =
      canAttack &&
      held === 'rod' &&
      runtime.swingCooldownTicks === 0 &&
      castLanding(position, aimYaw, this.clearing.water) !== null;
    return { canAttack, castInstead };
  }

  /**
   * A swing or a charged strike lands, at the moment its blow connects:
   * on the tree in front, with the axe - a tree is only for chopping - or
   * failing that on whatever animal is in reach, with anything at all in
   * hand. Swinging at nothing is a swing at nothing.
   *
   * A charged strike is the payoff for winding up, rooted to the spot:
   * whatever it lands on goes down outright, however many swings that would
   * otherwise have taken.
   */
  private landBlow(
    runtime: PlayerRuntime,
    position: Readonly<Vec3>,
    aimYaw: number,
    impact: Impact,
  ): void {
    if (this.equippedItemOf(runtime.netId) === null) return;
    const charged = impact.kind === 'strike';

    if (this.isActiveItem(runtime, 'axe')) {
      const tree = this.treeInReachOf(position, aimYaw);
      if (tree !== null) {
        this.chopTree(runtime, tree, charged);
        return;
      }
    }

    // Looking back to when the swing began, and a little before for the
    // browser having shown it slightly in the past (see decision 0056).
    const began =
      impact.kind === 'strike' ? STRIKE.impact : (LIGHT_COMBO[impact.step - 1]?.impact ?? 0);
    const animalTarget = this.animalInReachOf(position, aimYaw, began + LAG_COMPENSATION_TICKS);
    if (animalTarget !== null) this.catchAnimal(runtime, animalTarget.id, charged);
  }

  /** One blow of the axe into a tree, or the one that brings it down. */
  private chopTree(runtime: PlayerRuntime, target: ChopTarget, charged: boolean): void {
    const state = this.treeState(target.prop.id);
    const swingsTaken = charged ? target.rule.swingsToFell : state.swingsTaken + 1;
    const swingsLeft = Math.max(0, target.rule.swingsToFell - swingsTaken);

    if (swingsLeft > 0) {
      state.swingsTaken = swingsTaken;
      this.chopEvents.push({
        netId: runtime.netId,
        treeId: target.prop.id,
        swingsLeft,
        logsGained: 0,
      });
      return;
    }

    this.fellTree(target.prop.id, this.nowMs);
    // A full pack means the wood stays on the ground. The tree still falls:
    // you did chop it down, you just cannot carry what came off it.
    const logsGained = addItem(runtime.inventory, 'log', target.rule.logs);
    this.chopEvents.push({
      netId: runtime.netId,
      treeId: target.prop.id,
      swingsLeft: 0,
      logsGained,
    });
  }

  /** Whether nobody else is already in this chair, or in this bed. */
  private isRestingPlaceFree(runtime: PlayerRuntime, place: RestingPlace): boolean {
    const kind = place.kind === 'chair' ? ActionKind.Sit : ActionKind.Lie;
    const rising = place.kind === 'chair' ? RiseFrom.Chair : RiseFrom.Bed;
    for (const other of this.players.values()) {
      if (other === runtime || other.space !== runtime.space) continue;
      const { action } = other;
      if (action.kind === kind || (action.kind === ActionKind.Rise && action.step === rising)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Sit down in the chair, or lie down in bed: stood at its spot, facing its
   * way, and settling in (see decision 0056). Getting up again is the
   * player's own move - see `advanceAction`.
   */
  private settleInto(runtime: PlayerRuntime, motion: PlayerMotion, place: RestingPlace): void {
    motion.position.x = place.stand.x;
    motion.position.z = place.stand.z;
    motion.position.y = 0;
    motion.velocity.x = 0;
    motion.velocity.y = 0;
    motion.velocity.z = 0;
    motion.facingYaw = place.stand.yaw;
    motion.grounded = true;
    beginAction(runtime.action, place.kind === 'chair' ? ActionKind.Sit : ActionKind.Lie);
  }

  /**
   * Catch an animal that is not a tree: the swing that just missed a trunk
   * lands on whatever wildlife was in reach instead.
   *
   * Prey goes down in one landed swing, the same as always. A threat takes
   * `hitsToDefeat` of them, the same shape of rule as a tree's `swingsToFell`
   * - each one short of the last is a `ThreatHit`, not yet a catch - unless
   * `charged` says this one swing is worth all of them at once.
   *
   * Either way it goes back to its den once `ANIMAL_RESPAWN_SECONDS` is up,
   * the same way a tree waits out `regrowMinSeconds` before it is worth
   * chopping again.
   */
  private catchAnimal(runtime: PlayerRuntime, animalId: number, charged: boolean): void {
    const animal = this.animals.get(animalId);
    if (animal === undefined) return;
    const kind: AnimalKind = ANIMAL_KINDS[animal.kind];

    if (kind.threat !== undefined && !charged) {
      animal.hitsTaken += 1;
      const hitsLeft = kind.threat.hitsToDefeat - animal.hitsTaken;
      if (hitsLeft > 0) {
        this.threatHitEvents.push({ animalId: animal.id, hitsLeft, netId: runtime.netId });
        return;
      }
    }

    animal.caught = true;
    animal.respawnAtMs = this.nowMs + ANIMAL_RESPAWN_SECONDS * 1000;
    animal.hitsTaken = 0;

    const item = kind.catchItem;
    // A full pack means it was still caught - the den stays empty for the
    // same reason a felled tree still falls with no room for the logs. A
    // threat with nothing to pay out - the masked raccoon, for now - still
    // counts as caught, just with nothing added.
    const added = item === undefined ? 0 : addItem(runtime.inventory, item, 1);
    this.catchEvents.push({ netId: runtime.netId, item: item ?? null, added });
  }

  /**
   * Take health off a player. A hit that lands makes them flinch, which stops
   * whatever they were doing - a charge included - and one that empties
   * their health knocks them out: down where they stand, half their pack
   * buried there, healed straight back to full, and woken up a couple of
   * seconds later at home (see `wakeUp`).
   *
   * A dodge timed right beats this outright: mid-roll, the hit simply never
   * lands. Nobody can be hit while down or getting back up either.
   */
  private damagePlayer(runtime: PlayerRuntime, amount: number): void {
    if (runtime.action.kind === ActionKind.Dodge) {
      if (this.tick - runtime.dodgeStartedAtTick < DODGE.invulnerable) {
        this.healthEvents.push({
          netId: runtime.netId,
          health: Math.round(runtime.health),
          knockedOut: false,
          dodged: true,
        });
        return;
      }
    } else if (isUntouchable(runtime.action)) {
      return;
    }

    const remaining = Math.max(0, runtime.health - amount);
    const knockedOut = remaining <= 0;
    runtime.health = knockedOut ? HEALTH_MAX : remaining;

    if (knockedOut) {
      // Where they fell is where it stays buried.
      const position = runtime.entity.get(Position);
      if (position !== undefined) {
        const buried = buryHalf(runtime.inventory);
        if (buried.length > 0) {
          const cache: BuriedCache = {
            id: this.nextBuriedCacheId++,
            ownerPlayerKey: runtime.playerKey,
            x: position.x,
            z: position.z,
            items: buried,
          };
          this.buriedCaches.push(cache);
          this.cacheEvents.push({ netId: runtime.netId, kind: 'buried', cache });
        }
      }
      if (runtime.cast !== null) this.endCast(runtime, { outcome: 'walkedAway' });
      runtime.pendingBuild = null;
      beginAction(runtime.action, ActionKind.KnockedOut);
      runtime.knockedOutAtTick = this.tick;
    } else {
      beginAction(runtime.action, ActionKind.Flinch);
    }

    this.healthEvents.push({
      netId: runtime.netId,
      health: Math.round(runtime.health),
      knockedOut,
      dodged: false,
    });
  }

  /**
   * Wake a knocked-out player up, once they have been down long enough: at
   * home, getting out of their own bed, if they have one (see decision
   * 0055); otherwise getting up off the ground in the shared clearing,
   * facing whichever way they already happened to be.
   */
  private wakeUp(runtime: PlayerRuntime): void {
    const home = runtime.playerKey !== null ? this.homeOf(runtime.playerKey) : null;
    if (home !== null) {
      runtime.doorCooldownTicks = DOOR_COOLDOWN_TICKS;
      this.placePlayer(
        runtime.netId,
        { x: HOME_WAKE_SPOT.x, y: 0, z: HOME_WAKE_SPOT.z },
        HOME_WAKE_SPOT.yaw,
        home.id,
      );
      this.spaceChanges.push({
        netId: runtime.netId,
        space: home.id,
        x: HOME_WAKE_SPOT.x,
        z: HOME_WAKE_SPOT.z,
        yaw: HOME_WAKE_SPOT.yaw,
      });
      beginAction(runtime.action, ActionKind.Rise, RiseFrom.Bed);
    } else {
      const facingYaw = runtime.entity.get(Facing)?.yaw ?? 0;
      this.placePlayer(runtime.netId, this.nextSpawnPosition(), facingYaw);
      beginAction(runtime.action, ActionKind.Rise, RiseFrom.Ground);
    }
  }

  /**
   * Cast a line, if this player has the rod active and is facing water.
   *
   * A tree you could chop comes first: with the axe active and a trunk in
   * reach, the click was for the tree.
   */
  private tryCast(runtime: PlayerRuntime, position: Readonly<Vec3>, aimYaw: number): void {
    if (runtime.swingCooldownTicks > 0) return;
    if (!this.isActiveItem(runtime, 'rod')) return;

    const spot = castLanding(position, aimYaw, this.clearing.water);
    if (spot === null) return;

    runtime.cast = startCast(this.seed, this.castCounter++, this.tick, position, spot);
    this.fishingEvents.push({ kind: 'cast', netId: runtime.netId, x: spot.x, z: spot.z });
  }

  /**
   * Place what this player asked for where they asked for it, if they can
   * afford it, the spot is in reach and clear (see `checkBuildSpot`), and -
   * for anything capped to one per player - they do not already have one of
   * that kind.
   */
  private tryBuild(runtime: PlayerRuntime, position: Readonly<Vec3>, request: BuildRequest): void {
    if (runtime.swingCooldownTicks > 0) return;
    const { kind } = request;
    const buildable = BUILDABLE_KINDS[kind];
    if (!canAfford(runtime.inventory, buildable)) return;
    // Capped kinds are capped per kind, not shared across all of them: a
    // cabin does not block a flower bed, and one flower bed does not block a
    // second, different, capped decoration.
    if (
      buildable.capPerPlayer &&
      runtime.playerKey !== null &&
      this.ownsBuildable(runtime.playerKey, kind)
    )
      return;

    const piece = buildableFootprint(kind, request.x, request.z, request.yaw);
    const refusal = checkBuildSpot(
      piece,
      position,
      BUILD_REACH + BUILD_REACH_SLACK,
      this.clearing.water,
      this.buildFootprints(),
    );
    if (refusal !== null) return;

    runtime.swingCooldownTicks = SWING_COOLDOWN_TICKS;
    for (const cost of buildable.costs) removeItem(runtime.inventory, cost.item, cost.amount);

    const prop: BuiltProp = {
      id: this.nextBuiltPropId++,
      kind,
      x: request.x,
      z: request.z,
      yaw: request.yaw,
      lit: false,
    };
    this.builtProps.push(prop);
    this.builtPropsById.set(prop.id, prop);
    if (buildable.isHome) this.collision.colliders.push(cabinCollider(prop));
    this.movePatchesFrom(piece);
    const ownerKey = buildable.capPerPlayer ? runtime.playerKey : null;
    if (ownerKey !== null) this.ownedBuiltProps.set(prop.id, ownerKey);
    this.buildEvents.push({ netId: runtime.netId, prop, ownerKey });
    this.gestureEvents.push({ netId: runtime.netId, gesture: Gesture.Reach, item: null });
  }

  /** Everything a new piece has to keep clear of: every tree, rock and stump, and everything built. */
  private buildFootprints(): Footprint[] {
    return [
      ...this.standing.map((prop) =>
        roundFootprint(
          prop.x,
          prop.z,
          PROP_KINDS[prop.kind].colliderRadius * prop.scale,
          PROP_KINDS[prop.kind].displayName.toLowerCase(),
        ),
      ),
      ...this.builtProps.map((built) =>
        buildableFootprint(built.kind, built.x, built.z, built.yaw),
      ),
    ];
  }

  /** Whose a built prop is, by player key, or null if it is communal. */
  builtPropOwner(propId: number): string | null {
    return this.ownedBuiltProps.get(propId) ?? null;
  }

  /** Whether this player already has one of this particular kind built somewhere. */
  private ownsBuildable(playerKey: string, kind: BuildableKindId): boolean {
    for (const [id, owner] of this.ownedBuiltProps) {
      if (owner !== playerKey) continue;
      const prop = this.builtPropsById.get(id);
      if (prop !== undefined && prop.kind === kind) return true;
    }
    return false;
  }

  /** This player's own home, or null if they have none. */
  private homeOf(playerKey: string): BuiltProp | null {
    for (const [id, owner] of this.ownedBuiltProps) {
      if (owner !== playerKey) continue;
      const home = this.builtPropsById.get(id);
      if (home !== undefined && BUILDABLE_KINDS[home.kind].isHome) return home;
    }
    return null;
  }

  /** A tick of waiting at the water: the bite, the leash and giving up. */
  private tickLine(runtime: PlayerRuntime, cast: Cast, position: Readonly<Vec3>): void {
    const progress = tickCast(cast, this.tick, position);
    if (progress.bit) this.fishingEvents.push({ kind: 'bite', netId: runtime.netId });
    if (progress.end !== null) this.endCast(runtime, progress.end);
  }

  /** One of the angler's inputs: did they click, and did they see the bite? */
  private readLine(runtime: PlayerRuntime, cast: Cast, input: CastInput): void {
    const end = readCastInput(cast, this.seed, this.tick, input);
    if (end !== null) this.endCast(runtime, end);
  }

  /** The line comes in, with or without a fish, and everybody hears how. */
  private endCast(runtime: PlayerRuntime, end: CastEnd): void {
    runtime.cast = null;
    runtime.swingCooldownTicks = CAST_COOLDOWN_TICKS;

    if (end.outcome === 'caught') {
      // Hooked either way; a full pack means it goes back in the water.
      const added = addItem(runtime.inventory, end.item);
      this.fishingEvents.push({ kind: 'caught', netId: runtime.netId, item: end.item, added });
      return;
    }
    this.fishingEvents.push({ kind: end.outcome, netId: runtime.netId });
  }

  /** Take a tree out of the world: it stops blocking, and a stump blocks instead. */
  private fellTree(treeId: number, felledAtMs: number): void {
    const state = this.treeState(treeId);
    if (state.felled) return;
    state.felled = true;
    state.swingsTaken = 0;
    state.felledAtMs = felledAtMs;

    const index = this.clearing.indexById.get(treeId);
    const tree = index === undefined ? undefined : this.standing[index];
    if (index === undefined || tree === undefined) return;
    replaceCollider(this.collision, index, stumpColliderFor(tree));
  }

  /**
   * Put a tree back, at whatever size this generation of it is.
   *
   * Both the thing you bump into and the thing reach is measured against have
   * to agree it is a tree again, and agree about how big.
   */
  private growTree(treeId: number, state: TreeState): void {
    state.felled = false;
    state.swingsTaken = 0;
    state.generation = nextGeneration(state.generation);

    const index = this.clearing.indexById.get(treeId);
    const original = index === undefined ? undefined : this.clearing.props[index];
    if (index === undefined || original === undefined) return;

    const grown = treeAtGeneration(this.seed, original, state.generation);
    this.standing[index] = grown;
    replaceCollider(this.collision, index, colliderForProp(grown));
    this.regrowthEvents.push({ treeId, generation: state.generation });
  }

  private treeState(treeId: number): TreeState {
    const existing = this.trees.get(treeId);
    if (existing !== undefined) return existing;
    const fresh: TreeState = { swingsTaken: 0, felled: false, felledAtMs: 0, generation: 0 };
    this.trees.set(treeId, fresh);
    return fresh;
  }

  /**
   * Bring back every tree whose time is up and whose spot is free.
   *
   * Called with real time, because a world with nobody in it does not tick. On
   * waking, everything that fell long enough ago comes back at once.
   */
  regrowTrees(nowMs: number): TreeRegrown[] {
    const players: Vec3[] = [];
    for (const runtime of this.players.values()) {
      if (runtime.space !== OUTDOORS) continue;
      const position = runtime.entity.get(Position);
      if (position !== undefined) players.push({ x: position.x, y: position.y, z: position.z });
    }

    for (const [treeId, state] of this.trees) {
      if (!state.felled) continue;
      const dueAt = regrowDueAtMs(
        this.seed,
        treeId,
        state.generation,
        state.felledAtMs,
        this.regrowMinSeconds,
      );
      if (nowMs < dueAt) continue;

      const index = this.clearing.indexById.get(treeId);
      const original = index === undefined ? undefined : this.clearing.props[index];
      if (index === undefined || original === undefined) continue;

      // The same tree `growTree` is about to put here, so the room it asks for
      // is the room it will take.
      const grown = treeAtGeneration(this.seed, original, nextGeneration(state.generation));
      const footprint = colliderFootprintRadius(colliderForProp(grown));
      // Somebody is standing here: it waits rather than growing through them.
      if (!spotIsClear(grown.x, grown.z, footprint, players)) continue;

      this.growTree(treeId, state);
    }

    return this.regrowthEvents.splice(0);
  }

  /** The tree this player would hit if they swung, or null. Used by tests. */
  treeInReachOf(position: Readonly<Vec3>, aimYaw: number): ChopTarget | null {
    return treeInReach(position, aimYaw, this.standing, (id) => this.isFelled(id));
  }

  isFelled(treeId: number): boolean {
    return this.trees.get(treeId)?.felled === true;
  }

  /** The animal this player would catch if they swung, or null. Used by tests. */
  animalInReachOf(position: Readonly<Vec3>, aimYaw: number, ticksBack = 0): CatchTarget | null {
    const candidates: CatchCandidate[] = [];
    for (const runtime of this.animals.values()) {
      if (runtime.caught) continue;
      const animalPosition = runtime.entity.get(Position);
      if (animalPosition === undefined) continue;
      candidates.push({ id: runtime.id, x: animalPosition.x, z: animalPosition.z });
      // Wherever it was over the last few ticks counts too: a swing that
      // began with it in reach lands, however fast it bolted since.
      const back = Math.min(ticksBack, runtime.trailCount - 1);
      for (let i = 1; i <= back; i++) {
        const index = (runtime.trailHead - i + ANIMAL_TRAIL_TICKS) % ANIMAL_TRAIL_TICKS;
        candidates.push({
          id: runtime.id,
          x: runtime.trailX[index] ?? 0,
          z: runtime.trailZ[index] ?? 0,
        });
      }
    }

    const found = animalInReach(position, aimYaw, candidates);
    const runtime = found === null ? undefined : this.animals.get(found.id);
    return runtime === undefined ? null : { id: runtime.id, kind: runtime.kind };
  }

  /** How many more swings this tree needs, or null if it is already down. */
  swingsLeftOn(treeId: number): number | null {
    const state = this.trees.get(treeId);
    if (state?.felled === true) return null;
    const index = this.clearing.indexById.get(treeId);
    const tree = index === undefined ? undefined : this.standing[index];
    if (tree === undefined) return null;
    const rule = choppingRuleFor(PROP_KINDS[tree.kind]);
    if (rule === null) return null;
    return rule.swingsToFell - (state?.swingsTaken ?? 0);
  }

  /** Trees that are down right now, for sending to a client. */
  felledTreeIds(): number[] {
    const down: number[] = [];
    for (const [treeId, state] of this.trees) if (state.felled) down.push(treeId);
    return down;
  }

  /** How many times this spot has grown back. Zero for a tree nobody has touched. */
  generationOf(treeId: number): number {
    return this.trees.get(treeId)?.generation ?? 0;
  }

  /** What the client needs to draw the trees that are not as the seed left them. */
  changedTrees(): Array<{ treeId: number; generation: number; felled: boolean }> {
    const changed: Array<{ treeId: number; generation: number; felled: boolean }> = [];
    for (const [treeId, state] of this.trees) {
      if (!state.felled && state.generation === 0) continue;
      changed.push({ treeId, generation: state.generation, felled: state.felled });
    }
    return changed;
  }

  /** Everything worth saving about the trees. Untouched trees are not saved. */
  persistableTrees(): PersistedTree[] {
    const saved: PersistedTree[] = [];
    for (const [treeId, state] of this.trees) {
      if (!state.felled && state.swingsTaken === 0 && state.generation === 0) continue;
      saved.push({
        treeId,
        swingsTaken: state.swingsTaken,
        felled: state.felled,
        felledAtMs: state.felledAtMs,
        generation: state.generation,
      });
    }
    return saved;
  }

  /** Put the trees back as they were after the world wakes from storage. */
  restoreTrees(trees: Iterable<PersistedTree>): void {
    for (const tree of trees) {
      const state = this.treeState(tree.treeId);
      state.generation = tree.generation;
      state.swingsTaken = tree.swingsTaken;

      const index = this.clearing.indexById.get(tree.treeId);
      const original = index === undefined ? undefined : this.clearing.props[index];
      if (index !== undefined && original !== undefined && tree.generation > 0) {
        const grown = treeAtGeneration(this.seed, original, tree.generation);
        this.standing[index] = grown;
        replaceCollider(this.collision, index, colliderForProp(grown));
      }

      if (tree.felled) this.fellTree(tree.treeId, tree.felledAtMs);
    }
  }

  /** Everything anybody has ever built, for sending to a client or saving to storage. */
  builtPropsList(): readonly BuiltProp[] {
    return [...this.builtProps];
  }

  /**
   * Put built props back as they were after the world wakes from storage.
   *
   * `litUntilMs` travels separately from `lit` itself, the same reason
   * `ownerKey` travels separately from the rest of `BuiltProp` - it is
   * server-only bookkeeping that a client has no business seeing. Null for
   * anything that was not lit when it was saved.
   */
  restoreBuiltProps(
    props: Iterable<
      BuiltProp & { readonly ownerKey: string | null; readonly litUntilMs: number | null }
    >,
  ): void {
    for (const { ownerKey, litUntilMs, ...prop } of props) {
      this.builtProps.push(prop);
      this.builtPropsById.set(prop.id, prop);
      if (BUILDABLE_KINDS[prop.kind].isHome) this.collision.colliders.push(cabinCollider(prop));
      this.nextBuiltPropId = Math.max(this.nextBuiltPropId, prop.id + 1);
      if (ownerKey !== null) this.ownedBuiltProps.set(prop.id, ownerKey);
      if (litUntilMs !== null) this.campfireLitUntilMs.set(prop.id, litUntilMs);
    }
  }

  /** Hand over every build placed since this was last asked. */
  drainBuildEvents(): BuildEvent[] {
    return this.buildEvents.splice(0);
  }

  /**
   * Everything currently buried, for sending to a client or saving to
   * storage, with each owner's network id resolved fresh right now.
   */
  buriedCachesList(): readonly BuriedCacheView[] {
    return this.buriedCaches.map((cache) => ({
      id: cache.id,
      ownerNetId: this.netIdForPlayerKey(cache.ownerPlayerKey),
      x: cache.x,
      z: cache.z,
    }));
  }

  /** Put buried caches back as they were after the world wakes from storage. */
  restoreBuriedCaches(caches: Iterable<BuriedCache>): void {
    for (const cache of caches) {
      this.buriedCaches.push(cache);
      this.nextBuriedCacheId = Math.max(this.nextBuriedCacheId, cache.id + 1);
    }
  }

  /** The network id of whoever is connected under this stable key right now, or null. */
  private netIdForPlayerKey(playerKey: string | null): number | null {
    if (playerKey === null) return null;
    for (const runtime of this.players.values()) {
      if (runtime.playerKey === playerKey) return runtime.netId;
    }
    return null;
  }

  /** Hand over every change to anybody's own buried cache since this was last asked. */
  drainCacheEvents(): CacheChange[] {
    return this.cacheEvents.splice(0);
  }

  /** Hand over every swing that landed since this was last asked. */
  drainChopEvents(): TreeChopped[] {
    return this.chopEvents.splice(0);
  }

  /** Hand over every animal caught since this was last asked. */
  drainCatchEvents(): AnimalCaught[] {
    return this.catchEvents.splice(0);
  }

  /** Hand over every swing that landed on a threat without defeating it since this was last asked. */
  drainThreatHitEvents(): ThreatHit[] {
    return this.threatHitEvents.splice(0);
  }

  /** Hand over every change to anybody's health since this was last asked. */
  /** Everything anybody did with their hands since this was last asked, for everybody nearby to see. */
  drainGestureEvents(): GestureEvent[] {
    return this.gestureEvents.splice(0);
  }

  /** What this player is in the middle of, for a snapshot or a test. */
  actionOf(netId: number): Readonly<ActionState> | null {
    return this.players.get(netId)?.action ?? null;
  }

  drainHealthEvents(): HealthEvent[] {
    return this.healthEvents.splice(0);
  }

  /** Hand over everything that happened at the water since this was last asked. */
  drainFishingEvents(): FishingEvent[] {
    return this.fishingEvents.splice(0);
  }

  /** This player's line, if they have one out. Used by tests. */
  castOf(netId: number): Readonly<Cast> | null {
    return this.players.get(netId)?.cast ?? null;
  }

  /** What this player could pick up right now, or null. Used by tests. */
  reachablePickup(netId: number): PlacedPickup | null {
    const position = this.players.get(netId)?.entity.get(Position);
    if (position === undefined) return null;
    return pickupInReach(position, this.clearing.pickups, (id) => this.takenPickups.has(id));
  }

  /** What a player is carrying. The client is told this; it never decides it. */
  inventoryOf(netId: number): Inventory {
    return this.players.get(netId)?.inventory ?? {};
  }

  /** How hungry a player is right now, from `HUNGER_MAX` down to zero. */
  hungerOf(netId: number): number {
    return Math.round(this.players.get(netId)?.hunger ?? HUNGER_MAX);
  }

  /** How much health a player has left right now, from `HEALTH_MAX` down to zero. */
  healthOf(netId: number): number {
    return Math.round(this.players.get(netId)?.health ?? HEALTH_MAX);
  }

  /** Hand over every change to anybody's hunger since this was last asked. */
  drainHungerEvents(): HungerEvent[] {
    return this.hungerEvents.splice(0);
  }

  /**
   * Make something out of whatever this player is carrying, if there is a
   * recipe for it, they can afford it and have room for the result.
   *
   * Crafting is not tied to reach or facing the way chopping and picking
   * things up are, so unlike those it does not wait for the next tick: a
   * client's request is settled the moment it arrives. Returns whether
   * anything was actually made.
   */
  craftItem(netId: number, item: ItemId): boolean {
    const runtime = this.players.get(netId);
    if (runtime === undefined) return false;
    if (!craft(runtime.inventory, item)) return false;

    this.craftEvents.push({ netId, item });
    return true;
  }

  /** Hand over every craft since this was last asked. */
  drainCraftEvents(): CraftedEvent[] {
    return this.craftEvents.splice(0);
  }

  /**
   * Select one item from the pack as this player's equipped item - what
   * shows in their hand, and what everyone nearby is now told they are
   * holding - and, if it is food, eat it on the spot too.
   *
   * Unlike the interact button's own fallback to eating, eating this way
   * does not wait for the pack to be a last resort, and eats exactly the
   * item asked for rather than whichever common fish comes first. Only
   * food actually gets eaten; equipping a tool just shows it held, the same
   * as picking one up already did before this existed. Refuses outright for
   * anything not marked `equippable` (materials, the bag) or not actually
   * in the pack. Not tied to reach or the tick loop, the same as crafting:
   * settled the moment it arrives. Returns whether anything actually
   * changed - equipping, eating, or both.
   */
  useItem(netId: number, item: ItemId): boolean {
    const runtime = this.players.get(netId);
    if (runtime === undefined) return false;
    if (!ITEM_KINDS[item].equippable || !hasItem(runtime.inventory, item)) return false;

    let changed = false;
    if (runtime.equippedItem !== item) {
      runtime.equippedItem = item;
      this.equipEvents.push(netId);
      changed = true;
    }
    if (isFood(item) && runtime.hunger < HUNGER_MAX) {
      this.eatItem(runtime, item);
      changed = true;
    }
    return changed;
  }

  /**
   * What this player currently has equipped, or null.
   *
   * Re-checked against the pack every time rather than trusted from
   * whenever it was last set: eating the last of an equipped food, or a
   * knockout burying it away, empties a hand out from under a player with
   * nothing here having to notice and clear the field itself.
   */
  equippedItemOf(netId: number): ItemId | null {
    const runtime = this.players.get(netId);
    if (runtime === undefined) return null;
    return runtime.equippedItem !== null && hasItem(runtime.inventory, runtime.equippedItem)
      ? runtime.equippedItem
      : null;
  }

  /**
   * What every connected player currently has equipped, for the whole-list
   * broadcast - the same "cheap while there are only ever a few dozen,
   * simplest to keep in sync" shape `Roster` and `BuiltProps` already use.
   */
  equippedList(): Array<{ netId: number; item: ItemId | null }> {
    return [...this.players.keys()].map((netId) => ({ netId, item: this.equippedItemOf(netId) }));
  }

  /**
   * Who changed what they have equipped since this was last asked - a
   * signal that the whole list is worth resending, not a diff of who
   * changed to what.
   */
  drainEquipEvents(): number[] {
    return this.equipEvents.splice(0);
  }

  /** Who gathered a stick since this was last asked, so their pack can be sent. */
  drainGatherEvents(): number[] {
    return this.gatherEvents.splice(0);
  }

  /** Pickups already taken, for sending to a client and for saving. */
  takenPickupIds(): number[] {
    return [...this.takenPickups];
  }

  /** Put back the set of taken pickups after the world wakes from storage. */
  restoreTakenPickups(ids: Iterable<number>): void {
    for (const id of ids) this.takenPickups.add(id);
  }

  /** Hand over everything that happened since this was last asked. */
  drainPickupEvents(): PickupTaken[] {
    return this.pickupEvents.splice(0);
  }

  /** Every stick and flower patch as a browser is told it, picked-clean ones included. */
  gatherPatchesList(): GatherPatchView[] {
    return this.patches.map(patchView);
  }

  /** One patch as it goes into storage, or null if there is no such patch. */
  persistedPatch(id: number): PersistedPatch | null {
    const patch = this.patches.find((candidate) => candidate.id === id);
    if (patch === undefined) return null;
    const { x, z, remaining, generation, emptiedAtMs } = patch;
    return { id, x, z, remaining, generation, emptiedAtMs };
  }

  /**
   * Put the patches back as they were after the world wakes from storage.
   *
   * Anything in the save that does not make sense - a patch the clearing no
   * longer has, a count out of range - is left as the clearing lays it out
   * instead, so a bad row can never crash a world or hand out a hundred
   * sticks.
   */
  restorePatches(saved: Iterable<PersistedPatch>): void {
    for (const row of saved) {
      const patch = this.patches.find((candidate) => candidate.id === row.id);
      if (patch === undefined) continue;
      const sensible =
        Number.isFinite(row.x) &&
        Number.isFinite(row.z) &&
        Number.isInteger(row.remaining) &&
        row.remaining >= 0 &&
        row.remaining <= GATHER_PATCH_MAX_COUNT &&
        Number.isInteger(row.generation) &&
        row.generation >= 0 &&
        Number.isFinite(row.emptiedAtMs);
      if (!sensible) continue;
      patch.x = row.x;
      patch.z = row.z;
      patch.remaining = row.remaining;
      patch.generation = row.generation;
      patch.emptiedAtMs = row.emptiedAtMs;
    }
  }

  /** Which patches changed since this was last asked, so they can be saved and sent. */
  drainPatchChanges(): number[] {
    const ids = [...this.patchChanges];
    this.patchChanges.clear();
    return ids;
  }

  /** Everything lying where somebody dropped it, as a browser is told it. */
  droppedPilesList(): DroppedPileView[] {
    return this.droppedPiles.map(pileView);
  }

  /** One pile as it goes into storage, or null if it is gone - picked up or faded. */
  persistedPile(id: number): PersistedPile | null {
    const pile = this.droppedPiles.find((candidate) => candidate.id === id);
    if (pile === undefined) return null;
    const { item, count, x, z, droppedAtMs } = pile;
    return { id, item, count, x, z, droppedAtMs };
  }

  /** Put dropped piles back as they were after the world wakes from storage. */
  restoreDroppedPiles(saved: Iterable<PersistedPile>): void {
    const rows = [...saved].filter(
      (row) =>
        Number.isInteger(row.count) &&
        row.count > 0 &&
        Number.isFinite(row.x) &&
        Number.isFinite(row.z) &&
        Number.isFinite(row.droppedAtMs),
    );
    rows.sort((a, b) => a.droppedAtMs - b.droppedAtMs);
    for (const row of rows.slice(-MAX_DROPPED_PILES)) {
      this.droppedPiles.push({ ...row });
      this.nextDroppedPileId = Math.max(this.nextDroppedPileId, (row.id % 0xffff) + 1);
      // `claimPileId` steps over any id still in use, so wrapping here is safe.
    }
  }

  /** Which piles changed since this was last asked, so they can be saved and sent. */
  drainPileChanges(): number[] {
    const ids = [...this.pileChanges];
    this.pileChanges.clear();
    return ids;
  }

  /** Hand over everything anybody dropped or destroyed since this was last asked. */
  drainDiscardEvents(): DiscardedEvent[] {
    return this.discardEvents.splice(0);
  }

  /** Read one player's state, mostly for tests and for saving. */
  readPlayer(netId: number): PlayerMotion | undefined {
    const runtime = this.players.get(netId);
    if (!runtime) return undefined;
    const position = runtime.entity.get(Position);
    const velocity = runtime.entity.get(Velocity);
    const facing = runtime.entity.get(Facing);
    const grounded = runtime.entity.get(Grounded);
    if (!position || !velocity || !facing || !grounded) return undefined;
    return {
      position: { x: position.x, y: position.y, z: position.z },
      velocity: { x: velocity.x, y: velocity.y, z: velocity.z },
      facingYaw: facing.yaw,
      grounded: grounded.value,
    };
  }

  /** Move a player directly. Used when restoring a save, never by a client. */
  placePlayer(
    netId: number,
    position: Readonly<Vec3>,
    facingYaw: number,
    space: number = OUTDOORS,
  ): void {
    const runtime = this.players.get(netId);
    if (!runtime) return;
    runtime.space = space;
    runtime.entity.set(Position, { x: position.x, y: position.y, z: position.z });
    runtime.entity.set(Velocity, { x: 0, y: 0, z: 0 });
    runtime.entity.set(Facing, { yaw: facingYaw });
    runtime.entity.set(AimYaw, { yaw: facingYaw });
    // Whatever they were in the middle of does not come with them.
    beginAction(runtime.action, ActionKind.Idle);
  }

  /**
   * Move an animal straight to a spot, ignoring its den and leash.
   *
   * Nothing in normal play ever teleports wildlife - a real fox and a real
   * rabbit only meet by both wandering there on their own, which the real den
   * layout is spaced out precisely so is a rare "sometimes", not a given.
   * Used by tests, the same reason `placePlayer` exists for something a
   * gameplay path also needs.
   */
  placeAnimal(animalId: number, position: Readonly<Vec3>): void {
    const runtime = this.animals.get(animalId);
    if (runtime === undefined) return;
    runtime.entity.set(Position, { x: position.x, y: position.y, z: position.z });
    runtime.entity.set(Velocity, { x: 0, y: 0, z: 0 });
    runtime.trailCount = 0;
  }

  /** Everything worth writing to storage. */
  persistablePlayers(): PersistedPlayer[] {
    const saved: PersistedPlayer[] = [];
    for (const runtime of this.players.values()) {
      const outside = this.outdoorPositionOf(runtime.netId);
      if (outside === null) continue;
      saved.push({
        netId: runtime.netId,
        x: outside.x,
        y: outside.y,
        z: outside.z,
        facingYaw: outside.yaw,
        items: inventoryEntries(runtime.inventory),
        hunger: runtime.hunger,
        health: runtime.health,
        equippedItem: runtime.equippedItem,
        explored: runtime.explored,
      });
    }
    return saved;
  }

  /**
   * The players a given viewer should be told about.
   *
   * Interest management: only entities within about 100 m are sent, so a busy
   * world does not cost every player bandwidth for people they cannot see.
   */
  snapshotFor(viewerNetId: number, into: SnapshotEntity[] = []): SnapshotEntity[] {
    into.length = 0;
    const viewer = this.players.get(viewerNetId);
    if (!viewer) return into;
    const viewerPosition = viewer.entity.get(Position);
    if (!viewerPosition) return into;
    const radiusSquared = INTEREST_RADIUS * INTEREST_RADIUS;

    this.world
      .query(PlayerTag, Position, Velocity, Facing, Grounded, NetworkId)
      .readEach(([position, velocity, facing, grounded, networkId]) => {
        if (networkId.value !== viewerNetId) {
          // Only whoever is in the same place: outdoors, or the same room.
          if (this.players.get(networkId.value)?.space !== viewer.space) return;
          const dx = position.x - viewerPosition.x;
          const dz = position.z - viewerPosition.z;
          if (dx * dx + dz * dz > radiusSquared) return;
        }
        const speedSquared = velocity.x * velocity.x + velocity.z * velocity.z;
        let flags = 0;
        if (speedSquared > 0.04) flags |= SnapshotFlag.Moving;
        if (!grounded.value) flags |= SnapshotFlag.Airborne;
        if (speedSquared > SPRINT_REPORTING_SPEED * SPRINT_REPORTING_SPEED) {
          flags |= SnapshotFlag.Sprinting;
        }
        const action = this.players.get(networkId.value)?.action;
        into.push({
          netId: networkId.value,
          x: position.x,
          y: position.y,
          z: position.z,
          vx: velocity.x,
          vy: velocity.y,
          vz: velocity.z,
          yaw: facing.yaw,
          flags,
          action: action === undefined ? 0 : packActionByte(action),
          actionAge: action?.age ?? 0,
          actionHeading: action?.heading ?? 0,
        });
      });

    this.world
      .query(AnimalTag, Position, Velocity, Facing, NetworkId)
      .readEach(([position, velocity, facing, networkId]) => {
        // A caught animal is gone until it respawns: left out of every
        // viewer's snapshot entirely, the same as a pickup nobody can see
        // once it is taken. And there is no wildlife indoors.
        if (this.animals.get(networkId.value)?.caught === true) return;
        if (viewer.space !== OUTDOORS) return;

        const dx = position.x - viewerPosition.x;
        const dz = position.z - viewerPosition.z;
        if (dx * dx + dz * dz > radiusSquared) return;

        const speedSquared = velocity.x * velocity.x + velocity.z * velocity.z;
        into.push({
          netId: networkId.value,
          x: position.x,
          y: position.y,
          z: position.z,
          vx: velocity.x,
          vy: velocity.y,
          vz: velocity.z,
          yaw: facing.yaw,
          flags: SnapshotFlag.Animal | (speedSquared > 0.04 ? SnapshotFlag.Moving : 0),
          action: 0,
          actionAge: 0,
          actionHeading: 0,
        });
      });

    return into;
  }

  /** Spread arrivals around the spawn point so nobody lands inside somebody else. */
  private nextSpawnPosition(): Vec3 {
    const index = this.spawnCounter++;
    if (index === 0) return { x: SPAWN_POSITION.x, y: SPAWN_POSITION.y, z: SPAWN_POSITION.z };
    // A golden-angle spiral keeps arrivals apart without any randomness.
    const angle = index * 2.39996;
    const radius = SPAWN_RING_RADIUS * Math.sqrt(index);
    return {
      x: SPAWN_POSITION.x + Math.cos(angle) * radius,
      y: SPAWN_POSITION.y,
      z: SPAWN_POSITION.z + Math.sin(angle) * radius,
    };
  }
}

/**
 * How many inputs to simulate this tick.
 *
 * One per tick keeps the player exactly in step with the server. If a burst of
 * packets arrives late we work through a couple extra so they catch up rather
 * than drift further behind.
 */
export function inputsToConsume(queueLength: number): number {
  if (queueLength === 0) return 0;
  if (queueLength <= INPUT_BACKLOG_CATCHUP_THRESHOLD) return 1;
  return Math.min(queueLength, MAX_INPUTS_PER_TICK);
}
