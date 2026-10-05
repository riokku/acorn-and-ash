import { afterEach, describe, expect, it } from 'vitest';

import { DEFAULT_WORLD_SEED, HUNGER_MAX, TICK_MILLISECONDS, TICK_SECONDS } from '../src/constants';
import { createCollisionWorld } from '../src/collision/capsule';
import { ActionKind, unpackActionByte, createActionState } from '../src/sim/actions';
import { buildableFootprint, checkBuildSpot } from '../src/sim/building';
import { createInput, createPlayerMotion, PlayerButton } from '../src/sim/player';
import {
  beachedBoat,
  boatYawFor,
  isWithinBoardingReach,
  keepBoatAfloat,
  landingBeside,
  landingFrom,
  riderFacingFor,
  stepBoat,
} from '../src/sim/rowing';
import { WorldSimulation, type BuiltProp } from '../src/sim/world-sim';
import { createWildernessTerrain } from '../src/world/terrain';
import {
  BOAT_BOARD_REACH,
  BOAT_EXIT_MAX_DEPTH,
  BOAT_HULL_MIN_DEPTH,
  BOAT_ROW_SPEED,
  BOAT_SPRINT_SPEED,
} from '../src/world/boat';
import { LAKE, lakeDepthAt } from '../src/world/lake';
import { REED_PATCHES } from '../src/world/reeds';
import { encodeBuiltProps, decodeServerMessage } from '../src/net/protocol';

const FAR_AWAY = { x: 0, y: 0, z: 0 };

/** The water in front of the first clump of reeds: where a boat floats, which way is out, and the bank. */
function berthAt(depth = 2.5, alongBank = 0) {
  const spot = REED_PATCHES[0]!;
  const circle = LAKE.basin.reduce((best, c) => {
    const gap = (each: { x: number; z: number; radius: number }) =>
      Math.abs(Math.hypot(spot.x - each.x, spot.z - each.z) - each.radius);
    return gap(c) < gap(best) ? c : best;
  });
  const length = Math.hypot(circle.x - spot.x, circle.z - spot.z);
  const inward = { x: (circle.x - spot.x) / length, z: (circle.z - spot.z) / length };
  const along = { x: -inward.z, z: inward.x };
  const reach = depth - 0.45;
  const x = spot.x + inward.x * reach + along.x * alongBank;
  const z = spot.z + inward.z * reach + along.z * alongBank;
  return {
    x,
    z,
    inward,
    along,
    yaw: Math.atan2(-along.z, along.x),
    // Somebody standing on the bank a little way along it, in reach of the boat.
    bank: {
      x: x - inward.x * (depth + 0.4) + along.x * 3.5,
      z: z - inward.z * (depth + 0.4) + along.z * 3.5,
    },
    /** The camera heading that points the boat out over the water. */
    outYaw: Math.atan2(-inward.x, -inward.z),
    /** The camera heading that points it along the bank, away from the reeds. */
    alongYaw: Math.atan2(-along.x, -along.z),
  };
}

