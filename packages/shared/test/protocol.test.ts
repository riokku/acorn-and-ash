import { describe, expect, it } from 'vitest';

import { MAX_PLAYERS_PER_WORLD, MAX_TREE_GENERATION, SNAPSHOT_HZ, TICK_HZ } from '../src/constants';
import { RejectReason } from '../src/net/messages';
import {
  decodeClientMessage,
  decodeServerMessage,
  encodeInputBundle,
  encodeInventory,
  encodePickupsTaken,
  encodePing,
  encodeBuild,
  encodeCraft,
  encodeBuiltProps,
  encodeBuriedCaches,
  encodeCache,
  encodeCaught,
  encodeCrafted,
  encodeFishing,
  encodeHealth,
  encodeHello,
  encodeHunger,
  encodeRoster,
  encodeThreatHit,
  encodeTreeHit,
  encodeTreeStates,
  encodePlayerLeft,
  encodePong,
  encodeRejected,
  encodeSnapshot,
  encodeWelcome,
  inputBundleBytes,
  snapshotBytes,
  MAX_INPUTS_PER_BUNDLE,
  MAX_BUILT_PROPS,
  MAX_BURIED_CACHES,
  MAX_ROSTER_ENTRIES,
} from '../src/net/protocol';
import { createInput } from '../src/sim/player';
import type { RosterEntry } from '../src/net/messages';
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
} from '../src/sim/world-sim';

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

describe('telling players how the trees stand', () => {
  const trees = [
    { treeId: 3, generation: 0, felled: true },
    { treeId: 17, generation: 2, felled: false },
    { treeId: 140, generation: 1, felled: true },
  ];

  it('survives a round trip', () => {
    expect(decodeServerMessage(encodeTreeStates(trees))).toEqual({
      type: 'treeStates',
      trees,
    });
  });

  it('says so plainly when the clearing is untouched', () => {
    expect(decodeServerMessage(encodeTreeStates([]))).toEqual({
      type: 'treeStates',
      trees: [],
    });
  });

  it('keeps a tree that grew back apart from one that is still down', () => {
    const decoded = decodeServerMessage(encodeTreeStates(trees));
    if (decoded?.type !== 'treeStates') throw new Error('wrong message');
    expect(decoded.trees.filter((tree) => tree.felled).map((tree) => tree.treeId)).toEqual([
      3, 140,
    ]);
    expect(decoded.trees.find((tree) => tree.treeId === 17)?.generation).toBe(2);
  });

  it('will not let a generation past the one byte it travels in', () => {
    const decoded = decodeServerMessage(
      encodeTreeStates([{ treeId: 4, generation: MAX_TREE_GENERATION + 5, felled: false }]),
    );
    if (decoded?.type !== 'treeStates') throw new Error('expected tree states');
    expect(decoded.trees[0]?.generation).toBe(MAX_TREE_GENERATION);
  });

  it('carries a whole clearing of changed trees in under six hundred bytes', () => {
    const everyTree = Array.from({ length: 141 }, (_, i) => ({
      treeId: i + 1,
      generation: 3,
      felled: i % 2 === 0,
    }));
    expect(encodeTreeStates(everyTree).byteLength).toBeLessThan(600);
  });

  it('refuses a message that has been cut short', () => {
    const encoded = encodeTreeStates(trees);
    expect(decodeServerMessage(encoded.slice(0, encoded.byteLength - 1))).toBeNull();
  });
});

describe('telling players a swing landed', () => {
  it('survives a round trip', () => {
    expect(decodeServerMessage(encodeTreeHit(42, 3, 7))).toEqual({
      type: 'treeHit',
      treeId: 42,
      swingsLeft: 3,
      netId: 7,
    });
  });

  it('says zero swings left for the one that felled it', () => {
    expect(decodeServerMessage(encodeTreeHit(42, 0, 7))).toEqual({
      type: 'treeHit',
      treeId: 42,
      swingsLeft: 0,
      netId: 7,
    });
  });

  it('says whose swing it was, so only the swinger plays their axe swinging back', () => {
    expect(decodeServerMessage(encodeTreeHit(42, 3, 7))).toMatchObject({ netId: 7 });
    expect(decodeServerMessage(encodeTreeHit(42, 3, 9))).toMatchObject({ netId: 9 });
  });

  it('is tiny, because one goes out for every swing anybody takes', () => {
    expect(encodeTreeHit(42, 3, 7).byteLength).toBeLessThanOrEqual(6);
  });

  it('refuses a message of the wrong length', () => {
    const encoded = encodeTreeHit(42, 3, 7);
    expect(decodeServerMessage(encoded.slice(0, 3))).toBeNull();
  });
});

