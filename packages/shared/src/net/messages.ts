import type { ExpeditionRequest, ExpeditionView } from '../sim/expeditions';
import type { DecorationRequest, DecorationState } from '../sim/decorations';
import type { MealState } from '../sim/meals';
import type { HomeSupplies } from '../sim/home-supplies';
import type { DiscoveryState } from '../data/discoveries';
import type { GardenRequest, GardenState } from '../sim/garden';
import type { HomeBuildFeedback } from '../data/housing';
import type { ChestRequest, ChestResult } from '../sim/chest';
import type { BuildableKindId } from '../data/buildables';
import type { CharacterId, TintColorId } from '../data/characters';
import type { ItemId } from '../data/items';
import type { PlayerInput } from '../sim/player';
import type { GestureEvent } from '../sim/actions';
import type { GatherPatchView } from '../sim/gathering';
import type { DroppedPileView } from '../sim/dropping';
import type { TreeFall } from '../sim/tree-fall';
import type { RaidNews, RaiderHit, RaiderView } from '../sim/raids';
import type {
  AnimalCaught,
  BuiltProp,
  BuriedCacheView,
  CacheEvent,
  CraftedEvent,
  CookedEvent,
  CollectedEvent,
  DiscardedEvent,
  FishingEvent,
  HealthEvent,
  HungerEvent,
  SnapshotEntity,
  ThreatHit,
} from '../sim/world-sim';

/** What a client is allowed to say. */
export const ClientMessageType = {
  InputBundle: 0x01,
  Ping: 0x02,
  Craft: 0x03,
  Build: 0x04,
  Hello: 0x05,
  UseItem: 0x06,
  SetDoorLock: 0x07,
  Discard: 0x08,
  Loot: 0x09,
  Chest: 0x0a,
  Garden: 0x0b,
  Decoration: 0x0c,
  Expedition: 0x0d,
} as const;

/** What the server says back. */
export const ServerMessageType = {
  Welcome: 0x10,
  Snapshot: 0x11,
  PlayerLeft: 0x12,
  Pong: 0x13,
  Rejected: 0x14,
  Inventory: 0x15,
  PickupsTaken: 0x16,
  TreeStates: 0x17,
  TreeHit: 0x18,
  Fishing: 0x19,
  Hunger: 0x1a,
  Crafted: 0x1b,
  Caught: 0x1c,
  BuiltProps: 0x1d,
  ThreatHit: 0x1e,
  Health: 0x1f,
  BuriedCaches: 0x20,
  Cache: 0x21,
  Roster: 0x22,
  Equipped: 0x23,
  Explored: 0x24,
  Space: 0x25,
  Gestures: 0x26,
  GatherPatches: 0x27,
  DroppedPiles: 0x28,
  Discarded: 0x29,
  Raiders: 0x2a,
  RaidNews: 0x2b,
  RaiderHit: 0x2c,
  Cooked: 0x2d,
  PickupRefused: 0x2e,
  Collected: 0x2f,
  Chest: 0x30,
  HomeSkills: 0x31,
  HomeBuildFeedback: 0x32,
  Discoveries: 0x33,
  Garden: 0x34,
  HomeSupplies: 0x35,
  Meal: 0x36,
  Decoration: 0x37,
  RecoveryMarkers: 0x38,
  Expedition: 0x39,
  RaiderVitals: 0x3a,
} as const;

export const RejectReason = {
  WorldFull: 1,
  BadMessage: 2,
} as const;
export type RejectReasonCode = (typeof RejectReason)[keyof typeof RejectReason];

export interface InputBundleMessage {
  readonly type: 'input';
  readonly inputs: readonly PlayerInput[];
}

export interface PingMessage {
  readonly type: 'ping';
  readonly clientTimeMs: number;
}

/**
 * Make something out of whatever is in the pack.
 *
 * Crafting is not aimed at anything the way a swing or a cast is, so unlike
 * those it travels as its own small message rather than a bit on the input
 * bundle.
 */
