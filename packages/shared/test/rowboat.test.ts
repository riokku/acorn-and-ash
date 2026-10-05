import { afterEach, describe, expect, it } from 'vitest';

import { BUILD_REACH, DEFAULT_WORLD_SEED, HUNGER_MAX, TICK_MILLISECONDS } from '../src/constants';
import { BUILDABLE_KINDS, BUILDABLE_KIND_ORDER } from '../src/data/buildables';
import { ITEM_KINDS } from '../src/data/items';
import {
  buildableFootprint,
  checkBuildSpot,
  footprintEnds,
  reedFootprints,
  roundFootprint,
} from '../src/sim/building';
import { countOf } from '../src/sim/inventory';
import { createInput } from '../src/sim/player';
import { WorldSimulation } from '../src/sim/world-sim';
import { BOAT_BERTH_MAX_DEPTH, BOAT_HULL_MIN_DEPTH } from '../src/world/boat';
import { LAKE, lakeDepthAt } from '../src/world/lake';
import { REED_PATCHES } from '../src/world/reeds';
import type { WaterCircle } from '../src/world/water';

/** A walker far from the lake, so only the lake's own rules say anything. */
const FAR_AWAY = { x: 0, y: 0, z: 0 };
/** Reach wide enough that where the player stands never decides the answer. */
const ANY_REACH = 1000;

/** How far in from the bank a boat is moored in these tests, in metres from the shore. */
const BERTH_DEPTH = 2.5;

interface Berth {
  readonly x: number;
  readonly z: number;
  /** Turned so the boat lies along the bank. */
  readonly yaw: number;
  /** Where somebody stands on the bank to have built it. */
  readonly bank: { readonly x: number; readonly z: number };
  /** Which way is out into the water, from the bank. */
  readonly inward: { readonly x: number; readonly z: number };
}

/** The circle of the lake this reed patch grows on the edge of. */
function circleOf(spot: { x: number; z: number }): WaterCircle {
  const gap = (circle: WaterCircle): number =>
    Math.abs(Math.hypot(spot.x - circle.x, spot.z - circle.z) - circle.radius);
  return LAKE.basin.reduce((best, circle) => (gap(circle) < gap(best) ? circle : best));
}

/** A boat's place on the water beside a reed patch, lying along the bank, and where its builder stands. */
function berthBeside(spot: { x: number; z: number }, depth = BERTH_DEPTH): Berth {
  const circle = circleOf(spot);
  const length = Math.hypot(circle.x - spot.x, circle.z - spot.z);
  const inward = { x: (circle.x - spot.x) / length, z: (circle.z - spot.z) / length };
  // The reeds stand 0.45 m from the shore; the middle of the boat is `depth` from it.
  const reach = depth - 0.45;
  const x = spot.x + inward.x * reach;
  const z = spot.z + inward.z * reach;
  // The tangent to the bank is the way the hull's length runs: a model's X axis
  // turned by `yaw` points along (cos yaw, -sin yaw).
  const tangent = { x: -inward.z, z: inward.x };
  const yaw = Math.atan2(-tangent.z, tangent.x);
  const standing = depth + 0.4;
  return {
    x,
    z,
    yaw,
    inward,
    bank: { x: x - inward.x * standing, z: z - inward.z * standing },
  };
}

const first = REED_PATCHES[0]!;

describe('what a rowboat is', () => {
  it('costs six logs and two rope, and is the last buildable in the menu order', () => {
    expect(BUILDABLE_KINDS.rowboat.costs).toEqual([
      { item: 'log', amount: 6 },
      { item: 'rope', amount: 2 },
    ]);
    expect(BUILDABLE_KIND_ORDER.at(-1)).toBe('rowboat');
    expect(ITEM_KINDS.rope.displayName).toBe('Rope');
  });

  it('is a long hull with round ends, one to a player', () => {
    expect(BUILDABLE_KINDS.rowboat.footprintHalfLength).toBeGreaterThan(0.5);
    expect(BUILDABLE_KINDS.rowboat.capPerPlayer).toBe(true);
    expect(BUILDABLE_KINDS.rowboat.isHome).toBe(false);
  });
});

