import { WorldSimulation, DEFAULT_WORLD_SEED } from '../src';
import { describe, expect, it } from 'vitest';
import {
  fishRecordsFromSaved,
  recordFish,
  fishDisplayLearned,
  startRareReel,
  readRareReel,
  encodeFishRecords,
  encodeRareReel,
  decodeServerMessage,
} from '../src';
describe('personal fishing records', () => {
  it('migrates old or corrupt saves without granting display recipes', () => {
    expect(fishRecordsFromSaved(null)).toEqual({
      counts: [0, 0, 0],
      bestCm: [0, 0, 0],
      displays: 0,
    });
    expect(
      fishRecordsFromSaved({ counts: [-1, NaN, 1.5], bestCm: [999, -4, NaN], displays: 3 }),
    ).toEqual(fishRecordsFromSaved(null));
  });
  it('records seeded sizes, keeps personal bests and unlocks both cosmetic milestones', () => {
    const a = fishRecordsFromSaved(null),
      b = fishRecordsFromSaved(null);
    for (let i = 0; i < 5; i++)
      expect(recordFish(a, 'perch', 12, i, 50)).toBe(recordFish(b, 'perch', 12, i, 50));
    expect(a).toEqual(b);
    expect(a.bestCm[0]).toBeGreaterThanOrEqual(12);
    expect(a.bestCm[0]).toBeLessThanOrEqual(38);
    expect(fishDisplayLearned('fishDisplay', a)).toBe(true);
    expect(fishDisplayLearned('goldenFishDisplay', a)).toBe(false);
    recordFish(a, 'trout', 12, 6, 50);
    recordFish(a, 'goldenCarp', 12, 7, 50);
    expect(a.displays).toBe(3);
    const best = a.bestCm[0];
    recordFish(a, 'perch', 12, 8, 50);
    expect(a.bestCm[0]).toBeGreaterThanOrEqual(best!);
    expect(decodeServerMessage(encodeFishRecords(a))).toEqual({ type: 'fishRecords', ...a });
    expect(decodeServerMessage(encodeFishRecords(a).slice(0, 19))).toBeNull();
    const invalid = encodeFishRecords(fishRecordsFromSaved(null));
    new DataView(invalid).setUint8(19, 3);
    expect(decodeServerMessage(invalid)).toBeNull();
  });
});
describe('gentle rare-fish reel', () => {
  const input = (seq: number, clicked = false, sawBite = false) => ({ seq, clicked, sawBite });
  it('waits for the displayed phase and accepts two broad steady windows', () => {
    const reel = startRareReel(100);
    expect(readRareReel(reel, input(500, true, true))).toBeNull();
    expect(reel.firstSeq).toBeNull();
    readRareReel(reel, input(900));
    expect(readRareReel(reel, input(908, true))).toBeNull();
    expect(reel.hits).toBe(1);
    readRareReel(reel, input(920, true));
    expect(reel.hits).toBe(1);
    expect(readRareReel(reel, input(952, true))).toBe('caught');
    expect(reel.hits).toBe(2);
  });
  it('ignores duplicate inputs and tolerates two mistakes', () => {
    const reel = startRareReel(0);
    readRareReel(reel, input(1));
    readRareReel(reel, input(2, true));
    readRareReel(reel, input(2, true));
    expect(reel.misses).toBe(1);
    readRareReel(reel, input(3, true));
    expect(reel.misses).toBe(2);
    readRareReel(reel, input(15, true));
    expect(readRareReel(reel, input(55, true))).toBe('caught');
  });
  it('ends after three misses or eight seconds and checks compact updates', () => {
    const reel = startRareReel(0);
    readRareReel(reel, input(1));
    readRareReel(reel, input(2, true));
    readRareReel(reel, input(3, true));
    expect(readRareReel(reel, input(4, true))).toBe('tooLate');
    expect(readRareReel(startRareReel(0), input(1))).toBeNull();
    const timed = startRareReel(0);
    readRareReel(timed, input(1));
    expect(readRareReel(timed, input(162))).toBe('tooLate');
    expect(decodeServerMessage(encodeRareReel({ age: 34, hits: 1, misses: 2 }))).toEqual({
      type: 'rareReel',
      age: 34,
      hits: 1,
      misses: 2,
    });
    expect(decodeServerMessage(encodeRareReel({ age: 34, hits: 2, misses: 2 }))).toBeNull();
  });
});

it('enforces earned display recipes without taking supplies, preserves placed ownership, and protects visitors', () => {
  const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED });
  try {
    sim.restoreBuiltProps([
      {
        id: 7,
        kind: 'cabin',
        x: 0,
        z: -5,
        yaw: 0,
        ownerKey: 'owner',
        lit: false,
        litUntilMs: null,
      },
    ]);
    sim.addPlayer(
      1,
      {
        netId: 1,
        x: 0,
        y: 0,
        z: 0,
        facingYaw: 0,
        hunger: 100,
        items: [
          { item: 'log', count: 10 },
          { item: 'stick', count: 10 },
          { item: 'flower', count: 10 },
        ],
        fishRecords: fishRecordsFromSaved({ counts: [5, 0, 0], bestCm: [28, 0, 0] }),
      },
      'owner',
    );
    sim.addPlayer(2, undefined, 'visitor');
    sim.placePlayer(1, { x: 0, y: 0, z: 2 }, 0, 7);
    sim.placePlayer(2, { x: 0, y: 0, z: 2 }, 0, 7);
    const request = {
        action: 'place' as const,
        kind: 'goldenFishDisplay' as const,
        id: 0,
        x: -0.5,
        z: -0.1,
        yaw: 0,
      },
      before = { ...sim.inventoryOf(1) };
    expect(sim.requestDecoration(1, request).reason).toBe('recipe');
    expect(sim.inventoryOf(1)).toEqual(before);
    expect(sim.requestDecoration(2, { ...request, kind: 'fishDisplay' }).reason).toBe('private');
    expect(sim.requestDecoration(1, { ...request, kind: 'fishDisplay' }).reason).toBeNull();
    expect(sim.inventoryOf(1)).toMatchObject({ log: 8, stick: 8 });
    const piece = sim.decorationsList()[0]!,
      saved = sim.persistablePlayers()[0]!;
    sim.removePlayer(1);
    sim.addPlayer(1, { ...saved, fishRecords: fishRecordsFromSaved(null) }, 'owner');
    sim.placePlayer(1, { x: 0, y: 0, z: 2 }, 0, 7);
    expect(sim.requestDecoration(1, { ...piece, action: 'move', x: 0, z: -1.1 }).reason).toBeNull();
    expect(sim.requestDecoration(1, { ...piece, action: 'reclaim' }).reason).toBeNull();
    expect(sim.inventoryOf(1)).toEqual(before);
  } finally {
    sim.dispose();
  }
});