describe('telling players a threat was hit', () => {
  const roundTrip = (event: ThreatHit): ThreatHit | null => {
    const decoded = decodeServerMessage(encodeThreatHit(event));
    return decoded?.type === 'threatHit' ? decoded.event : null;
  };

  it('carries which one and how many swings it has left', () => {
    expect(roundTrip({ animalId: 1005, hitsLeft: 2 })).toEqual({ animalId: 1005, hitsLeft: 2 });
  });

  it('says a full count again for one just back from being defeated', () => {
    expect(roundTrip({ animalId: 1005, hitsLeft: 3 })).toEqual({ animalId: 1005, hitsLeft: 3 });
  });

  it('is tiny, the same as a tree hit', () => {
    expect(encodeThreatHit({ animalId: 1005, hitsLeft: 2 }).byteLength).toBeLessThanOrEqual(4);
  });

  it('refuses a message of the wrong length', () => {
    const encoded = encodeThreatHit({ animalId: 1005, hitsLeft: 2 });
    expect(decodeServerMessage(encoded.slice(0, 3))).toBeNull();
  });
});

describe('telling players what happened at the water', () => {
  const roundTrip = (event: FishingEvent): FishingEvent | null => {
    const decoded = decodeServerMessage(encodeFishing(event));
    return decoded?.type === 'fishing' ? decoded.event : null;
  };

  it('carries where the float landed, to the centimetre', () => {
    const decoded = roundTrip({ kind: 'cast', netId: 7, x: 12.345, z: -6.789 });
    expect(decoded?.kind).toBe('cast');
    if (decoded?.kind !== 'cast') return;
    expect(decoded.netId).toBe(7);
    expect(decoded.x).toBeCloseTo(12.35, 2);
    expect(decoded.z).toBeCloseTo(-6.79, 2);
  });

  it('carries which fish was caught and how many were kept', () => {
    expect(roundTrip({ kind: 'caught', netId: 3, item: 'goldenCarp', added: 1 })).toEqual({
      kind: 'caught',
      netId: 3,
      item: 'goldenCarp',
      added: 1,
    });
    expect(roundTrip({ kind: 'caught', netId: 3, item: 'perch', added: 0 })).toEqual({
      kind: 'caught',
      netId: 3,
      item: 'perch',
      added: 0,
    });
  });

  it('carries every way a cast can end', () => {
    for (const kind of ['bite', 'tooSoon', 'tooLate', 'walkedAway'] as const) {
      expect(roundTrip({ kind, netId: 12 })).toEqual({ kind, netId: 12 });
    }
  });

  it('fits in eight bytes', () => {
    expect(encodeFishing({ kind: 'cast', netId: 1, x: 1, z: 1 }).byteLength).toBe(8);
    expect(encodeFishing({ kind: 'bite', netId: 1 }).byteLength).toBe(8);
  });

  it('refuses one that has been cut short or says nothing it knows', () => {
    const encoded = encodeFishing({ kind: 'bite', netId: 1 });
    expect(decodeServerMessage(encoded.slice(0, 7))).toBeNull();

    const nonsense = new Uint8Array(encoded.slice(0));
    nonsense[3] = 99;
    expect(decodeServerMessage(nonsense.buffer)).toBeNull();
  });
});

