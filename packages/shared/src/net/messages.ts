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

export type ServerMessage =
  | WelcomeMessage
  | SnapshotMessage
  | PlayerLeftMessage
  | PongMessage
  | RejectedMessage;
