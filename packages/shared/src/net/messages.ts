import type { ItemId } from '../data/items';
import type { PlayerInput } from '../sim/player';
import type { SnapshotEntity } from '../sim/world-sim';

/** What a client is allowed to say. */
export const ClientMessageType = {
  InputBundle: 0x01,
  Ping: 0x02,
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
  TreesFelled: 0x17,
  TreeHit: 0x18,
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

export type ClientMessage = InputBundleMessage | PingMessage;

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

/**
 * Which trees are down.
 *
 * Like pickups, the clearing itself comes from the seed, so only the ids of the
 * trees that have changed have to travel.
 */
export interface TreesFelledMessage {
  readonly type: 'treesFelled';
  readonly treeIds: readonly number[];
}

/** A swing landed. `swingsLeft` of zero means that was the one that felled it. */
export interface TreeHitMessage {
  readonly type: 'treeHit';
  readonly treeId: number;
  readonly swingsLeft: number;
}

export type ServerMessage =
  | WelcomeMessage
  | SnapshotMessage
  | PlayerLeftMessage
  | PongMessage
  | RejectedMessage
  | InventoryMessage
  | PickupsTakenMessage
  | TreesFelledMessage
  | TreeHitMessage;