describe('rowing a boat', () => {
  const world = createCollisionWorld(createWildernessTerrain(DEFAULT_WORLD_SEED), []);

  function rowFrom(x: number, z: number, facingYaw: number) {
    const motion = createPlayerMotion({ x, y: 0, z });
    motion.facingYaw = facingYaw;
    return motion;
  }

  /** `seconds` of rowing toward a camera heading, in whole ticks. */
  function row(motion: ReturnType<typeof rowFrom>, seconds: number, yaw: number, buttons = 0) {
    for (let tick = 0; tick < Math.round(seconds / TICK_SECONDS); tick++)
      stepBoat(motion, createInput(tick + 1, 0, 1, yaw, buttons), TICK_SECONDS, world);
  }

  const speedOf = (motion: ReturnType<typeof rowFrom>) =>
    Math.hypot(motion.velocity.x, motion.velocity.z);

  it('turns the bow to where the rower points and picks up speed from there', () => {
    const berth = berthAt(6);
    // Facing out already, so there is nothing to turn.
    const motion = rowFrom(berth.x, berth.z, berth.outYaw);
    row(motion, 4, berth.outYaw);
    expect(speedOf(motion)).toBeCloseTo(BOAT_ROW_SPEED, 1);
    // Rowing out, and the boat has gone out.
    const gone =
      (motion.position.x - berth.x) * berth.inward.x +
      (motion.position.z - berth.z) * berth.inward.z;
    expect(gone).toBeGreaterThan(5);
    expect(motion.position.y).toBe(LAKE.level);
  });

  it('swings round at a limited rate, slowing for a sharp turn', () => {
    const berth = berthAt(8);
    const motion = rowFrom(berth.x, berth.z, berth.outYaw);
    // Pointing straight the other way.
    stepBoat(motion, createInput(1, 0, 1, berth.outYaw + Math.PI), TICK_SECONDS, world);
    const turned = Math.abs(
      Math.atan2(
        Math.sin(motion.facingYaw - berth.outYaw),
        Math.cos(motion.facingYaw - berth.outYaw),
      ),
    );
    expect(turned).toBeGreaterThan(0);
    expect(turned).toBeLessThan(0.2);
    // Not up to speed until it has come round.
    row(motion, 0.5, berth.outYaw + Math.PI);
    expect(speedOf(motion)).toBeLessThan(BOAT_ROW_SPEED / 2);
  });

  it('rows faster when pulling hard, and glides to a stop when let go', () => {
    const berth = berthAt(8);
    const motion = rowFrom(berth.x, berth.z, berth.outYaw);
    // Far enough to reach full speed, and not so far it is across the lake.
    row(motion, 3, berth.outYaw, PlayerButton.Sprint);
    expect(speedOf(motion)).toBeCloseTo(BOAT_SPRINT_SPEED, 1);
    for (let tick = 0; tick < 12 / TICK_SECONDS; tick++) {
      stepBoat(motion, createInput(tick + 1, 0, 0, berth.outYaw), TICK_SECONDS, world);
      if (speedOf(motion) === 0) break;
    }
    expect(speedOf(motion)).toBe(0);
  });

  it('never runs aground: rowing at the bank, the hull stays in the water and slides along it', () => {
    const berth = berthAt(4);
    const motion = rowFrom(berth.x, berth.z, riderFacingFor(berth.yaw));
    // Hard at the bank, then along it, then at it again.
    row(motion, 10, berth.outYaw + Math.PI, PlayerButton.Sprint);
    expect(keepBoatAfloat({ ...motion.position }, boatYawFor(motion.facingYaw))).toBeNull();
    expect(lakeDepthAt(LAKE, motion.position.x, motion.position.z)).toBeGreaterThanOrEqual(
      BOAT_HULL_MIN_DEPTH - 0.01,
    );
    // Held against the bank it has stopped, rather than creeping up it.
    expect(speedOf(motion)).toBeLessThan(0.5);
  });

  it('is carried the same by the server and the browser: stepping is a pure function of its inputs', () => {
    const berth = berthAt(8);
    const one = rowFrom(berth.x, berth.z, berth.outYaw);
    const other = rowFrom(berth.x, berth.z, berth.outYaw);
    row(one, 3, berth.outYaw + 0.7);
    row(other, 3, berth.outYaw + 0.7);
    expect(one).toEqual(other);
  });
});

