import {
  WildfireSimulation,
  LIGHTNING_INTERVAL_MS,
  type FireTarget,
  type WildfireView,
} from './wildfire';
import { FISHING_LEASH } from '../constants';
import {
  fishDisplayLearned,
  fishRecordsFromSaved,
  recordFish,
  type FishRecords,
} from './fish-records';
import { startRareReel, readRareReel, type RareReel, type ReelView } from './rare-reel';
import {
  EXPEDITIONS,
  expeditionFromSaved,
  expeditionComplete,
  expeditionOffers,
  expeditionBoardSpot,
  progressExpedition,
  TRAIL_PENNANT_SKILL,
  type ExpeditionState,
  type ExpeditionView,
  type ExpeditionRequest,
  type ExpeditionEvent,
  type ExpeditionNotice,
} from './expeditions';
import { storeBuildingSupplies } from './chest';
import {
  isIndoorOnlyKind,
  isDecorationKind,
  checkDecorationSpot,
  decorationCollider,
  MAX_HOME_DECORATIONS,
  MAX_WORLD_DECORATIONS,
  type DecorationRequest,
  type DecorationState,
  type HomeDecoration,
} from './decorations';
import { forestWeather, weatherPlan, WEATHER_CYCLE_MS, BLIZZARD_SPEED } from './weather';
import {
  advanceMeal,
  mealCooldown,
  mealFromSaved,
  startMeal,
  isMealItem,
  type MealState,
} from './meals';
import {
  combineHomeSupplies,
  storedHomeSupplies,
  payHomeUpgrade,
  type HomeSupplies,
} from './home-supplies';
import { resolveCapsule } from '../collision/capsule';
import { WOODLAND_ENCOUNTERS } from '../data/tracking';
import {
  homeBuildArea,
  checkHomeBuildArea,
  checkPieceBuildArea,
  buildGroundIsLevel,
  type ProtectedBuildSite,
} from './build-areas';
import {
  buildDiscoverySites,
  discoveryForageSpots,
  discoveryColliders,
  DISCOVERY_MASK,
  discoveryKnown,
  type DiscoveryState,
  type DiscoverySite,
  type DiscoveryNotice,
} from '../data/discoveries';
import { recipeFor } from '../data/recipes';
import { createRng, hashSeed } from '../rng';
import {
  blueprintDropChance,
  BLUEPRINT_MAX_MISSES,
  HOME_SKILL_MASK,
  HOME_TIERS,
  blueprintHome,
  isHomeKind,
  knowsHome,
  learnHome,
  nextHome,
  nextBlueprint,
  homeRoomScale,
  type HomeBuildReason,
  type HomeBuildFeedback,
  type HomeKind,
} from '../data/housing';
import {
  emptyChest,
  chestFromSaved,
  depositInChest,
  withdrawFromChest,
  validTransferAmount,
  type ChestSlot,
  type ChestRequest,
  type ChestResult,
  type ChestReason,
} from './chest';
import { createWorld, type Entity, type World } from 'koota';
import type { LootRequest } from '../net/messages';

import {
  ANIMAL_RESPAWN_SECONDS,
  BUILD_REACH,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  PLAYABLE_HALF_EXTENT,
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
  REED_REGROW_MIN_SECONDS,
  REGROW_MIN_SECONDS,
  SPAWN_POSITION,
  SPAWN_RING_RADIUS,
  SPRINT_REPORTING_SPEED,
  SWING_COOLDOWN_TICKS,
  TICK_MILLISECONDS,
  TICK_SECONDS,
  TICK_HZ,
} from '../constants';
import { createCollisionWorld, setLakeFrozen, type CollisionWorld } from '../collision/capsule';
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
  RaiderTag,
  StaticTag,
  Velocity,
} from '../ecs/traits';
import { PROP_KINDS, choppingRuleFor, propKindIndex, propHeight } from '../data/props';
import {
  ANIMAL_KINDS,
  type AnimalKind,
  type AnimalKindId,
  type ThreatBehavior,
} from '../data/animals';
import { BUILDABLE_KINDS, type BuildableKindId } from '../data/buildables';
import { colliderFootprintRadius } from '../world/colliders';
import { isFood, isPack, ITEM_KINDS, TOOL_ITEMS, type ItemId } from '../data/items';
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
import type { GatherSpot } from '../world/clearing';
import { createFlatTerrain, createWildernessTerrain, type Terrain } from '../world/terrain';
import { homeFacilityInReach } from '../data/home-facilities';
import { toolKind } from '../data/items';
import { canWearIn, isWeapon, type GearSlot, type WornGear } from '../data/gear';
import {
  swapGear,
  takeOffGear,
  wearGear,
  wornEntries,
  wornFromEntries,
  type GearChange,
} from './gear';
import {
  emptyGarden,
  gardenFromSaved,
  useGarden,
  type GardenPlot,
  type GardenRequest,
  type GardenState,
  type GardenReason,
} from './garden';
import {
  HOME_ENTRY,
  homeSpot,
  homeChestSpot,
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
import { BOAT_ICE_STEP_OUT } from '../world/boat';
import { LAKE, lakeDepthAt } from '../world/lake';
import { STREAM_KEEP_OUT } from '../world/stream';
import {
  beachedBoat,
  boatSalvage,
  boatYawFor,
  isWithinBoardingReach,
  landingBeside,
  landingFrom,
  riderFacingFor,
  stepBoat,
} from './rowing';
import {
  isReedPatch,
  isReedSpotFor,
  REED_PATCHES,
  reedBedSpacing,
  reedIsDue,
  reedRegrowSpot,
} from '../world/reeds';
import { buildMountainRockSpots, isMountainPatch } from '../world/mountain-rocks';
import { DugGrid, type Dig } from '../world/digging';
import { DIG_MAX_COUNT, digRefusal, digYield, planDig } from './digging';
import { castLanding, overlapsWater, type WaterCircle } from '../world/water';
import { calendarAt, lakeIsFrozen, type Calendar } from './seasons';
import { buildWilderness, type Wilderness } from '../world/wilderness';
import { buildEncounterSites, encounterColliders, type EncounterSite } from '../world/encounters';
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
  roomFor,
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
import { treeFallTimes, treeFallYaw, treeLogSpots, type TreeFall } from './tree-fall';
import { animalInReach, type CatchCandidate } from './hunting';
import {
  buildableFootprint,
  checkBuildSpot,
  footprintGap,
  nearestCampfire,
  REED_CLEAR_RADIUS,
  reedFootprints,
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
import { cookOne, cookedItemFor } from './cooking';
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
  isDown,
  isFreeToInteract,
  isUntouchable,
  packActionByte,
  stepDodge,
  stepDodgeAttack,
  Gesture,
  type ActionContext,
  type ActionState,
  type GestureEvent,
  type Impact,
} from './actions';
import { DODGE, DODGE_ATTACKS, KNOCKED_OUT_TICKS, LIGHT_COMBO, STRIKE } from '../data/moves';
import type { RaiderKindId } from '../data/raiders';
import {
  RaidDirector,
  type RaidFighter,
  type RaidNews,
  type RaiderHit,
  type RaiderView,
} from './raids';

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
   * The shortest a cut-clean bed of mature reeds takes to come back, in
   * seconds. Reeds return somewhere between this and a bit over half as long
   * again (fifteen to twenty-five minutes, by default).
   *
   * Turned down for previews and local runs, like `patchRegrowMinSeconds`.
   */
  readonly reedRegrowMinSeconds?: number;
  /**
   * How long a full hunger meter takes to empty, in seconds, if nothing is
   * eaten.
   *
   * Turned right down for previews and local runs, so it can be watched
   * rather than waited out. Left alone everywhere real.
   */
  readonly hungerEmptyAfterSeconds?: number;
  /**
   * The shortest time outdoors between skeleton raids, in seconds of
   * daytime (see `RaidOptions`). Turned right down for previews and local
   * runs, so a raid can be waited for rather than waited out.
   */
  readonly raidIntervalSeconds?: number;
  readonly forestEncounters?: boolean;
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
  /**
   * A skeleton raider, not a player (see `sim/raids.ts`). Its id is its
   * own, the same way an animal's is, and its move travels exactly as a
   * player's does.
   */
  Raider: 1 << 4,
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
  readonly meal?: MealState;
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
   * What they are wearing (see decision 0113). Optional, the same reason
   * `health` is: saves from before gear existed have none.
   */
  readonly worn?: readonly { readonly slot: GearSlot; readonly item: ItemId }[];
  /**
   * Which parts of the world they have seen (see decision 0054). Optional,
   * the same reason `health` is; a save without one, or one of the wrong
   * size, starts a fresh map.
   */
  readonly explored?: Uint8Array | null;
  readonly homeSkills?: number;
  readonly blueprintMisses?: number;
  readonly sentinelVictories?: number;
  readonly fishRecords?: FishRecords;
  readonly discoveriesFound?: number;
  readonly discoveriesClaimed?: number;
  readonly expedition?: ExpeditionState;
  /**
   * The axe, bag and rod (and anything else lying in the clearing) this
   * character has already picked up. Every character finds their own, so this
   * is theirs, not the world's. Optional: a save from before this was kept
   * starts with none taken.
   */
  readonly takenPickups?: readonly number[];
}

/** Somebody picked something up. The world server turns these into messages. */
export interface PickupTaken {
  readonly netId: number;
  readonly pickupId: number;
  readonly item: ItemId;
}

/** A confirmed collection, used for material sounds and a cleared-pile flourish. */
export interface CollectedEvent {
  readonly netId: number;
  readonly item: ItemId;
  readonly count: number;
  readonly x: number;
  readonly z: number;
  readonly depleted: boolean;
}

/** Private feedback when an attempted pickup cannot fit. */
export interface PickupRefusal {
  readonly netId: number;
  readonly item: ItemId;
  readonly reason: 'full' | 'limit';
}

/** A swing landed on a tree. */
export interface TreeChopped {
  readonly netId: number;
  readonly treeId: number;
  /** Swings still to go. Zero means it came down. */
  readonly swingsLeft: number;
  /** Kept for older event consumers; always zero now that wood lands as pickups. */
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
  /**
   * Where it stands. Fixed for everything except a rowboat, which is carried
   * across the lake by whoever rows it and stays wherever it was left (see
   * decision 0093) - only `WorldSimulation.carryBoat` ever changes these.
   */
  x: number;
  z: number;
  /**
   * Which way it was turned when placed, the same way a model's `rotation.y`
   * reads. Zero for everything built before pieces could be turned.
   */
  yaw: number;
  /**
   * Only meaningful for a campfire - always false for every other kind.
   * Atmosphere only: it burns down on its own after `CAMPFIRE_BURN_SECONDS`,
   * or a player can put it out early by hand. Mutable, unlike the fields
   * above: a campfire's identity never changes once built, but this does.
   */
  lit: boolean;
  /**
   * For a home: whether its owner has locked the door to visitors (see
   * decision 0055). Absent, like false, for anything built before doors could
   * be locked.
   *
   * Of every kind, it also means the character who built it has been deleted:
   * it stands there for a while longer, but nobody can enter it, light it, row
   * it or use it, and then it is gone (decision 0108).
   */
  locked?: boolean;
  /**
   * Only meaningful for a rowboat: the network id of whoever is rowing it, so
   * nobody else can climb in. Never saved - a world that wakes from storage
   * has nobody aboard anything.
   */
  rower?: number;
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
 * Who a build belongs to once its character has been deleted: nobody. No
 * account is ever given this key, so none can ever own, open or decorate it.
 */
export const ABANDONED_OWNER = '~abandoned';

/** What was left behind, and what was cleared away, when a character was deleted. */
export interface ForgottenCharacter {
  /** Every build that now stands abandoned and locked, with when it will disappear. */
  readonly abandoned: readonly { readonly prop: BuiltProp; readonly expiresAtMs: number }[];
  /** The ids of the buried caches that went at once, for storage to forget. */
  readonly cacheIds: readonly number[];
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
  readonly kind: 'buried' | 'dugUp' | 'partial';
}

/**
 * `CacheEvent` plus what the game server needs to persist it - the full
 * cache for a fresh burial, or just the id to delete for a dig-up - which
 * never goes to a client and so never needs to be a `CacheEvent` itself.
 */
export type CacheChange =
  | { readonly netId: number; readonly kind: 'buried' | 'partial'; readonly cache: BuriedCache }
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
  /** Absent on old saves, whose wood was already awarded directly. */
  readonly fallYaw?: number | null;
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

/** Word that a player cooked one piece of food over a lit campfire. */
export interface CookedEvent {
  readonly netId: number;
  readonly raw: ItemId;
  readonly cooked: ItemId;
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
  readonly ownerKey?: string;
}

/** A tree that has come back. */
export interface TreeRegrown {
  readonly treeId: number;
  readonly generation: number;
}

/**
 * Where a prop sits in the world's lists, so felling a tree can find its
 * collider to swap for a stump and growing it back can put the new one in
 * the same place.
 */
interface TreeSlot {
  /** Which list it is in: the hand-built clearing, or the generated wilderness. */
  readonly wilderness: boolean;
  /** Its place in that list (`props`, and the matching list of standing props). */
  readonly index: number;
  /** Its place in the collision world's flat list of colliders. */
  readonly colliderIndex: number;
}

/** Everything the world knows about one tree. */
interface TreeState {
  swingsTaken: number;
  felled: boolean;
  felledAtMs: number;
  generation: number;
  fallYaw: number | null;
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
  homeSkills: number;
  blueprintMisses: number;
  discoveriesFound: number;
  discoveriesClaimed: number;
  expedition: ExpeditionState;
  sentinelVictories: number;
  /** Clearing pickups this character has already taken, by id. Each character finds their own. */
  readonly takenPickups: Set<number>;
  fishRecords: FishRecords;
  reel: RareReel | null;
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
  pickupRefused: boolean;
  /**
   * What to build on the next tick, and where, or null when nothing is
   * waiting. A discrete request rather than a held button - like crafting,
   * it is settled the moment it arrives - so there is no held/clicked edge
   * to track here the way there is for a swing.
   */
  pendingBuild: BuildRequest | null;
  pendingLoot: LootRequest | null;
  /** Their line in the water, if they have one out. */
  cast: Cast | null;
  lastProcessedSeq: number;
  /** Inputs thrown away because the client was sending faster than it should. */
  droppedInputs: number;
  /** How hungry they are, from `HUNGER_MAX` (full) down to zero. */
  hunger: number;
  meal: MealState;
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
  /** Historical protection stops when a roll becomes an attack. */
  dodgeAttackStartedAtTick: number;
  /**
   * What this player last chose to hold, or null if they never have. Read
   * through `equippedItemOf`, never directly - the pack can empty this out
   * from under them (eating the last of it, a knockout burying it) without
   * anything here clearing the field itself.
   */
  equippedItem: ItemId | null;
  /** What they are wearing, slot by slot (decision 0113). Read through `wornOf`. */
  worn: WornGear;
  /** The tick of the last blow they gave or took, for the gear rule against changing mid-fight. */
  lastCombatTick: number;
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
  /** The built-prop id of the rowboat they are rowing, or null on foot (see `sim/rowing.ts`). */
  boatId: number | null;
  /**
   * Whether the press of interact that is still held was already spent on
   * climbing in or out of a boat, so holding it on does not go on to cut the
   * reeds or eat something the moment they land.
   */
  interactSpent: boolean;
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
  readonly damageHelpers: Set<number>;
}

/** How many ticks of an animal's recent path are kept for a blow to look back over. */
const ANIMAL_TRAIL_TICKS = 10;

/**
 * How far from a spot a tree or rock can be and still matter to a log or a
 * pile put down there: the farthest a log is nudged (4 m) plus the widest
 * trunk, with room to spare.
 */
const LOG_SEARCH_REACH = 8;

/**
 * The authoritative world.
 *
 * This is the server's copy of the truth. It is plain TypeScript with no Worker
 * or browser APIs in it, so the same class runs inside the World Durable Object,
 * inside tests and inside the load-test benchmark.
 */
/** How long after a blow, given or taken, a player still counts as fighting. */
export const COMBAT_COOLDOWN_SECONDS = 8;
const COMBAT_COOLDOWN_TICKS = COMBAT_COOLDOWN_SECONDS * TICK_HZ;
/** A skeleton raider this close counts as a fight, even before a blow lands. */
export const COMBAT_RAIDER_RADIUS = 14;

export class WorldSimulation {
  readonly world: World;
  readonly seed: number;
  readonly clearing: Clearing;
  /** Everywhere the pond or the lake reaches, for the checks that only need to keep clear of water. */
  private readonly keepOutWater: readonly WaterCircle[];
  /**
   * The generated forest beyond the clearing, as the seed lays it out. Its
   * trees can be chopped down and grow back like the clearing's, so what
   * stands there now is `standingWilderness`; this is how it started.
   */
  readonly wilderness: Wilderness;
  readonly encounterSites: readonly EncounterSite[];
  readonly discoverySites: readonly DiscoverySite[];
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
  readonly reedRegrowMinSeconds: number;
  readonly hungerDrainPerSecond: number;
  /** Every skeleton raid, and when the next one comes (see `sim/raids.ts`). */
  readonly raids: RaidDirector;

  /** How many ticks have been simulated since the world was created. */
  tick = 0;