describe('telling a player how hungry they are', () => {
  const roundTrip = (event: HungerEvent): HungerEvent | null => {
    const decoded = decodeServerMessage(encodeHunger(event));
    return decoded?.type === 'hunger' ? decoded.event : null;
  };

  it('carries the number and who it is for', () => {
    expect(roundTrip({ netId: 7, hunger: 63, ate: null })).toEqual({
      netId: 7,
      hunger: 63,
      ate: null,
    });
  });

  it('carries what was just eaten', () => {
    expect(roundTrip({ netId: 3, hunger: 100, ate: 'goldenCarp' })).toEqual({
      netId: 3,
      hunger: 100,
      ate: 'goldenCarp',
    });
  });

  it('fits in five bytes', () => {
    expect(encodeHunger({ netId: 1, hunger: 50, ate: null }).byteLength).toBe(5);
  });

  it('refuses one that has been cut short', () => {
    const encoded = encodeHunger({ netId: 1, hunger: 50, ate: null });
    expect(decodeServerMessage(encoded.slice(0, 4))).toBeNull();
  });
});

describe('telling a player how much health they have', () => {
  const roundTrip = (event: HealthEvent): HealthEvent | null => {
    const decoded = decodeServerMessage(encodeHealth(event));
    return decoded?.type === 'health' ? decoded.event : null;
  };

  it('carries the number and who it is for', () => {
    expect(roundTrip({ netId: 7, health: 75, knockedOut: false, dodged: false })).toEqual({
      netId: 7,
      health: 75,
      knockedOut: false,
      dodged: false,
    });
  });

  it('carries a knockout', () => {
    expect(roundTrip({ netId: 3, health: 100, knockedOut: true, dodged: false })).toEqual({
      netId: 3,
      health: 100,
      knockedOut: true,
      dodged: false,
    });
  });

  it('carries a dodge, separately from a knockout', () => {
    expect(roundTrip({ netId: 3, health: 80, knockedOut: false, dodged: true })).toEqual({
      netId: 3,
      health: 80,
      knockedOut: false,
      dodged: true,
    });
  });

  it('fits in five bytes', () => {
    expect(
      encodeHealth({ netId: 1, health: 50, knockedOut: false, dodged: false }).byteLength,
    ).toBe(5);
  });

  it('refuses one that has been cut short', () => {
    const encoded = encodeHealth({ netId: 1, health: 50, knockedOut: false, dodged: false });
    expect(decodeServerMessage(encoded.slice(0, 4))).toBeNull();
  });
});

describe('asking to craft something', () => {
  it('survives a round trip', () => {
    const decoded = decodeClientMessage(encodeCraft('axe'));
    expect(decoded).toEqual({ type: 'craft', item: 'axe' });
  });

  it('is two bytes: not worth batching with the input bundle', () => {
    expect(encodeCraft('rod').byteLength).toBe(2);
  });

  it('refuses one that has been cut short', () => {
    const encoded = encodeCraft('axe');
    expect(decodeClientMessage(encoded.slice(0, 1))).toBeNull();
  });

  it('refuses an item this build has never heard of', () => {
    const encoded = new Uint8Array(encodeCraft('axe').slice(0));
    encoded[1] = 200;
    expect(decodeClientMessage(encoded.buffer)).toBeNull();
  });
});

describe('asking to build something', () => {
  it('survives a round trip', () => {
    const decoded = decodeClientMessage(encodeBuild('cabin'));
    expect(decoded).toEqual({ type: 'build', kind: 'cabin' });
  });

  it('is two bytes: not worth batching with the input bundle', () => {
    expect(encodeBuild('campfire').byteLength).toBe(2);
  });

  it('refuses one that has been cut short', () => {
    const encoded = encodeBuild('campfire');
    expect(decodeClientMessage(encoded.slice(0, 1))).toBeNull();
  });

  it('refuses a buildable kind this build has never heard of', () => {
    const encoded = new Uint8Array(encodeBuild('campfire').slice(0));
    encoded[1] = 200;
    expect(decodeClientMessage(encoded.buffer)).toBeNull();
  });
});

