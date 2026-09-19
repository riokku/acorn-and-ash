import { describe, expect, it } from 'vitest';

import { MAX_PLAYERS_PER_WORLD, SNAPSHOT_HZ, TICK_HZ } from '../src/constants';
import { RejectReason } from '../src/net/messages';
import {
  decodeClientMessage,
  decodeServerMessage,
  encodeInputBundle,
  encodeInventory,
  encodePickupsTaken,
  encodePing,
  encodeTreeHit,
  encodeTreesFelled,
  encodePlayerLeft,
  encodePong,
  encodeRejected,
  encodeSnapshot,
  encodeWelcome,
  inputBundleBytes,
  snapshotBytes,
  MAX_INPUTS_PER_BUNDLE,
} from '../src/net/protocol';
import { createInput } from '../src/sim/player';
import type { SnapshotEntity } from '../src/sim/world-sim';

describe('input bundles', () => {
  it('survives a round trip', () => {
    const inputs = [
      createInput(41, -1, 1, 0.5, 1),
      createInput(42, 0.25, -0.75, -2.1, 0),
      createInput(43, 0, 0, 3.0, 0),
    ];
    const decoded = decodeClientMessage(encodeInputBundle(inputs));

    expect(decoded?.type).toBe('input');
    if (decoded?.type !== 'input') throw new Error('expected an input bundle');
    expect(decoded.inputs).toHaveLength(3);
    decoded.inputs.forEach((input, index) => {
      const original = inputs[index];
      if (original === undefined) throw new Error('missing input');
      expect(input.seq).toBe(original.seq);
      expect(input.moveX).toBeCloseTo(original.moveX, 2);
      expect(input.moveZ).toBeCloseTo(original.moveZ, 2);
      expect(input.yaw).toBeCloseTo(original.yaw, 3);
      expect(input.buttons).toBe(original.buttons);
    });
  });

  it('only sends the first sequence number', () => {
    expect(encodeInputBundle([createInput(7)]).byteLength).toBe(inputBundleBytes(1));
    expect(encodeInputBundle([createInput(7), createInput(8)]).byteLength).toBe(
      inputBundleBytes(2),
    );
  });

  it('stays small enough to be worth bundling', () => {
    // Two inputs per message at 15 messages a second.
    expect(inputBundleBytes(2)).toBeLessThan(32);
  });

  it('refuses to encode nothing', () => {
    expect(() => encodeInputBundle([])).toThrow();
  });

  it('refuses to encode more inputs than a bundle may carry', () => {
    const tooMany = Array.from({ length: MAX_INPUTS_PER_BUNDLE + 1 }, (_, i) => createInput(i));
    expect(() => encodeInputBundle(tooMany)).toThrow();
  });
});

describe('rejecting rubbish from a client', () => {
  it('rejects an empty message', () => {
    expect(decodeClientMessage(new ArrayBuffer(0))).toBeNull();
  });

  it('rejects an unknown message type', () => {
    const buffer = new ArrayBuffer(4);
    new DataView(buffer).setUint8(0, 0xfe);
    expect(decodeClientMessage(buffer)).toBeNull();
  });

  it('rejects a bundle whose length does not match its count', () => {
    const buffer = new ArrayBuffer(11);
    const view = new DataView(buffer);
    view.setUint8(0, 0x01);
    view.setUint32(1, 1, true);
    view.setUint8(5, 9); // claims nine inputs, carries one
    expect(decodeClientMessage(buffer)).toBeNull();
  });

  it('rejects a bundle claiming more inputs than the limit', () => {
    const count = MAX_INPUTS_PER_BUNDLE + 1;
    const buffer = new ArrayBuffer(6 + count * 5);
    const view = new DataView(buffer);
    view.setUint8(0, 0x01);
    view.setUint32(1, 1, true);
    view.setUint8(5, count);
    expect(decodeClientMessage(buffer)).toBeNull();
  });

  it('rejects a truncated ping', () => {
    const buffer = new ArrayBuffer(3);
    new DataView(buffer).setUint8(0, 0x02);
    expect(decodeClientMessage(buffer)).toBeNull();
  });

  it('clamps a movement axis that is out of range', () => {
    // 0x7f is the largest value the wire format can hold, which means 1.0.
    const buffer = new ArrayBuffer(11);
    const view = new DataView(buffer);
    view.setUint8(0, 0x01);
    view.setUint32(1, 5, true);
    view.setUint8(5, 1);
    view.setInt8(6, -128); // one step past -1
    view.setInt8(7, 127);
    const decoded = decodeClientMessage(buffer);
    if (decoded?.type !== 'input') throw new Error('expected an input bundle');
    expect(decoded.inputs[0]?.moveX).toBe(-1);
    expect(decoded.inputs[0]?.moveZ).toBe(1);
  });
});

