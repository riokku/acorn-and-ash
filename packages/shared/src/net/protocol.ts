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

import { MAX_TREE_GENERATION, SNAPSHOT_HZ, TICK_HZ } from '../constants';
import { itemFromIndex, itemIndex, type ItemId } from '../data/items';
import {
  buildableKindFromIndex,
  buildableKindIndex,
  type BuildableKindId,
} from '../data/buildables';
import { clamp } from '../math/vec3';
import { wrapAngle, TAU } from '../math/angles';
import type { PlayerInput } from '../sim/player';
import type {
  AnimalCaught,
  BuiltProp,
  BuriedCacheView,
  CacheEvent,
  CraftedEvent,
  FishingEvent,
  HealthEvent,
  HungerEvent,
  SnapshotEntity,
  ThreatHit,
} from '../sim/world-sim';
import {
  ClientMessageType,
  RejectReason,
  ServerMessageType,
  type ClientMessage,
  type RejectReasonCode,
  type ServerMessage,
  type TreeState,
} from './messages';

/** Positions are sent as whole centimetres. */
export const POSITION_SCALE = 100;
/** Speeds are sent as whole centimetres per second, which tops out at 327 m/s. */
export const VELOCITY_SCALE = 100;
const MAX_QUANTISED_VELOCITY = 32767;
/** Angles are sent as a fraction of a full turn in 16 bits: about 0.005 degrees. */
const ANGLE_SCALE = 65536 / TAU;

const BYTES_PER_INPUT = 5;
const INPUT_HEADER_BYTES = 6;
/** netId(2) + x,y,z(4 each) + vx,vy,vz(2 each) + yaw(2) + flags(1) */
const BYTES_PER_SNAPSHOT_ENTITY = 23;
const SNAPSHOT_HEADER_BYTES = 14;

/** A bundle never carries more than this, so a bad client cannot make us work. */
export const MAX_INPUTS_PER_BUNDLE = 32;
/** A snapshot never carries more than this many entities. */
export const MAX_SNAPSHOT_ENTITIES = 255;
/** These lists carry a one-byte length, so 255 is the ceiling for each. */
export const MAX_INVENTORY_ENTRIES = 255;
export const MAX_TAKEN_PICKUPS = 255;
/**
 * The clearing has about a hundred and forty trees, so a world where every one
 * has been touched still fits. A bigger world will need a two-byte count.
 */
export const MAX_CHANGED_TREES = 255;
/** Handful of these for now; a one-byte count leaves plenty of room to grow. */
export const MAX_BUILT_PROPS = 255;
/** Only ever one per knockout, so this ceiling is not expected to matter in practice. */
export const MAX_BURIED_CACHES = 255;

const BYTES_PER_INVENTORY_ENTRY = 3;
const BYTES_PER_TAKEN_PICKUP = 2;
/** treeId(2) + generation(1) + flags(1) */
const BYTES_PER_TREE_STATE = 4;
const TREE_FELLED_FLAG = 1;
/** id(2) + kind(1) + x(2) + z(2) + flags(1) */
const BYTES_PER_BUILT_PROP = 8;
/** Only a campfire ever sets this, but the bit costs nothing on anything else. */
const BUILT_PROP_LIT_FLAG = 1;
/** id(2) + ownerNetId(2) + x(2) + z(2) */
const BYTES_PER_BURIED_CACHE = 8;
/** A network id no real connection ever has, standing in for "not connected right now." */
const NO_OWNER = 0xffff;

/** type(1) + netId(2) + what happened(1) + two numbers that depend on it(2 each) */
const FISHING_MESSAGE_BYTES = 8;
/** What happened at the water, as one byte. Only ever add to the end. */
const FISHING_KIND_CODES = {
  cast: 1,
  bite: 2,
  caught: 3,
  tooSoon: 4,
  tooLate: 5,
  walkedAway: 6,
} as const satisfies Record<FishingEvent['kind'], number>;
const INT16_MIN = -32768;
const INT16_MAX = 32767;

/** type(1) + netId(2) + hunger(1) + what was eaten, if anything(1) */
const HUNGER_MESSAGE_BYTES = 5;
/** No item at all - nothing eaten, or nothing paid out for a catch. */
const NO_ITEM = 0xff;
/** type(1) + netId(2) + health(1) + knocked out or not(1) */
const HEALTH_MESSAGE_BYTES = 5;
/** type(1) + netId(2) + buried or dug up(1) */
const CACHE_MESSAGE_BYTES = 4;