export interface CraftMessage {
  readonly type: 'craft';
  readonly item: ItemId;
}

/**
 * Build this, exactly here and turned this way: wherever the player's preview
 * stood when they clicked (see decision 0052).
 *
 * Like crafting, this is its own small message rather than a bit on the input
 * bundle. The server still checks the spot is within reach of wherever it has
 * the player standing, and clear.
 */
export interface BuildMessage {
  readonly type: 'build';
  readonly kind: BuildableKindId;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
}

/**
 * Select one item from the hotbar as the one now equipped - shown in hand,
 * and told to everybody nearby - eating it too if it is food.
 *
 * Like crafting, this is its own small message rather than a bit on the input
 * bundle: it is not aimed at anything, so it needs neither reach nor facing,
 * and is settled the moment the server reads it.
 */
export interface UseItemMessage {
  readonly type: 'useItem';
  readonly item: ItemId;
}

/**
 * Lock or unlock your own front door to visitors (see decision 0055). Only
 * ever your own: the server knows whose home is whose.
 */
export interface SetDoorLockMessage {
  readonly type: 'setDoorLock';
  readonly locked: boolean;
}

/**
 * Introduce yourself: the name, character and tint picked on the Home screen.
 *
 * Sent once, right after `Welcome` - not bundled with it, so a slow Home
 * screen submit never holds up the very first snapshot. Nothing about a
 * player's own movement or the world waits on this; it only ever changes how
 * that player is labelled and coloured for everybody else.
 */
export interface HelloMessage {
  readonly type: 'hello';
  readonly name: string;
  readonly character: CharacterId;
  readonly color: TintColorId;
}

/**
 * Drop or destroy some of one thing from the pack, to make room (see
 * decision 0061). Settled the moment it arrives, the same as crafting.
 */
export interface DiscardMessage {
  readonly type: 'discard';
  readonly item: ItemId;
  /** How many. The server never takes more than the player actually holds. */
  readonly amount: number;
  readonly destroy: boolean;
}

export interface LootRequest {
  readonly kind: 'pickup' | 'pile' | 'patch';
  readonly id: number;
}

export interface LootMessage extends LootRequest {
  readonly type: 'loot';
}

export type ChestMessage = ChestRequest & { readonly type: 'chest' };
export type ChestStateMessage = ChestResult & { readonly type: 'chest' };

export type ClientMessage =
  | (ExpeditionRequest & { readonly type: 'expedition' })
  | (DecorationRequest & { readonly type: 'decoration' })
  | (GardenRequest & { readonly type: 'garden' })
  | ChestMessage
  | InputBundleMessage
  | PingMessage
  | CraftMessage
  | BuildMessage
  | HelloMessage
  | UseItemMessage
  | SetDoorLockMessage
  | DiscardMessage
  | LootMessage;

export interface WelcomeMessage {
  readonly type: 'welcome';
  readonly netId: number;
  readonly seed: number;
  readonly tick: number;
  readonly serverTimeMs: number;
  readonly tickHz: number;
  readonly snapshotHz: number;
}

export interface SnapshotMessage {
  readonly type: 'snapshot';
  readonly tick: number;
  readonly serverTimeMs: number;
  /** The newest input from this client that the server has simulated. */
  readonly ackSeq: number;
  /** Inputs before this client's own player may dodge again: theirs alone, so it travels once. */
  readonly dodgeCooldown: number;
  readonly entities: readonly SnapshotEntity[];
}

export interface PlayerLeftMessage {
  readonly type: 'playerLeft';
  readonly netId: number;
}

export interface PongMessage {
  readonly type: 'pong';
  readonly clientTimeMs: number;
  readonly serverTimeMs: number;
}

export interface RejectedMessage {
  readonly type: 'rejected';
  readonly reason: RejectReasonCode;
}

