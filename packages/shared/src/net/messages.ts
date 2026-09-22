import type { ItemId } from '../data/items';
import type { PlayerInput } from '../sim/player';
import type { CraftedEvent, FishingEvent, HungerEvent, SnapshotEntity } from '../sim/world-sim';

/** What a client is allowed to say. */
export const ClientMessageType = {
  InputBundle: 0x01,
  Ping: 0x02,
  Craft: 0x03,
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

export type ClientMessage = InputBundleMessage | PingMessage | CraftMessage;

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

/** A swing landed. `swingsLeft` of zero means that was the one that felled it. */
export interface TreeHitMessage {
  readonly type: 'treeHit';
  readonly treeId: number;
  readonly swingsLeft: number;
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

export type ServerMessage =
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
  | CraftedMessage;