describe('where a rowboat can be moored', () => {
  it('floats beside every clump of reeds, lying along the bank', () => {
    for (const spot of REED_PATCHES) {
      const berth = berthBeside(spot);
      const piece = buildableFootprint('rowboat', berth.x, berth.z, berth.yaw);
      expect(checkBuildSpot(piece, FAR_AWAY, ANY_REACH, [], [])).toBeNull();
    }
  });

  it('is turned along the bank by the yaw these tests use', () => {
    const berth = berthBeside(first);
    const [one, other] = footprintEnds(buildableFootprint('rowboat', berth.x, berth.z, berth.yaw));
    // Both ends are the same distance from the shore: the hull lies parallel to it.
    expect(
      Math.abs(lakeDepthAt(LAKE, one.x, one.z) - lakeDepthAt(LAKE, other.x, other.z)),
    ).toBeLessThan(0.2);
  });

  it('is not built on dry land', () => {
    const piece = buildableFootprint('rowboat', 0, -10, 0);
    expect(checkBuildSpot(piece, FAR_AWAY, ANY_REACH, [], [])).toEqual({ reason: 'needsWater' });
  });

  it('needs water under all of it, so not right at the water edge', () => {
    const berth = berthBeside(first, 1);
    const piece = buildableFootprint('rowboat', berth.x, berth.z, berth.yaw);
    expect(lakeDepthAt(LAKE, berth.x, berth.z)).toBeLessThan(BOAT_HULL_MIN_DEPTH + 0.3);
    expect(checkBuildSpot(piece, FAR_AWAY, ANY_REACH, [], [])).toEqual({ reason: 'needsWater' });
  });

  it('needs water under its bow as well as its middle', () => {
    // Turned so the bow points at the bank: its middle floats, its bow does not.
    const berth = berthBeside(first);
    const piece = buildableFootprint('rowboat', berth.x, berth.z, berth.yaw + Math.PI / 2);
    expect(checkBuildSpot(piece, FAR_AWAY, ANY_REACH, [], [])).toEqual({ reason: 'needsWater' });
  });

  it('is not built far out in the deep, where nobody could have reached', () => {
    const berth = berthBeside(first, BOAT_BERTH_MAX_DEPTH + 2);
    const piece = buildableFootprint('rowboat', berth.x, berth.z, berth.yaw);
    expect(checkBuildSpot(piece, FAR_AWAY, ANY_REACH, [], [])).toEqual({ reason: 'tooFarOut' });
  });

  it('is built from the bank within reach, and not from across the lake', () => {
    const berth = berthBeside(first);
    const piece = buildableFootprint('rowboat', berth.x, berth.z, berth.yaw);
    const onBank = { x: berth.bank.x, y: 0, z: berth.bank.z };
    expect(checkBuildSpot(piece, onBank, BUILD_REACH, [], [])).toBeNull();
    const farBank = {
      x: berth.bank.x - berth.inward.x * 20,
      y: 0,
      z: berth.bank.z - berth.inward.z * 20,
    };
    expect(checkBuildSpot(piece, farBank, BUILD_REACH, [], [])).toEqual({ reason: 'tooFar' });
  });

  it('does not ask for the clearing, and ignores the pond-style water rule', () => {
    // Far outside the clearing, and the same circles that keep a campfire away are no bar to a boat.
    const berth = berthBeside(first);
    const piece = buildableFootprint('rowboat', berth.x, berth.z, berth.yaw);
    expect(checkBuildSpot(piece, FAR_AWAY, ANY_REACH, [...LAKE.basin], [])).toBeNull();
    // Whereas a campfire in the same water is refused for it.
    const fire = buildableFootprint('campfire', berth.x, berth.z, 0);
    expect(checkBuildSpot(fire, FAR_AWAY, ANY_REACH, [...LAKE.basin], [])).not.toBeNull();
  });

  it('keeps off other boats', () => {
    const berth = berthBeside(first);
    const piece = buildableFootprint('rowboat', berth.x, berth.z, berth.yaw);
    const other = buildableFootprint('rowboat', berth.x, berth.z, berth.yaw);
    expect(checkBuildSpot(piece, FAR_AWAY, ANY_REACH, [], [other])).toEqual({
      reason: 'tooClose',
      what: 'rowboat',
    });
  });

  it('keeps off the reeds that are cut for rope', () => {
    const footprints = reedFootprints();
    expect(footprints).toHaveLength(REED_PATCHES.length);
    for (const footprint of footprints) expect(footprint.name).toBe('reeds');
    // A boat that would float, but with a clump standing in it, is refused for the clump.
    const berth = berthBeside(first);
    const piece = buildableFootprint('rowboat', berth.x, berth.z, berth.yaw);
    const clump = roundFootprint(berth.x, berth.z, 0.7, 'reeds');
    expect(checkBuildSpot(piece, FAR_AWAY, ANY_REACH, [], [clump])).toEqual({
      reason: 'tooClose',
      what: 'reeds',
    });
  });
});

const built: WorldSimulation[] = [];
let clockMs = 1_700_000_000_000;
const tickClock = (): number => (clockMs += TICK_MILLISECONDS);

afterEach(() => {
  for (const sim of built.splice(0)) sim.dispose();
});