/** Everything this player is carrying. Sent on arrival and whenever it changes. */
export interface InventoryMessage {
  readonly type: 'inventory';
  readonly items: readonly { readonly item: ItemId; readonly count: number }[];
}

/**
 * Which pickups are gone.
 *
 * The client already knows where every pickup in the clearing is, because the
 * clearing is built from the seed, so only the ids have to travel.
 */
export interface PickupsTakenMessage {
  readonly type: 'pickupsTaken';
  readonly pickupIds: readonly number[];
}

/** One tree that is not as the seed left it. */
export interface TreeState {
  readonly treeId: number;
  /** How many times this spot has grown back. It decides the tree's size. */
  readonly generation: number;
  readonly felled: boolean;
  /** Timing and direction let observers, including late joiners, see the same fall. */
  readonly fall?: TreeFall;
}

/**
 * Every tree that has changed since the clearing was built.
 *
 * The clearing itself comes from the seed, so a tree nobody has touched is not
 * in here at all. A tree that has grown back is, because its size is not the
 * one the seed gave it: both ends work that size out from the generation
 * rather than it being sent.
 */
export interface TreeStatesMessage {
  readonly type: 'treeStates';
  readonly trees: readonly TreeState[];
}

/**
 * A swing landed. `swingsLeft` of zero means that was the one that felled it.
 *
 * Told to everybody nearby, same as a `ThreatHit` - but `netId` says whose
 * swing it was, so only the swinger's own client plays a swing of its own
 * axe back for it, rather than every nearby player's axe swinging in sync
 * with a stranger's chop.
 */
export interface TreeHitMessage {
  readonly type: 'treeHit';
  readonly treeId: number;
  readonly swingsLeft: number;
  readonly netId: number;
}

/**
 * Something happened at the water: a cast, a bite, a catch or one that got away.
 *
 * Everybody hears about everybody's line, so the float somebody else is
 * watching bobs for you too.
 */
export interface FishingMessage {
  readonly type: 'fishing';
  readonly event: FishingEvent;
}

/**
 * How hungry this player is now.
 *
 * Only that player is ever told: hunger is nobody else's business. Sent on
 * arrival and whenever it changes.
 */
export interface HungerMessage {
  readonly type: 'hunger';
  readonly event: HungerEvent;
}

/**
 * Word that this player crafted something, for a HUD toast.
 *
 * Only that player is ever told: like hunger, nobody else has any reason to
 * know what somebody else just made.
 */
export interface CraftedMessage {
  readonly type: 'crafted';
  readonly event: CraftedEvent;
}

/** Word that this player cooked one piece of food at a campfire. */
export interface CookedMessage {
  readonly type: 'cooked';
  readonly event: CookedEvent;
}

/**
 * Word that this player caught an animal, for a HUD toast.
 *
 * Only that player is ever told: like crafting, nobody else has any reason
 * to know what somebody else just caught. The animal itself vanishing is
 * already plain to everybody from the next snapshot.
 */
export interface CaughtMessage {
  readonly type: 'caught';
  readonly event: AnimalCaught;
}

/**
 * Everything anybody has ever built.
 *
 * Sent whole, the same way tree states are: cheap while there is not much
 * built yet, and simplest to keep in sync. Sent on arrival, and again
 * whenever somebody places something new.
 */
export interface BuiltPropsMessage {
  readonly type: 'builtProps';
  readonly props: readonly BuiltPropView[];
}

/**
 * A built prop as one particular player hears about it: whether it is theirs
 * comes along too, so their preview can say they already have a cabin rather
 * than turning green for one the server will refuse. Only ever about the
 * player it was sent to - nobody learns who else owns what.
 */
export interface BuiltPropView extends BuiltProp {
  readonly yours: boolean;
}

/**
 * A swing landed on a threat without defeating it, or one just came back
 * from being defeated. `hitsLeft` is how many more swings it will take.
 *
 * Everybody hears about it, the same as a tree shaking: whoever is fighting
 * it benefits most, but anyone nearby should see it react too.
 */