/** type(1) + which item to make(1) */
const CRAFT_MESSAGE_BYTES = 2;
const BUILD_MESSAGE_BYTES = 2;
/** type(1) + netId(2) + what was made(1) */
const CRAFTED_MESSAGE_BYTES = 4;

/** type(1) + netId(2) + what was caught(1) + how many went in(1) */
const CAUGHT_MESSAGE_BYTES = 5;

export function quantisePosition(metres: number): number {
  return Math.round(metres * POSITION_SCALE);
}

export function dequantisePosition(centimetres: number): number {
  return centimetres / POSITION_SCALE;
}

export function quantiseVelocity(metresPerSecond: number): number {
  return clamp(
    Math.round(metresPerSecond * VELOCITY_SCALE),
    -MAX_QUANTISED_VELOCITY,
    MAX_QUANTISED_VELOCITY,
  );
}

export function dequantiseVelocity(packed: number): number {
  return packed / VELOCITY_SCALE;
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

export function encodeCraft(item: ItemId): ArrayBuffer {
  const buffer = new ArrayBuffer(CRAFT_MESSAGE_BYTES);
  const view = new DataView(buffer);
  view.setUint8(0, ClientMessageType.Craft);
  view.setUint8(1, itemIndex(item));
  return buffer;
}

export function encodeBuild(kind: BuildableKindId): ArrayBuffer {
  const buffer = new ArrayBuffer(BUILD_MESSAGE_BYTES);
  const view = new DataView(buffer);
  view.setUint8(0, ClientMessageType.Build);
  view.setUint8(1, buildableKindIndex(kind));
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

  if (type === ClientMessageType.Craft) {
    if (data.byteLength !== CRAFT_MESSAGE_BYTES) return null;
    const item = itemFromIndex(view.getUint8(1));
    if (item === null) return null;
    return { type: 'craft', item };
  }

  if (type === ClientMessageType.Build) {
    if (data.byteLength !== BUILD_MESSAGE_BYTES) return null;
    const kind = buildableKindFromIndex(view.getUint8(1));
    if (kind === null) return null;
    return { type: 'build', kind };
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
    view.setInt16(offset + 14, quantiseVelocity(entity.vx), true);
    view.setInt16(offset + 16, quantiseVelocity(entity.vy), true);
    view.setInt16(offset + 18, quantiseVelocity(entity.vz), true);
    view.setUint16(offset + 20, quantiseAngle(entity.yaw), true);
    view.setUint8(offset + 22, entity.flags & 0xff);
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

export function encodeInventory(
  items: readonly { readonly item: ItemId; readonly count: number }[],
): ArrayBuffer {
  const count = Math.min(items.length, MAX_INVENTORY_ENTRIES);
  const buffer = new ArrayBuffer(2 + count * BYTES_PER_INVENTORY_ENTRY);
  const view = new DataView(buffer);
  view.setUint8(0, ServerMessageType.Inventory);
  view.setUint8(1, count);

  let offset = 2;
  for (let i = 0; i < count; i++) {
    const entry = items[i];
    if (entry === undefined) break;
    view.setUint8(offset, itemIndex(entry.item));
    view.setUint16(offset + 1, clamp(Math.round(entry.count), 0, 65535), true);
    offset += BYTES_PER_INVENTORY_ENTRY;
  }
  return buffer;
}

export function encodePickupsTaken(pickupIds: readonly number[]): ArrayBuffer {
  const count = Math.min(pickupIds.length, MAX_TAKEN_PICKUPS);
  const buffer = new ArrayBuffer(2 + count * BYTES_PER_TAKEN_PICKUP);
  const view = new DataView(buffer);
  view.setUint8(0, ServerMessageType.PickupsTaken);
  view.setUint8(1, count);

  let offset = 2;
  for (let i = 0; i < count; i++) {
    view.setUint16(offset, (pickupIds[i] ?? 0) & 0xffff, true);
    offset += BYTES_PER_TAKEN_PICKUP;
  }
  return buffer;
}

export function encodeTreeStates(trees: readonly TreeState[]): ArrayBuffer {
  const count = Math.min(trees.length, MAX_CHANGED_TREES);
  const buffer = new ArrayBuffer(2 + count * BYTES_PER_TREE_STATE);
  const view = new DataView(buffer);
  view.setUint8(0, ServerMessageType.TreeStates);
  view.setUint8(1, count);

  let offset = 2;
  for (let i = 0; i < count; i++) {
    const tree = trees[i];
    if (tree === undefined) break;
    view.setUint16(offset, tree.treeId & 0xffff, true);
    view.setUint8(offset + 2, clamp(Math.round(tree.generation), 0, MAX_TREE_GENERATION));
    view.setUint8(offset + 3, tree.felled ? TREE_FELLED_FLAG : 0);
    offset += BYTES_PER_TREE_STATE;
  }
  return buffer;
}

/**
 * Everything anybody has ever built, sent whole - the same way tree states are.
 *
 * Campfires have no per-player cap, so a long-lived world can outgrow
 * MAX_BUILT_PROPS. When it does, this keeps the most recently built ones
 * rather than the oldest - losing sight of something built long ago is a much
 * smaller problem than a new campfire silently never reaching anybody.
 */
export function encodeBuiltProps(props: readonly BuiltProp[]): ArrayBuffer {
  const start = Math.max(0, props.length - MAX_BUILT_PROPS);
  const count = props.length - start;
  const buffer = new ArrayBuffer(2 + count * BYTES_PER_BUILT_PROP);
  const view = new DataView(buffer);
  view.setUint8(0, ServerMessageType.BuiltProps);
  view.setUint8(1, count);

  let offset = 2;
  for (let i = 0; i < count; i++) {
    const prop = props[start + i];
    if (prop === undefined) break;
    view.setUint16(offset, prop.id & 0xffff, true);
    view.setUint8(offset + 2, buildableKindIndex(prop.kind));
    view.setInt16(offset + 3, clamp(quantisePosition(prop.x), INT16_MIN, INT16_MAX), true);
    view.setInt16(offset + 5, clamp(quantisePosition(prop.z), INT16_MIN, INT16_MAX), true);
    view.setUint8(offset + 7, prop.lit ? BUILT_PROP_LIT_FLAG : 0);
    offset += BYTES_PER_BUILT_PROP;
  }
  return buffer;
}

/**
 * Everything currently buried, sent whole - the same way built props are.
 *
 * What each one holds never goes over the wire: nothing needs to say what is
 * in a cache, only that it is there and whose.
 *
 * A cache never expires (see decision 0028), so a long-lived world can
 * outgrow MAX_BURIED_CACHES same as built props can. Keeps the most recent
 * ones for the same reason: a very old, likely-forgotten mound is a smaller
 * loss than a fresh one nobody can ever see.
 */
export function encodeBuriedCaches(caches: readonly BuriedCacheView[]): ArrayBuffer {
  const start = Math.max(0, caches.length - MAX_BURIED_CACHES);
  const count = caches.length - start;
  const buffer = new ArrayBuffer(2 + count * BYTES_PER_BURIED_CACHE);
  const view = new DataView(buffer);
  view.setUint8(0, ServerMessageType.BuriedCaches);
  view.setUint8(1, count);

  let offset = 2;
  for (let i = 0; i < count; i++) {
    const cache = caches[start + i];
    if (cache === undefined) break;
    view.setUint16(offset, cache.id & 0xffff, true);
    view.setUint16(
      offset + 2,
      cache.ownerNetId === null ? NO_OWNER : cache.ownerNetId & 0xffff,
      true,
    );
    view.setInt16(offset + 4, clamp(quantisePosition(cache.x), INT16_MIN, INT16_MAX), true);
    view.setInt16(offset + 6, clamp(quantisePosition(cache.z), INT16_MIN, INT16_MAX), true);
    offset += BYTES_PER_BURIED_CACHE;
  }
  return buffer;
}

export function encodeTreeHit(treeId: number, swingsLeft: number, netId: number): ArrayBuffer {
  const buffer = new ArrayBuffer(6);
  const view = new DataView(buffer);
  view.setUint8(0, ServerMessageType.TreeHit);
  view.setUint16(1, treeId & 0xffff, true);
  view.setUint8(3, clamp(Math.round(swingsLeft), 0, 255));
  view.setUint16(4, netId & 0xffff, true);
  return buffer;
}

/**
 * One thing that happened at the water, in eight bytes.
 *
 * The last two numbers mean different things for different news: where the
 * float landed for a cast, and which fish and how many were kept for a catch.
 */
export function encodeFishing(event: FishingEvent): ArrayBuffer {
  const buffer = new ArrayBuffer(FISHING_MESSAGE_BYTES);
  const view = new DataView(buffer);
  view.setUint8(0, ServerMessageType.Fishing);
  view.setUint16(1, event.netId & 0xffff, true);
  view.setUint8(3, FISHING_KIND_CODES[event.kind]);

  if (event.kind === 'cast') {
    view.setInt16(4, clamp(quantisePosition(event.x), INT16_MIN, INT16_MAX), true);
    view.setInt16(6, clamp(quantisePosition(event.z), INT16_MIN, INT16_MAX), true);
  } else if (event.kind === 'caught') {
    view.setInt16(4, itemIndex(event.item), true);
    view.setInt16(6, clamp(Math.round(event.added), 0, INT16_MAX), true);
  }
  return buffer;
}

function decodeFishing(view: DataView): FishingEvent | null {
  const netId = view.getUint16(1, true);
  const a = view.getInt16(4, true);
  const b = view.getInt16(6, true);

  switch (view.getUint8(3)) {
    case FISHING_KIND_CODES.cast:
      return { kind: 'cast', netId, x: dequantisePosition(a), z: dequantisePosition(b) };
    case FISHING_KIND_CODES.bite:
      return { kind: 'bite', netId };
    case FISHING_KIND_CODES.caught: {
      const item = itemFromIndex(a);
      if (item === null) return null;
      return { kind: 'caught', netId, item, added: b };
    }
    case FISHING_KIND_CODES.tooSoon:
      return { kind: 'tooSoon', netId };
    case FISHING_KIND_CODES.tooLate:
      return { kind: 'tooLate', netId };
    case FISHING_KIND_CODES.walkedAway:
      return { kind: 'walkedAway', netId };
    default:
      return null;
  }
}

/**
 * How hungry a player is now, in five bytes.
 *
 * `ate` names what was just eaten, for a HUD toast, or the "no item" sentinel
 * when this is only the meter running down on its own.
 */
export function encodeHunger(event: HungerEvent): ArrayBuffer {
  const buffer = new ArrayBuffer(HUNGER_MESSAGE_BYTES);
  const view = new DataView(buffer);
  view.setUint8(0, ServerMessageType.Hunger);
  view.setUint16(1, event.netId & 0xffff, true);
  view.setUint8(3, clamp(Math.round(event.hunger), 0, 255));
  view.setUint8(4, event.ate === null ? NO_ITEM : itemIndex(event.ate));
  return buffer;
}

function decodeHunger(view: DataView): HungerEvent {
  const ateIndex = view.getUint8(4);
  return {
    netId: view.getUint16(1, true),
    hunger: view.getUint8(3),
    // An id this build does not know is still worth showing the number for,
    // so this only drops the toast rather than the whole message.
    ate: ateIndex === NO_ITEM ? null : itemFromIndex(ateIndex),
  };
}

/** What a player just made, in four bytes. Only they are ever sent it. */
export function encodeCrafted(event: CraftedEvent): ArrayBuffer {
  const buffer = new ArrayBuffer(CRAFTED_MESSAGE_BYTES);
  const view = new DataView(buffer);
  view.setUint8(0, ServerMessageType.Crafted);
  view.setUint16(1, event.netId & 0xffff, true);
  view.setUint8(3, itemIndex(event.item));
  return buffer;
}

function decodeCrafted(view: DataView): CraftedEvent | null {
  const item = itemFromIndex(view.getUint8(3));
  if (item === null) return null;
  return { netId: view.getUint16(1, true), item };
}

/**
 * What a player just caught, in five bytes. Only they are ever sent it.
 *
 * `item` is the "no item" sentinel for a threat defeated with nothing to
 * show for it, the same as `Hunger`'s `ate` is when nothing was eaten.
 */
export function encodeCaught(event: AnimalCaught): ArrayBuffer {
  const buffer = new ArrayBuffer(CAUGHT_MESSAGE_BYTES);
  const view = new DataView(buffer);
  view.setUint8(0, ServerMessageType.Caught);
  view.setUint16(1, event.netId & 0xffff, true);
  view.setUint8(3, event.item === null ? NO_ITEM : itemIndex(event.item));
  view.setUint8(4, clamp(Math.round(event.added), 0, 255));
  return buffer;
}

function decodeCaught(view: DataView): AnimalCaught | null {
  const itemIndexByte = view.getUint8(3);
  if (itemIndexByte === NO_ITEM) {
    return { netId: view.getUint16(1, true), item: null, added: view.getUint8(4) };
  }
  const item = itemFromIndex(itemIndexByte);
  if (item === null) return null;
  return { netId: view.getUint16(1, true), item, added: view.getUint8(4) };
}

/**
 * A swing landed on a threat, or one just came back from being defeated, in
 * four bytes. Everybody is sent it, the same as a tree hit.
 */
export function encodeThreatHit(event: ThreatHit): ArrayBuffer {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setUint8(0, ServerMessageType.ThreatHit);
  view.setUint16(1, event.animalId & 0xffff, true);
  view.setUint8(3, clamp(Math.round(event.hitsLeft), 0, 255));
  return buffer;
}

function decodeThreatHit(view: DataView): ThreatHit {
  return { animalId: view.getUint16(1, true), hitsLeft: view.getUint8(3) };
}

/** Bit flags packed into a Health message's last byte, so a dodge costs no extra space. */
const HEALTH_FLAG_KNOCKED_OUT = 1 << 0;
const HEALTH_FLAG_DODGED = 1 << 1;

/** How much health a player has left, in five bytes. Only they are ever sent it. */
export function encodeHealth(event: HealthEvent): ArrayBuffer {
  const buffer = new ArrayBuffer(HEALTH_MESSAGE_BYTES);
  const view = new DataView(buffer);
  view.setUint8(0, ServerMessageType.Health);
  view.setUint16(1, event.netId & 0xffff, true);
  view.setUint8(3, clamp(Math.round(event.health), 0, 255));
  view.setUint8(
    4,
    (event.knockedOut ? HEALTH_FLAG_KNOCKED_OUT : 0) | (event.dodged ? HEALTH_FLAG_DODGED : 0),
  );
  return buffer;
}

function decodeHealth(view: DataView): HealthEvent {
  const flags = view.getUint8(4);
  return {
    netId: view.getUint16(1, true),
    health: view.getUint8(3),
    knockedOut: (flags & HEALTH_FLAG_KNOCKED_OUT) !== 0,
    dodged: (flags & HEALTH_FLAG_DODGED) !== 0,
  };
}

const CACHE_FLAG_DUG_UP = 1 << 0;

/** Word that a player's own buried cache changed, in four bytes. Only they are ever sent it. */
export function encodeCache(event: CacheEvent): ArrayBuffer {
  const buffer = new ArrayBuffer(CACHE_MESSAGE_BYTES);
  const view = new DataView(buffer);
  view.setUint8(0, ServerMessageType.Cache);
  view.setUint16(1, event.netId & 0xffff, true);
  view.setUint8(3, event.kind === 'dugUp' ? CACHE_FLAG_DUG_UP : 0);
  return buffer;
}

function decodeCache(view: DataView): CacheEvent {
  return {
    netId: view.getUint16(1, true),
    kind: (view.getUint8(3) & CACHE_FLAG_DUG_UP) !== 0 ? 'dugUp' : 'buried',
  };
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
          vx: dequantiseVelocity(view.getInt16(offset + 14, true)),
          vy: dequantiseVelocity(view.getInt16(offset + 16, true)),
          vz: dequantiseVelocity(view.getInt16(offset + 18, true)),
          yaw: dequantiseAngle(view.getUint16(offset + 20, true)),
          flags: view.getUint8(offset + 22),
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
    case ServerMessageType.Inventory: {
      if (data.byteLength < 2) return null;
      const count = view.getUint8(1);
      if (data.byteLength !== 2 + count * BYTES_PER_INVENTORY_ENTRY) return null;
      const items: { item: ItemId; count: number }[] = [];
      let offset = 2;
      for (let i = 0; i < count; i++) {
        const item = itemFromIndex(view.getUint8(offset));
        // An item this build has never heard of means the server is newer than
        // we are. Dropping the whole message is safer than showing half a pack.
        if (item === null) return null;
        items.push({ item, count: view.getUint16(offset + 1, true) });
        offset += BYTES_PER_INVENTORY_ENTRY;
      }
      return { type: 'inventory', items };
    }
    case ServerMessageType.PickupsTaken: {
      if (data.byteLength < 2) return null;
      const count = view.getUint8(1);
      if (data.byteLength !== 2 + count * BYTES_PER_TAKEN_PICKUP) return null;
      const pickupIds: number[] = [];
      let offset = 2;
      for (let i = 0; i < count; i++) {
        pickupIds.push(view.getUint16(offset, true));
        offset += BYTES_PER_TAKEN_PICKUP;
      }
      return { type: 'pickupsTaken', pickupIds };
    }
    case ServerMessageType.TreeStates: {
      if (data.byteLength < 2) return null;
      const count = view.getUint8(1);
      if (data.byteLength !== 2 + count * BYTES_PER_TREE_STATE) return null;
      const trees: TreeState[] = [];
      let offset = 2;
      for (let i = 0; i < count; i++) {
        trees.push({
          treeId: view.getUint16(offset, true),
          generation: view.getUint8(offset + 2),
          felled: (view.getUint8(offset + 3) & TREE_FELLED_FLAG) !== 0,
        });
        offset += BYTES_PER_TREE_STATE;
      }
      return { type: 'treeStates', trees };
    }
    case ServerMessageType.BuiltProps: {
      if (data.byteLength < 2) return null;
      const count = view.getUint8(1);
      if (data.byteLength !== 2 + count * BYTES_PER_BUILT_PROP) return null;
      const props: BuiltProp[] = [];
      let offset = 2;
      for (let i = 0; i < count; i++) {
        const kind = buildableKindFromIndex(view.getUint8(offset + 2));
        if (kind === null) return null;
        props.push({
          id: view.getUint16(offset, true),
          kind,
          x: dequantisePosition(view.getInt16(offset + 3, true)),
          z: dequantisePosition(view.getInt16(offset + 5, true)),
          lit: (view.getUint8(offset + 7) & BUILT_PROP_LIT_FLAG) !== 0,
        });
        offset += BYTES_PER_BUILT_PROP;
      }
      return { type: 'builtProps', props };
    }
    case ServerMessageType.BuriedCaches: {
      if (data.byteLength < 2) return null;
      const count = view.getUint8(1);
      if (data.byteLength !== 2 + count * BYTES_PER_BURIED_CACHE) return null;
      const caches: BuriedCacheView[] = [];
      let offset = 2;
      for (let i = 0; i < count; i++) {
        const ownerNetId = view.getUint16(offset + 2, true);
        caches.push({
          id: view.getUint16(offset, true),
          ownerNetId: ownerNetId === NO_OWNER ? null : ownerNetId,
          x: dequantisePosition(view.getInt16(offset + 4, true)),
          z: dequantisePosition(view.getInt16(offset + 6, true)),
        });
        offset += BYTES_PER_BURIED_CACHE;
      }
      return { type: 'buriedCaches', caches };
    }
    case ServerMessageType.TreeHit: {
      if (data.byteLength !== 6) return null;
      return {
        type: 'treeHit',
        treeId: view.getUint16(1, true),
        swingsLeft: view.getUint8(3),
        netId: view.getUint16(4, true),
      };
    }
    case ServerMessageType.Fishing: {
      if (data.byteLength !== FISHING_MESSAGE_BYTES) return null;
      const event = decodeFishing(view);
      return event === null ? null : { type: 'fishing', event };
    }
    case ServerMessageType.Hunger: {
      if (data.byteLength !== HUNGER_MESSAGE_BYTES) return null;
      return { type: 'hunger', event: decodeHunger(view) };
    }
    case ServerMessageType.Crafted: {
      if (data.byteLength !== CRAFTED_MESSAGE_BYTES) return null;
      const event = decodeCrafted(view);
      return event === null ? null : { type: 'crafted', event };
    }
    case ServerMessageType.Caught: {
      if (data.byteLength !== CAUGHT_MESSAGE_BYTES) return null;
      const event = decodeCaught(view);
      return event === null ? null : { type: 'caught', event };
    }
    case ServerMessageType.ThreatHit: {
      if (data.byteLength !== 4) return null;
      return { type: 'threatHit', event: decodeThreatHit(view) };
    }
    case ServerMessageType.Health: {
      if (data.byteLength !== HEALTH_MESSAGE_BYTES) return null;
      return { type: 'health', event: decodeHealth(view) };
    }
    case ServerMessageType.Cache: {
      if (data.byteLength !== CACHE_MESSAGE_BYTES) return null;
      return { type: 'cache', event: decodeCache(view) };
    }
    case ServerMessageType.Rejected: {
      if (data.byteLength !== 2) return null;
      const reason = view.getUint8(1);
      return {
        type: 'rejected',
        reason:
          reason === RejectReason.WorldFull ? RejectReason.WorldFull : RejectReason.BadMessage,
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