describe('server messages', () => {
  it('round-trips a welcome', () => {
    const decoded = decodeServerMessage(encodeWelcome(7, 0x4143_4f52, 1234, 56789));
    expect(decoded).toEqual({
      type: 'welcome',
      netId: 7,
      seed: 0x4143_4f52,
      tick: 1234,
      serverTimeMs: 56789,
      tickHz: TICK_HZ,
      snapshotHz: SNAPSHOT_HZ,
    });
  });

  it('round-trips a snapshot', () => {
    const entities: SnapshotEntity[] = [
      { netId: 1, x: 12.34, y: 0, z: -56.78, vx: 3.2, vy: 0, vz: -1.05, yaw: 1.2, flags: 1 },
      { netId: 2, x: -0.01, y: 1.5, z: 0.99, vx: 0, vy: -24.5, vz: 0, yaw: -3.0, flags: 0 },
    ];
    const decoded = decodeServerMessage(encodeSnapshot(90, 5000, 41, entities));

    if (decoded?.type !== 'snapshot') throw new Error('expected a snapshot');
    expect(decoded.tick).toBe(90);
    expect(decoded.serverTimeMs).toBe(5000);
    expect(decoded.ackSeq).toBe(41);
    expect(decoded.entities).toHaveLength(2);
    decoded.entities.forEach((entity, index) => {
      const original = entities[index];
      if (original === undefined) throw new Error('missing entity');
      expect(entity.netId).toBe(original.netId);
      // Positions travel as whole centimetres.
      expect(entity.x).toBeCloseTo(original.x, 2);
      expect(entity.y).toBeCloseTo(original.y, 2);
      expect(entity.z).toBeCloseTo(original.z, 2);
      expect(entity.vx).toBeCloseTo(original.vx, 2);
      expect(entity.vy).toBeCloseTo(original.vy, 2);
      expect(entity.vz).toBeCloseTo(original.vz, 2);
      expect(entity.yaw).toBeCloseTo(original.yaw, 3);
      expect(entity.flags).toBe(original.flags);
    });
  });

  it('keeps a snapshot for a busy world small', () => {
    expect(snapshotBytes(10)).toBeLessThan(256);
    expect(snapshotBytes(MAX_PLAYERS_PER_WORLD)).toBeLessThan(1200);
  });

  it('round-trips the small messages', () => {
    expect(decodeServerMessage(encodePlayerLeft(9))).toEqual({ type: 'playerLeft', netId: 9 });
    expect(decodeServerMessage(encodePong(11, 22))).toEqual({
      type: 'pong',
      clientTimeMs: 11,
      serverTimeMs: 22,
    });
    expect(decodeServerMessage(encodeRejected(RejectReason.WorldFull))).toEqual({
      type: 'rejected',
      reason: RejectReason.WorldFull,
    });
  });

  it('round-trips an empty snapshot', () => {
    const decoded = decodeServerMessage(encodeSnapshot(1, 2, 3, []));
    if (decoded?.type !== 'snapshot') throw new Error('expected a snapshot');
    expect(decoded.entities).toEqual([]);
  });

  it('rejects a snapshot whose length does not match its count', () => {
    const buffer = new ArrayBuffer(14 + 23);
    const view = new DataView(buffer);
    view.setUint8(0, 0x11);
    view.setUint8(13, 4);
    expect(decodeServerMessage(buffer)).toBeNull();
  });

  it('survives a ping round trip', () => {
    const decoded = decodeClientMessage(encodePing(4242));
    expect(decoded).toEqual({ type: 'ping', clientTimeMs: 4242 });
  });
});