export interface ThreatHitMessage {
  readonly type: 'threatHit';
  readonly event: ThreatHit;
}

/**
 * How much health this player has left.
 *
 * Only that player is ever told: like hunger, nobody else's business. Sent
 * whenever a threat's attack lands, or otherwise knocks them out.
 */
export interface HealthMessage {
  readonly type: 'health';
  readonly event: HealthEvent;
}

/**
 * Every cache currently buried anywhere in the world.
 *
 * Sent whole, the same as built props: cheap while there are only ever a
 * handful, and simplest to keep in sync. Sent on arrival, and again whenever
 * one is buried or dug back up. `ownerNetId` is resolved fresh each time -
 * null while its owner is not connected to hint at.
 */
export interface BuriedCachesMessage {
  readonly type: 'buriedCaches';
  readonly caches: readonly BuriedCacheView[];
}

/**
 * Word that this player's own buried cache changed - one just appeared from
 * a knockout, or they just dug one up - for a HUD toast.
 *
 * Only that player is ever told: like crafting, nobody else has any reason
 * to know what somebody else lost or found. The cache itself appearing or
 * disappearing is already plain to everybody from the next `BuriedCaches`.
 */
export interface CacheMessage {
  readonly type: 'cache';
  readonly event: CacheEvent;
}

/** Who one connected player says they are. */
export interface RosterEntry {
  readonly netId: number;
  readonly name: string;
  readonly character: CharacterId;
  readonly color: TintColorId;
}

/**
 * Who everybody currently connected says they are.
 *
 * Sent whole, the same way built props and buried caches are: cheap while a
 * world holds at most `MAX_PLAYERS_PER_WORLD` players, and simplest to keep
 * in sync. Sent to a newly connecting player covering whoever has already
 * introduced themselves, and again to everybody whenever that changes. A
 * netId with nothing here yet just has not sent its own `Hello` - drawn
 * without a name or a chosen tint until it does.
 */
export interface RosterMessage {
  readonly type: 'roster';
  readonly players: readonly RosterEntry[];
}

/** What one connected player currently has equipped - shown in their hand. */
export interface EquippedEntry {
  readonly netId: number;
  readonly item: ItemId | null;
}

/**
 * What everybody currently connected has equipped, sent whole - the same
 * "cheap while there are only ever a few dozen, simplest to keep in sync"
 * shape `Roster` and `BuiltProps` already use. Sent to a newly connecting
 * player covering whoever has already equipped something, and again to
 * everybody whenever any one player's own choice changes - not a diff of
 * who changed to what, since resending the whole small list costs nothing
 * extra and needs no per-player bookkeeping to stay correct.
 */
export interface EquippedMessage {
  readonly type: 'equipped';
  readonly players: readonly EquippedEntry[];
}

/**
 * Which parts of the world this player has seen, whole (see decision 0054):
 * one bit per `EXPLORE_CELL_SIZE` square, in `exploring.ts`'s order. Private
 * to the one it belongs to.
 */
export interface ExploredMessage {
  readonly type: 'explored';
  readonly cells: Uint8Array;
}

/**
 * You went in through a door or came back out (see decision 0055): which
 * space you are now in - 0 for outdoors, or the built-prop id of the home
 * you are inside - and exactly where, since a room has its own coordinates.
 * Private to the one it happened to; everybody else just stops (or starts)
 * seeing them.
 */
export interface SpaceMessage {
  readonly type: 'space';
  readonly space: number;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
}

/**
 * Somebody picked something up, dug, reached out or ate (see decision 0056):
 * a moment's gesture for every browser nearby to play on them.
 */
export interface GesturesMessage {
  readonly type: 'gestures';
  readonly gestures: readonly GestureEvent[];
}