describe('telling a player what they made', () => {
  const roundTrip = (event: CraftedEvent): CraftedEvent | null => {
    const decoded = decodeServerMessage(encodeCrafted(event));
    return decoded?.type === 'crafted' ? decoded.event : null;
  };

  it('carries who made it and what', () => {
    expect(roundTrip({ netId: 7, item: 'rod' })).toEqual({ netId: 7, item: 'rod' });
  });

  it('fits in four bytes', () => {
    expect(encodeCrafted({ netId: 1, item: 'axe' }).byteLength).toBe(4);
  });

  it('refuses one that has been cut short', () => {
    const encoded = encodeCrafted({ netId: 1, item: 'axe' });
    expect(decodeServerMessage(encoded.slice(0, 3))).toBeNull();
  });

  it('refuses an item this build has never heard of', () => {
    const encoded = new Uint8Array(encodeCrafted({ netId: 1, item: 'axe' }).slice(0));
    encoded[3] = 200;
    expect(decodeServerMessage(encoded.buffer)).toBeNull();
  });
});

describe('telling a player what they caught', () => {
  const roundTrip = (event: AnimalCaught): AnimalCaught | null => {
    const decoded = decodeServerMessage(encodeCaught(event));
    return decoded?.type === 'caught' ? decoded.event : null;
  };

  it('carries who caught it, what, and how many went in the pack', () => {
    expect(roundTrip({ netId: 7, item: 'meat', added: 1 })).toEqual({
      netId: 7,
      item: 'meat',
      added: 1,
    });
  });

  it('carries a full pack turning away the catch', () => {
    expect(roundTrip({ netId: 3, item: 'meat', added: 0 })).toEqual({
      netId: 3,
      item: 'meat',
      added: 0,
    });
  });

  it('carries a threat fought off with nothing to show for it', () => {
    expect(roundTrip({ netId: 5, item: null, added: 0 })).toEqual({
      netId: 5,
      item: null,
      added: 0,
    });
  });

  it('fits in five bytes', () => {
    expect(encodeCaught({ netId: 1, item: 'meat', added: 1 }).byteLength).toBe(5);
  });

  it('refuses one that has been cut short', () => {
    const encoded = encodeCaught({ netId: 1, item: 'meat', added: 1 });
    expect(decodeServerMessage(encoded.slice(0, 4))).toBeNull();
  });

  it('refuses an item this build has never heard of', () => {
    const encoded = new Uint8Array(encodeCaught({ netId: 1, item: 'meat', added: 1 }).slice(0));
    encoded[3] = 200;
    expect(decodeServerMessage(encoded.buffer)).toBeNull();
  });
});

describe('telling everybody what has been built', () => {
  const roundTrip = (props: readonly BuiltProp[]): readonly BuiltProp[] | null => {
    const decoded = decodeServerMessage(encodeBuiltProps(props));
    return decoded?.type === 'builtProps' ? decoded.props : null;
  };

  it('carries an empty world', () => {
    expect(roundTrip([])).toEqual([]);
  });

  it('carries every campfire, with its id and where it stands', () => {
    const props: BuiltProp[] = [
      { id: 1, kind: 'campfire', x: 4.2, z: -6.75, lit: false },
      { id: 2, kind: 'campfire', x: -30, z: 12.5, lit: false },
    ];
    const decoded = roundTrip(props);
    expect(decoded).toHaveLength(2);
    expect(decoded?.[0]?.id).toBe(1);
    expect(decoded?.[0]?.kind).toBe('campfire');
    expect(decoded?.[0]?.x).toBeCloseTo(4.2, 2);
    expect(decoded?.[0]?.z).toBeCloseTo(-6.75, 2);
    expect(decoded?.[1]).toEqual(expect.objectContaining({ id: 2, kind: 'campfire' }));
  });

  it('carries whether a campfire is lit', () => {
    const props: BuiltProp[] = [
      { id: 1, kind: 'campfire', x: 0, z: 0, lit: true },
      { id: 2, kind: 'campfire', x: 1, z: 1, lit: false },
    ];
    const decoded = roundTrip(props);
    expect(decoded?.[0]?.lit).toBe(true);
    expect(decoded?.[1]?.lit).toBe(false);
  });

  it('fits an empty list in two bytes', () => {
    expect(encodeBuiltProps([]).byteLength).toBe(2);
  });

  it('costs eight bytes a prop', () => {
    const props: BuiltProp[] = [{ id: 1, kind: 'campfire', x: 0, z: 0, lit: false }];
    expect(encodeBuiltProps(props).byteLength).toBe(10);
  });

  it('refuses one that has been cut short', () => {
    const encoded = encodeBuiltProps([{ id: 1, kind: 'campfire', x: 0, z: 0, lit: false }]);
    expect(decodeServerMessage(encoded.slice(0, 5))).toBeNull();
  });

  it('refuses a kind this build has never heard of', () => {
    const encoded = new Uint8Array(
      encodeBuiltProps([{ id: 1, kind: 'campfire', x: 0, z: 0, lit: false }]).slice(0),
    );
    encoded[4] = 200;
    expect(decodeServerMessage(encoded.buffer)).toBeNull();
  });

  it('past the cap, keeps the most recently built rather than the oldest', () => {
    // A campfire has no per-player cap, so a long-lived world can outgrow
    // MAX_BUILT_PROPS. A fresh campfire silently never reaching anybody
    // would be a much worse loss than an old one falling off the end.
    const props: BuiltProp[] = Array.from({ length: MAX_BUILT_PROPS + 3 }, (_, i) => ({
      id: i,
      kind: 'campfire',
      x: 0,
      z: 0,
      lit: false,
    }));
    const decoded = roundTrip(props);
    expect(decoded).toHaveLength(MAX_BUILT_PROPS);
    expect(decoded?.[0]?.id).toBe(3);
    expect(decoded?.[decoded.length - 1]?.id).toBe(MAX_BUILT_PROPS + 2);
  });
});