  /** Real time as of the tick being simulated, supplied by the caller. */
  private nowMs = 0;
  readonly wildfire = new WildfireSimulation();
  private testWeather: 'storm' | 'blizzard' | null = null;
  setTestWeather(weather: 'storm' | 'blizzard' | null): void {
    this.testWeather = weather;
  }
  weather() {
    const weather = forestWeather(this.seed, this.tick * TICK_MILLISECONDS, this.calendar());
    return this.testWeather === null
      ? weather
      : {
          ...weather,
          kind: this.testWeather,
          precipitation: 1,
          wind: this.testWeather === 'blizzard' ? 1.6 : 0.85,
        };
  }
  private fireTargets(): FireTarget[] {
    const targets: FireTarget[] = [];
    for (const [id, slot] of this.treeSlots) {
      const prop = this.standingAt(slot);
      if (!prop || !choppingRuleFor(PROP_KINDS[prop.kind]) || this.trees.get(id)?.felled) continue;
      targets.push({
        id,
        kind: 'tree',
        x: prop.x,
        y: prop.y ?? 0,
        z: prop.z,
        height: propHeight(PROP_KINDS[prop.kind]) * prop.scale,
        radius: 1,
      });
    }
    for (const prop of this.builtProps) {
      const rule = BUILDABLE_KINDS[prop.kind];
      if (
        !rule.isHome &&
        prop.kind !== 'fence' &&
        prop.kind !== 'cedarBench' &&
        prop.kind !== 'timberTable'
      )
        continue;
      targets.push({
        id: prop.id,
        kind: 'building',
        x: prop.x,
        y: this.collision.terrain.heightAt(prop.x, prop.z),
        z: prop.z,
        height: rule.isHome ? 4 : 1.5,
        radius: rule.footprintRadius,
      });
    }
    return targets;
  }
  wildfireView(): WildfireView {
    return { ...this.wildfire.view(this.tick * TICK_MILLISECONDS), testWeather: this.testWeather };
  }
  restoreWildfire(saved: string): void {
    this.wildfire.restore(saved, this.fireTargets());
  }
  /** Server-side entry point also used by simulation tests; clients cannot ignite things. */
  igniteTree(id: number): boolean {
    const target = this.fireTargets().find((target) => target.kind === 'tree' && target.id === id);
    return target !== undefined && this.wildfire.ignite(target, this.tick * TICK_MILLISECONDS);
  }
  private updateWildfire(): void {
    if (this.tick % TICK_HZ !== 0) return;
    const now = this.tick * TICK_MILLISECONDS;
    const targets = this.fireTargets();
    const slot = Math.floor(now / LIGHTNING_INTERVAL_MS);
    if (this.wildfire.lastStrike < 0) this.wildfire.lastStrike = slot;
    if (slot > this.wildfire.lastStrike) {
      this.wildfire.lastStrike = slot;
      if (this.calendar().season === 'summer' && this.weather().kind === 'storm') {
        const nearby = targets.filter(
          (target) =>
            target.kind === 'tree' &&
            [...this.players.values()].some((player) => {
              if (player.space !== OUTDOORS) return false;
              const position = player.entity.get(Position)!;
              return Math.hypot(position.x - target.x, position.z - target.z) < 65;
            }),
        );
        const target = nearby[hashSeed('lightning-target', this.seed, slot) % nearby.length];
        if (target) {
          this.wildfire.lightning = {
            serial: slot,
            x: target.x,
            y: target.y + target.height,
            z: target.z,
          };
          if (hashSeed('lightning-ignite', this.seed, slot) % 100 < 45)
            this.wildfire.ignite(target, now);
        }
      }
    }
    const burned = this.wildfire.advance(this.seed, now, targets);
    for (const target of burned) {
      if (target.kind === 'tree') this.fellTree(target.id, this.nowMs);
      else {
        const prop = this.builtPropsById.get(target.id);
        if (!prop) continue;
        const stacks = [...(this.homeChests.get(prop.id) ?? [])];
        this.removeAbandonedBuild(prop);
        for (const [index, stack] of stacks.entries()) {
          if (!stack) continue;
          const spot = this.reachableLogSpot(
            { x: prop.x + index * 0.35, z: prop.z },
            { x: prop.x, y: this.collision.terrain.heightAt(prop.x, prop.z), z: prop.z },
          );
          this.addPile(stack.item, stack.count, spot.x, spot.z, this.nowMs);
        }
      }
    }
    for (const player of this.players.values()) {
      const position = player.entity.get(Position)!;
      for (const fire of this.wildfire.fires.values()) {
        if (
          (player.space === OUTDOORS &&
            Math.hypot(position.x - fire.x, position.z - fire.z) < fire.radius + 1.2 &&
            Math.abs(position.y - fire.y) < fire.height + 1) ||
          (fire.kind === 'building' && player.space === fire.id)
        ) {
          this.damagePlayer(player, 8);
          break;
        }
      }
    }
  }
  private weatherCycle: number | null = null;
  private weatherCycleChanged = false;
  restoreWeatherCycle(value: number | null): void {
    this.weatherCycle = value !== null && Number.isSafeInteger(value) && value >= 0 ? value : null;
  }
  drainWeatherCycleChange(): number | null {
    if (!this.weatherCycleChanged) return null;
    this.weatherCycleChanged = false;
    return this.weatherCycle;
  }
  /** Only the latest completed storm leaves rewards; sleeping does not stockpile old storms. */
  updateWeather(nowMs: number): void {
    const cycle = Math.floor(nowMs / WEATHER_CYCLE_MS);
    if (this.weatherCycle !== null && cycle <= this.weatherCycle) return;
    if (
      this.weatherCycle !== null &&
      cycle > this.weatherCycle &&
      weatherPlan(this.seed, cycle - 1).storm
    ) {
      const rng = createRng(hashSeed('storm-windfall', this.seed, cycle));
      const footprints = this.buildFootprints(undefined, true).filter(
        (footprint) =>
          Math.hypot(footprint.x, footprint.z) <= 71 + footprint.radius + footprint.halfLength,
      );
      const protectedSites = this.protectedBuildSites();
      let placed = 0;
      for (
        let attempt = 0;
        attempt < 128 && placed < 6 && this.droppedPiles.length < MAX_DROPPED_PILES;
        attempt++
      ) {
        const angle = rng.nextRange(0, Math.PI * 2),
          radius = rng.nextRange(18, 70);
        const x = Math.cos(angle) * radius,
          z = Math.sin(angle) * radius;
        const nearbyFootprints = footprints.filter((footprint) => {
          const reach = footprint.radius + footprint.halfLength + PATCH_CLEARANCE;
          return Math.abs(footprint.x - x) < reach && Math.abs(footprint.z - z) < reach;
        });
        if (!this.patchSpotIsClear(-1, x, z, nearbyFootprints)) continue;
        if (protectedSites.some((site) => Math.hypot(site.x - x, site.z - z) < site.radius + 1))
          continue;
        this.addPile(placed % 2 === 0 ? 'log' : 'stick', placed % 2 === 0 ? 1 : 3, x, z, nowMs);
        placed++;
      }
    }
    this.weatherCycle = cycle;
    this.weatherCycleChanged = true;
  }

  private readonly homeBuildFeedback: (HomeBuildFeedback & { netId: number })[] = [];
  drainHomeBuildFeedback(): (HomeBuildFeedback & { netId: number })[] {
    return this.homeBuildFeedback.splice(0);
  }
  private readonly homeSolids = new Map<number, ReturnType<typeof cabinCollider>>();
  private readonly roomWorlds = new Map<HomeKind, CollisionWorld>();
  private readonly decoratedRooms = new Map<number, CollisionWorld>();
  private decorations: HomeDecoration[] = [];
  private readonly decoratedHomes = new Set<number>();
  private nextDecorationId = 1;
  decorationsList(): HomeDecoration[] {
    return this.decorations.map((piece) => ({ ...piece }));
  }
  restoreDecorations(pieces: readonly HomeDecoration[]): void {
    const ids = new Set<number>(),
      counts = new Map<number, number>();
    this.decorations = pieces
      .slice(0, MAX_WORLD_DECORATIONS)
      .filter(
        (piece) =>
          piece != null &&
          isDecorationKind(piece.kind) &&
          this.builtPropsById.has(piece.homeId) &&
          isHomeKind(this.builtPropsById.get(piece.homeId)!.kind) &&
          Math.abs(piece.x) <= 20 &&
          Math.abs(piece.z) <= 20 &&
          Math.abs(piece.yaw) <= Math.PI * 100 &&
          Number.isInteger(piece.id) &&
          piece.id > 0 &&
          piece.id <= 0xfffffffe &&
          [piece.x, piece.z, piece.yaw].every(Number.isFinite),
      )
      .filter((piece) => {
        const count = counts.get(piece.homeId) ?? 0;
        if (ids.has(piece.id) || count >= MAX_HOME_DECORATIONS) return false;
        ids.add(piece.id);
        counts.set(piece.homeId, count + 1);
        return true;
      })
      .map((piece) => ({ ...piece }));
    this.nextDecorationId = Math.max(0, ...this.decorations.map((piece) => piece.id)) + 1;
    this.decoratedHomes.clear();
    for (const piece of this.decorations) this.decoratedHomes.add(piece.homeId);
    this.decoratedRooms.clear();
  }
  requestDecoration(netId: number, request: DecorationRequest): DecorationState {
    const runtime = this.players.get(netId),
      home = runtime === undefined ? undefined : this.builtPropsById.get(runtime.space);
    const result = (reason: DecorationState['reason']): DecorationState => ({
      pieces: this.decorationsList(),
      reason,
    });
    if (runtime === undefined || home === undefined || !isHomeKind(home.kind))
      return result('unavailable');
    if (runtime.playerKey === null || this.builtPropOwner(home.id) !== runtime.playerKey)
      return result('private');
    if (runtime.health <= 0 || runtime.action.kind !== ActionKind.Idle || runtime.cast !== null)
      return result('busy');
    if (
      request.action === 'place' &&
      request.kind === 'trailPennant' &&
      !(runtime.expedition.cosmetics & TRAIL_PENNANT_SKILL)
    )
      return result('recipe');
    if (request.action === 'place' && !fishDisplayLearned(request.kind, runtime.fishRecords))
      return result('recipe');
    const old = this.decorations.find(
      (piece) => piece.id === request.id && piece.homeId === home.id,
    );
    if (request.action !== 'place' && (old === undefined || old.kind !== request.kind))
      return result('missing');
    if (request.action === 'reclaim') {
      const copy = { ...runtime.inventory };
      for (const cost of BUILDABLE_KINDS[old!.kind].costs)
        if (addItem(copy, cost.item, cost.amount) !== cost.amount) return result('packFull');
      Object.assign(runtime.inventory, copy);
      this.decorations.splice(this.decorations.indexOf(old!), 1);
      if (!this.decorations.some((piece) => piece.homeId === home.id))
        this.decoratedHomes.delete(home.id);
      this.decoratedRooms.delete(home.id);
      return result(null);
    }
    if (
      request.action === 'place' &&
      (request.id !== 0 ||
        this.decorations.length >= MAX_WORLD_DECORATIONS ||
        this.decorations.filter((piece) => piece.homeId === home.id).length >= MAX_HOME_DECORATIONS)
    )
      return result('limit');
    if (
      request.kind === 'guardianTrophy' &&
      this.decorations.some(
        (piece) =>
          piece.kind === 'guardianTrophy' && piece.homeId === home.id && piece.id !== old?.id,
      )
    )
      return result('limit');
    const piece: HomeDecoration = {
      id: old?.id ?? this.nextDecorationId,
      homeId: home.id,
      kind: request.kind,
      x: request.x,
      z: request.z,
      yaw: request.yaw,
    };
    const position = runtime.entity.get(Position);
    if (position === undefined) return result('unavailable');
    const refusal = checkDecorationSpot(
      home.kind,
      piece,
      this.decorations.filter((other) => other.homeId === home.id),
      position,
    );
    if (refusal !== null) return result(refusal);
    if (
      piece.kind !== 'wovenRug' &&
      [...this.players.values()].some(
        (other) =>
          other !== runtime &&
          other.space === home.id &&
          Math.hypot(
            (other.entity.get(Position)?.x ?? 0) - piece.x,
            (other.entity.get(Position)?.z ?? 0) - piece.z,
          ) <
            BUILDABLE_KINDS[piece.kind].footprintRadius + PLAYER_RADIUS,
      )
    )
      return result('blocked');
    if (request.action === 'place') {
      if (!canAfford(runtime.inventory, BUILDABLE_KINDS[piece.kind])) return result('materials');
      for (const cost of BUILDABLE_KINDS[piece.kind].costs)
        removeItem(runtime.inventory, cost.item, cost.amount);
      this.decorations.push(piece);
      this.decoratedHomes.add(home.id);
      this.nextDecorationId++;
    } else this.decorations[this.decorations.indexOf(old!)] = piece;
    this.decoratedRooms.delete(home.id);
    return result(null);
  }
  private addHomeSolid(prop: BuiltProp): void {
    const solid = cabinCollider(prop, this.collision.terrain.heightAt(prop.x, prop.z));
    this.homeSolids.set(prop.id, solid);
    this.collision.colliders.push(solid);
  }
  private kindOfHome(space: number): HomeKind {
    const kind = this.builtPropsById.get(space)?.kind;
    return kind !== undefined && isHomeKind(kind) ? kind : 'cabin';
  }
  private roomFor(space: number): CollisionWorld {
    const kind = this.kindOfHome(space);
    if (this.decoratedHomes.has(space)) {
      let decorated = this.decoratedRooms.get(space);
      if (decorated === undefined) {
        const colliders = this.decorations
          .filter((piece) => piece.homeId === space)
          .map(decorationCollider)
          .filter((value): value is NonNullable<typeof value> => value !== null);
        decorated = createCollisionWorld(
          createFlatTerrain(0),
          [...homeRoomColliders(kind), ...colliders],
          (HOME_ROOM.halfWidth + HOME_ROOM.wallThickness) * homeRoomScale(kind),
        );
        this.decoratedRooms.set(space, decorated);
      }
      return decorated;
    }
    if (kind === 'cabin') return this.roomCollision;
    let room = this.roomWorlds.get(kind);
    if (room === undefined) {
      room = createCollisionWorld(
        createFlatTerrain(0),
        homeRoomColliders(kind),
        (HOME_ROOM.halfWidth + HOME_ROOM.wallThickness) * homeRoomScale(kind),
      );
      this.roomWorlds.set(kind, room);
    }
    return room;
  }
  homeSkillsOf(netId: number): number {
    return this.players.get(netId)?.homeSkills ?? 0;
  }

  private readonly homeChests = new Map<number, ChestSlot[]>();
  private readonly players = new Map<number, PlayerRuntime>();
  private readonly animals = new Map<number, AnimalRuntime>();
  /** Drained by the world server each tick and turned into messages. */
  private readonly pickupEvents: PickupTaken[] = [];
  /** Every tree anybody has touched, by prop id. Untouched trees are not here. */
  private readonly trees = new Map<number, TreeState>();
  /** Where every prop sits in the lists above, by its number. */
  private readonly treeSlots = new Map<number, TreeSlot>();
  /** Trees chopped, felled or grown back since this was last asked, so only those are sent and saved. */
  private readonly treeChanges = new Set<number>();
  private readonly chopEvents: TreeChopped[] = [];
  private readonly catchEvents: AnimalCaught[] = [];
  private readonly threatHitEvents: ThreatHit[] = [];
  private readonly regrowthEvents: TreeRegrown[] = [];
  private readonly fishingEvents: FishingEvent[] = [];
  private readonly reelChanges = new Map<number, ReelView>();
  private readonly fishRecordChanges = new Set<number>();
  /** Every cast in this world gets its own number, so no two share a roll. */
  private castCounter = 0;
  private readonly mealChanges = new Map<number, MealState>();
  private readonly hungerEvents: HungerEvent[] = [];
  private readonly healthEvents: HealthEvent[] = [];
  private readonly gestureEvents: GestureEvent[] = [];
  private readonly craftEvents: CraftedEvent[] = [];
  private readonly cookingEvents: CookedEvent[] = [];
  /** Who gathered something this tick, so the world server knows whose pack to send. */
  private readonly gatherEvents: number[] = [];
  private readonly collectionEvents: CollectedEvent[] = [];
  private readonly pickupRefusals: PickupRefusal[] = [];
  /** Every stick and flower patch: where it is now and how many it has left (see decision 0061). */
  private readonly patches: GatherPatch[];
  /** Patches gathered from, grown back or moved since this was last asked, by id. */
  private readonly patchChanges = new Set<number>();
  /** Everything lying where somebody dropped it, oldest first. */
  private readonly droppedPiles: DroppedPile[] = [];
  /** Piles already saved, but hidden and uncollectible until the tree has finished falling. */
  private readonly pendingPiles = new Set<number>();
  private nextDroppedPileId = 1;
  /** Piles dropped, added to, picked from or faded since this was last asked, by id. */
  private readonly pileChanges = new Set<number>();
  private readonly blueprintProgressChanges = new Set<number>();
  private readonly sentinelProgressChanges = new Set<number>();
  private readonly expeditionChanges = new Map<number, ExpeditionNotice>();
  private readonly discoveryChanges = new Map<number, DiscoveryNotice>();
  private readonly homeGardens = new Map<number, GardenPlot[]>();
  private readonly discardEvents: DiscardedEvent[] = [];
  /** Who changed what they have equipped since this was last asked - a signal to resend the whole list, not a diff. */
  private readonly equipEvents: number[] = [];
  /** Who changed what they are wearing since this was last asked - again a signal to resend the whole list. */
  private readonly wornEvents: number[] = [];
  /** Everything anybody has ever built. Nothing is ever removed from it yet. */
  private readonly builtProps: BuiltProp[] = [];
  /** Same props, by id - campfires have no cap, so looking one up by id must not mean scanning all of them. */
  private readonly builtPropsById = new Map<number, BuiltProp>();
  private nextBuiltPropId = 1;
  private readonly buildEvents: BuildEvent[] = [];
  /** Rowboats somebody climbed into or out of since this was last asked, by built-prop id. */
  private readonly boatChanges = new Set<number>();
  private readonly brokenBoats: number[] = [];
  /** Whole days the calendar is pushed on, to look at a season while testing (decision 0095). */
  private calendarShiftMs = 0;
  /** Whether the lake is frozen over, as of the last time the calendar was looked at. */
  private lakeFrozen = false;
  /** Set until the first look at the calendar, which does not wait for a whole second. */
  private lakeUnchecked = true;
  /** The lake freezing or thawing since this was last asked, for telling everybody. */
  private lakeFreezeChange: boolean | null = null;
  /** When each currently-lit campfire should go out on its own, by prop id. Absent while unlit. */
  private readonly campfireLitUntilMs = new Map<number, number>();
  private readonly campfireLitEvents: CampfireLitEvent[] = [];
  /** Built-prop id -> whoever it belongs to, for anything capped per player. */
  private readonly ownedBuiltProps = new Map<number, string>();
  /** When each abandoned build disappears, in real time, by built-prop id. */
  private readonly abandonedUntilMs = new Map<number, number>();
  private readonly removedBuilds: number[] = [];
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
  /** The same, for the wilderness: what stands there now, in the same order as `wilderness.props`. */
  private readonly standingWilderness: PlacedProp[];
  private spawnCounter = 0;
  /** Reused every tick so a busy world does not allocate per player. */
  private readonly scratch: PlayerMotion = createPlayerMotion(SPAWN_POSITION);
  /** Every player, as a raid sees them - refreshed each tick, reused between them. */
  private readonly fighters: RaidFighter[] = [];
  /** Where each mountain pile of stone or ore first lay; it comes back near here once picked clean. */
  private readonly mountainRockHomes = new Map<number, GatherSpot>();
  /** Ground dug out below the surface (decision 0114, step 4); shared with `collision`. */
  readonly dug: DugGrid;
  /** Digs made since the server last told everybody and saved them. */
  private readonly digNews: Dig[] = [];