/**
 * Every stick and flower patch: where it is now and how many are left (see
 * decision 0061). Sent whole - there are only a handful - on arrival and to
 * everybody whenever one is gathered from, grows back or moves.
 */
export interface GatherPatchesMessage {
  readonly type: 'gatherPatches';
  readonly patches: readonly GatherPatchView[];
}

/**
 * Everything lying where somebody dropped it, sent whole the same way as
 * buried caches: on arrival, and to everybody whenever a pile is dropped,
 * added to, picked up or fades.
 */
export interface DroppedPilesMessage {
  readonly type: 'droppedPiles';
  readonly piles: readonly DroppedPileView[];
}

/** Word that you dropped or destroyed something, for your own HUD alone. */
export interface DiscardedMessage {
  readonly type: 'discarded';
  readonly event: DiscardedEvent;
}

/**
 * Every skeleton raider in the world, sent whole (see decision 0063): which
 * kind each one is and how many blows it has left. Where they are and what
 * they are doing travels in snapshots like everybody else; this is what a
 * snapshot does not carry. Sent on arrival, and to everybody whenever one
 * turns up, is hit or is gone.
 */
export interface RaidersMessage {
  readonly type: 'raiders';
  readonly raiders: readonly RaiderView[];
}

/** A raid turned up, was fought off or gave up. Everybody hears about it. */
export interface RaidNewsMessage {
  readonly type: 'raidNews';
  readonly news: RaidNews;
}

/**
 * A player's blow landed on a raider, for every browser to show. Whoever
 * threw it already did, so theirs only uses it to set the record straight.
 */
export interface RaiderHitMessage {
  readonly type: 'raiderHit';
  readonly hit: RaiderHit;
}

export interface PickupRefusedMessage {
  readonly type: 'pickupRefused';
  readonly item: ItemId;
  readonly reason: 'full' | 'limit';
}

export interface CollectedMessage {
  readonly type: 'collected';
  readonly events: readonly CollectedEvent[];
}

export interface HomeSkillsMessage {
  readonly type: 'homeSkills';
  readonly skills: number;
}

export type HomeBuildFeedbackMessage = HomeBuildFeedback & { readonly type: 'homeBuildFeedback' };
export type DiscoveriesMessage = DiscoveryState & { readonly type: 'discoveries' };
export type HomeSuppliesMessage = HomeSupplies & { readonly type: 'homeSupplies' };

export type MealMessage = MealState & { readonly type: 'meal' };

export type ServerMessage =
  | { readonly type: 'raiderVitals'; readonly id: number; readonly maxHits: number }
  | (ExpeditionView & { readonly type: 'expedition' })
  | { readonly type: 'recoveryMarkers'; readonly caches: readonly BuriedCacheView[] }
  | (DecorationState & { readonly type: 'decoration' })
  | MealMessage
  | HomeSuppliesMessage
  | (GardenState & { readonly type: 'garden' })
  | DiscoveriesMessage
  | HomeBuildFeedbackMessage
  | HomeSkillsMessage
  | ChestStateMessage
  | CollectedMessage
  | PickupRefusedMessage
  | WelcomeMessage
  | SnapshotMessage
  | PlayerLeftMessage
  | PongMessage
  | RejectedMessage
  | InventoryMessage
  | PickupsTakenMessage
  | TreeStatesMessage
  | TreeHitMessage
  | FishingMessage
  | HungerMessage
  | CraftedMessage
  | CookedMessage
  | CaughtMessage
  | BuiltPropsMessage
  | ThreatHitMessage
  | HealthMessage
  | BuriedCachesMessage
  | CacheMessage
  | RosterMessage
  | EquippedMessage
  | ExploredMessage
  | SpaceMessage
  | GesturesMessage
  | GatherPatchesMessage
  | DroppedPilesMessage
  | DiscardedMessage
  | RaidersMessage
  | RaidNewsMessage
  | RaiderHitMessage;
