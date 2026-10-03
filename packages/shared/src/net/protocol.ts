import type { HomeSupplies } from '../sim/home-supplies';
import { DISCOVERY_MASK, type DiscoveryState } from '../data/discoveries';
import {
  GARDEN_CROPS,
  GARDEN_PLOTS,
  GARDEN_GROW_TICKS,
  GARDEN_REASONS,
  gardenFromSaved,
  type GardenRequest,
  type GardenState,
} from '../sim/garden';
import {
  HOME_BUILD_REASONS,
  isHomeKind,
  type HomeBuildFeedback,
  HOME_SKILL_MASK,
} from '../data/housing';
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

import {
  CHEST_SLOTS,
  CHEST_REASONS,
  emptyChest,
  chestFromSaved,
  type ChestRequest,
  type ChestResult,
} from '../sim/chest';
import { MAX_PLAYERS_PER_WORLD, MAX_TREE_GENERATION, SNAPSHOT_HZ, TICK_HZ } from '../constants';
import { itemFromIndex, itemIndex, type ItemId } from '../data/items';
import { buildableKindFromIndex, buildableKindIndex } from '../data/buildables';
import {
  characterFromIndex,
  characterIndex,
  tintColorFromIndex,
  tintColorIndex,
  type CharacterId,
  type TintColorId,
} from '../data/characters';
import { clamp } from '../math/vec3';
import { wrapAngle, TAU } from '../math/angles';
import type { PlayerInput } from '../sim/player';
import { GESTURE_COUNT, type Gesture, type GestureEvent } from '../sim/actions';
import { EXPLORED_BYTES } from '../sim/exploring';
import type { GatherPatchView } from '../sim/gathering';
import { MAX_PILE_COUNT, type DroppedPileView } from '../sim/dropping';
import { raiderKindFromIndex, raiderKindIndex } from '../data/raiders';
import type { RaidNews, RaidNewsKind, RaiderHit, RaiderView } from '../sim/raids';
import type {
  AnimalCaught,
  BuildRequest,
  BuiltProp,
  BuriedCacheView,
  CacheEvent,
  CraftedEvent,
  CookedEvent,
  CollectedEvent,
  DiscardedEvent,
  DiscardRequest,
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
  type BuiltPropView,
  type ClientMessage,
  type LootRequest,
  type EquippedEntry,
  type RejectReasonCode,
  type RosterEntry,
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

const BYTES_PER_INPUT = 7;
const INPUT_HEADER_BYTES = 6;
/**
 * netId(2) + x,y,z(4 each) + vx,vy,vz(2 each) + yaw(2) + flags(1) + the move
 * in progress: packed kind(1) + age(1) + heading(1).
 */
const BYTES_PER_SNAPSHOT_ENTITY = 26;
/** type(1) + tick(4) + serverTimeMs(4) + ackSeq(4) + count(1) + the viewer's own dodge cooldown(1). */
const SNAPSHOT_HEADER_BYTES = 15;

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
/** A clearing has a handful of patches; a one-byte count is plenty. */
export const MAX_GATHER_PATCHES = 255;
/** A world keeps at most `MAX_DROPPED_PILES` (64), well inside a one-byte count. */
export const MAX_SENT_DROPPED_PILES = 255;
/** A world never holds more players than this, so the roster never needs to either. */
export const MAX_ROSTER_ENTRIES = MAX_PLAYERS_PER_WORLD;
/** One entry per connected player, the same ceiling `Roster` already has. */
export const MAX_EQUIPPED_ENTRIES = MAX_PLAYERS_PER_WORLD;
/**
 * A name is capped at MAX_PLAYER_NAME_LENGTH *characters* on the Home screen,
 * but travels as UTF-8 bytes here - generous enough for that many characters
 * even if every one of them needs the full four bytes, while still comfortably
 * fitting the one-byte length prefix below.
 */
export const MAX_NAME_BYTES = 80;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/** UTF-8 bytes for a name, never longer than `MAX_NAME_BYTES`. */
function encodeName(name: string): Uint8Array {
  return textEncoder.encode(name).slice(0, MAX_NAME_BYTES);
}

const BYTES_PER_INVENTORY_ENTRY = 3;
const BYTES_PER_TAKEN_PICKUP = 2;
/** treeId(2) + generation(1) + flags(1) + fall yaw(4) + fall start milliseconds(8) */
const BYTES_PER_TREE_STATE = 16;
const TREE_FELLED_FLAG = 1;
const TREE_FALL_FLAG = 2;
/** id(2) + kind(1) + x(2) + z(2) + yaw(2) + flags(1) */
const BYTES_PER_BUILT_PROP = 10;
/** Only a campfire ever sets this, but the bit costs nothing on anything else. */
const BUILT_PROP_LIT_FLAG = 1;
/** Set only on the copy of the list sent to whoever owns it. */
const BUILT_PROP_YOURS_FLAG = 2;
/** Only a home ever sets this: its owner has locked the door to visitors. */
const BUILT_PROP_LOCKED_FLAG = 4;
/** id(2) + ownerNetId(2) + x(2) + z(2) */
const BYTES_PER_BURIED_CACHE = 8;
/** id(1) + item(1) + x(2) + z(2) + how many are left(1) */
const BYTES_PER_GATHER_PATCH = 7;
/** id(2) + item(1) + count(2) + x(2) + z(2) */
const BYTES_PER_DROPPED_PILE = 9;
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
/** type(1) + which kind(1) + x(2) + z(2) + yaw(2) */
const BUILD_MESSAGE_BYTES = 8;
/** type(1) + which item to use(1) */
const USE_ITEM_MESSAGE_BYTES = 2;
/** type(1) + netId(2) + what was made(1) */
const CRAFTED_MESSAGE_BYTES = 4;
/** type(1) + netId(2) + raw item(1) + cooked item(1) */
const COOKED_MESSAGE_BYTES = 5;
/** type(1) + which item(1) + how many(2) + flags(1) */
const DISCARD_MESSAGE_BYTES = 5;
/** type(1) + netId(2) + which item(1) + how many(2) + flags(1) */
const DISCARDED_MESSAGE_BYTES = 7;
/** Destroyed, rather than dropped on the ground. */
const DISCARD_DESTROY_FLAG = 1;

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
    view.setUint16(offset + 4, quantiseAngle(input.aimYaw), true);
    view.setUint8(offset + 6, input.buttons & 0xff);
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

export function encodeBuild(request: BuildRequest): ArrayBuffer {
  const buffer = new ArrayBuffer(BUILD_MESSAGE_BYTES);
  const view = new DataView(buffer);
  view.setUint8(0, ClientMessageType.Build);
  view.setUint8(1, buildableKindIndex(request.kind));
  view.setInt16(2, clamp(quantisePosition(request.x), INT16_MIN, INT16_MAX), true);
  view.setInt16(4, clamp(quantisePosition(request.z), INT16_MIN, INT16_MAX), true);
  view.setUint16(6, quantiseAngle(request.yaw), true);
  return buffer;
}

export function encodeSetDoorLock(locked: boolean): ArrayBuffer {
  const buffer = new ArrayBuffer(2);
  const view = new DataView(buffer);
  view.setUint8(0, ClientMessageType.SetDoorLock);
  view.setUint8(1, locked ? 1 : 0);
  return buffer;
}

/** Drop or destroy some of one thing (see decision 0061). */
const LOOT_KINDS = ['pickup', 'pile', 'patch'] as const;

export function encodeChestRequest(request: ChestRequest): ArrayBuffer {
  if (request.action === 'open') return new Uint8Array([ClientMessageType.Chest, 0]).buffer;
  const buffer = new ArrayBuffer(5);
  const view = new DataView(buffer);
  view.setUint8(0, ClientMessageType.Chest);
  view.setUint8(1, request.action === 'deposit' ? 1 : 2);
  view.setUint8(2, request.action === 'deposit' ? itemIndex(request.item) : request.slot);
  view.setUint16(3, request.amount, true);
  return buffer;
}

export function encodeGardenRequest(request: GardenRequest): ArrayBuffer {
  const actions = ['inspect', 'plant', 'harvest'];
  return new Uint8Array([
    ClientMessageType.Garden,
    actions.indexOf(request.action),
    request.action === 'inspect' ? 0 : request.plot,
    request.action === 'plant' ? GARDEN_CROPS.indexOf(request.crop) + 1 : 0,
  ]).buffer;
}
export function encodeGardenState(state: GardenState): ArrayBuffer {
  const view = new DataView(new ArrayBuffer(7 + GARDEN_PLOTS * 3));
  view.setUint8(0, ServerMessageType.Garden);
  view.setUint32(1, state.homeId, true);
  view.setUint8(5, state.yours ? 1 : 0);
  view.setUint8(6, state.reason === null ? 0 : GARDEN_REASONS.indexOf(state.reason) + 1);
  state.plots.forEach((plot, index) => {
    view.setUint8(7 + index * 3, plot.crop === null ? 0 : GARDEN_CROPS.indexOf(plot.crop) + 1);
    view.setUint16(8 + index * 3, plot.growTicks, true);
  });
  return view.buffer;
}
export function encodeChestState(result: ChestResult): ArrayBuffer {
  const buffer = new ArrayBuffer(6 + CHEST_SLOTS * 3);
  const view = new DataView(buffer);
  view.setUint8(0, ServerMessageType.Chest);
  view.setUint16(1, result.homeId, true);
  view.setUint8(3, result.reason === null ? 0 : CHEST_REASONS.indexOf(result.reason) + 1);
  view.setUint16(4, result.moved, true);
  for (let i = 0; i < CHEST_SLOTS; i++) {
    const slot = result.slots[i];
    view.setUint8(6 + i * 3, slot == null ? 255 : itemIndex(slot.item));
    view.setUint16(7 + i * 3, slot?.count ?? 0, true);
  }
  return buffer;
}

export function encodeLoot(request: LootRequest): ArrayBuffer {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setUint8(0, ClientMessageType.Loot);
  view.setUint8(1, LOOT_KINDS.indexOf(request.kind));
  view.setUint16(2, request.id, true);
  return buffer;
}

export function encodeDiscard(request: DiscardRequest): ArrayBuffer {
  const buffer = new ArrayBuffer(DISCARD_MESSAGE_BYTES);
  const view = new DataView(buffer);
  view.setUint8(0, ClientMessageType.Discard);
  view.setUint8(1, itemIndex(request.item));
  view.setUint16(2, clamp(Math.round(request.amount), 0, 0xffff), true);
  view.setUint8(4, request.destroy ? DISCARD_DESTROY_FLAG : 0);
  return buffer;
}

export function encodeUseItem(item: ItemId): ArrayBuffer {
  const buffer = new ArrayBuffer(USE_ITEM_MESSAGE_BYTES);
  const view = new DataView(buffer);
  view.setUint8(0, ClientMessageType.UseItem);
  view.setUint8(1, itemIndex(item));
  return buffer;
}

/**
 * Introduce yourself: the name, character and tint picked on the Home screen.
 *
 * type(1) + character(1) + color(1) + nameLength(1) + name bytes.
 */
export function encodeHello(name: string, character: CharacterId, color: TintColorId): ArrayBuffer {
  const nameBytes = encodeName(name);
  const buffer = new ArrayBuffer(4 + nameBytes.length);
  const view = new DataView(buffer);
  view.setUint8(0, ClientMessageType.Hello);
  view.setUint8(1, characterIndex(character));
  view.setUint8(2, tintColorIndex(color));
  view.setUint8(3, nameBytes.length);
  new Uint8Array(buffer, 4).set(nameBytes);
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

  if (type === ClientMessageType.Garden) {
    if (data.byteLength !== 4) return null;
    const action = view.getUint8(1),
      plot = view.getUint8(2),
      crop = view.getUint8(3);
    if (action > 2 || plot >= GARDEN_PLOTS || crop > GARDEN_CROPS.length) return null;
    if (action === 0)
      return plot === 0 && crop === 0 ? { type: 'garden', action: 'inspect' } : null;
    if (action === 1)
      return crop === 0
        ? null
        : { type: 'garden', action: 'plant', plot, crop: GARDEN_CROPS[crop - 1]! };
    return crop === 0 ? { type: 'garden', action: 'harvest', plot } : null;
  }

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
        aimYaw: dequantiseAngle(view.getUint16(offset + 4, true)),
        buttons: view.getUint8(offset + 6),
      });
      offset += BYTES_PER_INPUT;
    }
    return { type: 'input', inputs };
  }

  if (type === ClientMessageType.Chest) {
    if (data.byteLength === 2 && view.getUint8(1) === 0) return { type: 'chest', action: 'open' };
    if (data.byteLength !== 5) return null;
    const action = view.getUint8(1),
      source = view.getUint8(2),
      amount = view.getUint16(3, true);
    if (amount === 0) return null;
    if (action === 1) {
      const item = itemFromIndex(source);
      return item === null ? null : { type: 'chest', action: 'deposit', item, amount };
    }
    if (action === 2 && source < CHEST_SLOTS)
      return { type: 'chest', action: 'withdraw', slot: source, amount };
    return null;
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
    return {
      type: 'build',
      kind,
      x: dequantisePosition(view.getInt16(2, true)),
      z: dequantisePosition(view.getInt16(4, true)),
      yaw: dequantiseAngle(view.getUint16(6, true)),
    };
  }

  if (type === ClientMessageType.SetDoorLock) {
    if (data.byteLength !== 2) return null;
    return { type: 'setDoorLock', locked: view.getUint8(1) !== 0 };
  }

  if (type === ClientMessageType.UseItem) {
    if (data.byteLength !== USE_ITEM_MESSAGE_BYTES) return null;
    const item = itemFromIndex(view.getUint8(1));
    if (item === null) return null;
    return { type: 'useItem', item };
  }

  if (type === ClientMessageType.Discard) {
    if (data.byteLength !== DISCARD_MESSAGE_BYTES) return null;
    const item = itemFromIndex(view.getUint8(1));
    const amount = view.getUint16(2, true);
    if (item === null || amount === 0) return null;
    return {
      type: 'discard',
      item,
      amount,
      destroy: (view.getUint8(4) & DISCARD_DESTROY_FLAG) !== 0,
    };
  }

  if (type === ClientMessageType.Loot) {
    if (data.byteLength !== 4) return null;
    const kind = LOOT_KINDS[view.getUint8(1)];
    if (kind === undefined) return null;
    return { type: 'loot', kind, id: view.getUint16(2, true) };
  }

  if (type === ClientMessageType.Hello) {
    if (data.byteLength < 4) return null;
    const character = characterFromIndex(view.getUint8(1));
    const color = tintColorFromIndex(view.getUint8(2));
    const nameLength = view.getUint8(3);
    if (character === null || color === null) return null;
    if (data.byteLength !== 4 + nameLength) return null;
    const name = textDecoder.decode(new Uint8Array(data, 4, nameLength));
    return { type: 'hello', name, character, color };
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
  dodgeCooldown = 0,
): ArrayBuffer {
  const count = Math.min(entities.length, MAX_SNAPSHOT_ENTITIES);
  const buffer = new ArrayBuffer(SNAPSHOT_HEADER_BYTES + count * BYTES_PER_SNAPSHOT_ENTITY);
  const view = new DataView(buffer);
  view.setUint8(0, ServerMessageType.Snapshot);
  view.setUint32(1, tick >>> 0, true);
  view.setUint32(5, serverTimeMs >>> 0, true);
  view.setUint32(9, ackSeq >>> 0, true);
  view.setUint8(13, count);
  view.setUint8(14, clamp(Math.round(dodgeCooldown), 0, 255));

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
    view.setUint8(offset + 23, entity.action & 0xff);
    view.setUint8(offset + 24, clamp(Math.round(entity.actionAge), 0, 255));
    view.setUint8(offset + 25, entity.actionHeading & 0xff);
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

export function encodeHomeBuildFeedback(result: HomeBuildFeedback): ArrayBuffer {
  const data = new ArrayBuffer(5);
  const view = new DataView(data);
  view.setUint8(0, ServerMessageType.HomeBuildFeedback);
  view.setUint8(1, buildableKindIndex(result.kind));
  view.setUint16(2, result.homeId, true);
  view.setUint8(4, result.reason === null ? 0 : HOME_BUILD_REASONS.indexOf(result.reason) + 1);
  return data;
}
export function encodeHomeSkills(skills: number): ArrayBuffer {
  return new Uint8Array([ServerMessageType.HomeSkills, skills & HOME_SKILL_MASK]).buffer;
}

export function encodeHomeSupplies(state: HomeSupplies): ArrayBuffer {
  const data = new ArrayBuffer(6 + state.items.length * 3),
    view = new DataView(data);
  view.setUint8(0, ServerMessageType.HomeSupplies);
  view.setUint32(1, state.homeId, true);
  view.setUint8(5, state.items.length);
  state.items.forEach((entry, index) => {
    view.setUint8(6 + index * 3, itemIndex(entry.item));
    view.setUint16(7 + index * 3, entry.count, true);
  });
  return data;
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
    const fall = tree.felled ? tree.fall : undefined;
    view.setUint8(offset + 3, (tree.felled ? TREE_FELLED_FLAG : 0) | (fall ? TREE_FALL_FLAG : 0));
    view.setFloat32(offset + 4, fall?.yaw ?? 0, true);
    view.setFloat64(offset + 8, fall?.startedAtMs ?? 0, true);
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
export function encodeBuiltProps(
  props: readonly BuiltProp[],
  isYours: (propId: number) => boolean = () => false,
): ArrayBuffer {
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
    view.setUint16(offset + 7, quantiseAngle(prop.yaw), true);
    view.setUint8(
      offset + 9,
      (prop.lit ? BUILT_PROP_LIT_FLAG : 0) |
        (isYours(prop.id) ? BUILT_PROP_YOURS_FLAG : 0) |
        (prop.locked === true ? BUILT_PROP_LOCKED_FLAG : 0),
    );
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

/**
 * Every stick and flower patch, sent whole: where each is and how many are
 * left, zero meaning picked clean and waiting to grow back somewhere else.
 */
export function encodeGatherPatches(patches: readonly GatherPatchView[]): ArrayBuffer {
  const count = Math.min(patches.length, MAX_GATHER_PATCHES);
  const buffer = new ArrayBuffer(2 + count * BYTES_PER_GATHER_PATCH);
  const view = new DataView(buffer);
  view.setUint8(0, ServerMessageType.GatherPatches);
  view.setUint8(1, count);

  let offset = 2;
  for (let i = 0; i < count; i++) {
    const patch = patches[i];
    if (patch === undefined) break;
    view.setUint8(offset, patch.id & 0xff);
    view.setUint8(offset + 1, itemIndex(patch.item));
    view.setInt16(offset + 2, clamp(quantisePosition(patch.x), INT16_MIN, INT16_MAX), true);
    view.setInt16(offset + 4, clamp(quantisePosition(patch.z), INT16_MIN, INT16_MAX), true);
    view.setUint8(offset + 6, clamp(patch.remaining, 0, 0xff));
    offset += BYTES_PER_GATHER_PATCH;
  }
  return buffer;
}

function decodeGatherPatches(view: DataView): GatherPatchView[] | null {
  if (view.byteLength < 2) return null;
  const count = view.getUint8(1);
  if (view.byteLength !== 2 + count * BYTES_PER_GATHER_PATCH) return null;
  const patches: GatherPatchView[] = [];
  let offset = 2;
  for (let i = 0; i < count; i++) {
    const item = itemFromIndex(view.getUint8(offset + 1));
    if (item === null) return null;
    patches.push({
      id: view.getUint8(offset),
      item,
      x: dequantisePosition(view.getInt16(offset + 2, true)),
      z: dequantisePosition(view.getInt16(offset + 4, true)),
      remaining: view.getUint8(offset + 6),
    });
    offset += BYTES_PER_GATHER_PATCH;
  }
  return patches;
}

/**
 * Everything lying where somebody dropped it, sent whole. Keeps the newest
 * if there were ever somehow more than fit, the same as buried caches.
 */
export function encodeDroppedPiles(piles: readonly DroppedPileView[]): ArrayBuffer {
  const start = Math.max(0, piles.length - MAX_SENT_DROPPED_PILES);
  const count = piles.length - start;
  const buffer = new ArrayBuffer(2 + count * BYTES_PER_DROPPED_PILE);
  const view = new DataView(buffer);
  view.setUint8(0, ServerMessageType.DroppedPiles);
  view.setUint8(1, count);

  let offset = 2;
  for (let i = 0; i < count; i++) {
    const pile = piles[start + i];
    if (pile === undefined) break;
    view.setUint16(offset, pile.id & 0xffff, true);
    view.setUint8(offset + 2, itemIndex(pile.item));
    view.setUint16(offset + 3, clamp(pile.count, 0, MAX_PILE_COUNT), true);
    view.setInt16(offset + 5, clamp(quantisePosition(pile.x), INT16_MIN, INT16_MAX), true);
    view.setInt16(offset + 7, clamp(quantisePosition(pile.z), INT16_MIN, INT16_MAX), true);
    offset += BYTES_PER_DROPPED_PILE;
  }
  return buffer;
}

function decodeDroppedPiles(view: DataView): DroppedPileView[] | null {
  if (view.byteLength < 2) return null;
  const count = view.getUint8(1);
  if (view.byteLength !== 2 + count * BYTES_PER_DROPPED_PILE) return null;
  const piles: DroppedPileView[] = [];
  let offset = 2;
  for (let i = 0; i < count; i++) {
    const item = itemFromIndex(view.getUint8(offset + 2));
    if (item === null) return null;
    piles.push({
      id: view.getUint16(offset, true),
      item,
      count: view.getUint16(offset + 3, true),
      x: dequantisePosition(view.getInt16(offset + 5, true)),
      z: dequantisePosition(view.getInt16(offset + 7, true)),
    });
    offset += BYTES_PER_DROPPED_PILE;
  }
  return piles;
}

/** Confirmed collections are bounded so bursts fit in a single binary packet. */
export const MAX_COLLECTIONS_PER_MESSAGE = 255;
/** netId(2), item(1), count(2), x/z(8), depleted(1). */
export function encodeCollected(events: readonly CollectedEvent[]): ArrayBuffer {
  const count = Math.min(events.length, MAX_COLLECTIONS_PER_MESSAGE);
  const buffer = new ArrayBuffer(2 + count * 14);
  const view = new DataView(buffer);
  view.setUint8(0, ServerMessageType.Collected);
  view.setUint8(1, count);
  for (let i = 0; i < count; i++) {
    const event = events[i]!;
    const offset = 2 + i * 14;
    view.setUint16(offset, event.netId, true);
    view.setUint8(offset + 2, itemIndex(event.item));
    view.setUint16(offset + 3, event.count, true);
    view.setFloat32(offset + 5, event.x, true);
    view.setFloat32(offset + 9, event.z, true);
    view.setUint8(offset + 13, event.depleted ? 1 : 0);
  }
  return buffer;
}

/** Only sent to the player whose pickup was refused. */
export function encodePickupRefused(item: ItemId, reason: 'full' | 'limit'): ArrayBuffer {
  return new Uint8Array([
    ServerMessageType.PickupRefused,
    itemIndex(item),
    reason === 'full' ? 0 : 1,
  ]).buffer;
}

export function encodeDiscarded(event: DiscardedEvent): ArrayBuffer {
  const buffer = new ArrayBuffer(DISCARDED_MESSAGE_BYTES);
  const view = new DataView(buffer);
  view.setUint8(0, ServerMessageType.Discarded);
  view.setUint16(1, event.netId & 0xffff, true);
  view.setUint8(3, itemIndex(event.item));
  view.setUint16(4, clamp(event.count, 0, 0xffff), true);
  view.setUint8(6, event.destroyed ? DISCARD_DESTROY_FLAG : 0);
  return buffer;
}

function decodeDiscarded(view: DataView): DiscardedEvent | null {
  const item = itemFromIndex(view.getUint8(3));
  if (item === null) return null;
  return {
    netId: view.getUint16(1, true),
    item,
    count: view.getUint16(4, true),
    destroyed: (view.getUint8(6) & DISCARD_DESTROY_FLAG) !== 0,
  };
}

/** id(2) + kind(1) + blows still needed(1) */
const BYTES_PER_RAIDER = 4;
/** A world holds at most `RAID.maxConcurrent` raids of three, well inside a one-byte count. */
export const MAX_SENT_RAIDERS = 255;

/** Every raider in the world, sent whole: which kind each is and how much it has left. */
export function encodeRaiders(raiders: readonly RaiderView[]): ArrayBuffer {
  const count = Math.min(raiders.length, MAX_SENT_RAIDERS);
  const buffer = new ArrayBuffer(2 + count * BYTES_PER_RAIDER);
  const view = new DataView(buffer);
  view.setUint8(0, ServerMessageType.Raiders);
  view.setUint8(1, count);

  let offset = 2;
  for (let i = 0; i < count; i++) {
    const raider = raiders[i];
    if (raider === undefined) break;
    view.setUint16(offset, raider.id & 0xffff, true);
    view.setUint8(offset + 2, raiderKindIndex(raider.kind));
    view.setUint8(offset + 3, clamp(Math.round(raider.hitsLeft), 0, 255));
    offset += BYTES_PER_RAIDER;
  }
  return buffer;
}

function decodeRaiders(view: DataView): RaiderView[] | null {
  if (view.byteLength < 2) return null;
  const count = view.getUint8(1);
  if (view.byteLength !== 2 + count * BYTES_PER_RAIDER) return null;
  const raiders: RaiderView[] = [];
  let offset = 2;
  for (let i = 0; i < count; i++) {
    const kind = raiderKindFromIndex(view.getUint8(offset + 2));
    if (kind === null) return null;
    raiders.push({
      id: view.getUint16(offset, true),
      kind,
      hitsLeft: view.getUint8(offset + 3),
    });
    offset += BYTES_PER_RAIDER;
  }
  return raiders;
}

/** What a raid just did, as one byte. Only ever add to the end. */
const RAID_NEWS_KINDS: readonly RaidNewsKind[] = [
  'incoming',
  'foughtOff',
  'gaveUp',
  'wanderer',
  'ruins',
  'patrol',
  'encounterCleared',
];
/** type(1) + kind(1) + raidId(2) + targetNetId(2) + count(1) + x(2) + z(2) */
const RAID_NEWS_MESSAGE_BYTES = 11;

/** A raid turned up, was fought off or gave up, in eleven bytes. Everybody is sent it. */
export function encodeRaidNews(news: RaidNews): ArrayBuffer {
  const buffer = new ArrayBuffer(RAID_NEWS_MESSAGE_BYTES);
  const view = new DataView(buffer);
  view.setUint8(0, ServerMessageType.RaidNews);
  view.setUint8(1, RAID_NEWS_KINDS.indexOf(news.kind));
  view.setUint16(2, news.raidId & 0xffff, true);
  view.setUint16(4, news.targetNetId & 0xffff, true);
  view.setUint8(6, clamp(news.count, 0, 255));
  view.setInt16(7, clamp(quantisePosition(news.x), INT16_MIN, INT16_MAX), true);
  view.setInt16(9, clamp(quantisePosition(news.z), INT16_MIN, INT16_MAX), true);
  return buffer;
}

function decodeRaidNews(view: DataView): RaidNews | null {
  const kind = RAID_NEWS_KINDS[view.getUint8(1)];
  if (kind === undefined) return null;
  return {
    kind,
    raidId: view.getUint16(2, true),
    targetNetId: view.getUint16(4, true),
    count: view.getUint8(6),
    x: dequantisePosition(view.getInt16(7, true)),
    z: dequantisePosition(view.getInt16(9, true)),
  };
}

const RAIDER_HIT_FLAG_HEAVY = 1 << 0;
const RAIDER_HIT_FLAG_SHRUGGED = 1 << 1;
/** type(1) + raiderId(2) + blows still needed(1) + whose blow(2) + flags(1) */
const RAIDER_HIT_MESSAGE_BYTES = 7;

/** A player's blow landed on a raider, in seven bytes. Everybody is sent it, like a threat hit. */
export function encodeRaiderHit(hit: RaiderHit): ArrayBuffer {
  const buffer = new ArrayBuffer(RAIDER_HIT_MESSAGE_BYTES);
  const view = new DataView(buffer);
  view.setUint8(0, ServerMessageType.RaiderHit);
  view.setUint16(1, hit.raiderId & 0xffff, true);
  view.setUint8(3, clamp(Math.round(hit.hitsLeft), 0, 255));
  view.setUint16(4, hit.netId === null ? NOBODY : hit.netId & 0xffff, true);
  view.setUint8(
    6,
    (hit.heavy ? RAIDER_HIT_FLAG_HEAVY : 0) | (hit.shrugged ? RAIDER_HIT_FLAG_SHRUGGED : 0),
  );
  return buffer;
}

function decodeRaiderHit(view: DataView): RaiderHit {
  const netId = view.getUint16(4, true);
  const flags = view.getUint8(6);
  return {
    raiderId: view.getUint16(1, true),
    hitsLeft: view.getUint8(3),
    netId: netId === NOBODY ? null : netId,
    heavy: (flags & RAIDER_HIT_FLAG_HEAVY) !== 0,
    shrugged: (flags & RAIDER_HIT_FLAG_SHRUGGED) !== 0,
  };
}

/**
 * Who everybody currently connected says they are, the same reconciling way
 * as built props and buried caches - sent whole rather than as a diff.
 *
 * Each entry is variable length (the name), so this cannot use a fixed
 * per-entry byte count the way most of these lists do; it is sized in two
 * passes instead, encoding every name once before knowing the buffer's
 * total length.
 */
export function encodeRoster(players: readonly RosterEntry[]): ArrayBuffer {
  const clipped = players.slice(0, MAX_ROSTER_ENTRIES);
  const names = clipped.map((player) => encodeName(player.name));

  let total = 2;
  for (const name of names) total += 5 + name.length;

  const buffer = new ArrayBuffer(total);
  const view = new DataView(buffer);
  view.setUint8(0, ServerMessageType.Roster);
  view.setUint8(1, clipped.length);

  let offset = 2;
  for (let i = 0; i < clipped.length; i++) {
    const player = clipped[i];
    const name = names[i];
    if (player === undefined || name === undefined) break;
    view.setUint16(offset, player.netId & 0xffff, true);
    view.setUint8(offset + 2, characterIndex(player.character));
    view.setUint8(offset + 3, tintColorIndex(player.color));
    view.setUint8(offset + 4, name.length);
    new Uint8Array(buffer, offset + 5, name.length).set(name);
    offset += 5 + name.length;
  }
  return buffer;
}

/** netId(2) + what's equipped, or the "no item" sentinel(1) */
const BYTES_PER_EQUIPPED_ENTRY = 3;

/**
 * What everybody currently connected has equipped, sent whole - a fixed
 * per-entry size, unlike `Roster`, since there is no name string here to
 * make one entry a different length from the next.
 */
export function encodeEquipped(players: readonly EquippedEntry[]): ArrayBuffer {
  const count = Math.min(players.length, MAX_EQUIPPED_ENTRIES);
  const buffer = new ArrayBuffer(2 + count * BYTES_PER_EQUIPPED_ENTRY);
  const view = new DataView(buffer);
  view.setUint8(0, ServerMessageType.Equipped);
  view.setUint8(1, count);

  let offset = 2;
  for (let i = 0; i < count; i++) {
    const entry = players[i];
    if (entry === undefined) break;
    view.setUint16(offset, entry.netId & 0xffff, true);
    view.setUint8(offset + 2, entry.item === null ? NO_ITEM : itemIndex(entry.item));
    offset += BYTES_PER_EQUIPPED_ENTRY;
  }
  return buffer;
}

/** space(2) + x(2) + z(2) + yaw(2), after the type byte. */
const SPACE_MESSAGE_BYTES = 9;

/** You went through a door: which space you are in now, and where (see decision 0055). */
export function encodeSpace(space: number, x: number, z: number, yaw: number): ArrayBuffer {
  const buffer = new ArrayBuffer(SPACE_MESSAGE_BYTES);
  const view = new DataView(buffer);
  view.setUint8(0, ServerMessageType.Space);
  view.setUint16(1, space & 0xffff, true);
  view.setInt16(3, quantisePosition(x), true);
  view.setInt16(5, quantisePosition(z), true);
  view.setUint16(7, quantiseAngle(yaw), true);
  return buffer;
}

/** A gesture each: netId(2) + which(1) + item(1). */
const BYTES_PER_GESTURE = 4;
/** One message carries at most this many; a busier tick sends the rest in another. */
export const MAX_GESTURES_PER_MESSAGE = 255;

/** What everybody did with their hands this tick (see decision 0056). */
export function encodeGestures(gestures: readonly GestureEvent[]): ArrayBuffer {
  const count = Math.min(gestures.length, MAX_GESTURES_PER_MESSAGE);
  const buffer = new ArrayBuffer(2 + count * BYTES_PER_GESTURE);
  const view = new DataView(buffer);
  view.setUint8(0, ServerMessageType.Gestures);
  view.setUint8(1, count);
  for (let i = 0; i < count; i++) {
    const gesture = gestures[i];
    if (gesture === undefined) break;
    const offset = 2 + i * BYTES_PER_GESTURE;
    view.setUint16(offset, gesture.netId & 0xffff, true);
    view.setUint8(offset + 2, gesture.gesture);
    view.setUint8(offset + 3, gesture.item === null ? NO_ITEM : itemIndex(gesture.item));
  }
  return buffer;
}

function decodeGestures(view: DataView): GestureEvent[] | null {
  const count = view.getUint8(1);
  if (view.byteLength !== 2 + count * BYTES_PER_GESTURE) return null;
  const gestures: GestureEvent[] = [];
  for (let i = 0; i < count; i++) {
    const offset = 2 + i * BYTES_PER_GESTURE;
    const which = view.getUint8(offset + 2);
    if (which >= GESTURE_COUNT) return null;
    const itemByte = view.getUint8(offset + 3);
    const item = itemByte === NO_ITEM ? null : itemFromIndex(itemByte);
    if (itemByte !== NO_ITEM && item === null) return null;
    gestures.push({
      netId: view.getUint16(offset, true),
      // Checked against GESTURE_COUNT just above.
      gesture: which as Gesture,
      item,
    });
  }
  return gestures;
}

/**
 * Which parts of the world one player has seen, whole (see decision 0054).
 * Always the same size, so there is no count to send: the map's own shape
 * is fixed by the world's.
 */
export function encodeExplored(cells: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(1 + EXPLORED_BYTES);
  const bytes = new Uint8Array(buffer);
  bytes[0] = ServerMessageType.Explored;
  bytes.set(cells.subarray(0, EXPLORED_BYTES), 1);
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

/** One piece cooked over a campfire. Only that player is ever sent it. */
export function encodeCooked(event: CookedEvent): ArrayBuffer {
  const buffer = new ArrayBuffer(COOKED_MESSAGE_BYTES);
  const view = new DataView(buffer);
  view.setUint8(0, ServerMessageType.Cooked);
  view.setUint16(1, event.netId & 0xffff, true);
  view.setUint8(3, itemIndex(event.raw));
  view.setUint8(4, itemIndex(event.cooked));
  return buffer;
}

function decodeCooked(view: DataView): CookedEvent | null {
  const raw = itemFromIndex(view.getUint8(3));
  const cooked = itemFromIndex(view.getUint8(4));
  if (raw === null || cooked === null) return null;
  return { netId: view.getUint16(1, true), raw, cooked };
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

/** Whose swing a threat hit was, when it was nobody's. */
const NOBODY = 0xffff;

/**
 * A swing landed on a threat, or one just came back from being defeated, in
 * six bytes: which animal, what it has left, and whose swing it was.
 * Everybody is sent it, the same as a tree hit.
 */
export function encodeThreatHit(event: ThreatHit): ArrayBuffer {
  const buffer = new ArrayBuffer(6);
  const view = new DataView(buffer);
  view.setUint8(0, ServerMessageType.ThreatHit);
  view.setUint16(1, event.animalId & 0xffff, true);
  view.setUint8(3, clamp(Math.round(event.hitsLeft), 0, 255));
  view.setUint16(4, event.netId === null ? NOBODY : event.netId & 0xffff, true);
  return buffer;
}

function decodeThreatHit(view: DataView): ThreatHit {
  const netId = view.getUint16(4, true);
  return {
    animalId: view.getUint16(1, true),
    hitsLeft: view.getUint8(3),
    netId: netId === NOBODY ? null : netId,
  };
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

export function encodeDiscoveries(state: DiscoveryState): ArrayBuffer {
  return new Uint8Array([
    ServerMessageType.Discoveries,
    state.found,
    state.claimed,
    ['none', 'guarded', 'full', 'quiet', 'guardian'].indexOf(state.notice),
  ]).buffer;
}

export function decodeServerMessage(data: ArrayBuffer): ServerMessage | null {
  if (data.byteLength < 1) return null;
  const view = new DataView(data);
  const type = view.getUint8(0);

  switch (type) {
    case ServerMessageType.Garden: {
      if (
        data.byteLength !== 7 + GARDEN_PLOTS * 3 ||
        view.getUint8(5) > 1 ||
        view.getUint8(6) > GARDEN_REASONS.length
      )
        return null;
      const values = [];
      for (let index = 0; index < GARDEN_PLOTS; index++) {
        const crop = view.getUint8(7 + index * 3),
          growTicks = view.getUint16(8 + index * 3, true);
        if (crop > GARDEN_CROPS.length || growTicks > GARDEN_GROW_TICKS) return null;
        values.push({ crop: crop === 0 ? null : GARDEN_CROPS[crop - 1], growTicks });
      }
      const plots = gardenFromSaved(values);
      if (plots === null) return null;
      const reason = view.getUint8(6);
      return {
        type: 'garden',
        homeId: view.getUint32(1, true),
        yours: view.getUint8(5) === 1,
        plots,
        reason: reason === 0 ? null : GARDEN_REASONS[reason - 1]!,
      };
    }
    case ServerMessageType.Discoveries: {
      if (data.byteLength !== 4) return null;
      const found = view.getUint8(1),
        claimed = view.getUint8(2),
        reason = view.getUint8(3);
      if (found & ~DISCOVERY_MASK || claimed & ~found || reason > 4) return null;
      return {
        type: 'discoveries',
        found,
        claimed,
        notice: (['none', 'guarded', 'full', 'quiet', 'guardian'] as const)[reason]!,
      };
    }
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
          action: view.getUint8(offset + 23),
          actionAge: view.getUint8(offset + 24),
          actionHeading: view.getUint8(offset + 25),
        });
        offset += BYTES_PER_SNAPSHOT_ENTITY;
      }
      return {
        type: 'snapshot',
        tick: view.getUint32(1, true),
        serverTimeMs: view.getUint32(5, true),
        ackSeq: view.getUint32(9, true),
        dodgeCooldown: view.getUint8(14),
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
    case ServerMessageType.Chest: {
      if (data.byteLength !== 6 + CHEST_SLOTS * 3) return null;
      const reasonCode = view.getUint8(3);
      if (reasonCode > CHEST_REASONS.length) return null;
      const slots = emptyChest();
      for (let i = 0; i < CHEST_SLOTS; i++) {
        const source = view.getUint8(6 + i * 3),
          count = view.getUint16(7 + i * 3, true);
        if (source === 255) {
          if (count !== 0) return null;
          continue;
        }
        const item = itemFromIndex(source);
        if (item === null) return null;
        slots[i] = { item, count };
      }
      if (chestFromSaved(slots) === null) return null;
      return {
        type: 'chest',
        homeId: view.getUint16(1, true),
        slots,
        moved: view.getUint16(4, true),
        reason: reasonCode === 0 ? null : CHEST_REASONS[reasonCode - 1]!,
      };
    }
    case ServerMessageType.HomeBuildFeedback: {
      if (data.byteLength !== 5) return null;
      const kind = buildableKindFromIndex(view.getUint8(1)),
        reason = view.getUint8(4);
      if (kind === null || !isHomeKind(kind) || reason > HOME_BUILD_REASONS.length) return null;
      return {
        type: 'homeBuildFeedback',
        kind,
        homeId: view.getUint16(2, true),
        reason: reason === 0 ? null : HOME_BUILD_REASONS[reason - 1]!,
      };
    }
    case ServerMessageType.HomeSkills: {
      if (data.byteLength !== 2 || (view.getUint8(1) & ~HOME_SKILL_MASK) !== 0) return null;
      return { type: 'homeSkills', skills: view.getUint8(1) };
    }
    case ServerMessageType.HomeSupplies: {
      if (data.byteLength < 6) return null;
      const homeId = view.getUint32(1, true),
        count = view.getUint8(5);
      if (data.byteLength !== 6 + count * 3 || (homeId === 0 && count !== 0)) return null;
      const items: { item: ItemId; count: number }[] = [],
        seen = new Set<ItemId>();
      for (let index = 0; index < count; index++) {
        const item = itemFromIndex(view.getUint8(6 + index * 3)),
          amount = view.getUint16(7 + index * 3, true);
        if (item === null || amount === 0 || seen.has(item)) return null;
        seen.add(item);
        items.push({ item, count: amount });
      }
      return { type: 'homeSupplies', homeId, items };
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
      // Old servers only sent the four-byte standing/stump state.
      const stride =
        data.byteLength === 2 + count * BYTES_PER_TREE_STATE ? BYTES_PER_TREE_STATE : 4;
      if (data.byteLength !== 2 + count * stride) return null;
      const trees: TreeState[] = [];
      let offset = 2;
      for (let i = 0; i < count; i++) {
        const hasFall =
          stride === BYTES_PER_TREE_STATE && (view.getUint8(offset + 3) & TREE_FALL_FLAG) !== 0;
        const fall = hasFall
          ? {
              yaw: view.getFloat32(offset + 4, true),
              startedAtMs: view.getFloat64(offset + 8, true),
            }
          : undefined;
        if (
          fall &&
          (!Number.isFinite(fall.yaw) || !Number.isFinite(fall.startedAtMs) || fall.startedAtMs < 0)
        )
          return null;
        trees.push({
          treeId: view.getUint16(offset, true),
          generation: view.getUint8(offset + 2),
          felled: (view.getUint8(offset + 3) & TREE_FELLED_FLAG) !== 0,
          ...(fall ? { fall } : {}),
        });
        offset += stride;
      }
      return { type: 'treeStates', trees };
    }
    case ServerMessageType.BuiltProps: {
      if (data.byteLength < 2) return null;
      const count = view.getUint8(1);
      if (data.byteLength !== 2 + count * BYTES_PER_BUILT_PROP) return null;
      const props: BuiltPropView[] = [];
      let offset = 2;
      for (let i = 0; i < count; i++) {
        const kind = buildableKindFromIndex(view.getUint8(offset + 2));
        if (kind === null) return null;
        const flags = view.getUint8(offset + 9);
        props.push({
          id: view.getUint16(offset, true),
          kind,
          x: dequantisePosition(view.getInt16(offset + 3, true)),
          z: dequantisePosition(view.getInt16(offset + 5, true)),
          yaw: dequantiseAngle(view.getUint16(offset + 7, true)),
          lit: (flags & BUILT_PROP_LIT_FLAG) !== 0,
          yours: (flags & BUILT_PROP_YOURS_FLAG) !== 0,
          locked: (flags & BUILT_PROP_LOCKED_FLAG) !== 0,
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
    case ServerMessageType.GatherPatches: {
      const patches = decodeGatherPatches(view);
      return patches === null ? null : { type: 'gatherPatches', patches };
    }
    case ServerMessageType.DroppedPiles: {
      const piles = decodeDroppedPiles(view);
      return piles === null ? null : { type: 'droppedPiles', piles };
    }
    case ServerMessageType.Collected: {
      if (data.byteLength < 2) return null;
      const count = view.getUint8(1);
      if (data.byteLength !== 2 + count * 14) return null;
      const events: CollectedEvent[] = [];
      for (let i = 0; i < count; i++) {
        const offset = 2 + i * 14;
        const item = itemFromIndex(view.getUint8(offset + 2));
        const amount = view.getUint16(offset + 3, true);
        const x = view.getFloat32(offset + 5, true);
        const z = view.getFloat32(offset + 9, true);
        const flags = view.getUint8(offset + 13);
        if (
          item === null ||
          amount === 0 ||
          !Number.isFinite(x) ||
          !Number.isFinite(z) ||
          flags > 1
        )
          return null;
        events.push({
          netId: view.getUint16(offset, true),
          item,
          count: amount,
          x,
          z,
          depleted: flags === 1,
        });
      }
      return { type: 'collected', events };
    }
    case ServerMessageType.PickupRefused: {
      if (data.byteLength !== 3) return null;
      const item = itemFromIndex(view.getUint8(1));
      const reason = view.getUint8(2);
      if (item === null || reason > 1) return null;
      return { type: 'pickupRefused', item, reason: reason === 0 ? 'full' : 'limit' };
    }
    case ServerMessageType.Discarded: {
      if (data.byteLength !== DISCARDED_MESSAGE_BYTES) return null;
      const event = decodeDiscarded(view);
      return event === null ? null : { type: 'discarded', event };
    }
    case ServerMessageType.Raiders: {
      const raiders = decodeRaiders(view);
      return raiders === null ? null : { type: 'raiders', raiders };
    }
    case ServerMessageType.RaidNews: {
      if (data.byteLength !== RAID_NEWS_MESSAGE_BYTES) return null;
      const news = decodeRaidNews(view);
      return news === null ? null : { type: 'raidNews', news };
    }
    case ServerMessageType.RaiderHit: {
      if (data.byteLength !== RAIDER_HIT_MESSAGE_BYTES) return null;
      return { type: 'raiderHit', hit: decodeRaiderHit(view) };
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
    case ServerMessageType.Cooked: {
      if (data.byteLength !== COOKED_MESSAGE_BYTES) return null;
      const event = decodeCooked(view);
      return event === null ? null : { type: 'cooked', event };
    }
    case ServerMessageType.Caught: {
      if (data.byteLength !== CAUGHT_MESSAGE_BYTES) return null;
      const event = decodeCaught(view);
      return event === null ? null : { type: 'caught', event };
    }
    case ServerMessageType.ThreatHit: {
      if (data.byteLength !== 6) return null;
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
    case ServerMessageType.Roster: {
      if (data.byteLength < 2) return null;
      const count = view.getUint8(1);
      const players: RosterEntry[] = [];
      let offset = 2;
      for (let i = 0; i < count; i++) {
        if (offset + 5 > data.byteLength) return null;
        const netId = view.getUint16(offset, true);
        const character = characterFromIndex(view.getUint8(offset + 2));
        const color = tintColorFromIndex(view.getUint8(offset + 3));
        const nameLength = view.getUint8(offset + 4);
        if (character === null || color === null) return null;
        if (offset + 5 + nameLength > data.byteLength) return null;
        const name = textDecoder.decode(new Uint8Array(data, offset + 5, nameLength));
        players.push({ netId, name, character, color });
        offset += 5 + nameLength;
      }
      if (offset !== data.byteLength) return null;
      return { type: 'roster', players };
    }
    case ServerMessageType.Equipped: {
      if (data.byteLength < 2) return null;
      const count = view.getUint8(1);
      if (data.byteLength !== 2 + count * BYTES_PER_EQUIPPED_ENTRY) return null;
      const players: EquippedEntry[] = [];
      let offset = 2;
      for (let i = 0; i < count; i++) {
        const netId = view.getUint16(offset, true);
        const itemByte = view.getUint8(offset + 2);
        // An item this build has never heard of reads as nothing equipped
        // rather than failing the whole message - the same call `Hunger`
        // already makes for an unrecognised "what was eaten".
        players.push({ netId, item: itemByte === NO_ITEM ? null : itemFromIndex(itemByte) });
        offset += BYTES_PER_EQUIPPED_ENTRY;
      }
      return { type: 'equipped', players };
    }
    case ServerMessageType.Space: {
      if (data.byteLength !== SPACE_MESSAGE_BYTES) return null;
      return {
        type: 'space',
        space: view.getUint16(1, true),
        x: dequantisePosition(view.getInt16(3, true)),
        z: dequantisePosition(view.getInt16(5, true)),
        yaw: dequantiseAngle(view.getUint16(7, true)),
      };
    }
    case ServerMessageType.Gestures: {
      if (data.byteLength < 2) return null;
      const gestures = decodeGestures(view);
      return gestures === null ? null : { type: 'gestures', gestures };
    }
    case ServerMessageType.Explored: {
      if (data.byteLength !== 1 + EXPLORED_BYTES) return null;
      return { type: 'explored', cells: new Uint8Array(data.slice(1)) };
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