describe('telling a player what they carry', () => {
  it('survives a round trip', () => {
    const items = [
      { item: 'axe', count: 1 },
      { item: 'log', count: 7 },
    ] as const;
    const decoded = decodeServerMessage(encodeInventory(items));
    expect(decoded).toEqual({ type: 'inventory', items: [...items] });
  });

  it('sends an empty pack as an empty pack, not as nothing', () => {
    const decoded = decodeServerMessage(encodeInventory([]));
    expect(decoded).toEqual({ type: 'inventory', items: [] });
  });

  it('stays small: a full pack is under twenty bytes', () => {
    const full = encodeInventory([
      { item: 'axe', count: 1 },
      { item: 'log', count: 10 },
    ]);
    expect(full.byteLength).toBeLessThan(20);
  });

  it('refuses a message that has been cut short', () => {
    const encoded = encodeInventory([{ item: 'log', count: 3 }]);
    expect(decodeServerMessage(encoded.slice(0, encoded.byteLength - 1))).toBeNull();
  });

  it('refuses an item this build has never heard of', () => {
    const encoded = encodeInventory([{ item: 'log', count: 3 }]);
    // Rewrite the item index to one that does not exist.
    new DataView(encoded).setUint8(2, 200);
    expect(decodeServerMessage(encoded)).toBeNull();
  });
});

describe('telling players which pickups are gone', () => {
  it('survives a round trip', () => {
    const decoded = decodeServerMessage(encodePickupsTaken([1, 4, 9]));
    expect(decoded).toEqual({ type: 'pickupsTaken', pickupIds: [1, 4, 9] });
  });

  it('says so plainly when nothing has been taken yet', () => {
    expect(decodeServerMessage(encodePickupsTaken([]))).toEqual({
      type: 'pickupsTaken',
      pickupIds: [],
    });
  });

  it('refuses a message that has been cut short', () => {
    const encoded = encodePickupsTaken([1, 2]);
    expect(decodeServerMessage(encoded.slice(0, encoded.byteLength - 1))).toBeNull();
  });
});

describe('telling players which trees are down', () => {
  it('survives a round trip', () => {
    expect(decodeServerMessage(encodeTreesFelled([3, 17, 140]))).toEqual({
      type: 'treesFelled',
      treeIds: [3, 17, 140],
    });
  });

  it('says so plainly when the clearing is untouched', () => {
    expect(decodeServerMessage(encodeTreesFelled([]))).toEqual({
      type: 'treesFelled',
      treeIds: [],
    });
  });

  it('carries a whole clearing of felled trees in under three hundred bytes', () => {
    const everyTree = Array.from({ length: 141 }, (_, i) => i + 1);
    expect(encodeTreesFelled(everyTree).byteLength).toBeLessThan(300);
  });

  it('refuses a message that has been cut short', () => {
    const encoded = encodeTreesFelled([1, 2]);
    expect(decodeServerMessage(encoded.slice(0, encoded.byteLength - 1))).toBeNull();
  });
});

describe('telling players a swing landed', () => {
  it('survives a round trip', () => {
    expect(decodeServerMessage(encodeTreeHit(42, 3))).toEqual({
      type: 'treeHit',
      treeId: 42,
      swingsLeft: 3,
    });
  });

  it('says zero swings left for the one that felled it', () => {
    expect(decodeServerMessage(encodeTreeHit(42, 0))).toEqual({
      type: 'treeHit',
      treeId: 42,
      swingsLeft: 0,
    });
  });

  it('is tiny, because one goes out for every swing anybody takes', () => {
    expect(encodeTreeHit(42, 3).byteLength).toBeLessThanOrEqual(4);
  });

  it('refuses a message of the wrong length', () => {
    const encoded = encodeTreeHit(42, 3);
    expect(decodeServerMessage(encoded.slice(0, 3))).toBeNull();
  });
});
