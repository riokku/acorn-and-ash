import { afterEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_WORLD_SEED,
  EXPLORE_CELL_SIZE,
  EXPLORE_REVEAL_RADIUS,
  PLAYABLE_HALF_EXTENT,
  TICK_MILLISECONDS,
} from '../src/constants';
import {
  EXPLORED_BYTES,
  EXPLORE_GRID_SIZE,
  createExploredMap,
  exploreCellAt,
  exploreCellCentre,
  exploredFraction,
  exploredMapFrom,
  isCellExplored,
  isExploredAt,
  mergeExplored,
  revealAround,
} from '../src/sim/exploring';
import { createInput } from '../src/sim/player';
import { WorldSimulation } from '../src/sim/world-sim';
import { decodeServerMessage, encodeExplored } from '../src/net/protocol';

describe('the explored map', () => {
  it('covers the whole playable world in well under a kilobyte', () => {
    expect(EXPLORE_GRID_SIZE * EXPLORE_CELL_SIZE).toBeGreaterThanOrEqual(PLAYABLE_HALF_EXTENT * 2);
    expect(EXPLORED_BYTES).toBeLessThan(1024);
    expect(createExploredMap().every((byte) => byte === 0)).toBe(true);
  });

  it('puts every spot in the world in a square, and nothing past the wall', () => {
    expect(exploreCellAt(0, 0)).not.toBeNull();
    expect(exploreCellAt(-PLAYABLE_HALF_EXTENT, -PLAYABLE_HALF_EXTENT)).toBe(0);
    expect(exploreCellAt(PLAYABLE_HALF_EXTENT - 0.01, PLAYABLE_HALF_EXTENT - 0.01)).toBe(
      EXPLORE_GRID_SIZE * EXPLORE_GRID_SIZE - 1,
    );
    expect(exploreCellAt(PLAYABLE_HALF_EXTENT + 1, 0)).toBeNull();
    expect(exploreCellAt(0, -PLAYABLE_HALF_EXTENT - 1)).toBeNull();
  });

  it("finds a square's middle back again", () => {
    const cell = exploreCellAt(13.2, -41.7);
    expect(cell).not.toBeNull();
    const middle = exploreCellCentre(cell ?? 0);
    expect(Math.abs(middle.x - 13.2)).toBeLessThanOrEqual(EXPLORE_CELL_SIZE / 2);
    expect(Math.abs(middle.z + 41.7)).toBeLessThanOrEqual(EXPLORE_CELL_SIZE / 2);
    expect(exploreCellAt(middle.x, middle.z)).toBe(cell);
  });

  it('reveals a round patch around a spot, and only once', () => {
    const map = createExploredMap();
    const revealed = revealAround(map, 20, -10);
    const expected = Math.PI * (EXPLORE_REVEAL_RADIUS / EXPLORE_CELL_SIZE) ** 2;
    expect(revealed).toBeGreaterThan(expected * 0.85);
    expect(revealed).toBeLessThan(expected * 1.15);

    expect(isExploredAt(map, 20, -10)).toBe(true);
    expect(isExploredAt(map, 20 + EXPLORE_REVEAL_RADIUS - 3, -10)).toBe(true);
    expect(isExploredAt(map, 20 + EXPLORE_REVEAL_RADIUS + 5, -10)).toBe(false);
    // Round, not square: the corner of the box around it stays unseen.
    expect(
      isExploredAt(map, 20 + EXPLORE_REVEAL_RADIUS * 0.8, -10 + EXPLORE_REVEAL_RADIUS * 0.8),
    ).toBe(false);

    expect(revealAround(map, 20, -10)).toBe(0);
  });

  it('stops cleanly at the edge of the world', () => {
    const map = createExploredMap();
    expect(() =>
      revealAround(map, PLAYABLE_HALF_EXTENT - 1, PLAYABLE_HALF_EXTENT - 1),
    ).not.toThrow();
    expect(map.length).toBe(EXPLORED_BYTES);
    expect(isExploredAt(map, PLAYABLE_HALF_EXTENT - 2, PLAYABLE_HALF_EXTENT - 2)).toBe(true);
    expect(isExploredAt(map, PLAYABLE_HALF_EXTENT + 2, PLAYABLE_HALF_EXTENT - 2)).toBe(false);
  });

  it('merges two copies without forgetting anything either had seen', () => {
    const mine = createExploredMap();
    const theirs = createExploredMap();
    revealAround(mine, -60, 0);
    revealAround(theirs, 60, 0);
    expect(mergeExplored(mine, theirs)).toBe(true);
    expect(isExploredAt(mine, -60, 0)).toBe(true);
    expect(isExploredAt(mine, 60, 0)).toBe(true);
    expect(mergeExplored(mine, theirs)).toBe(false);
  });

  it('says how much of the world has been seen', () => {
    const map = createExploredMap();
    expect(exploredFraction(map)).toBe(0);
    revealAround(map, 0, 0);
    expect(exploredFraction(map)).toBeGreaterThan(0);
    expect(exploredFraction(map)).toBeLessThan(0.1);
  });

  it('starts over rather than misreading a saved map of the wrong size', () => {
    const saved = createExploredMap();
    revealAround(saved, 0, 0);
    expect(isCellExplored(exploredMapFrom(saved), exploreCellAt(0, 0) ?? -1)).toBe(true);
    expect(exploredMapFrom(new Uint8Array(10)).every((byte) => byte === 0)).toBe(true);
    expect(exploredMapFrom(null).length).toBe(EXPLORED_BYTES);
  });

  it('travels over the wire whole and comes back the same', () => {
    const map = createExploredMap();
    revealAround(map, 33, 71);
    const decoded = decodeServerMessage(encodeExplored(map));
    expect(decoded?.type).toBe('explored');
    if (decoded?.type !== 'explored') return;
    expect([...decoded.cells]).toEqual([...map]);
    // A message of the wrong length is refused, not half-read.
    expect(decodeServerMessage(encodeExplored(map).slice(0, 20))).toBeNull();
  });
});

