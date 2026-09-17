/**
 * The binary wire format.
 *
 * Everything is little-endian and packed by hand. Positions travel as whole
 * centimetres and angles as a 16-bit fraction of a turn, which keeps a snapshot
 * for ten players under 200 bytes.
 *
 * Inputs are bundled because Cloudflare bills incoming WebSocket messages at
 * 20:1: one message carrying three inputs costs a twentieth of three messages.
 */

import { SNAPSHOT_HZ, TICK_HZ } from '../constants';
import { clamp } from '../math/vec3';
import { wrapAngle, TAU } from '../math/angles';
import type { PlayerInput } from '../sim/player';
import type { SnapshotEntity } from '../sim/world-sim';
import {
  ClientMessageType,
  RejectReason,
  ServerMessageType,
  type ClientMessage,
  type RejectReasonCode,
  type ServerMessage,
} from './messages';

/** Positions are sent as whole centimetres. */
export const POSITION_SCALE = 100;
/** Angles are sent as a fraction of a full turn in 16 bits: about 0.005 degrees. */
const ANGLE_SCALE = 65536 / TAU;

const BYTES_PER_INPUT = 5;
const INPUT_HEADER_BYTES = 6;
/** netId(2) + x,y,z(4 each) + yaw(2) + flags(1) */
const BYTES_PER_SNAPSHOT_ENTITY = 17;
const SNAPSHOT_HEADER_BYTES = 14;

/** A bundle never carries more than this, so a bad client cannot make us work. */
export const MAX_INPUTS_PER_BUNDLE = 32;
/** A snapshot never carries more than this many entities. */
export const MAX_SNAPSHOT_ENTITIES = 255;

export function quantisePosition(metres: number): number {
  return Math.round(metres * POSITION_SCALE);
}

export function dequantisePosition(centimetres: number): number {
  return centimetres / POSITION_SCALE;
}

export function quantiseAngle(radians: number): number {
  return Math.round(wrapAngle(radians) * ANGLE_SCALE) & 0xffff;
}

export function dequantiseAngle(packed: number): number {
  return wrapAngle(packed / ANGLE_SCALE);
}

function quantiseAxis(value: number): number {
  return Math.round(clamp(value, -1, 1) * 127);
}

function dequantiseAxis(packed: number): number {
  return clamp(packed / 127, -1, 1);
}

/* -------------------------------------------------------------------------- */
/* Client to server                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Pack a run of inputs.
 *
 * The client produces exactly one input per simulation tick, so their sequence
 * numbers are consecutive and only the first one has to travel.
 */
export function encodeInputBundle(inputs: readonly PlayerInput[]): ArrayBuffer {
  if (inputs.length === 0) throw new Error('Cannot encode an empty input bundle');
  if (inputs.length > MAX_INPUTS_PER_BUNDLE) {
    throw new Error(`Input bundle of ${inputs.length} is longer than ${MAX_INPUTS_PER_BUNDLE}`);
  }
  const first = inputs[0];
  if (first === undefined) throw new Error('Cannot encode an empty input bundle');

  const buffer = new ArrayBuffer(INPUT_HEADER_BYTES + inputs.length * BYTES_PER_INPUT);
  const view = new DataView(buffer);
  view.setUint8(0, ClientMessageType.InputBundle);
  view.setUint32(1, first.seq >>> 0, true);
  view.setUint8(5, inputs.length);

  let offset = INPUT_HEADER_BYTES;
  for (const input of inputs) {
    view.setInt8(offset, quantiseAxis(input.moveX));
    view.setInt8(offset + 1, quantiseAxis(input.moveZ));
    view.setUint16(offset + 2, quantiseAngle(input.yaw), true);
    view.setUint8(offset + 4, input.buttons & 0xff);
    offset += BYTES_PER_INPUT;
  }
  return buffer;
}