describe('telling everybody what is buried', () => {
  const roundTrip = (caches: readonly BuriedCacheView[]): readonly BuriedCacheView[] | null => {
    const decoded = decodeServerMessage(encodeBuriedCaches(caches));
    return decoded?.type === 'buriedCaches' ? decoded.caches : null;
  };

  it('carries an empty world', () => {
    expect(roundTrip([])).toEqual([]);
  });

  it('carries a cache, its owner, and where it is - never what it holds', () => {
    const decoded = roundTrip([{ id: 3, ownerNetId: 7, x: 4.2, z: -6.75 }]);
    expect(decoded).toHaveLength(1);
    expect(decoded?.[0]?.id).toBe(3);
    expect(decoded?.[0]?.ownerNetId).toBe(7);
    expect(decoded?.[0]?.x).toBeCloseTo(4.2, 2);
    expect(decoded?.[0]?.z).toBeCloseTo(-6.75, 2);
  });

  it('carries a cache whose owner is not connected right now', () => {
    const decoded = roundTrip([{ id: 3, ownerNetId: null, x: 0, z: 0 }]);
    expect(decoded?.[0]?.ownerNetId).toBeNull();
  });

  it('fits an empty list in two bytes', () => {
    expect(encodeBuriedCaches([]).byteLength).toBe(2);
  });

  it('costs eight bytes a cache', () => {
    expect(encodeBuriedCaches([{ id: 1, ownerNetId: 1, x: 0, z: 0 }]).byteLength).toBe(10);
  });

  it('refuses one that has been cut short', () => {
    const encoded = encodeBuriedCaches([{ id: 1, ownerNetId: 1, x: 0, z: 0 }]);
    expect(decodeServerMessage(encoded.slice(0, 5))).toBeNull();
  });

  it('past the cap, keeps the most recently buried rather than the oldest', () => {
    // A cache never expires (decision 0028), so a long-lived world can
    // outgrow MAX_BURIED_CACHES the same way built props can.
    const caches: BuriedCacheView[] = Array.from({ length: MAX_BURIED_CACHES + 3 }, (_, i) => ({
      id: i,
      ownerNetId: null,
      x: 0,
      z: 0,
    }));
    const decoded = roundTrip(caches);
    expect(decoded).toHaveLength(MAX_BURIED_CACHES);
    expect(decoded?.[0]?.id).toBe(3);
    expect(decoded?.[decoded.length - 1]?.id).toBe(MAX_BURIED_CACHES + 2);
  });
});