  constructor(options: WorldSimulationOptions) {
    this.seed = options.seed;
    this.regrowMinSeconds = options.regrowMinSeconds ?? REGROW_MIN_SECONDS;
    this.patchRegrowMinSeconds = options.patchRegrowMinSeconds ?? PATCH_REGROW_MIN_SECONDS;
    this.reedRegrowMinSeconds = options.reedRegrowMinSeconds ?? REED_REGROW_MIN_SECONDS;
    this.hungerDrainPerSecond = hungerDrainPerSecond(
      options.hungerEmptyAfterSeconds ?? HUNGER_EMPTY_AFTER_SECONDS,
    );
    this.clearing = buildTestClearing(options.seed);
    this.keepOutWater = [...this.clearing.water, ...LAKE.basin, ...STREAM_KEEP_OUT];
    this.patches = this.clearing.gatherSpots.map((spot) => freshPatch(options.seed, spot));
    const terrain = options.terrain ?? createWildernessTerrain(options.seed);
    this.wilderness = buildWilderness(options.seed, terrain);
    this.encounterSites = buildEncounterSites(
      options.seed,
      terrain,
      [...this.clearing.colliders, ...this.wilderness.siteColliders],
      this.clearing.water,
      LAKE,
    );
    this.discoverySites = buildDiscoverySites(this.encounterSites);
    for (const spot of discoveryForageSpots(this.discoverySites))
      this.patches.push(freshPatch(this.seed, spot));
    for (const spot of REED_PATCHES) this.patches.push(freshPatch(this.seed, spot));
    const rockSpots = buildMountainRockSpots(
      this.seed,
      terrain,
      (x, z) =>
        !this.wilderness.colliders.some(
          (c) => Math.hypot(c.x - x, c.z - z) < (c.shape === 'cylinder' ? c.radius : 2) + 1.2,
        ),
    );
    for (const spot of rockSpots) {
      this.mountainRockHomes.set(spot.id, spot);
      this.patches.push(freshPatch(this.seed, spot));
    }
    this.collision = createCollisionWorld(
      terrain,
      [
        ...this.clearing.colliders,
        ...this.wilderness.colliders,
        ...encounterColliders(this.encounterSites, terrain),
        ...discoveryColliders(this.discoverySites, terrain),
      ],
      PLAYABLE_HALF_EXTENT,
      LAKE,
      true,
    );
    this.dug = new DugGrid(terrain);
    this.collision.dug = this.dug;
    this.standing = [...this.clearing.props];
    this.standingWilderness = [...this.wilderness.props];
    for (const [id, index] of this.clearing.indexById) {
      this.treeSlots.set(id, { wilderness: false, index, colliderIndex: index });
    }
    // The wilderness's colliders follow all of the clearing's, walls round the water included.
    for (const [id, index] of this.wilderness.indexById) {
      this.treeSlots.set(id, {
        wilderness: true,
        index,
        colliderIndex: this.clearing.colliders.length + index,
      });
    }
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

    this.raids = new RaidDirector(
      this.world,
      options.seed,
      {
        collision: this.collision,
        water: this.keepOutWater,
        fighters: () => this.fighters,
        strikePlayer: (netId, damage, impactTick) =>
          this.raiderStrikesPlayer(netId, damage, impactTick),
        defeated: (netId, raiderId, position, facingYaw, kind) => {
          const runtime = this.players.get(netId);
          if (runtime === undefined) return;
          this.advanceExpedition(runtime, { kind: 'defeat' }, 1);
          if (kind === 'sentinel') {
            const owner = this.rewardOwnerKey(runtime);
            if (runtime.sentinelVictories === 0)
              this.addPile('sentinelTrophy', 1, position.x, position.z, this.nowMs, false, owner);
            this.addPile('bone', 4, position.x + 0.25, position.z, this.nowMs, false, owner);
            this.addPile('log', 4, position.x - 0.25, position.z, this.nowMs, false, owner);
            runtime.sentinelVictories = Math.min(0xffffffff, runtime.sentinelVictories + 1);
            this.sentinelProgressChanges.add(netId);
          }
          const item = nextBlueprint(runtime.homeSkills);
          if (item === null) return;
          const roll = createRng(
            hashSeed(this.seed, 'home-blueprint', this.tick, raiderId, netId),
          ).nextFloat();
          if (roll < blueprintDropChance(runtime.blueprintMisses)) {
            runtime.blueprintMisses = 0;
            const spot = dropSpot(position, facingYaw);
            const clear = this.dropSpotIsClear(spot.x, spot.z);
            this.addPile(
              item,
              1,
              clear ? spot.x : position.x,
              clear ? spot.z : position.z,
              this.nowMs,
              false,
              this.rewardOwnerKey(runtime),
            );
          } else {
            runtime.blueprintMisses = Math.min(BLUEPRINT_MAX_MISSES, runtime.blueprintMisses + 1);
          }
          this.blueprintProgressChanges.add(netId);
        },
        dropLoot: (item, count, position, facingYaw) =>
          this.dropPile(item, count, position, facingYaw, this.nowMs),
      },
      {
        intervalMinSeconds: options.raidIntervalSeconds,
        encounterSites: options.forestEncounters === true ? this.encounterSites : [],
      },
    );
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
      damageHelpers: new Set(),
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
    this.raids.dispose();
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
    const wake = homeSpot(
      HOME_WAKE_SPOT,
      home !== null && isHomeKind(home.kind) ? home.kind : 'cabin',
    );
    const spawn =
      home !== null
        ? { x: wake.x, y: 0, z: wake.z }
        : saved
          ? this.savedSpot(saved)
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
      homeSkills:
        ((saved?.homeSkills ?? 0) |
          (home !== null && isHomeKind(home.kind) ? (1 << HOME_TIERS.indexOf(home.kind)) - 1 : 0)) &
        HOME_SKILL_MASK,
      blueprintMisses: Number.isFinite(saved?.blueprintMisses)
        ? Math.min(BLUEPRINT_MAX_MISSES, Math.max(0, Math.floor(saved?.blueprintMisses ?? 0)))
        : 0,
      discoveriesFound:
        ((saved?.discoveriesFound ?? 0) | (saved?.discoveriesClaimed ?? 0)) & DISCOVERY_MASK,
      discoveriesClaimed: (saved?.discoveriesClaimed ?? 0) & DISCOVERY_MASK,
      expedition: expeditionFromSaved(saved?.expedition),
      sentinelVictories:
        Number.isInteger(saved?.sentinelVictories) &&
        saved!.sentinelVictories! >= 0 &&
        saved!.sentinelVictories! <= 0xffffffff
          ? saved!.sentinelVictories!
          : 0,
      takenPickups: new Set(
        (saved?.takenPickups ?? []).filter((id) =>
          this.clearing.pickups.some((pickup) => pickup.id === id),
        ),
      ),
      swingCooldownTicks: 0,
      swingWasHeld: false,
      interactWasHeld: false,
      pickupRefused: false,
      pendingBuild: null,
      pendingLoot: null,
      cast: null,
      reel: null,
      fishRecords: fishRecordsFromSaved(saved?.fishRecords),
      lastProcessedSeq: 0,
      droppedInputs: 0,
      hunger,
      // Matches what `addPlayer`'s caller is about to be told separately, on
      // arrival, so the tick loop does not repeat itself the moment it runs.
      lastSentHunger: Math.round(hunger),
      meal: mealFromSaved(saved?.meal),
      health: saved?.health ?? HEALTH_MAX,
      action: createActionState(),
      previousButtons: 0,
      knockedOutAtTick: 0,
      dodgeStartedAtTick: -Infinity,
      dodgeAttackStartedAtTick: Infinity,
      // With a weapon already in the main hand, nothing chosen from the pack
      // means the weapon is drawn, not that a tool should be picked up.
      equippedItem:
        saved?.equippedItem == null && wornFromEntries(saved?.worn).mainHand !== undefined
          ? null
          : initialEquippedItem(inventory, saved?.equippedItem ?? null),
      worn: wornFromEntries(saved?.worn),
      lastCombatTick: -Infinity,
      explored: exploredMapFrom(saved?.explored),
      exploredCell: null,
      // Always worth sending once on arrival, whether or not anything new
      // gets seen: it is how a returning player's map comes back.
      exploredChanged: true,
      space: home?.id ?? OUTDOORS,
      doorCooldownTicks: 0,
      boatId: null,
      interactSpent: false,
    });
  }

  /** Every request is checked against the server's current room, owner and reach. */
  requestChest(netId: number, request: ChestRequest): ChestResult {
    const runtime = this.players.get(netId);
    const unavailable = (reason: ChestReason): ChestResult => ({
      homeId: 0,
      slots: emptyChest(),
      moved: 0,
      reason,
    });
    if (runtime === undefined || runtime.space === OUTDOORS) return unavailable('unavailable');
    const home = this.builtPropsById.get(runtime.space);
    if (home === undefined || !BUILDABLE_KINDS[home.kind].isHome) return unavailable('unavailable');
    if (runtime.playerKey === null || this.builtPropOwner(home.id) !== runtime.playerKey)
      return unavailable('private');
    const slots = this.homeChests.get(home.id) ?? emptyChest();
    const reply = (reason: ChestReason | null, moved = 0): ChestResult => ({
      homeId: home.id,
      slots: slots.map((slot) => (slot === null ? null : { ...slot })),
      moved,
      reason,
    });
    const position = runtime.entity.get(Position);
    const chest = homeChestSpot(isHomeKind(home.kind) ? home.kind : 'cabin');
    if (position === undefined || Math.hypot(position.x - chest.x, position.z - chest.z) > 1.8)
      return reply('tooFar');
    if (runtime.health <= 0 || runtime.action.kind !== ActionKind.Idle || runtime.cast !== null)
      return reply('busy');
    if (request.action === 'open') return reply(null);
    if (request.action === 'storeSupplies') {
      const wasHolding = this.equippedItemOf(netId);
      const result = storeBuildingSupplies(slots, runtime.inventory);
      if (result.moved > 0) this.homeChests.set(home.id, slots);
      if (wasHolding !== this.equippedItemOf(netId)) this.equipEvents.push(netId);
      return reply(
        result.left > 0 ? 'chestFull' : result.moved === 0 ? 'empty' : null,
        result.moved,
      );
    }
    if (!validTransferAmount(request.amount)) return reply('invalid');
    const wasHolding = this.equippedItemOf(netId);
    let moved: number;
    let reason: ChestReason | null = null;
    if (request.action === 'deposit') {
      if (!Object.hasOwn(ITEM_KINDS, request.item) || isPack(request.item)) return reply('invalid');
      const wanted = Math.min(request.amount, countOf(runtime.inventory, request.item));
      if (wanted === 0) return reply('empty');
      moved = depositInChest(slots, runtime.inventory, request.item, request.amount);
      if (moved < wanted) reason = 'chestFull';
    } else {
      if (!Number.isInteger(request.slot) || request.slot < 0 || request.slot >= slots.length)
        return reply('invalid');
      const stack = slots[request.slot];
      if (stack == null) return reply('empty');
      const wanted = Math.min(request.amount, stack.count);
      moved = withdrawFromChest(slots, runtime.inventory, request.slot, request.amount);
      if (moved < wanted) reason = 'packFull';
    }
    if (moved > 0) this.homeChests.set(home.id, slots);
    if (wasHolding !== this.equippedItemOf(netId)) this.equipEvents.push(netId);
    return reply(reason, moved);
  }

  homeSuppliesOf(netId: number): HomeSupplies {
    const runtime = this.players.get(netId),
      home = runtime?.playerKey == null ? null : this.homeOf(runtime.playerKey);
    return home === null
      ? { homeId: 0, items: [] }
      : {
          homeId: home.id,
          items: storedHomeSupplies(this.homeChests.get(home.id) ?? emptyChest()),
        };
  }
  chestSlots(homeId: number): readonly ChestSlot[] {
    return (this.homeChests.get(homeId) ?? emptyChest()).map((slot) =>
      slot === null ? null : { ...slot },
    );
  }

  restoreChest(homeId: number, saved: unknown): void {
    const slots = chestFromSaved(saved);
    const home = this.builtPropsById.get(homeId);
    if (slots !== null && home !== undefined && BUILDABLE_KINDS[home.kind].isHome)
      this.homeChests.set(homeId, slots);
  }

  gardenStateOf(netId: number, reason: GardenReason | null = null): GardenState {
    const runtime = this.players.get(netId);
    const homeId = runtime?.space ?? OUTDOORS;
    if (runtime === undefined || homeId === OUTDOORS || this.kindOfHome(homeId) !== 'largeCabin')
      return { homeId: 0, yours: false, plots: emptyGarden(), reason: reason ?? 'unavailable' };
    return {
      homeId,
      yours: runtime.playerKey !== null && this.builtPropOwner(homeId) === runtime.playerKey,
      plots: (this.homeGardens.get(homeId) ?? emptyGarden()).map((plot) => ({ ...plot })),
      reason,
    };
  }

  requestGarden(netId: number, request: GardenRequest): GardenState {
    const state = this.gardenStateOf(netId),
      runtime = this.players.get(netId);
    if (state.homeId === 0 || runtime === undefined) return state;
    if (request.action === 'inspect') return state;
    const refuse = (reason: GardenReason) => this.gardenStateOf(netId, reason);
    if (!state.yours) return refuse('private');
    const position = runtime.entity.get(Position);
    if (position === undefined || !homeFacilityInReach('largeCabin', 'garden', position))
      return refuse('tooFar');
    if (runtime.health <= 0 || runtime.action.kind !== ActionKind.Idle || runtime.cast !== null)
      return refuse('busy');
    const plots = this.homeGardens.get(state.homeId) ?? emptyGarden();
    const held = this.equippedItemOf(netId);
    const reason = useGarden(plots, runtime.inventory, request);
    if (reason === null) this.homeGardens.set(state.homeId, plots);
    if (held !== this.equippedItemOf(netId)) this.equipEvents.push(netId);
    return this.gardenStateOf(netId, reason);
  }

  savedGardens(): { homeId: number; plots: GardenPlot[] }[] {
    return [...this.homeGardens].map(([homeId, plots]) => ({
      homeId,
      plots: plots.map((plot) => ({ ...plot })),
    }));
  }
  restoreGarden(homeId: number, saved: unknown): void {
    const plots = gardenFromSaved(saved),
      home = this.builtPropsById.get(homeId);
    if (plots !== null && home?.kind === 'largeCabin') this.homeGardens.set(homeId, plots);
  }

  /** Ask for a specific loot target, validated at the next simulation tick. */
  requestLoot(netId: number, request: LootRequest): void {
    const runtime = this.players.get(netId);
    if (
      runtime === undefined ||
      !Number.isInteger(request.id) ||
      request.id < 0 ||
      request.id > 65535
    )
      return;
    runtime.pendingLoot = request;
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
    runtime.pickupRefused = false;
    runtime.pendingLoot = null;
  }

  removePlayer(netId: number): boolean {
    const runtime = this.players.get(netId);
    if (!runtime) return false;
    // Whoever was rowing leaves their boat on the bank, not out on the water.
    this.putBoatAshore(runtime);
    runtime.entity.destroy();
    this.players.delete(netId);
    this.expeditionChanges.delete(netId);
    this.sentinelProgressChanges.delete(netId);
    this.reelChanges.delete(netId);
    this.fishRecordChanges.delete(netId);
    this.raids.forgetPlayer(netId);
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
    this.revealLandedLogs(nowMs);
    this.tick += 1;
    this.updateLakeIce();
    this.updateWildfire();
    for (const plots of this.homeGardens.values())
      for (const plot of plots) if (plot.crop !== null && plot.growTicks > 0) plot.growTicks--;
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

        const hadMeal = runtime.meal.item !== null;
        const mealStep = advanceMeal(runtime.meal);
        runtime.meal = mealStep.state;
        if (mealStep.healing > 0 && runtime.health > 0 && runtime.health < HEALTH_MAX) {
          runtime.health = Math.min(HEALTH_MAX, runtime.health + mealStep.healing);
          this.healthEvents.push({
            netId: runtime.netId,
            health: Math.round(runtime.health),
            knockedOut: false,
            dodged: false,
          });
        }
        if (hadMeal && (this.tick % TICK_HZ === 0 || runtime.meal.item === null))
          this.mealChanges.set(runtime.netId, { ...runtime.meal });
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
        let wantsToLeaveBoat = false;
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
        const collision = outdoors ? this.collision : this.roomFor(runtime.space);
        collision.movementScale =
          outdoors && this.weather().kind === 'blizzard' ? BLIZZARD_SPEED : 1;

        // A line in the water keeps its own time: the fish bites when it bites,
        // and wandering off brings the line in, whether or not inputs arrived.
        if (runtime.cast !== null) this.tickLine(runtime, runtime.cast, scratch.position);

        const steps = inputsToConsume(runtime.queue.length);
        if (steps === 0) {
          // No packet arrived in time: the player coasts to a stop where they
          // are, and whatever they were doing waits for the next one, the same
          // way it waits in their own browser.
          const idle = idleInput(runtime.lastProcessedSeq, aim.yaw, aim.yaw);
          if (runtime.action.kind === ActionKind.Row) {
            stepBoat(scratch, idle, TICK_SECONDS, collision);
          } else if (runtime.action.kind === ActionKind.Idle) {
            stepPlayer(scratch, idle, TICK_SECONDS, collision);
          } else if (
            runtime.action.kind !== ActionKind.Dodge &&
            runtime.action.kind !== ActionKind.DodgeLight &&
            runtime.action.kind !== ActionKind.DodgeHeavy
          ) {
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

            const context = this.actionContext(
              runtime,
              scratch.position,
              input.aimYaw,
              scratch.grounded,
            );
            const beforeAction = runtime.action.kind;
            const tick = advanceAction(runtime.action, input, runtime.previousButtons, context);
            if (
              beforeAction === ActionKind.Dodge &&
              (runtime.action.kind === ActionKind.DodgeLight ||
                runtime.action.kind === ActionKind.DodgeHeavy)
            )
              runtime.dodgeAttackStartedAtTick = this.tick;
            runtime.previousButtons = input.buttons;
            if (runtime.action.kind === ActionKind.Dodge && runtime.action.age === 0) {
              runtime.dodgeStartedAtTick = this.tick;
              runtime.dodgeAttackStartedAtTick = Infinity;
            }
            if (tick.footing === 'dodging') {
              stepDodge(scratch, runtime.action, collision);
            } else if (tick.footing === 'aerial') {
              stepDodgeAttack(scratch, runtime.action, collision, input.aimYaw);
            } else if (tick.footing === 'rowing') {
              stepBoat(scratch, input, TICK_SECONDS, collision);
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
            if (!interactHeld) runtime.interactSpent = false;
            if (freshInteract) runtime.pickupRefused = false;
            const swingHeld = isHeld(input, PlayerButton.Swing) || isHeld(input, PlayerButton.Fish);
            const clicked = swingHeld && !runtime.swingWasHeld;
            runtime.swingWasHeld = swingHeld;
            // Reaching for things is only for somebody free to do it: not
            // mid-swing, mid-roll, down, or sat down.
            if (isFreeToInteract(runtime.action)) {
              if (interactHeld && !runtime.interactSpent) wantsToInteract = true;
              if (freshInteract) wantsToToggleCampfire = true;
            } else if (runtime.action.kind === ActionKind.Row && freshInteract) {
              wantsToLeaveBoat = true;
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

        // Climbing out of a boat is one press of interact, and the only thing
        // it does: it lands them on the bank, if there is one close enough.
        if (wantsToLeaveBoat) this.tryClimbOut(runtime, scratch);

        // Reaching and swinging are judged where the player ended up, not where
        // they started, and only the server ever decides what happens. Inside
        // a home, there is nothing out in the world in reach: only the chair
        // and the bed, and your own pack, to eat from. Food picked out and
        // room for it comes first, even beside them: that is what it was
        // picked out for.
        if (runtime.space === OUTDOORS && runtime.health > 0)
          this.findDiscoveries(runtime, scratch.position);
        const loot = runtime.pendingLoot;
        runtime.pendingLoot = null;
        if (loot !== null) {
          if (
            runtime.space === OUTDOORS &&
            isFreeToInteract(runtime.action) &&
            runtime.cast === null &&
            runtime.health > 0
          ) {
            runtime.pickupRefused = false;
            if (loot.kind === 'pickup') this.tryPickup(runtime, scratch.position, loot.id);
            if (loot.kind === 'pile') this.tryPickUpPile(runtime, scratch.position, loot.id);
            if (loot.kind === 'patch') this.tryGather(runtime, scratch.position, loot.id);
          }
        } else if (wantsToInteract && runtime.space !== OUTDOORS) {
          const place = wantsToToggleCampfire
            ? restingPlaceInReach(
                scratch.position.x,
                scratch.position.z,
                this.kindOfHome(runtime.space),
              )
            : null;
          const hungryWithFood =
            foodToEat(runtime.inventory, runtime.hunger, runtime.equippedItem) !== null;
          if (this.tryUseHomeCooking(runtime, scratch.position, wantsToToggleCampfire)) {
            // The cooking station claims E, including a full-pack cooking refusal.
          } else if (!hungryWithFood && place !== null && this.isRestingPlaceFree(runtime, place)) {
            this.settleInto(runtime, scratch, place);
            aim.yaw = scratch.facingYaw;
          } else {
            this.tryEat(runtime);
          }
        } else if (wantsToToggleCampfire && this.tryInspectDiscovery(runtime, scratch.position)) {
          // A deliberate inspect claims the button, including a guarded/full refusal.
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
            const boarded =
              !gathered && wantsToToggleCampfire && this.tryBoardBoat(runtime, scratch);
            if (boarded) aim.yaw = scratch.facingYaw;
            if (!gathered && !boarded) {
              const dugUp = this.tryDigUpCache(runtime, scratch.position);
              if (!dugUp) {
                // A campfire in reach always claims the button, whether or not
                // this tick is the fresh press that actually toggles it -
                // otherwise holding the button down to "keep warm" would fall
                // through and eat from the pack on every tick after the first.
                const nearCampfire = this.tryUseCampfire(
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
            // Nothing is built from the middle of the lake.
            if (runtime.boatId === null) this.tryBuild(runtime, scratch.position, request);
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
        if (runtime.boatId !== null) this.carryBoat(runtime, position, facing.yaw);
        // A room has its own coordinates, nowhere on the map.
        if (runtime.space === OUTDOORS) this.exploreAround(runtime, position.x, position.z);

        // Catches the meter crossing a whole point on its own, if eating did
        // not already say something this tick.
        this.queueHungerEvent(runtime, null);
      });

    this.stepAnimals();
    this.refreshFighters();
    this.raids.step(this.tick, isNight(dayProgress(nowMs)));
  }

  /**
   * Send a skeleton raid at a player right now, whatever their countdown
   * says: these kinds, or a group drawn at random. Returns the raid's id,
   * or null if it could not come. Used by tests.
   */
  startRaid(netId: number, kinds?: readonly RaiderKindId[]): number | null {
    this.refreshFighters();
    return this.raids.startRaid(netId, kinds, isNight(dayProgress(this.nowMs)));
  }

  /** Every player as a raid needs to see them, this tick. */
  private refreshFighters(): void {
    this.fighters.length = 0;
    for (const runtime of this.players.values()) {
      const position = runtime.entity.get(Position);
      if (position === undefined) continue;
      const { action } = runtime;
      this.fighters.push({
        netId: runtime.netId,
        rewardKey: this.rewardOwnerKey(runtime),
        position,
        aimYaw: runtime.entity.get(AimYaw)?.yaw ?? 0,
        action,
        outdoors: runtime.space === OUTDOORS,
        down: isDown(action),
      });
    }
  }

  /**
   * A raider's blow settles on a player (see `sim/raids.ts`). A roll begun
   * in time beats it: one whose untouchable stretch covers the moment it
   * landed, or that began in the moment since - the player sees every
   * raider a moment behind, so that is when they saw it coming.
   */
  private raiderStrikesPlayer(netId: number, damage: number, impactTick: number): void {
    const runtime = this.players.get(netId);
    if (runtime === undefined || runtime.space !== OUTDOORS) return;
    runtime.lastCombatTick = this.tick;
    const sinceRoll = impactTick - runtime.dodgeStartedAtTick;
    if (
      sinceRoll < DODGE.invulnerable &&
      runtime.dodgeStartedAtTick <= this.tick &&
      impactTick < runtime.dodgeAttackStartedAtTick
    ) {
      this.healthEvents.push({
        netId,
        health: Math.round(runtime.health),
        knockedOut: false,
        dodged: true,
      });
      return;
    }
    this.damagePlayer(runtime, damage);
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
      if (
        !isLeavingRoom(
          position.x,
          position.z,
          walkX,
          walkZ,
          freshInteract,
          this.kindOfHome(runtime.space),
        )
      )
        return false;
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
      this.moveBetweenSpaces(
        runtime,
        motion,
        home.id,
        homeSpot(HOME_ENTRY, isHomeKind(home.kind) ? home.kind : 'cabin'),
      );
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
    if (runtime.boatId !== null) {
      // Rowing: they come back on the bank, where they would climb out.
      const bank = landingBeside(position.x, position.z);
      return {
        x: bank.x,
        y: this.collision.terrain.heightAt(bank.x, bank.z),
        z: bank.z,
        yaw: facing.yaw,
      };
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
          runtime.damageHelpers.clear();
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
        if (runtime.kind === 'curiousRaccoon' && runtime.engaged && nearestPosition !== null) {
          direction = towardDirection(position.x, position.z, runtime.denX, runtime.denZ);
          speed = Math.hypot(position.x - runtime.denX, position.z - runtime.denZ) > 1.2 ? 0.85 : 0;
          if (speed === 0)
            facing.yaw = Math.atan2(
              -(nearestPosition.x - position.x),
              -(nearestPosition.z - position.z),
            );
        } else if (runtime.engaged && alarmPosition !== null) {
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
        this.resolveWoodlandAnimal(runtime, position);
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
  private resolveWoodlandAnimal(
    runtime: AnimalRuntime,
    position: { x: number; y: number; z: number },
  ): void {
    if (!WOODLAND_ENCOUNTERS.some((site) => site.kind === runtime.kind)) return;
    position.x = Math.max(
      -PLAYABLE_HALF_EXTENT + 0.5,
      Math.min(PLAYABLE_HALF_EXTENT - 0.5, position.x),
    );
    position.z = Math.max(
      -PLAYABLE_HALF_EXTENT + 0.5,
      Math.min(PLAYABLE_HALF_EXTENT - 0.5, position.z),
    );
    const small = runtime.kind === 'curiousRaccoon';
    resolveCapsule(
      position,
      small ? 0.17 : runtime.kind === 'elk' ? 0.35 : 0.45,
      small ? 0.5 : runtime.kind === 'elk' ? 1.8 : 2.8,
      this.collision,
    );
  }

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
    if (
      runtime.kind === 'woodlandGuardian' &&
      (Math.hypot(position.x - runtime.denX, position.z - runtime.denZ) > 18 ||
        (nearestPosition !== null &&
          Math.hypot(nearestPosition.x - runtime.denX, nearestPosition.z - runtime.denZ) > 18))
    ) {
      runtime.engaged = false;
      runtime.attackState = 'none';
      const direction = towardDirection(position.x, position.z, runtime.denX, runtime.denZ);
      velocity.x = direction.x * kind.wanderSpeed;
      velocity.z = direction.z * kind.wanderSpeed;
      position.x += velocity.x * TICK_SECONDS;
      position.z += velocity.z * TICK_SECONDS;
      this.resolveWoodlandAnimal(runtime, position);
      position.y = this.collision.terrain.heightAt(position.x, position.z);
      facing.yaw = Math.atan2(-direction.x, -direction.z);
      return;
    }
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
    this.resolveWoodlandAnimal(runtime, position);
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
      if (isDown(runtime.action)) continue;
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
   * Nothing happens if there is nothing in reach. A full pack reports the refusal,
   * and a pickup only ever leaves the world once however many people reach for
   * it in the same tick. Returns whether it claimed the interaction, so the caller can fall
   * back to something else the same button might mean.
   */
  private tryPickup(runtime: PlayerRuntime, position: Readonly<Vec3>, targetId?: number): boolean {
    const pickup = pickupInReach(
      position,
      targetId === undefined
        ? this.clearing.pickups
        : this.clearing.pickups.filter((pickup) => pickup.id === targetId),
      (id) => runtime.takenPickups.has(id),
    );
    if (pickup === null) return false;
    if (addItem(runtime.inventory, pickup.item) === 0)
      return this.refusePickup(runtime, pickup.item);

    runtime.takenPickups.add(pickup.id);
    this.collectionEvents.push({
      netId: runtime.netId,
      item: pickup.item,
      count: 1,
      x: pickup.x,
      z: pickup.z,
      depleted: true,
    });
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
   * the pile claimed the interaction, including a capacity refusal.
   */
  private tryPickUpPile(
    runtime: PlayerRuntime,
    position: Readonly<Vec3>,
    targetId?: number,
  ): boolean {
    const pile = droppedPileInReach(
      position,
      this.droppedPiles.filter(
        (p) =>
          !this.pendingPiles.has(p.id) &&
          (p.ownerKey === undefined || p.ownerKey === this.rewardOwnerKey(runtime)) &&
          (targetId === undefined || p.id === targetId),
      ),
    );
    if (pile === null) return false;
    const taken = addItem(runtime.inventory, pile.item, pile.count);
    if (taken === 0) return this.refusePickup(runtime, pile.item);

    pile.count -= taken;
    if (pile.count > 0) this.refusePickup(runtime, pile.item);
    if (pile.count === 0) this.droppedPiles.splice(this.droppedPiles.indexOf(pile), 1);
    this.pileChanges.add(pile.id);
    this.collectionEvents.push({
      netId: runtime.netId,
      item: pile.item,
      count: taken,
      x: pile.x,
      z: pile.z,
      depleted: pile.count === 0,
    });
    this.gatherEvents.push(runtime.netId);
    this.gestureEvents.push({ netId: runtime.netId, gesture: Gesture.PickUp, item: pile.item });
    return true;
  }

  /**
   * Gather one from a nearby patch - sticks or flowers, whatever it offers -
   * if there is one in reach with any left and this player is not still
   * catching their breath from a swing, a cast or a gather of their own.
   * Taking the last one leaves the patch picked clean until it grows back
   * somewhere else - or where it stood, for the lake's reeds (see
   * `regrowPatches`). A nearby patch claims E even on cooldown.
   */
  private tryGather(runtime: PlayerRuntime, position: Readonly<Vec3>, targetId?: number): boolean {
    const patch = gatherSpotInReach(
      position,
      targetId === undefined ? this.patches : this.patches.filter((patch) => patch.id === targetId),
    );
    if (patch === null) return false;
    if (roomFor(runtime.inventory, patch.item) === 0) return this.refusePickup(runtime, patch.item);
    if (runtime.swingCooldownTicks > 0) return true;
    const offered =
      patch.item === 'mushroom' && forestWeather(this.seed, this.nowMs).mushroomsAbundant ? 2 : 1;
    const gathered = addItem(runtime.inventory, patch.item, offered);
    this.advanceExpedition(runtime, { kind: 'gather', item: patch.item }, gathered);

    patch.remaining -= 1;
    if (patch.remaining === 0) patch.emptiedAtMs = this.nowMs;
    this.patchChanges.add(patch.id);
    this.collectionEvents.push({
      netId: runtime.netId,
      item: patch.item,
      count: gathered,
      x: patch.x,
      z: patch.z,
      depleted: patch.remaining === 0,
    });
    runtime.swingCooldownTicks = mealCooldown(runtime.meal, SWING_COOLDOWN_TICKS, 'berryTea');
    this.gatherEvents.push(runtime.netId);
    this.gestureEvents.push({ netId: runtime.netId, gesture: Gesture.PickUp, item: patch.item });
    return true;
  }

  /** A blocked target claims E, so reaching for a log cannot eat food or toggle a fire. */
  private refusePickup(runtime: PlayerRuntime, item: ItemId): true {
    if (!runtime.pickupRefused) {
      const reason =
        ITEM_KINDS[item].maxCarry === 1 && hasItem(runtime.inventory, item) ? 'limit' : 'full';
      this.pickupRefusals.push({ netId: runtime.netId, item, reason });
      runtime.pickupRefused = true;
    }
    return true;
  }

  drainCollectionEvents(): CollectedEvent[] {
    return this.collectionEvents.splice(0);
  }

  drainPickupRefusals(): PickupRefusal[] {
    return this.pickupRefusals.splice(0);
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
      if (!this.patchIsDueBack(patch, nowMs)) continue;
      const generation = patch.generation + 1;
      if (!this.movePatch(patch, generation, nowMs)) continue;
      patch.remaining = patchCount(this.seed, patch.id, generation);
      patch.emptiedAtMs = 0;
    }
  }

  /**
   * Put a patch somewhere new: the first open spot its seed offers for this
   * generation, or back where the clearing first laid it if somehow none of
   * them is.
   */
  private movePatch(patch: GatherPatch, generation: number, nowMs = this.nowMs): boolean {
    // Mature reeds come back somewhere else round the shore.
    if (isReedPatch(patch.id)) {
      const footprints = this.buildFootprints(undefined, true);
      const spot = reedRegrowSpot(this.seed, patch.id, generation, patch, (x, z) =>
        this.reedSpotIsClear(patch.id, x, z, footprints),
      );
      // With nowhere better, it comes back where it grew.
      if (spot !== null) {
        patch.x = spot.x;
        patch.z = spot.z;
      }
      patch.generation = generation;
      this.patchChanges.add(patch.id);
      return true;
    }
    const forage =
      discoveryForageSpots(this.discoverySites).find((s) => s.id === patch.id) ??
      (isMountainPatch(patch.id) ? this.mountainRockHomes.get(patch.id) : undefined);
    if (forage !== undefined) {
      const footprints = this.buildFootprints();
      const rng = createRng(hashSeed(this.seed, 'forest-forage', patch.id, generation));
      let chosen = { x: forage.x, z: forage.z };
      for (let attempt = 0; attempt < 64; attempt++) {
        if (this.patchSpotIsClear(patch.id, chosen.x, chosen.z, footprints)) break;
        const angle = rng.nextRange(0, Math.PI * 2),
          radius = rng.nextRange(1, 8);
        chosen = { x: forage.x + Math.cos(angle) * radius, z: forage.z + Math.sin(angle) * radius };
      }
      const clear = this.patchSpotIsClear(patch.id, chosen.x, chosen.z, footprints);
      if (clear) {
        patch.x = chosen.x;
        patch.z = chosen.z;
      } else {
        patch.remaining = 0;
        patch.emptiedAtMs = nowMs;
      }
      patch.generation = generation;
      this.patchChanges.add(patch.id);
      return clear;
    }
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
    return true;
  }

  /** Whether a picked-clean patch is due back: mature reeds on their own, longer timer. */
  private patchIsDueBack(patch: Readonly<GatherPatch>, nowMs: number): boolean {
    if (patch.remaining > 0) return false;
    if (!isReedPatch(patch.id)) {
      return patchIsDue(this.seed, patch, nowMs, this.patchRegrowMinSeconds);
    }
    return reedIsDue(
      this.seed,
      patch.id,
      patch.generation,
      patch.emptiedAtMs,
      nowMs,
      this.reedRegrowMinSeconds,
    );
  }

  /**
   * Whether a bed of mature reeds could come back here: nothing built or
   * growing on top of it, well away from any other bed of the same water that
   * still has reeds (so they are spread round the shore and not bunched), and
   * not so close to anything else waiting to be picked up that one press of
   * the button could mean either.
   */
  private reedSpotIsClear(
    patchId: number,
    x: number,
    z: number,
    footprints: readonly Footprint[],
  ): boolean {
    const here = roundFootprint(x, z, REED_CLEAR_RADIUS, 'reeds');
    if (footprints.some((footprint) => footprintGap(here, footprint) < 0)) return false;
    const spacing = reedBedSpacing(patchId);
    const tooCloseToAnotherBed = this.patches.some(
      (other) =>
        other.id !== patchId &&
        isReedPatch(other.id) &&
        other.remaining > 0 &&
        Math.hypot(other.x - x, other.z - z) < spacing,
    );
    return !tooCloseToAnotherBed && !this.somethingElseTooCloseToPress(patchId, x, z);
  }

  /**
   * Whether anything else waiting to be picked up - another kind of patch, a
   * pickup lying in the clearing, a dropped pile or a buried cache - is near
   * enough to this spot that one press of the button could mean either.
   */
  private somethingElseTooCloseToPress(patchId: number, x: number, z: number): boolean {
    const tooClose = (other: { x: number; z: number }): boolean =>
      Math.hypot(other.x - x, other.z - z) < PATCH_SPACING;
    for (const other of this.patches) {
      if (other.id !== patchId && other.remaining > 0 && tooClose(other)) return true;
    }
    // Every character has their own copy of each pickup, so some character may
    // still be able to reach any of them.
    for (const pickup of this.clearing.pickups) {
      if (tooClose(pickup)) return true;
    }
    return this.droppedPiles.some(tooClose) || this.buriedCaches.some(tooClose);
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
    if (overlapsWater(this.keepOutWater, x, z, PATCH_CLEARANCE)) return false;
    const here = roundFootprint(x, z, PATCH_CLEARANCE, 'patch');
    if (footprints.some((footprint) => footprintGap(here, footprint) < 0)) return false;

    return !this.somethingElseTooCloseToPress(patchId, x, z);
  }

  /**
   * Move any patch a new piece was just built on top of, keeping however
   * many it had left: a patch under a cabin would be out of reach for good,
   * and never picked clean, never grow back anywhere else either.
   */
  private movePatchesFrom(piece: Footprint): void {
    for (const patch of this.patches) {
      // Nothing is built on top of mature reeds (see `buildFootprints`), so none is ever moved for a build.
      if (patch.remaining === 0 || isReedPatch(patch.id)) continue;
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
    if (toolKind(item) === 'rod' && runtime.cast !== null && !this.isActiveItem(runtime, 'rod')) {
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

    const existing = pileToMergeInto(
      this.droppedPiles.filter((p) => !this.pendingPiles.has(p.id) && p.ownerKey === undefined),
      item,
      count,
      x,
      z,
    );
    if (existing !== null) {
      existing.count += count;
      existing.droppedAtMs = nowMs;
      // Freshly added to, so it is the newest now: the last to fade early.
      this.droppedPiles.splice(this.droppedPiles.indexOf(existing), 1);
      this.droppedPiles.push(existing);
      this.pileChanges.add(existing.id);
      return;
    }

    this.addPile(item, count, x, z, nowMs);
  }

  /** Add a distinct pickup. Future timestamps are tree logs waiting to land. */
  private addPile(
    item: ItemId,
    count: number,
    x: number,
    z: number,
    availableAtMs: number,
    pending = false,
    ownerKey?: string,
  ): void {
    if (this.droppedPiles.length >= MAX_DROPPED_PILES) {
      const removable = this.droppedPiles.findIndex(
        (pile) => !(pile.item === 'sentinelTrophy' && pile.ownerKey !== undefined),
      );
      const oldest = removable < 0 ? undefined : this.droppedPiles.splice(removable, 1)[0];
      if (oldest !== undefined) {
        this.pileChanges.add(oldest.id);
        this.pendingPiles.delete(oldest.id);
      }
    }
    const pile: DroppedPile = {
      id: this.claimPileId(),
      item,
      count,
      x,
      z,
      droppedAtMs: availableAtMs,
      ...(ownerKey === undefined ? {} : { ownerKey }),
    };
    this.droppedPiles.push(pile);
    if (pending) this.pendingPiles.add(pile.id);
    this.pileChanges.add(pile.id);
  }

  private revealLandedLogs(nowMs: number): void {
    for (const pile of this.droppedPiles) {
      if (!this.pendingPiles.has(pile.id) || nowMs < pile.droppedAtMs) continue;
      this.pendingPiles.delete(pile.id);
      this.pileChanges.add(pile.id);
    }
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
  private dropSpotIsClear(
    x: number,
    z: number,
    footprints: readonly Footprint[] = this.buildFootprints(undefined, true, {
      x,
      z,
      reach: LOG_SEARCH_REACH,
    }),
  ): boolean {
    if (overlapsWater(this.keepOutWater, x, z, 0)) return false;
    const here = roundFootprint(x, z, 0, 'pile');
    return !footprints.some((footprint) => footprintGap(here, footprint) < 0);
  }

  /**
   * Let every pile whose time is up fade away.
   *
   * Called with real time, the same reason `regrowTrees` is: on waking,
   * anything that should have faded while nobody was here is gone at once.
   */
  fadeDroppedPiles(nowMs: number): void {
    this.revealLandedLogs(nowMs);
    for (let index = this.droppedPiles.length - 1; index >= 0; index--) {
      const pile = this.droppedPiles[index];
      if (pile === undefined || nowMs < pileFadesAtMs(pile)) continue;
      this.droppedPiles.splice(index, 1);
      this.pendingPiles.delete(pile.id);
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

    let recovered = 0;
    const remaining: { item: ItemId; count: number }[] = [];
    for (const entry of cache.items) {
      const taken = addItem(runtime.inventory, entry.item, entry.count);
      recovered += taken;
      if (taken < entry.count) remaining.push({ item: entry.item, count: entry.count - taken });
    }
    if (recovered === 0) {
      const item = remaining[0]?.item;
      return item === undefined ? true : this.refusePickup(runtime, item);
    }
    if (remaining.length === 0) {
      this.buriedCaches.splice(this.buriedCaches.indexOf(cache), 1);
      this.cacheEvents.push({ netId: runtime.netId, kind: 'dugUp', cacheId: cache.id });
    } else {
      const updated = { ...cache, items: remaining };
      this.buriedCaches[this.buriedCaches.indexOf(cache)] = updated;
      this.cacheEvents.push({ netId: runtime.netId, kind: 'partial', cache: updated });
    }
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
  private tryUseCampfire(
    runtime: PlayerRuntime,
    position: Readonly<Vec3>,
    nowMs: number,
    isFreshPress: boolean,
  ): boolean {
    const campfire = nearestCampfire(position, this.builtProps);
    if (campfire === null) return false;
    if (!isFreshPress) return true;

    // A lit fire cooks one piece of the raw food actually held in hand.
    // Cookable food claims the press even when the result will not fit, so a
    // full pack never turns "cook this" into the surprising act of putting
    // the fire out.
    const held = this.equippedItemOf(runtime.netId);
    if (campfire.lit && held !== null && cookedItemFor(held) !== null) {
      const cooked = cookOne(runtime.inventory, held);
      if (cooked !== null) {
        this.cookingEvents.push({ netId: runtime.netId, raw: held, cooked });
        this.gestureEvents.push({ netId: runtime.netId, gesture: Gesture.Reach, item: held });
        // If that was the last raw piece, the hand is now empty. Resending the
        // equipped list settles that for this player and everybody nearby.
        this.equipEvents.push(runtime.netId);
      }
      return true;
    }

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
    if (isMealItem(item)) {
      runtime.meal = startMeal(item);
      this.mealChanges.set(runtime.netId, { ...runtime.meal });
    }
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
    if (item === 'axe' || item === 'rod')
      return toolKind(this.equippedItemOf(runtime.netId)) === item;
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
    grounded: boolean,
  ): ActionContext {
    const held = this.equippedItemOf(runtime.netId);
    const canAttack = held !== null && runtime.space === OUTDOORS && runtime.cast === null;
    const castInstead =
      canAttack &&
      toolKind(held) === 'rod' &&
      runtime.swingCooldownTicks === 0 &&
      castLanding(position, aimYaw, this.clearing.water, this.openLake()) !== null;
    return {
      canAttack,
      castInstead,
      // Anywhere there is ground underfoot and no line in the water.
      canSit: grounded && runtime.cast === null,
      dodgeCooldown: mealCooldown(runtime.meal, DODGE.cooldown, 'trailRation'),
    };
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

    // Looking back to when the swing began, and a little before for the
    // browser having shown it slightly in the past (see decision 0056).
    const began = impact.dodge
      ? impact.kind === 'strike'
        ? DODGE_ATTACKS.heavy.impact
        : DODGE_ATTACKS.light.impact
      : impact.kind === 'strike'
        ? STRIKE.impact
        : (LIGHT_COMBO[impact.step - 1]?.impact ?? 0);
    const lookBack = began + LAG_COMPENSATION_TICKS;

    // A skeleton in front comes before anything else: mid-fight, the swing
    // was for it, not the tree beside it.
    if (this.raids.blowLands(runtime.netId, position, aimYaw, impact, lookBack)) {
      runtime.lastCombatTick = this.tick;
      return;
    }

    if (this.isActiveItem(runtime, 'axe')) {
      const tree = this.treeInReachOf(position, aimYaw);
      if (tree !== null) {
        this.chopTree(runtime, tree, charged, position);
        return;
      }
    }

    if (this.isActiveItem(runtime, 'shovel') && this.digAhead(runtime, position, aimYaw, charged))
      return;

    const animalTarget = this.animalInReachOf(position, aimYaw, lookBack);
    if (animalTarget !== null)
      this.catchAnimal(
        runtime,
        animalTarget.id,
        charged,
        impact.dodge ? (charged ? 3 : 2) : undefined,
      );
  }

  /**
   * One swing of the shovel: carve the metre cube of ground ahead (a light
   * swing, level, or the cube above once that is open) or a half-metre lower
   * (a charged one, down a ramp), keep what it
   * turns up, and tell everybody. Returns false when there was nothing to dig
   * or it is not allowed, so the swing can still be for an animal.
   */
  private digAhead(
    runtime: PlayerRuntime,
    position: Readonly<Vec3>,
    aimYaw: number,
    down: boolean,
  ): boolean {
    const dig = planDig(position, aimYaw, down, this.dug);
    const near = (x: number, z: number, margin: number): boolean =>
      overlapsWater(this.keepOutWater, x, z, margin);
    if (digRefusal(dig, this.dug, this.collision.terrain, near, this.builtProps) !== null)
      return false;
    const solid = this.dug.solidCubes(dig).length;
    if (solid === 0) return false;
    const x = (dig.ix + 0.5) * 0.5;
    const z = (dig.iz + 0.5) * 0.5;
    const found = digYield(this.seed, dig, solid, this.collision.terrain.heightAt(x, z));
    // A full pack stops the dig, rather than throwing the ground away.
    const first = found[0]!;
    if (roomFor(runtime.inventory, first.item) === 0) return this.refusePickup(runtime, first.item);
    this.dug.apply(dig);
    this.digNews.push(dig);
    for (const { item, count } of found) {
      const taken = addItem(runtime.inventory, item, count);
      if (taken === 0) continue;
      this.collectionEvents.push({
        netId: runtime.netId,
        item,
        count: taken,
        x,
        z,
        depleted: false,
      });
    }
    this.gestureEvents.push({ netId: runtime.netId, gesture: Gesture.Dig, item: null });
    return true;
  }

  /** Every dig made so far, oldest first: what a joining browser replays and the world saves. */
  digsList(): readonly Dig[] {
    return this.dug.digs;
  }

  /** The digs made since this was last asked, so they can be saved and sent. */
  drainDigNews(): Dig[] {
    return this.digNews.splice(0);
  }

  /** Put saved digs back after the world wakes. Anything out of range is ignored. */
  restoreDigs(saved: Iterable<Dig>): void {
    for (const dig of saved) {
      if (this.dug.digs.length >= DIG_MAX_COUNT) break;
      const sensible =
        Number.isInteger(dig.ix) &&
        Number.isInteger(dig.iy) &&
        Number.isInteger(dig.iz) &&
        Math.abs(dig.ix) < 2000 &&
        Math.abs(dig.iz) < 2000 &&
        dig.dir >= 0 &&
        dig.dir <= 4;
      if (sensible) this.dug.apply(dig);
    }
  }

  /** One blow of the axe into a tree, or the one that brings it down. */
  private chopTree(
    runtime: PlayerRuntime,
    target: ChopTarget,
    charged: boolean,
    position: Readonly<Vec3>,
  ): void {
    const state = this.treeState(target.prop.id);
    const weight = this.equippedItemOf(runtime.netId) === 'refinedAxe' ? 2 : 1;
    const swingsTaken = charged ? target.rule.swingsToFell : state.swingsTaken + weight;
    const swingsLeft = Math.max(0, target.rule.swingsToFell - swingsTaken);

    if (swingsLeft > 0) {
      state.swingsTaken = swingsTaken;
      this.treeChanges.add(target.prop.id);
      this.chopEvents.push({
        netId: runtime.netId,
        treeId: target.prop.id,
        swingsLeft,
        logsGained: 0,
      });
      return;
    }

    this.advanceExpedition(runtime, { kind: 'chop' }, 1);
    this.fellTree(target.prop.id, this.nowMs);
    state.fallYaw = treeFallYaw(target.prop, position);
    const landsAt = this.nowMs + treeFallTimes(target.prop).break * 1000;
    for (const spot of treeLogSpots(target.prop, state.fallYaw)) {
      const clear = this.reachableLogSpot(spot, position);
      this.addPile('log', 1, clear.x, clear.z, landsAt, true);
    }
    this.chopEvents.push({
      netId: runtime.netId,
      treeId: target.prop.id,
      swingsLeft: 0,
      logsGained: 0,
    });
  }

  /** Nudge a piece out of water, trees or buildings so the wood can always be collected. */
  private reachableLogSpot(
    spot: { x: number; z: number },
    cutter: Readonly<Vec3>,
  ): { x: number; z: number } {
    // Worked out once: the search below tries up to a hundred spots, all close to this one.
    const footprints = this.buildFootprints(undefined, true, {
      x: spot.x,
      z: spot.z,
      reach: LOG_SEARCH_REACH,
    });
    if (this.dropSpotIsClear(spot.x, spot.z, footprints)) return spot;
    for (let radius = 0.5; radius <= 4; radius += 0.5) {
      for (let direction = 0; direction < 12; direction++) {
        const angle = (direction / 12) * Math.PI * 2;
        const x = spot.x + Math.sin(angle) * radius;
        const z = spot.z + Math.cos(angle) * radius;
        if (this.dropSpotIsClear(x, z, footprints)) return { x, z };
      }
    }
    return { x: cutter.x, z: cutter.z };
  }

  /**
   * Climb into the nearest boat that is close enough and has nobody in it
   * (see decision 0093): anybody's, not only their own. They are put in the
   * middle of the boat, facing out over its bow, and from here on the boat
   * is carried wherever they row.
   */
  private tryBoardBoat(runtime: PlayerRuntime, motion: PlayerMotion): boolean {
    if (runtime.health <= 0 || runtime.cast !== null || runtime.boatId !== null) return false;
    // Frozen in the ice until spring.
    if (this.lakeFrozen) return false;
    let nearest: BuiltProp | null = null;
    let nearestDistance = Infinity;
    for (const prop of this.builtProps) {
      if (prop.kind !== 'rowboat' || prop.rower !== undefined || prop.locked === true) continue;
      if (!isWithinBoardingReach(motion.position, prop)) continue;
      const distance = Math.hypot(motion.position.x - prop.x, motion.position.z - prop.z);
      if (distance < nearestDistance) {
        nearest = prop;
        nearestDistance = distance;
      }
    }
    if (nearest === null) return false;

    nearest.rower = runtime.netId;
    runtime.boatId = nearest.id;
    runtime.interactSpent = true;
    this.boatChanges.add(nearest.id);
    motion.position.x = nearest.x;
    motion.position.y = LAKE.level;
    motion.position.z = nearest.z;
    motion.velocity.x = 0;
    motion.velocity.y = 0;
    motion.velocity.z = 0;
    motion.facingYaw = riderFacingFor(nearest.yaw);
    motion.grounded = true;
    beginAction(runtime.action, ActionKind.Row);
    return true;
  }

  /**
   * Step out of the boat onto the bank, if it is close enough to one. The
   * boat stays exactly where it is, for whoever comes next.
   */
  private tryClimbOut(runtime: PlayerRuntime, motion: PlayerMotion): boolean {
    const boat = this.boatOf(runtime);
    if (boat === undefined) return false;
    const bank = landingFrom(motion.position.x, motion.position.z);
    if (bank === null) return false;

    this.carryBoat(runtime, motion.position, motion.facingYaw);
    this.releaseBoat(runtime, boat);
    motion.position.x = bank.x;
    motion.position.z = bank.z;
    // Still in the middle of a lake's worth of trees or rocks is possible,
    // if rarely: the same push-out as any walk.
    motion.position.y = this.collision.terrain.heightAt(bank.x, bank.z);
    resolveCapsule(motion.position, PLAYER_RADIUS, PLAYER_HEIGHT, this.collision);
    motion.position.y = this.collision.terrain.heightAt(motion.position.x, motion.position.z);
    motion.velocity.x = 0;
    motion.velocity.y = 0;
    motion.velocity.z = 0;
    motion.grounded = true;
    // Facing the way they stepped, not back out over the water.
    motion.facingYaw = Math.atan2(bank.towardX, bank.towardZ) + Math.PI;
    runtime.interactSpent = true;
    return true;
  }

  /**
   * Put the boat ashore and its rider on the bank, wherever they are: for a
   * player who leaves the game, or is knocked out, in the middle of the
   * lake. The boat is moved in beside the nearest shore, lying along it, and
   * left there.
   */
  private putBoatAshore(runtime: PlayerRuntime): void {
    const boat = this.boatOf(runtime);
    const position = runtime.entity.get(Position);
    if (boat === undefined || position === undefined) {
      runtime.boatId = null;
      return;
    }
    const bank = landingBeside(position.x, position.z);
    const berth = beachedBoat(position.x, position.z);
    boat.x = berth.x;
    boat.z = berth.z;
    boat.yaw = berth.yaw;
    this.releaseBoat(runtime, boat);
    const height = this.collision.terrain.heightAt(bank.x, bank.z);
    this.placePlayer(
      runtime.netId,
      { x: bank.x, y: height, z: bank.z },
      Math.atan2(bank.towardX, bank.towardZ) + Math.PI,
    );
  }

  /** The boat somebody is rowing, if they are rowing one. */
  private boatOf(runtime: PlayerRuntime): BuiltProp | undefined {
    return runtime.boatId === null ? undefined : this.builtPropsById.get(runtime.boatId);
  }

  /** Nobody is rowing this boat any more: it stays where it is. */
  private releaseBoat(runtime: PlayerRuntime, boat: BuiltProp): void {
    delete boat.rower;
    runtime.boatId = null;
    this.boatChanges.add(boat.id);
    beginAction(runtime.action, ActionKind.Idle);
  }

  /**
   * The boat goes where its rider goes: its middle under them, its bow the
   * way they face. It is only told to everybody else when somebody climbs in
   * or out (see `drainBoatChanges`) - while it is being rowed, the rider's
   * own position is how everybody sees it.
   */
  private carryBoat(runtime: PlayerRuntime, position: Readonly<Vec3>, facingYaw: number): void {
    const boat = this.boatOf(runtime);
    if (boat === undefined) return;
    boat.x = position.x;
    boat.z = position.z;
    boat.yaw = boatYawFor(facingYaw);
  }

  /**
   * Where in the year this world is (decision 0089): worked out from the
   * world's own clock - the ticks it has run, which is the time everybody is
   * told - plus a whole number of days when a test asked for a season.
   */
  calendar(): Calendar {
    return calendarAt(this.seed, this.tick * TICK_MILLISECONDS + this.calendarShiftMs);
  }

  /** Push the calendar on by this many milliseconds, a whole number of days, to see a season while testing. */
  setCalendarShift(shiftMs: number): void {
    this.calendarShiftMs = shiftMs;
    this.lakeUnchecked = true;
  }

  /** Is the lake frozen over right now? */
  isLakeFrozen(): boolean {
    return this.lakeFrozen;
  }

  /**
   * Whether the calendar says the lake is frozen, which is what a browser that
   * is just arriving should be told: the first tick of a world that has only
   * just woken has not yet frozen it.
   */
  lakeFrozenByCalendar(): boolean {
    return lakeIsFrozen(this.calendar());
  }

  /**
   * Where a saved player stands again. Somebody who logged out on the ice and
   * comes back after it has thawed is put on the nearest shore instead of in
   * the water (decision 0095).
   */
  private savedSpot(saved: PersistedPlayer): Vec3 {
    const overTheLake = lakeDepthAt(LAKE, saved.x, saved.z) > -PLAYER_RADIUS;
    if (!overTheLake || this.lakeFrozenByCalendar()) return { x: saved.x, y: saved.y, z: saved.z };
    const shore = landingBeside(saved.x, saved.z);
    return { x: shore.x, y: this.collision.terrain.heightAt(shore.x, shore.z), z: shore.z };
  }

  /**
   * The lake as a cast line, a boat or a mooring sees it: open water, or
   * nothing at all while it is frozen (decision 0095).
   */
  private openLake(): typeof LAKE | null {
    return this.lakeFrozen ? null : LAKE;
  }

  /** Once a second, and at the very start: freeze or thaw the lake when the calendar says so. */
  private updateLakeIce(): void {
    if (!this.lakeUnchecked && this.tick % TICK_HZ !== 0) return;
    this.lakeUnchecked = false;
    const frozen = lakeIsFrozen(this.calendar());
    if (frozen === this.lakeFrozen) return;
    this.lakeFrozen = frozen;
    this.lakeFreezeChange = frozen;
    setLakeFrozen(this.collision, frozen);
    for (const runtime of this.players.values()) {
      if (frozen) this.stepOntoIce(runtime);
      else this.washAshore(runtime);
    }
  }

  /**
   * The lake froze under somebody rowing: the boat stays where it is, stuck
   * in the ice until spring, and they step out onto the ice beside it.
   */
  private stepOntoIce(runtime: PlayerRuntime): void {
    const boat = this.boatOf(runtime);
    const position = runtime.entity.get(Position);
    const facing = runtime.entity.get(Facing);
    if (boat === undefined || position === undefined || facing === undefined) return;
    this.carryBoat(runtime, position, facing.yaw);
    this.releaseBoat(runtime, boat);
    // Out over the side of the boat: its beam runs square to its length.
    const x = boat.x + Math.sin(boat.yaw) * BOAT_ICE_STEP_OUT;
    const z = boat.z + Math.cos(boat.yaw) * BOAT_ICE_STEP_OUT;
    this.placePlayer(runtime.netId, { x, y: this.collision.terrain.heightAt(x, z), z }, facing.yaw);
  }

  /**
   * The ice has gone: anybody still out on the lake is put on the nearest
   * shore, without being woken, stood up or told to get off whatever they
   * were doing.
   */
  private washAshore(runtime: PlayerRuntime): void {
    const position = runtime.entity.get(Position);
    if (position === undefined || runtime.space !== OUTDOORS) return;
    if (lakeDepthAt(LAKE, position.x, position.z) <= -PLAYER_RADIUS) return;
    const shore = landingBeside(position.x, position.z);
    runtime.entity.set(Position, {
      x: shore.x,
      y: this.collision.terrain.heightAt(shore.x, shore.z),
      z: shore.z,
    });
    runtime.entity.set(Velocity, { x: 0, y: 0, z: 0 });
  }

  /** The lake freezing or thawing since this was last asked, or null if it did neither. */
  drainLakeFreezeChange(): boolean | null {
    const change = this.lakeFreezeChange;
    this.lakeFreezeChange = null;
    return change;
  }

  /**
   * Hand over every rowboat somebody has climbed into or out of since this
   * was last asked, as it is now - for broadcasting the built pieces again
   * and saving where it was left.
   */
  drainBoatChanges(): BuiltProp[] {
    const changed: BuiltProp[] = [];
    for (const id of this.boatChanges) {
      const boat = this.builtPropsById.get(id);
      if (boat !== undefined) changed.push(boat);
    }
    this.boatChanges.clear();
    return changed;
  }

  /**
   * A player has been knocked out and wakes in bed. Any boat of theirs that
   * nobody is rowing and that is left on an island, where they cannot walk
   * back to it, falls apart where it lies into half its materials for
   * anybody to pick up - so they are free to build another (decision 0094).
   * A boat on the mainland shore stays put.
   */
  private breakUpStrandedBoats(runtime: PlayerRuntime): void {
    // Over the ice, any island can be walked to.
    if (runtime.playerKey === null || this.lakeFrozen) return;
    const owned: BuiltProp[] = [];
    for (const [id, owner] of this.ownedBuiltProps) {
      if (owner !== runtime.playerKey) continue;
      const prop = this.builtPropsById.get(id);
      if (prop !== undefined && prop.kind === 'rowboat' && prop.rower === undefined)
        owned.push(prop);
    }
    for (const boat of owned) {
      const shore = landingBeside(boat.x, boat.z);
      if (!shore.onIsland) continue;
      this.removeBoat(boat);
      boatSalvage().forEach((part, index) =>
        this.addPile(part.item, part.count, shore.x + index * 0.3, shore.z, this.nowMs),
      );
    }
  }

  /** Take a boat out of the world altogether. */
  private removeBoat(boat: BuiltProp): void {
    this.detachBuiltProp(boat);
    this.brokenBoats.push(boat.id);
  }

  /** Forget a built prop everywhere the simulation keeps track of one. */
  private detachBuiltProp(prop: BuiltProp): void {
    const index = this.builtProps.indexOf(prop);
    if (index >= 0) this.builtProps.splice(index, 1);
    this.builtPropsById.delete(prop.id);
    this.ownedBuiltProps.delete(prop.id);
    this.abandonedUntilMs.delete(prop.id);
    this.campfireLitUntilMs.delete(prop.id);
    this.boatChanges.delete(prop.id);
  }

  /** Hand over the id of every boat that has fallen apart since this was last asked. */
  drainBrokenBoats(): number[] {
    return this.brokenBoats.splice(0);
  }

  /**
   * A character has been deleted (decision 0108). Everything they built stays
   * standing but is locked for everybody, owned by nobody, until
   * `removeExpiredBuilds` takes it all away together at `nowMs + lifetimeMs`.
   * What is only theirs to find again - buried caches, and piles set aside
   * for them alone - goes at once, since nobody could ever collect it.
   *
   * Does not touch the player themself: the game server lets their
   * connection go and forgets their saved character separately.
   */
  forgetCharacter(playerKey: string, nowMs: number, lifetimeMs: number): ForgottenCharacter {
    const expiresAtMs = nowMs + lifetimeMs;
    const abandoned: { prop: BuiltProp; expiresAtMs: number }[] = [];
    for (const [id, owner] of [...this.ownedBuiltProps]) {
      if (owner !== playerKey) continue;
      const prop = this.builtPropsById.get(id);
      if (prop === undefined) continue;
      this.ownedBuiltProps.set(id, ABANDONED_OWNER);
      this.abandonedUntilMs.set(id, expiresAtMs);
      prop.locked = true;
      if (BUILDABLE_KINDS[prop.kind].isHome) this.sendVisitorsOutside(prop);
      abandoned.push({ prop, expiresAtMs });
    }

    const cacheIds: number[] = [];
    for (let index = this.buriedCaches.length - 1; index >= 0; index--) {
      const cache = this.buriedCaches[index];
      if (cache === undefined || cache.ownerPlayerKey !== playerKey) continue;
      this.buriedCaches.splice(index, 1);
      cacheIds.push(cache.id);
    }

    for (let index = this.droppedPiles.length - 1; index >= 0; index--) {
      const pile = this.droppedPiles[index];
      if (pile === undefined || pile.ownerKey !== playerKey) continue;
      this.droppedPiles.splice(index, 1);
      this.pendingPiles.delete(pile.id);
      this.pileChanges.add(pile.id);
    }

    return { abandoned, cacheIds };
  }

  /**
   * Take away every abandoned build whose time is up, and hand back the ids
   * of what went, for storage to forget and everybody to be told.
   *
   * Called with real time, the same reason `extinguishBurnedOutCampfires` is:
   * a world with nobody in it does not tick, so on waking, anything that
   * should have gone while nobody was here goes at once. A boat somebody is
   * still rowing goes the moment they climb out.
   */
  removeExpiredBuilds(nowMs: number): number[] {
    for (const [id, dueAt] of [...this.abandonedUntilMs]) {
      if (nowMs < dueAt) continue;
      const prop = this.builtPropsById.get(id);
      if (prop === undefined) {
        this.abandonedUntilMs.delete(id);
        continue;
      }
      if (prop.rower !== undefined) continue;
      this.removeAbandonedBuild(prop);
    }
    return this.removedBuilds.splice(0);
  }

  /** When this abandoned build disappears, or null for anything that is not abandoned. */
  abandonedUntilMsFor(propId: number): number | null {
    return this.abandonedUntilMs.get(propId) ?? null;
  }

  private removeAbandonedBuild(prop: BuiltProp): void {
    if (BUILDABLE_KINDS[prop.kind].isHome) {
      this.sendVisitorsOutside(prop);
      const solid = this.homeSolids.get(prop.id);
      if (solid !== undefined) {
        this.collision.colliders.splice(this.collision.colliders.indexOf(solid), 1);
        this.homeSolids.delete(prop.id);
      }
      this.homeChests.delete(prop.id);
      this.homeGardens.delete(prop.id);
      this.decorations = this.decorations.filter((piece) => piece.homeId !== prop.id);
      this.decoratedHomes.delete(prop.id);
      this.decoratedRooms.delete(prop.id);
    }
    this.detachBuiltProp(prop);
    this.removedBuilds.push(prop.id);
  }

  /** Put anybody inside this home back out on its doorstep, and tell them. */
  private sendVisitorsOutside(home: BuiltProp): void {
    const doorstep = cabinDoorstep(home);
    const y = this.collision.terrain.heightAt(doorstep.x, doorstep.z);
    for (const visitor of this.players.values()) {
      if (visitor.space !== home.id) continue;
      if (visitor.cast !== null) this.endCast(visitor, { outcome: 'walkedAway' });
      this.placePlayer(visitor.netId, { x: doorstep.x, y, z: doorstep.z }, doorstep.yaw);
      visitor.doorCooldownTicks = DOOR_COOLDOWN_TICKS;
      this.spaceChanges.push({
        netId: visitor.netId,
        space: OUTDOORS,
        x: doorstep.x,
        z: doorstep.z,
        yaw: doorstep.yaw,
      });
    }
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
  private catchAnimal(
    runtime: PlayerRuntime,
    animalId: number,
    charged: boolean,
    dodgeWeight?: number,
  ): void {
    const animal = this.animals.get(animalId);
    if (animal === undefined || animal.caught || animal.kind === 'curiousRaccoon') return;
    const kind: AnimalKind = ANIMAL_KINDS[animal.kind];
    animal.damageHelpers.add(runtime.netId);
    if (
      kind.threat !== undefined &&
      (dodgeWeight !== undefined || !charged || animal.kind === 'woodlandGuardian')
    ) {
      animal.hitsTaken += dodgeWeight ?? (charged ? 2 : 1);
      const hitsLeft = kind.threat.hitsToDefeat - animal.hitsTaken;
      if (hitsLeft > 0) {
        this.threatHitEvents.push({ animalId: animal.id, hitsLeft, netId: runtime.netId });
        return;
      }
    }

    animal.caught = true;
    animal.respawnAtMs = this.nowMs + ANIMAL_RESPAWN_SECONDS * 1000;
    animal.hitsTaken = 0;
    if (animal.kind === 'woodlandGuardian') {
      const at = animal.entity.get(Position);
      for (const netId of animal.damageHelpers) {
        const helper = this.players.get(netId),
          helperAt = helper?.entity.get(Position);
        if (
          helper === undefined ||
          helperAt === undefined ||
          at === undefined ||
          helper.space !== OUTDOORS ||
          helper.health <= 0 ||
          horizontalDistance(at, helperAt) > 24
        )
          continue;
        // The persistent found bit is proof of participation. Visiting the hollow
        // alone never sets this bit, and claiming remains atomic with inventory.
        helper.discoveriesFound |= 1 << 6;
        this.discoveryChanges.set(netId, 'none');
      }
    }
    animal.damageHelpers.clear();

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
    runtime.lastCombatTick = this.tick;
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
      // Out of the boat first, so what they buried is on dry ground.
      this.putBoatAshore(runtime);
      // A boat they can no longer walk back to is not worth keeping (decision 0094).
      this.breakUpStrandedBoats(runtime);
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
    } else if (runtime.boatId === null) {
      // A rower takes the blow, but there is nothing to flinch with: they stay in the boat.
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
      const wake = homeSpot(HOME_WAKE_SPOT, isHomeKind(home.kind) ? home.kind : 'cabin');
      this.placePlayer(runtime.netId, { x: wake.x, y: 0, z: wake.z }, wake.yaw, home.id);
      this.spaceChanges.push({
        netId: runtime.netId,
        space: home.id,
        x: wake.x,
        z: wake.z,
        yaw: wake.yaw,
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

    const spot = castLanding(position, aimYaw, this.clearing.water, this.openLake());
    if (spot === null) return;

    runtime.cast = startCast(
      this.seed,
      this.castCounter++,
      this.tick,
      position,
      spot,
      this.equippedItemOf(runtime.netId) === 'refinedRod' ? 0.75 : 1,
    );
    this.fishingEvents.push({ kind: 'cast', netId: runtime.netId, x: spot.x, z: spot.z });
  }

  /**
   * Place what this player asked for where they asked for it, if they can
   * afford it, the spot is in reach and clear (see `checkBuildSpot`), and -
   * for anything capped to one per player - they do not already have one of
   * that kind.
   */
  private tryBuild(runtime: PlayerRuntime, position: Readonly<Vec3>, request: BuildRequest): void {
    const { kind } = request;
    if (isIndoorOnlyKind(kind) || !fishDisplayLearned(kind, runtime.fishRecords)) return;
    if (kind === 'trailPennant' && !(runtime.expedition.cosmetics & TRAIL_PENNANT_SKILL)) return;
    const buildable = BUILDABLE_KINDS[kind];
    const refuse = (reason: HomeBuildReason): void => {
      if (isHomeKind(kind))
        this.homeBuildFeedback.push({ netId: runtime.netId, kind, homeId: 0, reason });
    };
    if (runtime.swingCooldownTicks > 0) return refuse('busy');
    const ownedHome = runtime.playerKey === null ? null : this.homeOf(runtime.playerKey);
    const available =
      isHomeKind(kind) && ownedHome !== null
        ? combineHomeSupplies(runtime.inventory, this.homeSuppliesOf(runtime.netId).items)
        : runtime.inventory;
    if (!canAfford(available, buildable)) return refuse('materials');
    const otherHomes = this.builtProps.filter(
      (prop) => isHomeKind(prop.kind) && prop.id !== ownedHome?.id,
    );
    const proposedPiece = buildableFootprint(kind, request.x, request.z, request.yaw);
    // A boat floats on the lake, so the ground under it is the lake bed and
    // it is nobody's home boundary: its own mooring rule says where it fits.
    const isBoat = kind === 'rowboat';
    if (!isBoat && !buildGroundIsLevel(proposedPiece, this.collision.terrain))
      return refuse('ground');
    if (isHomeKind(kind)) {
      const area = homeBuildArea({ id: ownedHome?.id ?? 0, kind, x: request.x, z: request.z });
      if (
        area === null ||
        checkHomeBuildArea(area, otherHomes, this.protectedBuildSites()) !== null
      )
        return refuse('area');
    } else if (
      !isBoat &&
      checkPieceBuildArea(proposedPiece, ownedHome, otherHomes, this.protectedBuildSites()) !== null
    )
      return;

    if (buildable.isHome) {
      if (runtime.playerKey === null || !isHomeKind(kind)) return refuse('identity');
      if (!knowsHome(runtime.homeSkills, kind)) return refuse('blueprint');
      const home = this.homeOf(runtime.playerKey);
      if (home !== null) {
        if (!isHomeKind(home.kind) || nextHome(home.kind) !== kind) return refuse('tier');
        if (
          Math.hypot(request.x - home.x, request.z - home.z) > 0.05 ||
          Math.abs(request.yaw - home.yaw) > 0.01
        )
          return refuse('moved');
        if ([...this.players.values()].some((player) => player.space === home.id))
          return refuse('occupied');
        const furnishings = this.decorations.filter((piece) => piece.homeId === home.id);
        if (
          furnishings.some(
            (piece) =>
              checkDecorationSpot(kind, piece, furnishings, {
                x: piece.x + BUILDABLE_KINDS[piece.kind].footprintRadius + PLAYER_RADIUS + 0.2,
                z: piece.z,
              }) !== null,
          )
        )
          return refuse('blocked');
        const piece = buildableFootprint(kind, home.x, home.z, home.yaw);
        if (
          checkBuildSpot(
            piece,
            position,
            BUILD_REACH + BUILD_REACH_SLACK,
            this.keepOutWater,
            this.buildFootprints(home.id, true),
            true,
          ) !== null
        )
          return refuse('blocked');
        for (const other of this.players.values()) {
          if (other.space !== OUTDOORS || other === runtime) continue;
          const at = other.entity.get(Position);
          if (
            at !== undefined &&
            Math.hypot(at.x - home.x, at.z - home.z) < piece.radius + PLAYER_RADIUS
          )
            return refuse('player');
        }
        const chest = this.homeChests.get(home.id) ?? emptyChest();
        if (!payHomeUpgrade(runtime.inventory, chest, buildable.costs)) return refuse('materials');
        this.homeChests.set(home.id, chest);
        runtime.swingCooldownTicks = SWING_COOLDOWN_TICKS;
        const upgraded = { ...home, kind };
        const index = this.builtProps.indexOf(home);
        this.builtProps[index] = upgraded;
        this.builtPropsById.set(home.id, upgraded);
        const oldCollider = this.homeSolids.get(home.id);
        if (oldCollider !== undefined)
          this.collision.colliders.splice(this.collision.colliders.indexOf(oldCollider), 1);
        this.addHomeSolid(upgraded);
        this.movePatchesFrom(piece);
        this.buildEvents.push({
          netId: runtime.netId,
          prop: upgraded,
          ownerKey: runtime.playerKey,
        });
        this.expeditionChanges.set(runtime.netId, 'none');
        this.homeBuildFeedback.push({ netId: runtime.netId, kind, homeId: home.id, reason: null });
        return;
      }
      if (kind !== 'tent') return refuse('tier');
    }
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
      this.keepOutWater,
      this.buildFootprints(undefined, true),
      true,
      this.lakeFrozen,
    );
    if (refusal !== null) return refuse('blocked');

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
    if (buildable.isHome) {
      this.addHomeSolid(prop);
      this.expeditionChanges.set(runtime.netId, 'none');
    }
    this.movePatchesFrom(piece);
    const ownerKey = runtime.playerKey;
    if (ownerKey !== null) this.ownedBuiltProps.set(prop.id, ownerKey);
    this.buildEvents.push({ netId: runtime.netId, prop, ownerKey });
    if (isHomeKind(kind))
      this.homeBuildFeedback.push({ netId: runtime.netId, kind, homeId: prop.id, reason: null });
    this.gestureEvents.push({ netId: runtime.netId, gesture: Gesture.Reach, item: null });
  }

  /** Everything a new piece has to keep clear of: every tree, rock and stump, and everything built. */
  private protectedBuildSites(): ProtectedBuildSite[] {
    return [
      ...WOODLAND_ENCOUNTERS,
      ...this.discoverySites.map((site) => ({ x: site.x, z: site.z, radius: 8, name: site.kind })),
      ...this.encounterSites.map((site) => ({ x: site.x, z: site.z, radius: 12, name: site.kind })),
    ];
  }

  /**
   * Every tree and rock as a footprint, the clearing's and, if asked, the
   * forest's - or only those within `near.reach` metres either way of a spot,
   * which is all a log or a pile needs and saves a thousand footprints.
   */
  private propFootprints(
    includeWilderness: boolean,
    near?: { x: number; z: number; reach: number },
  ): Footprint[] {
    const footprints: Footprint[] = [];
    const add = (prop: PlacedProp): void => {
      if (
        near !== undefined &&
        (Math.abs(prop.x - near.x) > near.reach || Math.abs(prop.z - near.z) > near.reach)
      )
        return;
      footprints.push(
        roundFootprint(
          prop.x,
          prop.z,
          PROP_KINDS[prop.kind].colliderRadius * prop.scale,
          PROP_KINDS[prop.kind].displayName.toLowerCase(),
        ),
      );
    };
    this.standing.forEach(add);
    if (includeWilderness) this.standingWilderness.forEach(add);
    return footprints;
  }

  private buildFootprints(
    excludeId?: number,
    includeWilderness = false,
    near?: { x: number; z: number; reach: number },
  ): Footprint[] {
    return [
      ...this.propFootprints(includeWilderness, near),
      ...this.builtProps
        .filter((built) => built.id !== excludeId)
        .map((built) => buildableFootprint(built.kind, built.x, built.z, built.yaw)),
      // Nothing is moored on top of the mature reeds that are cut for rope.
      ...reedFootprints(
        this.patches.filter((patch) => isReedPatch(patch.id) && patch.remaining > 0),
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
    if (runtime.reel !== null) {
      if (Math.hypot(position.x - cast.fromX, position.z - cast.fromZ) > FISHING_LEASH)
        this.endCast(runtime, { outcome: 'walkedAway' });
      else if (this.tick > runtime.reel.giveUpTick) this.endCast(runtime, { outcome: 'tooLate' });
      return;
    }
    const progress = tickCast(cast, this.tick, position);
    if (progress.bit) this.fishingEvents.push({ kind: 'bite', netId: runtime.netId });
    if (progress.end !== null) this.endCast(runtime, progress.end);
  }

  /** One of the angler's inputs: did they click, and did they see the bite? */
  private readLine(runtime: PlayerRuntime, cast: Cast, input: CastInput): void {
    if (runtime.reel !== null) {
      if (!input.sawBite && input.seq > runtime.reel.lastSeq)
        runtime.reel.giveUpTick = this.tick + 20 * TICK_HZ;
      const end = readRareReel(runtime.reel, input);
      this.reelChanges.set(runtime.netId, {
        age: runtime.reel.age,
        hits: runtime.reel.hits,
        misses: runtime.reel.misses,
      });
      if (end !== null)
        this.endCast(
          runtime,
          end === 'caught' ? { outcome: 'caught', item: 'goldenCarp' } : { outcome: end },
        );
      return;
    }
    const end = readCastInput(cast, this.seed, this.tick, input);
    if (end?.outcome === 'caught' && end.item === 'goldenCarp') {
      runtime.reel = startRareReel(this.tick);
      this.reelChanges.set(runtime.netId, { age: 0, hits: 0, misses: 0 });
    } else if (end !== null) this.endCast(runtime, end);
  }

  /** The line comes in, with or without a fish, and everybody hears how. */
  private endCast(runtime: PlayerRuntime, end: CastEnd): void {
    const castNumber = runtime.cast?.castNumber ?? 0;
    runtime.cast = null;
    runtime.reel = null;
    this.reelChanges.delete(runtime.netId);
    runtime.swingCooldownTicks = CAST_COOLDOWN_TICKS;

    if (end.outcome === 'caught') {
      // Hooked either way; a full pack means it goes back in the water.
      const added = addItem(runtime.inventory, end.item);
      recordFish(runtime.fishRecords, end.item, this.seed, castNumber, this.tick);
      this.fishRecordChanges.add(runtime.netId);
      this.advanceExpedition(runtime, { kind: 'fish' }, 1);
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
    this.treeChanges.add(treeId);

    const slot = this.treeSlots.get(treeId);
    const tree = slot === undefined ? undefined : this.standingAt(slot);
    if (slot === undefined || tree === undefined) return;
    replaceCollider(this.collision, slot.colliderIndex, stumpColliderFor(tree));
  }

  /** The prop standing in this slot now, which is not the one the seed laid out once a tree has grown back. */
  private standingAt(slot: TreeSlot): PlacedProp | undefined {
    return (slot.wilderness ? this.standingWilderness : this.standing)[slot.index];
  }

  /** The prop the seed laid out in this slot. */
  private originalAt(slot: TreeSlot): PlacedProp | undefined {
    return (slot.wilderness ? this.wilderness.props : this.clearing.props)[slot.index];
  }

  private standIn(slot: TreeSlot, prop: PlacedProp): void {
    (slot.wilderness ? this.standingWilderness : this.standing)[slot.index] = prop;
  }

  /**
   * Put a tree back, at whatever size this generation of it is.
   *
   * Both the thing you bump into and the thing reach is measured against have
   * to agree it is a tree again, and agree about how big.
   */
  private growTree(treeId: number, state: TreeState): void {
    state.felled = false;
    state.fallYaw = null;
    state.swingsTaken = 0;
    state.generation = nextGeneration(state.generation);
    this.treeChanges.add(treeId);

    const slot = this.treeSlots.get(treeId);
    const original = slot === undefined ? undefined : this.originalAt(slot);
    if (slot === undefined || original === undefined) return;

    const grown = treeAtGeneration(this.seed, original, state.generation);
    this.standIn(slot, grown);
    replaceCollider(this.collision, slot.colliderIndex, colliderForProp(grown));
    this.regrowthEvents.push({ treeId, generation: state.generation });
  }

  private treeState(treeId: number): TreeState {
    const existing = this.trees.get(treeId);
    if (existing !== undefined) return existing;
    const fresh: TreeState = {
      swingsTaken: 0,
      felled: false,
      felledAtMs: 0,
      generation: 0,
      fallYaw: null,
    };
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

      const slot = this.treeSlots.get(treeId);
      const original = slot === undefined ? undefined : this.originalAt(slot);
      if (slot === undefined || original === undefined) continue;

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
    const target = treeInReach(position, aimYaw, this.standing, (id) => this.isFelled(id));
    const further = treeInReach(position, aimYaw, this.standingWilderness, (id) =>
      this.isFelled(id),
    );
    if (target === null || further === null) return target ?? further;
    // The clearing's trees and the forest's are separate lists; the nearer one wins.
    return Math.hypot(further.prop.x - position.x, further.prop.z - position.z) <
      Math.hypot(target.prop.x - position.x, target.prop.z - position.z)
      ? further
      : target;
  }

  isFelled(treeId: number): boolean {
    return this.trees.get(treeId)?.felled === true;
  }

  /** The animal this player would catch if they swung, or null. Used by tests. */
  animalInReachOf(position: Readonly<Vec3>, aimYaw: number, ticksBack = 0): CatchTarget | null {
    const candidates: CatchCandidate[] = [];
    for (const runtime of this.animals.values()) {
      if (runtime.caught || runtime.kind === 'curiousRaccoon') continue;
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
    const slot = this.treeSlots.get(treeId);
    const tree = slot === undefined ? undefined : this.standingAt(slot);
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

  /**
   * What the client needs to draw the trees that are not as the seed left
   * them: every one, or only the ids asked for - the trees a change just
   * touched, so one swing of an axe does not resend the whole forest.
   */
  changedTrees(
    only?: Iterable<number>,
  ): Array<{ treeId: number; generation: number; felled: boolean; fall?: TreeFall }> {
    const changed: Array<{ treeId: number; generation: number; felled: boolean; fall?: TreeFall }> =
      [];
    for (const [treeId, state] of this.treesOf(only)) {
      if (!state.felled && state.generation === 0) continue;
      changed.push({
        treeId,
        generation: state.generation,
        felled: state.felled,
        ...(state.felled && state.fallYaw !== null
          ? { fall: { yaw: state.fallYaw, startedAtMs: state.felledAtMs } }
          : {}),
      });
    }
    return changed;
  }

  /**
   * Everything worth saving about the trees - or only the ids asked for.
   * Untouched trees are not saved.
   */
  persistableTrees(only?: Iterable<number>): PersistedTree[] {
    const saved: PersistedTree[] = [];
    for (const [treeId, state] of this.treesOf(only)) {
      if (!state.felled && state.swingsTaken === 0 && state.generation === 0) continue;
      saved.push({
        treeId,
        swingsTaken: state.swingsTaken,
        felled: state.felled,
        felledAtMs: state.felledAtMs,
        generation: state.generation,
        fallYaw: state.fallYaw,
      });
    }
    return saved;
  }

  /** The trees the caller asked about, or every tree anybody has touched. */
  private treesOf(only?: Iterable<number>): Iterable<[number, TreeState]> {
    if (only === undefined) return this.trees;
    const found: Array<[number, TreeState]> = [];
    for (const treeId of only) {
      const state = this.trees.get(treeId);
      if (state !== undefined) found.push([treeId, state]);
    }
    return found;
  }

  /**
   * Which trees were chopped, felled or grown back since this was last asked.
   *
   * A forest has over a thousand trees and a world saves and sends only what
   * changed: asking hands the list over and starts it afresh.
   */
  drainTreeChanges(): number[] {
    const ids = [...this.treeChanges];
    this.treeChanges.clear();
    return ids;
  }

  /** Put the trees back as they were after the world wakes from storage. */
  restoreTrees(trees: Iterable<PersistedTree>): void {
    for (const tree of trees) {
      const state = this.treeState(tree.treeId);
      state.generation = tree.generation;
      state.swingsTaken = tree.swingsTaken;
      state.fallYaw = tree.fallYaw ?? null;

      const slot = this.treeSlots.get(tree.treeId);
      const original = slot === undefined ? undefined : this.originalAt(slot);
      if (slot !== undefined && original !== undefined && tree.generation > 0) {
        const grown = treeAtGeneration(this.seed, original, tree.generation);
        this.standIn(slot, grown);
        replaceCollider(this.collision, slot.colliderIndex, colliderForProp(grown));
      }

      if (tree.felled) this.fellTree(tree.treeId, tree.felledAtMs);
    }
    // What was just read back is already saved; only later changes are news.
    this.treeChanges.clear();
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
   *
   * `expiresAtMs` is the same kind of thing for a build left behind by a
   * deleted character: when it disappears. Absent, like null, for everything
   * still in use.
   */
  restoreBuiltProps(
    props: Iterable<
      BuiltProp & {
        readonly ownerKey: string | null;
        readonly litUntilMs: number | null;
        readonly expiresAtMs?: number | null;
      }
    >,
  ): void {
    for (const { ownerKey, litUntilMs, expiresAtMs, ...prop } of props) {
      this.builtProps.push(prop);
      this.builtPropsById.set(prop.id, prop);
      if (BUILDABLE_KINDS[prop.kind].isHome) this.addHomeSolid(prop);
      this.nextBuiltPropId = Math.max(this.nextBuiltPropId, prop.id + 1);
      if (ownerKey !== null) this.ownedBuiltProps.set(prop.id, ownerKey);
      if (litUntilMs !== null) this.campfireLitUntilMs.set(prop.id, litUntilMs);
      if (expiresAtMs !== undefined && expiresAtMs !== null) {
        this.abandonedUntilMs.set(prop.id, expiresAtMs);
        prop.locked = true;
      }
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
  /** Raids starting and ending, since this was last asked. */
  drainRaidNews(): RaidNews[] {
    return this.raids.drainNews();
  }

  /** Blows that landed on raiders, since this was last asked. */
  drainRaiderHits(): RaiderHit[] {
    return this.raids.drainHits();
  }

  /** Whether any raider turned up, was hit or went, since this was last asked. */
  drainRaidersChanged(): boolean {
    return this.raids.drainListChanged();
  }

  /** Every raider in the world, as the list every browser keeps reads. */
  raidersList(): RaiderView[] {
    return this.raids.raidersList();
  }

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
    const runtime = this.players.get(netId);
    const position = runtime?.entity.get(Position);
    if (runtime === undefined || position === undefined) return null;
    return pickupInReach(position, this.clearing.pickups, (id) => runtime.takenPickups.has(id));
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
  mealStateOf(netId: number): MealState {
    return { ...(this.players.get(netId)?.meal ?? mealFromSaved(null)) };
  }
  drainMealChanges(): ReadonlyMap<number, MealState> {
    const changes = new Map(this.mealChanges);
    this.mealChanges.clear();
    return changes;
  }

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
    const recipe = recipeFor(item);
    if (
      (recipe?.discoveryId !== undefined || recipe?.station !== undefined) &&
      (!isFreeToInteract(runtime.action) || runtime.health <= 0 || runtime.cast !== null)
    )
      return false;
    if (recipe?.station === 'campfire' && !this.nearCookingFireOf(netId)) return false;
    if (recipe?.station === 'workbench' && !this.nearWorkbenchOf(netId)) return false;
    if (!craft(runtime.inventory, item, runtime.discoveriesClaimed)) return false;
    if (
      toolKind(item) !== null &&
      runtime.equippedItem !== null &&
      !hasItem(runtime.inventory, runtime.equippedItem)
    ) {
      runtime.equippedItem = item;
      this.equipEvents.push(netId);
    }

    this.craftEvents.push({ netId, item });
    return true;
  }

  /** Hand over every craft since this was last asked. */
  drainCraftEvents(): CraftedEvent[] {
    return this.craftEvents.splice(0);
  }

  /** Hand over every campfire cook since this was last asked. */
  drainCookingEvents(): CookedEvent[] {
    return this.cookingEvents.splice(0);
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
    if (!hasItem(runtime.inventory, item)) return false;
    const home = blueprintHome(item);
    if (home !== null) {
      if (runtime.health <= 0 || runtime.action.kind !== ActionKind.Idle || runtime.cast !== null)
        return false;
      if (knowsHome(runtime.homeSkills, home)) return false;
      runtime.homeSkills = learnHome(runtime.homeSkills, home);
      removeItem(runtime.inventory, item, 1);
      return true;
    }
    if (!ITEM_KINDS[item].equippable) return false;

    let changed = false;
    if (runtime.equippedItem !== item) {
      runtime.equippedItem = item;
      this.equipEvents.push(netId);
      changed = true;
    }
    const savingForFire = cookedItemFor(item) !== null && this.nearCookingFireOf(netId);
    if (isFood(item) && (runtime.hunger < HUNGER_MAX || isMealItem(item)) && !savingForFire) {
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
    if (runtime.equippedItem !== null && hasItem(runtime.inventory, runtime.equippedItem))
      return runtime.equippedItem;
    // With nothing chosen from the pack, the weapon in the main hand is what
    // they hold, and what a swing is made with (decision 0113).
    return runtime.worn.mainHand ?? null;
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

  /**
   * What they last chose from the pack, if they still hold it - not the
   * weapon in their main hand, which is saved with what they wear.
   */
  packChoiceOf(netId: number): ItemId | null {
    const runtime = this.players.get(netId);
    if (runtime === undefined || runtime.equippedItem === null) return null;
    return hasItem(runtime.inventory, runtime.equippedItem) ? runtime.equippedItem : null;
  }

  /** What this player is wearing, slot by slot. */
  wornOf(netId: number): Readonly<WornGear> {
    return this.players.get(netId)?.worn ?? {};
  }

  /** What every connected player is wearing, for the whole-list broadcast. */
  wornList(): Array<{ netId: number; worn: Readonly<WornGear> }> {
    return [...this.players.values()].map((runtime) => ({
      netId: runtime.netId,
      worn: runtime.worn,
    }));
  }

  /** Who changed what they are wearing since this was last asked. */
  drainWornEvents(): number[] {
    return this.wornEvents.splice(0);
  }

  /**
   * Whether this player is in a fight: mid-swing, charging, rolling or
   * flinching, or has given or taken a blow in the last few seconds, or has a
   * skeleton raider close by. Gear cannot be changed then (decision 0113).
   */
  inCombat(netId: number): boolean {
    const runtime = this.players.get(netId);
    if (runtime === undefined) return false;
    const kind = runtime.action.kind;
    if (
      kind === ActionKind.Swing ||
      kind === ActionKind.Charge ||
      kind === ActionKind.Strike ||
      kind === ActionKind.Dodge ||
      kind === ActionKind.Flinch
    )
      return true;
    if (this.tick - runtime.lastCombatTick < COMBAT_COOLDOWN_TICKS) return true;
    const position = runtime.entity.get(Position);
    if (position === undefined || runtime.space !== OUTDOORS) return false;
    return this.raids.raidersList().some((raider) => {
      const at = this.raids.positionOf(raider.id);
      return at !== null && horizontalDistance(at, position) < COMBAT_RAIDER_RADIUS;
    });
  }

  /** Why gear cannot be changed right now, or null if it can. */
  private gearBlocker(runtime: PlayerRuntime): 'inCombat' | 'busy' | null {
    if (this.inCombat(runtime.netId)) return 'inCombat';
    if (runtime.health <= 0 || runtime.cast !== null || runtime.boatId !== null) return 'busy';
    const kind = runtime.action.kind;
    if (kind === ActionKind.KnockedOut || kind === ActionKind.Rise) return 'busy';
    return null;
  }

  private gearChanged(runtime: PlayerRuntime): void {
    // A weapon put on is what they now hold, ahead of whatever they chose
    // from the pack; and a tool leaving the hand changes what is shown.
    this.wornEvents.push(runtime.netId);
    this.equipEvents.push(runtime.netId);
  }

  /**
   * Put a piece from the pack into a slot. Wearing a weapon in the main hand,
   * or choosing the one already there again, draws it: the hand holds it
   * rather than whatever was picked from the pack.
   */
  wearGear(netId: number, item: ItemId, slot: GearSlot): GearChange {
    const runtime = this.players.get(netId);
    if (runtime === undefined) return { ok: false, reason: 'busy' };
    if (!canWearIn(item, slot)) return { ok: false, reason: 'wrongSlot' };
    const blocker = this.gearBlocker(runtime);
    if (blocker !== null) return { ok: false, reason: blocker };

    // Choosing what is already worn there again draws it, if it is a weapon.
    if (runtime.worn[slot] === item && slot === 'mainHand') {
      runtime.equippedItem = null;
      this.gearChanged(runtime);
      return { ok: true, displaced: null };
    }
    const change = wearGear(runtime.worn, runtime.inventory, item, slot);
    if (!change.ok) return change;
    if (slot === 'mainHand' && isWeapon(item)) runtime.equippedItem = null;
    this.gearChanged(runtime);
    return change;
  }

  /** Take what is in a slot off, back into the pack. */
  takeOffGear(netId: number, slot: GearSlot): GearChange {
    const runtime = this.players.get(netId);
    if (runtime === undefined) return { ok: false, reason: 'busy' };
    const blocker = this.gearBlocker(runtime);
    if (blocker !== null) return { ok: false, reason: blocker };
    const change = takeOffGear(runtime.worn, runtime.inventory, slot);
    if (change.ok) this.gearChanged(runtime);
    return change;
  }

  /** Trade the pieces in two slots, as when one is dragged onto the other. */
  swapGear(netId: number, from: GearSlot, to: GearSlot): GearChange {
    const runtime = this.players.get(netId);
    if (runtime === undefined) return { ok: false, reason: 'busy' };
    const blocker = this.gearBlocker(runtime);
    if (blocker !== null) return { ok: false, reason: blocker };
    const change = swapGear(runtime.worn, from, to);
    if (change.ok) this.gearChanged(runtime);
    return change;
  }

  /**
   * Put one of every piece of gear in the pack, as far as it will fit. Only
   * ever used where the server is set up for testing (`?gear=` in the
   * address), so a preview can try the character screen before gear can be
   * found in the world.
   */
  giveTestGear(netId: number, items: readonly ItemId[]): void {
    const runtime = this.players.get(netId);
    if (runtime === undefined) return;
    for (const item of items) addItem(runtime.inventory, item, 1);
  }

  /** Who gathered a stick since this was last asked, so their pack can be sent. */
  drainGatherEvents(): number[] {
    return this.gatherEvents.splice(0);
  }

  /**
   * The pickups this character has already taken, for telling their browser
   * and for saving. Each character finds their own axe, bag and rod, so
   * somebody else having taken theirs changes nothing here.
   */
  takenPickupIdsOf(netId: number): number[] {
    return [...(this.players.get(netId)?.takenPickups ?? [])];
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
        Number.isFinite(row.emptiedAtMs) &&
        // A bed of reeds can only stand at the edge of the water it belongs to.
        (!isReedPatch(row.id) || isReedSpotFor(row.id, row.x, row.z));
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
  droppedPilesList(viewerNetId?: number): DroppedPileView[] {
    const viewer = viewerNetId === undefined ? undefined : this.players.get(viewerNetId);
    return this.droppedPiles
      .filter(
        (pile) =>
          !this.pendingPiles.has(pile.id) &&
          (viewerNetId === undefined ||
            pile.ownerKey === undefined ||
            (viewer !== undefined && pile.ownerKey === this.rewardOwnerKey(viewer))),
      )
      .map(pileView);
  }

  private rewardOwnerKey(runtime: PlayerRuntime): string {
    return runtime.playerKey ?? `session:${runtime.netId}`;
  }

  fishRecordsOf(netId: number): FishRecords {
    return fishRecordsFromSaved(this.players.get(netId)?.fishRecords);
  }
  drainFishRecordChanges(): number[] {
    const result = [...this.fishRecordChanges];
    this.fishRecordChanges.clear();
    return result;
  }
  drainReelChanges(): { netId: number; state: ReelView }[] {
    const result = [...this.reelChanges].map(([netId, state]) => ({ netId, state }));
    this.reelChanges.clear();
    return result;
  }
  sentinelVictoriesOf(netId: number): number {
    return this.players.get(netId)?.sentinelVictories ?? 0;
  }
  drainSentinelProgressChanges(): number[] {
    const ids = [...this.sentinelProgressChanges];
    this.sentinelProgressChanges.clear();
    return ids;
  }

  expeditionStateOf(netId: number, notice: ExpeditionNotice = 'none'): ExpeditionView {
    const runtime = this.players.get(netId),
      state = expeditionFromSaved(runtime?.expedition);
    const home = runtime?.playerKey == null ? null : this.homeOf(runtime.playerKey);
    return {
      ...state,
      offers: expeditionOffers(
        home !== null && isHomeKind(home.kind) ? home.kind : null,
        state,
        this.seed,
        runtime?.playerKey ?? `session:${netId}`,
      ),
      notice,
    };
  }
  nearExpeditionBoardOf(netId: number): boolean {
    const runtime = this.players.get(netId);
    if (runtime?.playerKey == null) return false;
    const home = this.homeOf(runtime.playerKey);
    if (home === null) return false;
    if (runtime.space === home.id) return true;
    if (runtime.space !== OUTDOORS) return false;
    const at = runtime.entity.get(Position),
      spot = expeditionBoardSpot(home);
    return at !== undefined && Math.hypot(at.x - spot.x, at.z - spot.z) <= 2.5;
  }
  requestExpedition(netId: number, request: ExpeditionRequest): ExpeditionView {
    const runtime = this.players.get(netId);
    const result = (notice: ExpeditionNotice): ExpeditionView =>
      this.expeditionStateOf(netId, notice);
    if (runtime === undefined || !this.nearExpeditionBoardOf(netId)) return result('away');
    if (runtime.health <= 0 || runtime.action.kind !== ActionKind.Idle || runtime.cast !== null)
      return result('busy');
    const state = runtime.expedition;
    if (request.action === 'accept') {
      if (state.active !== null) return result('active');
      if (!Number.isInteger(request.index) || request.index < 0 || request.index > 2)
        return result('choice');
      state.active = this.expeditionStateOf(netId).offers[request.index]!;
      state.progress = [0, 0, 0];
      // Requests return their state immediately; discard an older queued update.
      this.expeditionChanges.delete(netId);
      return result('accepted');
    }
    if (!expeditionComplete(state)) return result('unfinished');
    const copy = { ...runtime.inventory };
    for (const reward of EXPEDITIONS[state.active!]!.rewards)
      if (addItem(copy, reward.item, reward.count) !== reward.count) return result('full');
    Object.assign(runtime.inventory, copy);
    state.active = null;
    state.progress = [0, 0, 0];
    state.completed = Math.min(0xffffffff, state.completed + 1);
    state.cycle = Math.min(0xffffffff, state.cycle + 1);
    if (state.completed >= 3) state.cosmetics |= TRAIL_PENNANT_SKILL;
    this.expeditionChanges.delete(netId);
    return result('claimed');
  }
  private advanceExpedition(runtime: PlayerRuntime, event: ExpeditionEvent, count: number): void {
    if (progressExpedition(runtime.expedition, event, count))
      this.expeditionChanges.set(runtime.netId, 'none');
  }
  drainExpeditionChanges(): { netId: number; state: ExpeditionView }[] {
    const changed = [...this.expeditionChanges].map(([netId, notice]) => ({
      netId,
      state: this.expeditionStateOf(netId, notice),
    }));
    this.expeditionChanges.clear();
    return changed;
  }

  discoveryStateOf(netId: number): DiscoveryState {
    const runtime = this.players.get(netId);
    return {
      found: runtime?.discoveriesFound ?? 0,
      claimed: runtime?.discoveriesClaimed ?? 0,
      notice: 'none',
    };
  }

  nearCookingFireOf(netId: number): boolean {
    const runtime = this.players.get(netId),
      position = runtime?.entity.get(Position);
    if (runtime === undefined || position === undefined) return false;
    if (runtime.space !== OUTDOORS)
      return homeFacilityInReach(this.kindOfHome(runtime.space), 'cooking', position);
    return nearestCampfire(position, this.builtProps)?.lit === true;
  }

  nearWorkbenchOf(netId: number): boolean {
    const runtime = this.players.get(netId),
      position = runtime?.entity.get(Position);
    return (
      runtime !== undefined &&
      position !== undefined &&
      runtime.space !== OUTDOORS &&
      homeFacilityInReach(this.kindOfHome(runtime.space), 'workbench', position)
    );
  }

  private tryUseHomeCooking(
    runtime: PlayerRuntime,
    position: Readonly<Vec3>,
    fresh: boolean,
  ): boolean {
    if (!homeFacilityInReach(this.kindOfHome(runtime.space), 'cooking', position)) return false;
    if (!fresh) return true;
    const held = this.equippedItemOf(runtime.netId);
    if (held !== null && cookedItemFor(held) !== null) {
      const cooked = cookOne(runtime.inventory, held);
      if (cooked !== null) {
        this.cookingEvents.push({ netId: runtime.netId, raw: held, cooked });
        this.gestureEvents.push({ netId: runtime.netId, gesture: Gesture.Reach, item: held });
        this.equipEvents.push(runtime.netId);
      }
    }
    return true;
  }

  drainDiscoveryChanges(): { netId: number; state: DiscoveryState }[] {
    const events = [...this.discoveryChanges].map(([netId, notice]) => ({
      netId,
      state: { ...this.discoveryStateOf(netId), notice },
    }));
    this.discoveryChanges.clear();
    return events;
  }

  private findDiscoveries(runtime: PlayerRuntime, position: Readonly<Vec3>): void {
    for (const site of this.discoverySites) {
      if (Math.hypot(position.x - site.x, position.z - site.z) <= 6)
        this.advanceExpedition(runtime, { kind: 'visit', site: site.kind }, 1);
      if (
        site.kind === 'guardianHollow' ||
        discoveryKnown(runtime.discoveriesFound, site.id) ||
        Math.hypot(position.x - site.x, position.z - site.z) > 6
      )
        continue;
      runtime.discoveriesFound |= 1 << site.id;
      this.discoveryChanges.set(runtime.netId, 'none');
    }
  }

  private tryInspectDiscovery(runtime: PlayerRuntime, position: Readonly<Vec3>): boolean {
    const site = this.discoverySites.find(
      (s) =>
        !discoveryKnown(runtime.discoveriesClaimed, s.id) &&
        Math.hypot(position.x - s.x, position.z - s.z) < 2.7,
    );
    if (site === undefined || runtime.cast !== null || runtime.health <= 0) return false;
    if (site.kind === 'guardianHollow' && !discoveryKnown(runtime.discoveriesFound, site.id)) {
      this.discoveryChanges.set(runtime.netId, 'guardian');
      return true;
    }
    if (site.kind === 'elkGrove' || site.kind === 'raccoonHollow') {
      const animal = this.animals.get(site.kind === 'elkGrove' ? 1008 : 1009),
        at = animal?.entity.get(Position);
      if (
        animal === undefined ||
        animal.caught ||
        at === undefined ||
        horizontalDistance(position, at) > 10 ||
        (site.kind === 'elkGrove' && animal.engaged)
      ) {
        this.discoveryChanges.set(runtime.netId, 'quiet');
        return true;
      }
    }
    const guarded = this.raids.raidersList().some((r) => {
      const at = this.raids.positionOf(r.id);
      return r.hitsLeft > 0 && at !== null && Math.hypot(at.x - site.x, at.z - site.z) < 12;
    });
    if (guarded) {
      this.discoveryChanges.set(runtime.netId, 'guarded');
      return true;
    }
    const after = { ...runtime.inventory };
    if (site.reward.some((reward) => addItem(after, reward.item, reward.count) !== reward.count)) {
      this.discoveryChanges.set(runtime.netId, 'full');
      return true;
    }
    Object.assign(runtime.inventory, after);
    runtime.discoveriesFound |= 1 << site.id;
    runtime.discoveriesClaimed |= 1 << site.id;
    this.discoveryChanges.set(runtime.netId, 'none');
    this.gestureEvents.push({
      netId: runtime.netId,
      gesture: site.reward.length === 0 ? Gesture.Reach : Gesture.PickUp,
      item: site.reward[0]?.item ?? null,
    });
    return true;
  }

  encounterRestState(): [number, number][] {
    return this.raids.encounterRestState();
  }
  restoreEncounterRest(saved: readonly [number, number][]): void {
    this.raids.restoreEncounterRest(saved);
  }

  blueprintMissesOf(netId: number): number {
    return this.players.get(netId)?.blueprintMisses ?? 0;
  }

  drainBlueprintProgressChanges(): number[] {
    const ids = [...this.blueprintProgressChanges];
    this.blueprintProgressChanges.clear();
    return ids;
  }

  /** One pile as it goes into storage, or null if it is gone - picked up or faded. */
  persistedPile(id: number): PersistedPile | null {
    const pile = this.droppedPiles.find((candidate) => candidate.id === id);
    if (pile === undefined) return null;
    const { item, count, x, z, droppedAtMs, ownerKey } = pile;
    return { id, item, count, x, z, droppedAtMs, ...(ownerKey === undefined ? {} : { ownerKey }) };
  }

  /** Put dropped piles back as they were after the world wakes from storage. */
  restoreDroppedPiles(saved: Iterable<PersistedPile>, nowMs: number): void {
    const rows = [...saved].filter(
      (row) =>
        Number.isInteger(row.count) &&
        row.count > 0 &&
        Number.isFinite(row.x) &&
        Number.isFinite(row.z) &&
        Number.isFinite(row.droppedAtMs),
    );
    rows.sort((a, b) => a.droppedAtMs - b.droppedAtMs);
    const permanent = rows.filter(
      (row) => row.item === 'sentinelTrophy' && row.ownerKey !== undefined,
    );
    const ordinary = rows.filter(
      (row) => !(row.item === 'sentinelTrophy' && row.ownerKey !== undefined),
    );
    const available = Math.max(0, MAX_DROPPED_PILES - permanent.length);
    const retained = [...permanent, ...(available === 0 ? [] : ordinary.slice(-available))];
    for (const row of retained) {
      this.droppedPiles.push({ ...row });
      if (row.droppedAtMs > nowMs) this.pendingPiles.add(row.id);
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
        meal: { ...runtime.meal },
        health: runtime.health,
        equippedItem: runtime.equippedItem,
        worn: wornEntries(runtime.worn),
        explored: runtime.explored,
        homeSkills: runtime.homeSkills,
        blueprintMisses: runtime.blueprintMisses,
        discoveriesFound: runtime.discoveriesFound,
        discoveriesClaimed: runtime.discoveriesClaimed,
        sentinelVictories: runtime.sentinelVictories,
        takenPickups: [...runtime.takenPickups],
        fishRecords: fishRecordsFromSaved(runtime.fishRecords),
        expedition: { ...runtime.expedition, progress: [...runtime.expedition.progress] },
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
        const animal = this.animals.get(networkId.value);
        if (
          animal?.caught === true &&
          (animal.kind !== 'woodlandGuardian' ||
            this.nowMs >= animal.respawnAtMs - ANIMAL_RESPAWN_SECONDS * 1000 + 1000)
        )
          return;
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
          action: animal?.caught
            ? 8
            : (animal?.engaged ? 4 : 0) |
              (animal?.attackState === 'windup' ? 1 : animal?.attackState === 'cooldown' ? 2 : 0),
          actionAge:
            animal?.attackState === 'cooldown'
              ? Math.min(
                  255,
                  Math.max(
                    0,
                    Math.round(
                      (this.nowMs -
                        (animal.attackStateEndsAtMs -
                          (ANIMAL_KINDS[animal.kind] as AnimalKind).threat!.attackCooldownSeconds *
                            1000)) /
                        50,
                    ),
                  ),
                )
              : 0,
          actionHeading: 0,
        });
      });

    // Raiders, the same as other players would be - only ever outdoors.
    if (viewer.space === OUTDOORS) {
      this.world
        .query(RaiderTag, Position, Velocity, Facing, Grounded, NetworkId)
        .readEach(([position, velocity, facing, grounded, networkId]) => {
          const dx = position.x - viewerPosition.x;
          const dz = position.z - viewerPosition.z;
          if (dx * dx + dz * dz > radiusSquared) return;
          const action = this.raids.actionOf(networkId.value);
          const speedSquared = velocity.x * velocity.x + velocity.z * velocity.z;
          let flags = SnapshotFlag.Raider;
          if (speedSquared > 0.04) flags |= SnapshotFlag.Moving;
          if (!grounded.value) flags |= SnapshotFlag.Airborne;
          if (speedSquared > SPRINT_REPORTING_SPEED * SPRINT_REPORTING_SPEED) {
            flags |= SnapshotFlag.Sprinting;
          }
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
            action: action === null ? 0 : packActionByte(action),
            actionAge: action?.age ?? 0,
            actionHeading: action?.heading ?? 0,
          });
        });
    }

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