describe('climbing in and out', () => {
  it('reaches a boat from the bank, and not across the lake', () => {
    const berth = berthAt();
    expect(isWithinBoardingReach({ ...berth.bank, y: 0 }, berth)).toBe(true);
    const far = { x: berth.x - berth.inward.x * 20, y: 0, z: berth.z - berth.inward.z * 20 };
    expect(isWithinBoardingReach(far, berth)).toBe(false);
    expect(BOAT_BOARD_REACH).toBeGreaterThan(4);
  });

  it('steps ashore from near the bank, and not from the middle of the lake', () => {
    const near = berthAt(2.5);
    const landing = landingFrom(near.x, near.z)!;
    expect(landing).not.toBeNull();
    // On dry land, a little way up the beach.
    expect(lakeDepthAt(LAKE, landing.x, landing.z)).toBeLessThan(0);
    const out = berthAt(BOAT_EXIT_MAX_DEPTH + 1);
    expect(landingFrom(out.x, out.z)).toBeNull();
  });

  it('puts a boat ashore along the bank, afloat, wherever it was out on the water', () => {
    for (const depth of [1.9, 3.5, 6, 12]) {
      const out = berthAt(depth);
      const berth = beachedBoat(out.x, out.z);
      const piece = buildableFootprint('rowboat', berth.x, berth.z, berth.yaw);
      expect(checkBuildSpot(piece, FAR_AWAY, 1000, [], [])).toBeNull();
      const bank = landingBeside(out.x, out.z);
      expect(lakeDepthAt(LAKE, bank.x, bank.z)).toBeLessThan(0);
    }
  });

  it('says which way a rider faces for the way the boat is turned, and back', () => {
    for (const facing of [-2.5, -1, 0, 0.7, 3]) {
      const yaw = boatYawFor(facing);
      // The bow of a boat turned `yaw` points along (cos yaw, -sin yaw); a rider faces (-sin f, -cos f).
      expect(Math.cos(yaw)).toBeCloseTo(-Math.sin(facing), 6);
      expect(-Math.sin(yaw)).toBeCloseTo(-Math.cos(facing), 6);
      expect(riderFacingFor(yaw)).toBeCloseTo(facing, 6);
    }
  });
});