describe("word that a player's own cache changed", () => {
  const roundTrip = (event: CacheEvent): CacheEvent | null => {
    const decoded = decodeServerMessage(encodeCache(event));
    return decoded?.type === 'cache' ? decoded.event : null;
  };

  it('carries a fresh burial', () => {
    expect(roundTrip({ netId: 4, kind: 'buried' })).toEqual({ netId: 4, kind: 'buried' });
  });

  it('carries digging one back up', () => {
    expect(roundTrip({ netId: 4, kind: 'dugUp' })).toEqual({ netId: 4, kind: 'dugUp' });
  });

  it('fits in four bytes', () => {
    expect(encodeCache({ netId: 1, kind: 'buried' }).byteLength).toBe(4);
  });

  it('refuses one that has been cut short', () => {
    const encoded = encodeCache({ netId: 1, kind: 'buried' });
    expect(decodeServerMessage(encoded.slice(0, 3))).toBeNull();
  });
});

describe('introducing yourself', () => {
  it('survives a round trip', () => {
    const decoded = decodeClientMessage(encodeHello('Acorn', 'knight', 'amber'));
    expect(decoded).toEqual({ type: 'hello', name: 'Acorn', character: 'knight', color: 'amber' });
  });

  it('carries a name with real unicode in it', () => {
    const decoded = decodeClientMessage(encodeHello('Amélie 🌲', 'knight', 'moss'));
    expect(decoded).toEqual({
      type: 'hello',
      name: 'Amélie 🌲',
      character: 'knight',
      color: 'moss',
    });
  });

  it('carries an empty name rather than refusing it - the server decides if that is allowed', () => {
    expect(decodeClientMessage(encodeHello('', 'knight', 'amber'))).toEqual({
      type: 'hello',
      name: '',
      character: 'knight',
      color: 'amber',
    });
  });

  it('refuses one that has been cut short', () => {
    const encoded = encodeHello('Acorn', 'knight', 'amber');
    expect(decodeClientMessage(encoded.slice(0, encoded.byteLength - 1))).toBeNull();
  });

  it('refuses a character or colour this build has never heard of', () => {
    const badCharacter = new Uint8Array(encodeHello('Acorn', 'knight', 'amber').slice(0));
    badCharacter[1] = 200;
    expect(decodeClientMessage(badCharacter.buffer)).toBeNull();

    const badColor = new Uint8Array(encodeHello('Acorn', 'knight', 'amber').slice(0));
    badColor[2] = 200;
    expect(decodeClientMessage(badColor.buffer)).toBeNull();
  });
});

describe('telling everybody who is who', () => {
  const roundTrip = (players: readonly RosterEntry[]): readonly RosterEntry[] | null => {
    const decoded = decodeServerMessage(encodeRoster(players));
    return decoded?.type === 'roster' ? decoded.players : null;
  };

  it('carries an empty world', () => {
    expect(roundTrip([])).toEqual([]);
  });

  it('carries a name, character and tint for each connected player', () => {
    const players: RosterEntry[] = [
      { netId: 1, name: 'Acorn', character: 'knight', color: 'amber' },
      { netId: 2, name: 'Ash', character: 'knight', color: 'teal' },
    ];
    expect(roundTrip(players)).toEqual(players);
  });

  it('fits an empty list in two bytes', () => {
    expect(encodeRoster([]).byteLength).toBe(2);
  });

  it('refuses one that has been cut short', () => {
    const encoded = encodeRoster([
      { netId: 1, name: 'Acorn', character: 'knight', color: 'amber' },
    ]);
    expect(decodeServerMessage(encoded.slice(0, encoded.byteLength - 1))).toBeNull();
  });

  it('refuses a character or colour this build has never heard of', () => {
    const encoded = new Uint8Array(
      encodeRoster([{ netId: 1, name: 'Acorn', character: 'knight', color: 'amber' }]).slice(0),
    );
    // header(2) + netId(2) + character(1) puts the colour byte at index 5.
    encoded[5] = 200;
    expect(decodeServerMessage(encoded.buffer)).toBeNull();
  });

  it('never carries more than a world can hold', () => {
    const players: RosterEntry[] = Array.from({ length: MAX_ROSTER_ENTRIES + 5 }, (_, i) => ({
      netId: i + 1,
      name: `Player ${i}`,
      character: 'knight',
      color: 'amber',
    }));
    expect(roundTrip(players)).toHaveLength(MAX_ROSTER_ENTRIES);
  });
});