export function encodePing(clientTimeMs: number): ArrayBuffer {
  const buffer = new ArrayBuffer(5);
  const view = new DataView(buffer);
  view.setUint8(0, ClientMessageType.Ping);
  view.setUint32(1, clientTimeMs >>> 0, true);
  return buffer;
}

/**
 * Read a message from a client.
 *
 * Returns `null` for anything malformed. The server never trusts the contents:
 * the caller still clamps and validates whatever comes back.
 */
export function decodeClientMessage(data: ArrayBuffer): ClientMessage | null {
  if (data.byteLength < 1) return null;
  const view = new DataView(data);
  const type = view.getUint8(0);

  if (type === ClientMessageType.InputBundle) {
    if (data.byteLength < INPUT_HEADER_BYTES) return null;
    const firstSeq = view.getUint32(1, true);
    const count = view.getUint8(5);
    if (count === 0 || count > MAX_INPUTS_PER_BUNDLE) return null;
    if (data.byteLength !== INPUT_HEADER_BYTES + count * BYTES_PER_INPUT) return null;

    const inputs: PlayerInput[] = [];
    let offset = INPUT_HEADER_BYTES;
    for (let i = 0; i < count; i++) {
      inputs.push({
        seq: firstSeq + i,
        moveX: dequantiseAxis(view.getInt8(offset)),
        moveZ: dequantiseAxis(view.getInt8(offset + 1)),
        yaw: dequantiseAngle(view.getUint16(offset + 2, true)),
        buttons: view.getUint8(offset + 4),
      });
      offset += BYTES_PER_INPUT;
    }
    return { type: 'input', inputs };
  }

  if (type === ClientMessageType.Ping) {
    if (data.byteLength !== 5) return null;
    return { type: 'ping', clientTimeMs: view.getUint32(1, true) };
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Server to client                                                            */
/* -------------------------------------------------------------------------- */

export function encodeWelcome(
  netId: number,
  seed: number,
  tick: number,
  serverTimeMs: number,
): ArrayBuffer {
  const buffer = new ArrayBuffer(17);
  const view = new DataView(buffer);
  view.setUint8(0, ServerMessageType.Welcome);
  view.setUint16(1, netId, true);
  view.setUint32(3, seed >>> 0, true);
  view.setUint32(7, tick >>> 0, true);
  view.setUint32(11, serverTimeMs >>> 0, true);
  view.setUint8(15, TICK_HZ);
  view.setUint8(16, SNAPSHOT_HZ);
  return buffer;
}

export function encodeSnapshot(
  tick: number,
  serverTimeMs: number,
  ackSeq: number,
  entities: readonly SnapshotEntity[],
): ArrayBuffer {
  const count = Math.min(entities.length, MAX_SNAPSHOT_ENTITIES);
  const buffer = new ArrayBuffer(SNAPSHOT_HEADER_BYTES + count * BYTES_PER_SNAPSHOT_ENTITY);
  const view = new DataView(buffer);
  view.setUint8(0, ServerMessageType.Snapshot);
  view.setUint32(1, tick >>> 0, true);
  view.setUint32(5, serverTimeMs >>> 0, true);
  view.setUint32(9, ackSeq >>> 0, true);
  view.setUint8(13, count);

  let offset = SNAPSHOT_HEADER_BYTES;
  for (let i = 0; i < count; i++) {
    const entity = entities[i];
    if (entity === undefined) break;
    view.setUint16(offset, entity.netId, true);
    view.setInt32(offset + 2, quantisePosition(entity.x), true);
    view.setInt32(offset + 6, quantisePosition(entity.y), true);
    view.setInt32(offset + 10, quantisePosition(entity.z), true);
    view.setUint16(offset + 14, quantiseAngle(entity.yaw), true);
    view.setUint8(offset + 16, entity.flags & 0xff);
    offset += BYTES_PER_SNAPSHOT_ENTITY;
  }
  return buffer;
}

export function encodePlayerLeft(netId: number): ArrayBuffer {
  const buffer = new ArrayBuffer(3);
  const view = new DataView(buffer);
  view.setUint8(0, ServerMessageType.PlayerLeft);
  view.setUint16(1, netId, true);
  return buffer;
}

export function encodePong(clientTimeMs: number, serverTimeMs: number): ArrayBuffer {
  const buffer = new ArrayBuffer(9);
  const view = new DataView(buffer);
  view.setUint8(0, ServerMessageType.Pong);
  view.setUint32(1, clientTimeMs >>> 0, true);
  view.setUint32(5, serverTimeMs >>> 0, true);
  return buffer;
}

export function encodeRejected(reason: RejectReasonCode): ArrayBuffer {
  const buffer = new ArrayBuffer(2);
  const view = new DataView(buffer);
  view.setUint8(0, ServerMessageType.Rejected);
  view.setUint8(1, reason);
  return buffer;
}

export function decodeServerMessage(data: ArrayBuffer): ServerMessage | null {
  if (data.byteLength < 1) return null;
  const view = new DataView(data);
  const type = view.getUint8(0);

  switch (type) {
    case ServerMessageType.Welcome: {
      if (data.byteLength !== 17) return null;
      return {
        type: 'welcome',
        netId: view.getUint16(1, true),
        seed: view.getUint32(3, true),
        tick: view.getUint32(7, true),
        serverTimeMs: view.getUint32(11, true),
        tickHz: view.getUint8(15),
        snapshotHz: view.getUint8(16),
      };
    }
    case ServerMessageType.Snapshot: {
      if (data.byteLength < SNAPSHOT_HEADER_BYTES) return null;
      const count = view.getUint8(13);
      if (data.byteLength !== SNAPSHOT_HEADER_BYTES + count * BYTES_PER_SNAPSHOT_ENTITY) {
        return null;
      }
      const entities: SnapshotEntity[] = [];
      let offset = SNAPSHOT_HEADER_BYTES;
      for (let i = 0; i < count; i++) {
        entities.push({
          netId: view.getUint16(offset, true),
          x: dequantisePosition(view.getInt32(offset + 2, true)),
          y: dequantisePosition(view.getInt32(offset + 6, true)),
          z: dequantisePosition(view.getInt32(offset + 10, true)),
          yaw: dequantiseAngle(view.getUint16(offset + 14, true)),
          flags: view.getUint8(offset + 16),
        });
        offset += BYTES_PER_SNAPSHOT_ENTITY;
      }
      return {
        type: 'snapshot',
        tick: view.getUint32(1, true),
        serverTimeMs: view.getUint32(5, true),
        ackSeq: view.getUint32(9, true),
        entities,
      };
    }
    case ServerMessageType.PlayerLeft: {
      if (data.byteLength !== 3) return null;
      return { type: 'playerLeft', netId: view.getUint16(1, true) };
    }
    case ServerMessageType.Pong: {
      if (data.byteLength !== 9) return null;
      return {
        type: 'pong',
        clientTimeMs: view.getUint32(1, true),
        serverTimeMs: view.getUint32(5, true),
      };
    }
    case ServerMessageType.Rejected: {
      if (data.byteLength !== 2) return null;
      const reason = view.getUint8(1);
      return {
        type: 'rejected',
        reason: reason === RejectReason.WorldFull ? RejectReason.WorldFull : RejectReason.BadMessage,
      };
    }
    default:
      return null;
  }
}

/** How big a snapshot for this many players will be, in bytes. */
export function snapshotBytes(entityCount: number): number {
  return SNAPSHOT_HEADER_BYTES + entityCount * BYTES_PER_SNAPSHOT_ENTITY;
}

/** How big an input bundle carrying this many inputs will be, in bytes. */
export function inputBundleBytes(inputCount: number): number {
  return INPUT_HEADER_BYTES + inputCount * BYTES_PER_INPUT;
}