function worldWithBuilder(
  items: Array<{ item: 'log' | 'rope'; count: number }>,
  key = 'boatwright',
) {
  const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED });
  built.push(sim);
  sim.addPlayer(1, { netId: 1, x: 0, y: 0, z: 0, facingYaw: 0, items, hunger: HUNGER_MAX }, key);
  return sim;
}

/** Stand on the bank beside a patch and ask for a boat on the water in front of it. */
function buildBoatBeside(sim: WorldSimulation, berth: Berth, seq = 1): void {
  sim.placePlayer(1, { x: berth.bank.x, y: 0, z: berth.bank.z }, 0);
  sim.requestBuild(1, { kind: 'rowboat', x: berth.x, z: berth.z, yaw: berth.yaw });
  sim.queueInput(1, createInput(seq, 0, 0, 0, 0));
  sim.step(tickClock());
}

const boatsIn = (sim: WorldSimulation) =>
  sim.builtPropsList().filter((prop) => prop.kind === 'rowboat');

describe('building a rowboat', () => {
  it('moors one on the water for six logs and two rope, with no home needed', () => {
    const sim = worldWithBuilder([
      { item: 'log', count: 6 },
      { item: 'rope', count: 2 },
    ]);
    const berth = berthBeside(first);
    buildBoatBeside(sim, berth);

    const [boat] = boatsIn(sim);
    expect(boat).toBeDefined();
    expect(boat!.x).toBeCloseTo(berth.x, 5);
    expect(boat!.z).toBeCloseTo(berth.z, 5);
    expect(boat!.yaw).toBeCloseTo(berth.yaw, 5);
    expect(countOf(sim.inventoryOf(1), 'log')).toBe(0);
    expect(countOf(sim.inventoryOf(1), 'rope')).toBe(0);
    expect(sim.drainBuildEvents()).toHaveLength(1);
  });

  it('wants all of it: five logs or one rope is not enough', () => {
    const noRope = worldWithBuilder([
      { item: 'log', count: 6 },
      { item: 'rope', count: 1 },
    ]);
    buildBoatBeside(noRope, berthBeside(first));
    expect(boatsIn(noRope)).toEqual([]);
    expect(countOf(noRope.inventoryOf(1), 'rope')).toBe(1);

    const noLogs = worldWithBuilder([
      { item: 'log', count: 5 },
      { item: 'rope', count: 2 },
    ]);
    buildBoatBeside(noLogs, berthBeside(first));
    expect(boatsIn(noLogs)).toEqual([]);
  });

  it('refuses a boat on dry land, and keeps the materials', () => {
    const sim = worldWithBuilder([
      { item: 'log', count: 6 },
      { item: 'rope', count: 2 },
    ]);
    const berth = berthBeside(first);
    // Right where the builder stands, on the bank.
    sim.placePlayer(
      1,
      { x: berth.bank.x - berth.inward.x * 3, y: 0, z: berth.bank.z - berth.inward.z * 3 },
      0,
    );
    sim.requestBuild(1, { kind: 'rowboat', x: berth.bank.x, z: berth.bank.z, yaw: berth.yaw });
    sim.queueInput(1, createInput(1, 0, 0, 0, 0));
    sim.step(tickClock());
    expect(boatsIn(sim)).toEqual([]);
    expect(countOf(sim.inventoryOf(1), 'log')).toBe(6);
  });

  it('allows one each, so a second is refused while the first stands', () => {
    const sim = worldWithBuilder([
      { item: 'log', count: 12 },
      { item: 'rope', count: 4 },
    ]);
    buildBoatBeside(sim, berthBeside(first));
    expect(boatsIn(sim)).toHaveLength(1);

    // Well after the first swing's pause, at a different clump.
    for (let tick = 2; tick < 40; tick++) {
      sim.queueInput(1, createInput(tick, 0, 0, 0, 0));
      sim.step(tickClock());
    }
    buildBoatBeside(sim, berthBeside(REED_PATCHES[1]!), 41);
    expect(boatsIn(sim)).toHaveLength(1);
    expect(countOf(sim.inventoryOf(1), 'log')).toBe(6);
  });

  it('is remembered when the world wakes from storage', () => {
    const sim = worldWithBuilder([
      { item: 'log', count: 6 },
      { item: 'rope', count: 2 },
    ]);
    buildBoatBeside(sim, berthBeside(first));
    const saved = sim.builtPropsList().filter((prop) => prop.kind === 'rowboat');
    expect(saved).toHaveLength(1);

    const restored = new WorldSimulation({ seed: DEFAULT_WORLD_SEED });
    built.push(restored);
    restored.restoreBuiltProps(
      saved.map((prop) => ({ ...prop, ownerKey: 'boatwright', litUntilMs: null })),
    );
    expect(boatsIn(restored)).toEqual(saved);
  });
});
