import { describe, expect, it } from 'vitest';
import { DEFAULT_WORLD_SEED, PLAYER_HEIGHT, PLAYER_RADIUS, TICK_SECONDS } from '../src/constants';
import { createCollisionWorld, resolveCapsule, setLakeFrozen } from '../src/collision/capsule';
import { createInput, createPlayerMotion, PlayerButton } from '../src/sim/player';
import { driftBoat, keepBoatAfloat, stepBoat, landingBeside } from '../src/sim/rowing';
import { buildableFootprint, checkBuildSpot } from '../src/sim/building';
import { clockShiftForSeason } from '../src/sim/seasons';
import { WorldSimulation } from '../src/sim/world-sim';
import { LAKE } from '../src/world/lake';
import { navigableWaterDepthAt, navigableWaterSurfaceAt } from '../src/world/navigable-water';
import {
  STREAM,
  STREAM_POOL_SHARES,
  STREAM_WADING_DEPTH,
  nearestOnStream,
  streamCurrentAt,
  streamPointAt,
  streamSurfaceAt,
  streamWaterDepthAt,
  streamWaterHalfWidthAt,
} from '../src/world/stream';
import { createWildernessTerrain } from '../src/world/terrain';

function riverSpot(share: number) {
  const row = Math.round((STREAM.count - 1) * share);
  const p = streamPointAt(STREAM, row),
    next = streamPointAt(STREAM, row + 1);
  const size = Math.hypot(next.x - p.x, next.z - p.z);
  return {
    ...p,
    along: (row * STREAM.length) / (STREAM.count - 1),
    nx: -(next.z - p.z) / size,
    nz: (next.x - p.x) / size,
    yaw: Math.atan2(-(next.z - p.z), next.x - p.x),
  };
}

const terrain = createWildernessTerrain(DEFAULT_WORLD_SEED);

describe('deep river pools', () => {
  it('matches actual carved ground to depth and leaves shallow routes around every pool', () => {
    for (const share of STREAM_POOL_SHARES) {
      const p = riverSpot(share);
      const depth = streamWaterDepthAt(STREAM, p.x, p.z);
      expect(depth).toBeGreaterThan(1.5);
      expect(streamSurfaceAt(STREAM, p.along) - terrain.heightAt(p.x, p.z)).toBeGreaterThan(1.4);
      const shore = streamWaterHalfWidthAt(STREAM, p.along) * 0.9;
      expect(streamWaterDepthAt(STREAM, p.x + p.nx * shore, p.z + p.nz * shore)).toBeLessThan(
        STREAM_WADING_DEPTH,
      );
    }
  });

  it('keeps a capsule out of deep water but opens the same pools on frozen ice', () => {
    const world = createCollisionWorld(terrain, [], undefined, LAKE, false, STREAM);
    for (const share of STREAM_POOL_SHARES) {
      const p = riverSpot(share),
        position = { x: p.x, y: terrain.heightAt(p.x, p.z), z: p.z };
      expect(resolveCapsule(position, PLAYER_RADIUS, PLAYER_HEIGHT, world)).toBe(true);
      expect(streamWaterDepthAt(STREAM, position.x, position.z)).toBeLessThanOrEqual(
        STREAM_WADING_DEPTH,
      );
      const shallow = { x: position.x, y: terrain.heightAt(position.x, position.z), z: position.z };
      expect(resolveCapsule(shallow, PLAYER_RADIUS, PLAYER_HEIGHT, world)).toBe(false);
      setLakeFrozen(world, true);
      const ice = { x: p.x, y: world.terrain.heightAt(p.x, p.z), z: p.z };
      expect(resolveCapsule(ice, PLAYER_RADIUS, PLAYER_HEIGHT, world)).toBe(false);
      expect(ice.y).toBeCloseTo(streamSurfaceAt(STREAM, p.along) + 0.05, 5);
      setLakeFrozen(world, false);
    }
  });
});