describe('exploring the world', () => {
  const built: WorldSimulation[] = [];
  afterEach(() => {
    for (const sim of built.splice(0)) sim.dispose();
  });

  let clockMs = 1_700_000_000_000;
  function createWorld(): WorldSimulation {
    const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED });
    built.push(sim);
    return sim;
  }

  it('fills in around a new player, and tells them once', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    sim.step((clockMs += TICK_MILLISECONDS));
    const first = sim.drainExploredChanges();
    expect(first.map((change) => change.netId)).toEqual([1]);
    const position = sim.readPlayer(1)?.position;
    expect(position).toBeDefined();
    expect(
      isExploredAt(first[0]?.explored ?? createExploredMap(), position?.x ?? 0, position?.z ?? 0),
    ).toBe(true);

    // Standing still reveals nothing new, so there is nothing more to say.
    sim.step((clockMs += TICK_MILLISECONDS));
    expect(sim.drainExploredChanges()).toEqual([]);
  });

  it('grows as they walk somewhere new', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0);
    sim.step((clockMs += TICK_MILLISECONDS));
    sim.drainExploredChanges();
    const farAhead = { x: 0, z: -(EXPLORE_REVEAL_RADIUS + 12) };
    expect(isExploredAt(sim.exploredMapOf(1) ?? createExploredMap(), farAhead.x, farAhead.z)).toBe(
      false,
    );

    // Walk forward (towards -Z) for four seconds.
    for (let seq = 1; seq <= 80; seq++) {
      sim.queueInput(1, createInput(seq, 0, 1, 0));
      sim.step((clockMs += TICK_MILLISECONDS));
    }
    expect(isExploredAt(sim.exploredMapOf(1) ?? createExploredMap(), farAhead.x, farAhead.z)).toBe(
      true,
    );
    expect(sim.drainExploredChanges().map((change) => change.netId)).toEqual([1]);
  });

  it('keeps a returning player’s map', () => {
    const sim = createWorld();
    const saved = createExploredMap();
    revealAround(saved, 100, 100);
    sim.addPlayer(1, {
      netId: 1,
      x: 0,
      y: 0,
      z: 6,
      facingYaw: 0,
      items: [],
      hunger: 100,
      explored: saved,
    });
    expect(isExploredAt(sim.exploredMapOf(1) ?? createExploredMap(), 100, 100)).toBe(true);
    const persisted = sim.persistablePlayers()[0];
    expect(persisted?.explored).toBeDefined();
    expect(isExploredAt(persisted?.explored ?? createExploredMap(), 100, 100)).toBe(true);
  });
});