describe('a boat in the world', () => {
  const built: WorldSimulation[] = [];
  let clockMs = 1_700_000_000_000;
  let sequence = 0;
  afterEach(() => {
    for (const sim of built.splice(0)) sim.dispose();
  });

  const BOAT_ID = 7;

  /** A world with one boat moored at `berth`, and `players` of them on the bank beside it. */
  function lakeWorld(berth = berthAt(), players = 1) {
    const sim = new WorldSimulation({
      seed: DEFAULT_WORLD_SEED,
      hungerEmptyAfterSeconds: Infinity,
    });
    built.push(sim);
    sim.restoreBuiltProps([
      {
        id: BOAT_ID,
        kind: 'rowboat',
        x: berth.x,
        z: berth.z,
        yaw: berth.yaw,
        lit: false,
        ownerKey: 'boatwright',
        litUntilMs: null,
      },
    ]);
    for (let netId = 1; netId <= players; netId++) {
      sim.addPlayer(
        netId,
        { netId, x: 0, y: 0, z: 0, facingYaw: 0, items: [], hunger: HUNGER_MAX },
        `rower-${netId}`,
      );
      sim.placePlayer(netId, { x: berth.bank.x, y: 0, z: berth.bank.z }, 0);
    }
    return sim;
  }

  /** One tick for this player, with these buttons and this way held. */
  function tick(sim: WorldSimulation, netId: number, moveZ = 0, yaw = 0, buttons = 0): void {
    sim.queueInput(netId, createInput(++sequence, 0, moveZ, yaw, buttons));
    sim.step((clockMs += TICK_MILLISECONDS));
  }
  const ticks = (
    sim: WorldSimulation,
    netId: number,
    count: number,
    moveZ = 0,
    yaw = 0,
    buttons = 0,
  ) => {
    for (let i = 0; i < count; i++) tick(sim, netId, moveZ, yaw, buttons);
  };
  /** A press and a release of interact: one tap of E. */
  const tapE = (sim: WorldSimulation, netId: number) => {
    tick(sim, netId, 0, 0, PlayerButton.Interact);
    tick(sim, netId, 0, 0, 0);
  };

  const actionOf = (sim: WorldSimulation, netId: number) => {
    const entity = sim.snapshotFor(netId).find((each) => each.netId === netId)!;
    const state = unpackActionByte(entity.action, createActionState());
    return state.kind;
  };
  const boatOf = (sim: WorldSimulation): BuiltProp =>
    sim.builtPropsList().find((p) => p.id === BOAT_ID)!;
  const positionOf = (sim: WorldSimulation, netId: number) =>
    sim.snapshotFor(netId).find((e) => e.netId === netId)!;

  it('is boarded with E from the bank: the rider sits in the middle of it, facing its bow', () => {
    const berth = berthAt();
    const sim = lakeWorld(berth);
    tapE(sim, 1);

    expect(actionOf(sim, 1)).toBe(ActionKind.Row);
    expect(boatOf(sim).rower).toBe(1);
    const rider = positionOf(sim, 1);
    expect(rider.x).toBeCloseTo(berth.x, 3);
    expect(rider.z).toBeCloseTo(berth.z, 3);
    expect(rider.y).toBe(LAKE.level);
    expect(rider.yaw).toBeCloseTo(riderFacingFor(berth.yaw), 3);
    expect(sim.drainBoatChanges().map((boat) => boat.id)).toEqual([BOAT_ID]);
  });

  it('is not boarded from too far away', () => {
    const berth = berthAt();
    const sim = lakeWorld(berth);
    sim.placePlayer(
      1,
      { x: berth.bank.x - berth.inward.x * 12, y: 0, z: berth.bank.z - berth.inward.z * 12 },
      0,
    );
    tapE(sim, 1);
    expect(actionOf(sim, 1)).toBe(ActionKind.Idle);
    expect(boatOf(sim).rower).toBeUndefined();
  });

  it('is not climbed straight out of by the press that climbed in, however long it is held', () => {
    const sim = lakeWorld();
    ticks(sim, 1, 8, 0, 0, PlayerButton.Interact);
    expect(actionOf(sim, 1)).toBe(ActionKind.Row);
  });

  it('carries its rider where they row, and its place follows them', () => {
    const berth = berthAt();
    const sim = lakeWorld(berth);
    tapE(sim, 1);
    ticks(sim, 1, 80, 1, berth.outYaw);

    const rider = positionOf(sim, 1);
    const gone = (rider.x - berth.x) * berth.inward.x + (rider.z - berth.z) * berth.inward.z;
    expect(gone).toBeGreaterThan(3);
    expect(boatOf(sim).x).toBeCloseTo(rider.x, 5);
    expect(boatOf(sim).z).toBeCloseTo(rider.z, 5);
    // Rowing out over the bow it faces: the boat's own bow is the way it goes.
    expect(boatOf(sim).yaw).toBeCloseTo(boatYawFor(rider.yaw), 5);
  });

  it('has room for one: nobody else can climb into it while it is being rowed', () => {
    const berth = berthAt();
    const sim = lakeWorld(berth, 2);
    tapE(sim, 1);
    tapE(sim, 2);
    expect(actionOf(sim, 2)).toBe(ActionKind.Idle);
    expect(boatOf(sim).rower).toBe(1);
  });

  it('cannot be climbed out of in the middle of the lake', () => {
    const berth = berthAt();
    const sim = lakeWorld(berth);
    tapE(sim, 1);
    ticks(sim, 1, 60, 1, berth.outYaw, PlayerButton.Sprint);
    expect(lakeDepthAt(LAKE, positionOf(sim, 1).x, positionOf(sim, 1).z)).toBeGreaterThan(
      BOAT_EXIT_MAX_DEPTH,
    );
    tapE(sim, 1);
    expect(actionOf(sim, 1)).toBe(ActionKind.Row);
    expect(boatOf(sim).rower).toBe(1);
  });

  it('is climbed out of at the bank, and stays where it was left for the next rower', () => {
    const berth = berthAt();
    const sim = lakeWorld(berth, 2);
    tapE(sim, 1);
    // Along the bank, well away from the reeds, which the same press would cut first...
    ticks(sim, 1, 120, 1, berth.alongYaw);
    // ...and then in to the nearest shore, which holds it off the sand.
    const shore = landingBeside(boatOf(sim).x, boatOf(sim).z);
    ticks(sim, 1, 100, 1, Math.atan2(shore.towardX, shore.towardZ));
    expect(lakeDepthAt(LAKE, boatOf(sim).x, boatOf(sim).z)).toBeLessThan(BOAT_EXIT_MAX_DEPTH);
    sim.drainBoatChanges();
    const before = { x: boatOf(sim).x, z: boatOf(sim).z };
    tapE(sim, 1);
    // It has only glided a hand's breadth on from where it was, in the moment of stepping out.
    expect(Math.hypot(boatOf(sim).x - before.x, boatOf(sim).z - before.z)).toBeLessThan(0.15);
    const left = { x: boatOf(sim).x, z: boatOf(sim).z, yaw: boatOf(sim).yaw };

    expect(actionOf(sim, 1)).toBe(ActionKind.Idle);
    const walker = positionOf(sim, 1);
    expect(lakeDepthAt(LAKE, walker.x, walker.z)).toBeLessThan(0);
    expect(walker.y).toBeGreaterThanOrEqual(LAKE.level);
    expect(boatOf(sim).rower).toBeUndefined();
    // Not moved by being left, however long it is, and still floating where it was left.
    ticks(sim, 1, 60, 1, 0);
    expect(boatOf(sim)).toMatchObject(left);
    const piece = buildableFootprint('rowboat', left.x, left.z, left.yaw);
    expect(checkBuildSpot(piece, FAR_AWAY, 1000, [], [])).toBeNull();
    expect(sim.drainBoatChanges().map((boat) => boat.id)).toEqual([BOAT_ID]);

    // Another player on the bank climbs in where it was left.
    sim.placePlayer(2, { x: walker.x, y: walker.y, z: walker.z }, 0);
    tapE(sim, 2);
    expect(actionOf(sim, 2)).toBe(ActionKind.Row);
    expect(boatOf(sim).rower).toBe(2);
  });

  it('cannot be built from, or fished from, or swung from while rowing', () => {
    const berth = berthAt();
    const sim = lakeWorld(berth);
    tapE(sim, 1);
    ticks(sim, 1, 6, 0, 0, PlayerButton.Swing);
    ticks(sim, 1, 6, 0, 0, PlayerButton.Dodge);
    expect(actionOf(sim, 1)).toBe(ActionKind.Row);
  });

  it('is put ashore with its rider, when they leave the game out on the lake', () => {
    const berth = berthAt();
    const sim = lakeWorld(berth);
    tapE(sim, 1);
    ticks(sim, 1, 60, 1, berth.outYaw, PlayerButton.Sprint);
    sim.drainBoatChanges();

    // What is saved for them is the bank, not the water.
    const [saved] = sim.persistablePlayers();
    expect(lakeDepthAt(LAKE, saved!.x, saved!.z)).toBeLessThan(0);

    sim.removePlayer(1);
    const boat = boatOf(sim);
    expect(boat.rower).toBeUndefined();
    const piece = buildableFootprint('rowboat', boat.x, boat.z, boat.yaw);
    expect(checkBuildSpot(piece, FAR_AWAY, 1000, [], [])).toBeNull();
    expect(sim.drainBoatChanges().map((changed) => changed.id)).toEqual([BOAT_ID]);
  });

  it('tells everybody which boat is taken, and who the rider is by where they sit', () => {
    const berth = berthAt();
    const sim = lakeWorld(berth);
    tapE(sim, 1);
    const message = decodeServerMessage(encodeBuiltProps(sim.builtPropsList(), () => false));
    expect(message?.type).toBe('builtProps');
    if (message?.type !== 'builtProps') return;
    expect(message.props.find((prop) => prop.id === BOAT_ID)?.occupied).toBe(true);

    ticks(sim, 1, 4, 0, 0);
    // Out of the boat once it is back at the bank: nothing is marked.
    const moored = decodeServerMessage(
      encodeBuiltProps(
        [{ ...boatOf(sim), rower: undefined } as BuiltProp].map((prop) => {
          const { rower: _unused, ...rest } = prop;
          return rest;
        }),
        () => false,
      ),
    );
    if (moored?.type !== 'builtProps') throw new Error('not built props');
    expect(moored.props[0]?.occupied).toBeUndefined();
  });
});