describe('river current', () => {
  it('allows river boats to be built and boarded, drifts once per tick and stops when frozen', () => {
    const p = riverSpot(0.7);
    const bank = landingBeside(p.x, p.z);
    expect(
      checkBuildSpot(
        buildableFootprint('rowboat', p.x, p.z, p.yaw),
        { x: bank.x, y: 0, z: bank.z },
        10,
        [],
        [],
      ),
    ).toBeNull();
    const sim = new WorldSimulation({
      seed: DEFAULT_WORLD_SEED,
      hungerEmptyAfterSeconds: Infinity,
    });
    try {
      sim.restoreBuiltProps([
        {
          id: 1,
          kind: 'rowboat',
          x: p.x,
          z: p.z,
          yaw: p.yaw,
          lit: false,
          ownerKey: null,
          litUntilMs: null,
        },
      ]);
      sim.addPlayer(1, {
        netId: 1,
        x: bank.x,
        y: terrain.heightAt(bank.x, bank.z),
        z: bank.z,
        facingYaw: 0,
        items: [],
        hunger: 100,
      });
      sim.queueInput(1, createInput(1, 0, 0, 0, PlayerButton.Interact));
      sim.step(50);
      expect(sim.builtPropsList()[0]!.rower).toBe(1);
      const occupied = sim.builtPropsList()[0]!;
      const before = { x: occupied.x, z: occupied.z };
      const flow = streamCurrentAt(STREAM, before.x, before.z);
      sim.step(100);
      expect(Math.hypot(occupied.x - before.x, occupied.z - before.z)).toBeCloseTo(
        Math.hypot(flow.x, flow.z) * TICK_SECONDS,
        3,
      );
      const rider = sim.snapshotFor(1).find((e) => e.netId === 1)!;
      expect(rider.y).toBeCloseTo(navigableWaterSurfaceAt(rider.x, rider.z), 2);
      sim.setCalendarShift(clockShiftForSeason(DEFAULT_WORLD_SEED, sim.tick * 50, 'winter'));
      sim.step(150);
      expect(sim.isLakeFrozen()).toBe(true);
      expect(occupied.rower).toBeUndefined();
      const iceBoat = { x: occupied.x, z: occupied.z };
      for (let tick = 4; tick <= 40; tick++) sim.step(tick * 50);
      expect(occupied).toMatchObject(iceBoat);
      const pool = riverSpot(0.68);
      sim.placePlayer(
        1,
        { x: pool.x, y: sim.collision.terrain.heightAt(pool.x, pool.z), z: pool.z },
        0,
      );
      sim.setCalendarShift(clockShiftForSeason(DEFAULT_WORLD_SEED, sim.tick * 50, 'summer'));
      sim.step(2050);
      const walker = sim.snapshotFor(1).find((e) => e.netId === 1)!;
      expect(streamWaterDepthAt(STREAM, walker.x, walker.z)).toBeLessThan(STREAM_WADING_DEPTH);
    } finally {
      sim.dispose();
    }
  });

  it('runs downstream, fades at slough mouths and stops inside each slough and the lake', () => {
    const p = riverSpot(0.7),
      current = streamCurrentAt(STREAM, p.x, p.z);
    expect(Math.hypot(current.x, current.z)).toBeGreaterThan(0.6);
    const boat = { x: p.x, z: p.z, yaw: p.yaw };
    const start = nearestOnStream(STREAM, boat.x, boat.z, 6)!.along;
    for (let step = 0; step < 200; step++) driftBoat(boat, TICK_SECONDS);
    expect(nearestOnStream(STREAM, boat.x, boat.z, 6)!.along).toBeGreaterThan(start + 5);
    expect(navigableWaterDepthAt(boat.x, boat.z)).toBeGreaterThan(1.2);
    for (const slough of STREAM.sloughs) {
      const calm = slough.basin[0]!;
      expect(streamCurrentAt(STREAM, calm.x, calm.z)).toEqual({ x: 0, z: 0 });
      const still = { x: calm.x, z: calm.z, yaw: 0 };
      expect(driftBoat(still, 1)).toBe(false);
      expect(still).toMatchObject({ x: calm.x, z: calm.z });
    }
    const lake = LAKE.basin[0]!;
    expect(streamCurrentAt(STREAM, lake.x, lake.z)).toEqual({ x: 0, z: 0 });
    const half = streamWaterHalfWidthAt(STREAM, p.along);
    const mouth = streamCurrentAt(STREAM, p.x + p.nx * half, p.z + p.nz * half);
    const calm = streamCurrentAt(STREAM, p.x + p.nx * (half + 1), p.z + p.nz * (half + 1));
    expect(Math.hypot(mouth.x, mouth.z)).toBeLessThan(Math.hypot(current.x, current.z));
    expect(calm).toEqual({ x: 0, z: 0 });
  });

  it('carries an idle rower at the river surface and still allows rowing against the current', () => {
    const p = riverSpot(0.7);
    const world = createCollisionWorld(terrain, [], undefined, LAKE, false, STREAM);
    const motion = createPlayerMotion({ x: p.x, y: 0, z: p.z });
    motion.facingYaw = p.yaw - Math.PI / 2;
    const initial = nearestOnStream(STREAM, p.x, p.z, 6)!.along;
    for (let step = 0; step < 40; step++)
      stepBoat(motion, createInput(step, 0, 0, 0, 0), TICK_SECONDS, world);
    expect(nearestOnStream(STREAM, motion.position.x, motion.position.z, 6)!.along).toBeGreaterThan(
      initial + 1,
    );
    expect(motion.position.y).toBe(navigableWaterSurfaceAt(motion.position.x, motion.position.z));
    const upstream = motion.facingYaw + Math.PI;
    for (let step = 0; step < 160; step++)
      stepBoat(motion, createInput(step, 0, 1, upstream, 0), TICK_SECONDS, world);
    expect(nearestOnStream(STREAM, motion.position.x, motion.position.z, 6)!.along).toBeLessThan(
      initial - 5,
    );
    expect(keepBoatAfloat(motion.position, motion.facingYaw + Math.PI / 2)).toBeNull();
    expect(landingBeside(motion.position.x, motion.position.z).depth).toBeLessThan(6);
  });

  it('replicates unattended boat drift once per second and leaves slough boats still', () => {
    const sim = new WorldSimulation({
      seed: DEFAULT_WORLD_SEED,
      hungerEmptyAfterSeconds: Infinity,
    });
    try {
      const p = riverSpot(0.7),
        calm = STREAM.sloughs[0]!.basin[0]!;
      sim.restoreBuiltProps([
        {
          id: 1,
          kind: 'rowboat',
          x: p.x,
          z: p.z,
          yaw: p.yaw,
          lit: false,
          ownerKey: null,
          litUntilMs: null,
        },
        {
          id: 2,
          kind: 'rowboat',
          x: calm.x,
          z: calm.z,
          yaw: 0,
          lit: false,
          ownerKey: null,
          litUntilMs: null,
        },
      ]);
      for (let tick = 1; tick < 20; tick++) sim.step(tick * 50);
      expect(sim.drainBoatChanges()).toEqual([]);
      sim.step(1000);
      expect(sim.drainBoatChanges().map((boat) => boat.id)).toEqual([1]);
      const [moving, still] = sim.builtPropsList();
      expect(Math.hypot(moving!.x - p.x, moving!.z - p.z)).toBeGreaterThan(0.6);
      expect(still).toMatchObject({ x: calm.x, z: calm.z });
    } finally {
      sim.dispose();
    }
  });
});
