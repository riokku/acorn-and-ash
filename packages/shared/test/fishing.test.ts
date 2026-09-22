import { afterEach, describe, expect, it } from 'vitest';

import {
  BITE_DELAY_MAX_SECONDS,
  BITE_DELAY_MIN_SECONDS,
  CAST_DISTANCE_MAX,
  CAST_DISTANCE_MIN,
  DEFAULT_WORLD_SEED,
  FISHING_LEASH,
  FLOAT_SHORE_MARGIN,
  HUNGER_MAX,
  PLAYER_RADIUS,
  TICK_HZ,
  TICK_MILLISECONDS,
} from '../src/constants';
import { POND_FISH, fishForRoll } from '../src/data/fish';
import { ITEM_KINDS, ITEM_ORDER, type ItemId } from '../src/data/items';
import {
  BITE_GIVE_UP_TICKS,
  BITE_WINDOW_INPUTS,
  CAST_COOLDOWN_TICKS,
  biteDelayTicks,
  fishOnTheLine,
  readCastInput,
  startCast,
  tickCast,
  type Cast,
} from '../src/sim/fishing';
import { PlayerButton, createInput } from '../src/sim/player';
import { WorldSimulation, type FishingEvent, type PersistedPlayer } from '../src/sim/world-sim';
import { POND, ROD_PICKUP_ID, ROD_SPOT, buildTestClearing } from '../src/world/clearing';
import { castLanding, isOnWater, overlapsWater, waterColliders } from '../src/world/water';

/** Yaw that looks along +X. Yaw zero looks down -Z. */
const EAST = -Math.PI / 2;
const WEST = Math.PI / 2;

/** The widest circle of the pond, and a spot on its west bank looking out over it. */
const mainPool = POND[0];
if (mainPool === undefined) throw new Error('the pond has no water');
const onTheBank = { x: mainPool.x - mainPool.radius - PLAYER_RADIUS - 0.05, y: 0, z: mainPool.z };

describe('where the water is', () => {
  it('knows the middle of the pond from the grass beside it', () => {
    expect(isOnWater(POND, mainPool.x, mainPool.z)).toBe(true);
    expect(isOnWater(POND, onTheBank.x, onTheBank.z)).toBe(false);
  });

  it('keeps a margin in from the bank when asked', () => {
    const justInside = { x: mainPool.x - mainPool.radius + 0.1, z: mainPool.z };
    expect(isOnWater(POND, justInside.x, justInside.z)).toBe(true);
    expect(isOnWater(POND, justInside.x, justInside.z, FLOAT_SHORE_MARGIN)).toBe(false);
  });

  it('puts a wall around every circle of it', () => {
    const walls = waterColliders(POND);
    expect(walls).toHaveLength(POND.length);
    for (const wall of walls) expect(wall.shape).toBe('cylinder');
  });

  it('can tell whether something would poke into it', () => {
    expect(overlapsWater(POND, onTheBank.x, onTheBank.z, 1)).toBe(true);
    expect(overlapsWater(POND, 0, 20, 1)).toBe(false);
  });
});

describe('where a cast lands', () => {
  it('goes as far out as it can when you face the water', () => {
    const spot = castLanding(onTheBank, EAST, POND);
    expect(spot).not.toBeNull();
    if (spot === null) return;
    expect(spot.x - onTheBank.x).toBeCloseTo(CAST_DISTANCE_MAX, 5);
    expect(isOnWater(POND, spot.x, spot.z, FLOAT_SHORE_MARGIN)).toBe(true);
  });

  it('finds nothing when you face the grass', () => {
    expect(castLanding(onTheBank, WEST, POND)).toBeNull();
  });

  it('lands short rather than on the far bank', () => {
    // Standing so close to a small pool that the longest throw would clear it.
    const pool = [{ x: 0, z: 0, radius: 2 }];
    const here = { x: -2.5, y: 0, z: 0 };
    const spot = castLanding(here, EAST, pool);
    expect(spot).not.toBeNull();
    if (spot === null) return;
    const distance = spot.x - here.x;
    expect(distance).toBeLessThan(CAST_DISTANCE_MAX);
    expect(distance).toBeGreaterThanOrEqual(CAST_DISTANCE_MIN);
    expect(isOnWater(pool, spot.x, spot.z, FLOAT_SHORE_MARGIN)).toBe(true);
  });

  it('will not reach water that is too far away', () => {
    const farAway = {
      x: mainPool.x - mainPool.radius - CAST_DISTANCE_MAX - 1,
      y: 0,
      z: mainPool.z,
    };
    expect(castLanding(farAway, EAST, POND)).toBeNull();
  });
});

describe('the pond in the clearing', () => {
  it('is part of every clearing', () => {
    expect(buildTestClearing(DEFAULT_WORLD_SEED).water).toEqual(POND);
  });

  it('has nothing standing in it', () => {
    for (const seed of [DEFAULT_WORLD_SEED, 1, 2, 4242, 99]) {
      const clearing = buildTestClearing(seed);
      for (const prop of clearing.props) {
        expect(overlapsWater(POND, prop.x, prop.z, 0.5)).toBe(false);
      }
    }
  });

  it('leaves a rod on dry land beside it', () => {
    const clearing = buildTestClearing(DEFAULT_WORLD_SEED);
    const rod = clearing.pickups.find((pickup) => pickup.id === ROD_PICKUP_ID);
    expect(rod?.item).toBe('rod');
    expect(isOnWater(POND, ROD_SPOT.x, ROD_SPOT.z)).toBe(false);
    // Close enough to the water that you see the one from the other.
    expect(overlapsWater(POND, ROD_SPOT.x, ROD_SPOT.z, 2)).toBe(true);
  });

  it('keeps every landmark and every tree in the ring, so saved trees still line up', () => {
    // Trees are saved by id. Only rocks scattered after the ring may be moved
    // out of the water, so every id up to the end of the ring must still be here
    // and still be where the seed put it.
    const landmarksAndRing = 9 + 132;
    for (const seed of [DEFAULT_WORLD_SEED, 1, 2, 4242, 99]) {
      const clearing = buildTestClearing(seed);
      for (let id = 1; id <= landmarksAndRing; id++) {
        const index = clearing.indexById.get(id);
        expect(index).toBeDefined();
        expect(clearing.props[index ?? -1]?.id).toBe(id);
      }
    }
  });

  it('puts the walls after the props, so a prop still finds its own collider', () => {
    const clearing = buildTestClearing(DEFAULT_WORLD_SEED);
    expect(clearing.colliders).toHaveLength(clearing.props.length + POND.length);
  });
});

describe('what the pond gives up', () => {
  it('gives each fish its share of the rolls', () => {
    const counts = new Map<ItemId, number>();
    const rolls = 10_000;
    for (let i = 0; i < rolls; i++) {
      const fish = fishForRoll(POND_FISH, (i + 0.5) / rolls);
      counts.set(fish, (counts.get(fish) ?? 0) + 1);
    }
    const total = POND_FISH.reduce((sum, row) => sum + row.weight, 0);
    for (const row of POND_FISH) {
      expect((counts.get(row.item) ?? 0) / rolls).toBeCloseTo(row.weight / total, 2);
    }
  });

  it('makes the golden carp the rare one', () => {
    const carp = POND_FISH.find((row) => row.item === 'goldenCarp');
    const others = POND_FISH.filter((row) => row.item !== 'goldenCarp');
    for (const row of others) expect(carp?.weight).toBeLessThan(row.weight);
  });

  it('lets you carry ten of each fish, and one rod', () => {
    expect(ITEM_KINDS.perch.maxCarry).toBe(10);
    expect(ITEM_KINDS.trout.maxCarry).toBe(10);
    expect(ITEM_KINDS.goldenCarp.maxCarry).toBe(10);
    expect(ITEM_KINDS.rod.maxCarry).toBe(1);
  });

  it('adds the new things to the end of the list, so saved packs keep their meaning', () => {
    expect(ITEM_ORDER.slice(0, 2)).toEqual(['axe', 'log']);
  });

  it('decides the fish from the moment it is hooked', () => {
    const catches = new Set<ItemId>();
    for (let tick = 0; tick < 200; tick++) catches.add(fishOnTheLine(DEFAULT_WORLD_SEED, 0, tick));
    expect(catches.size).toBe(POND_FISH.length);
    expect(fishOnTheLine(DEFAULT_WORLD_SEED, 3, 77)).toBe(fishOnTheLine(DEFAULT_WORLD_SEED, 3, 77));
  });
});

describe('one cast, tick by tick', () => {
  const spot = { x: mainPool.x, z: mainPool.z };
  const SEED = DEFAULT_WORLD_SEED;

  /** A cast whose fish has just bitten, as the server sees it. */
  function bitten(): Cast {
    const cast = startCast(SEED, 0, 100, onTheBank, spot);
    expect(tickCast(cast, cast.biteTick, onTheBank).bit).toBe(true);
    return cast;
  }

  const nothing = { clicked: false, sawBite: false };

  it('waits somewhere between the shortest and longest wait for a bite', () => {
    for (let castNumber = 0; castNumber < 100; castNumber++) {
      const delay = biteDelayTicks(SEED, castNumber, 500);
      expect(delay).toBeGreaterThanOrEqual(BITE_DELAY_MIN_SECONDS * TICK_HZ);
      expect(delay).toBeLessThanOrEqual(BITE_DELAY_MAX_SECONDS * TICK_HZ);
    }
  });

  it('says when the float goes under, once', () => {
    const cast = startCast(SEED, 0, 100, onTheBank, spot);
    expect(tickCast(cast, cast.biteTick - 1, onTheBank).bit).toBe(false);
    expect(tickCast(cast, cast.biteTick, onTheBank).bit).toBe(true);
    expect(tickCast(cast, cast.biteTick + 1, onTheBank).bit).toBe(false);
  });

  it('loses the fish if you click before it bites', () => {
    const cast = startCast(SEED, 0, 100, onTheBank, spot);
    expect(readCastInput(cast, SEED, 101, { seq: 5, clicked: true, sawBite: false })).toEqual({
      outcome: 'tooSoon',
    });
  });

  it('counts a click made before you could see the bite as too soon, however late it arrives', () => {
    // The fish has bitten on the server, but this click was made while the
    // float on the player's screen was still only nibbling.
    const cast = bitten();
    expect(
      readCastInput(cast, SEED, cast.biteTick + 3, { seq: 40, clicked: true, sawBite: false }),
    ).toEqual({ outcome: 'tooSoon' });
  });

  it('hooks the fish when you click after seeing it go under', () => {
    const cast = bitten();
    expect(
      readCastInput(cast, SEED, cast.biteTick + 2, { seq: 50, ...nothing, sawBite: true }),
    ).toBe(null);
    const end = readCastInput(cast, SEED, cast.biteTick + 4, {
      seq: 58,
      clicked: true,
      sawBite: true,
    });
    expect(end?.outcome).toBe('caught');
  });

  it('counts the window from when you saw it, not from when it happened', () => {
    // Seen a long while after the bite, on a slow connection: the full window
    // still starts from there.
    const cast = bitten();
    const seenAt = 300;
    readCastInput(cast, SEED, cast.biteTick + 40, { seq: seenAt, ...nothing, sawBite: true });
    const end = readCastInput(cast, SEED, cast.biteTick + 55, {
      seq: seenAt + BITE_WINDOW_INPUTS,
      clicked: true,
      sawBite: true,
    });
    expect(end?.outcome).toBe('caught');
  });

  it('lets the fish go once the window has passed without a click', () => {
    const cast = bitten();
    readCastInput(cast, SEED, cast.biteTick + 2, { seq: 10, ...nothing, sawBite: true });
    expect(
      readCastInput(cast, SEED, cast.biteTick + 3, {
        seq: 10 + BITE_WINDOW_INPUTS,
        ...nothing,
        sawBite: true,
      }),
    ).toBeNull();
    expect(
      readCastInput(cast, SEED, cast.biteTick + 4, {
        seq: 11 + BITE_WINDOW_INPUTS,
        ...nothing,
        sawBite: true,
      }),
    ).toEqual({ outcome: 'tooLate' });
  });

  it('says too late for a click after the window', () => {
    const cast = bitten();
    readCastInput(cast, SEED, cast.biteTick + 2, { seq: 10, ...nothing, sawBite: true });
    expect(
      readCastInput(cast, SEED, cast.biteTick + 30, {
        seq: 11 + BITE_WINDOW_INPUTS,
        clicked: true,
        sawBite: true,
      }),
    ).toEqual({ outcome: 'tooLate' });
  });

  it('stops waiting on a browser that never says it saw the bite', () => {
    const cast = bitten();
    expect(tickCast(cast, cast.biteTick + BITE_GIVE_UP_TICKS, onTheBank).end).toBeNull();
    expect(tickCast(cast, cast.biteTick + BITE_GIVE_UP_TICKS + 1, onTheBank).end).toEqual({
      outcome: 'tooLate',
    });
  });

  it('ignores a flag that says the bite was seen before there was one', () => {
    const cast = startCast(SEED, 0, 100, onTheBank, spot);
    readCastInput(cast, SEED, 101, { seq: 3, ...nothing, sawBite: true });
    expect(cast.sawBiteSeq).toBeNull();
  });

  it('reels in when you wander off', () => {
    const cast = startCast(SEED, 0, 100, onTheBank, spot);
    const wandered = { x: onTheBank.x - FISHING_LEASH - 0.1, y: 0, z: onTheBank.z };
    expect(tickCast(cast, 101, wandered).end).toEqual({ outcome: 'walkedAway' });
  });

  it('lets you shuffle your feet without losing the line', () => {
    const cast = startCast(SEED, 0, 100, onTheBank, spot);
    const shuffled = { x: onTheBank.x - FISHING_LEASH + 0.2, y: 0, z: onTheBank.z };
    expect(tickCast(cast, 101, shuffled).end).toBeNull();
  });
});

/** Every world a test builds, handed back afterwards: Koota only allows sixteen. */
const built: WorldSimulation[] = [];
afterEach(() => {
  for (const sim of built.splice(0)) sim.dispose();
});

let clockMs = 1_700_000_000_000;
const tickClock = (): number => (clockMs += TICK_MILLISECONDS);

function createWorld(): WorldSimulation {
  const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED });
  built.push(sim);
  return sim;
}

function carrying(netId: number, items: Array<{ item: ItemId; count: number }>): PersistedPlayer {
  return { netId, x: 0, y: 0, z: 0, facingYaw: 0, items, hunger: HUNGER_MAX };
}

/** One tick of standing still, looking one way, with the button up or down. */
function hold(
  sim: WorldSimulation,
  netId: number,
  seq: number,
  yaw: number,
  down: boolean,
  sawBite = false,
): void {
  const buttons = (down ? PlayerButton.Swing : 0) | (sawBite ? PlayerButton.SawBite : 0);
  sim.queueInput(netId, createInput(seq, 0, 0, yaw, buttons));
  sim.step(tickClock());
}

/** A player at the water's edge with a rod, and an input counter for them. */
function atTheWater(items: Array<{ item: ItemId; count: number }> = [{ item: 'rod', count: 1 }]) {
  const sim = createWorld();
  sim.addPlayer(1, carrying(1, items));
  sim.placePlayer(1, onTheBank, EAST);
  let seq = 1;
  const events: FishingEvent[] = [];
  /** Like a browser: from hearing of the bite until the line comes in, say so. */
  let showingBite = false;
  const tick = (down: boolean, yaw = EAST): void => {
    hold(sim, 1, seq++, yaw, down, showingBite);
    for (const event of sim.drainFishingEvents()) {
      events.push(event);
      if (event.kind === 'bite') showingBite = true;
      else if (event.kind !== 'cast') showingBite = false;
    }
  };
  /** Press and let go. */
  const click = (yaw = EAST): void => {
    tick(true, yaw);
    tick(false, yaw);
  };
  /** Stand still until something happens at the water, or give up. */
  const waitFor = (kind: FishingEvent['kind'], limit = 400): void => {
    for (let i = 0; i < limit; i++) {
      if (events.some((event) => event.kind === kind)) return;
      tick(false);
    }
    throw new Error(`never saw ${kind}`);
  };
  return { sim, events, tick, click, waitFor };
}

describe('fishing in the world', () => {
  it('casts when you click facing the water with a rod', () => {
    const { sim, events, click } = atTheWater();
    click();
    const cast = events.find((event) => event.kind === 'cast');
    expect(cast).toBeDefined();
    if (cast?.kind !== 'cast') return;
    expect(isOnWater(POND, cast.x, cast.z, FLOAT_SHORE_MARGIN)).toBe(true);
    expect(sim.castOf(1)).not.toBeNull();
  });

  it('does nothing without a rod', () => {
    const { sim, events, click } = atTheWater([]);
    click();
    expect(events).toEqual([]);
    expect(sim.castOf(1)).toBeNull();
  });

  it('does nothing facing away from the water', () => {
    const { sim, click } = atTheWater();
    click(WEST);
    expect(sim.castOf(1)).toBeNull();
  });

  it('wants a click, not a button held down from before', () => {
    const { sim, tick } = atTheWater();
    // Pressed while looking at the grass, then turned to the water still holding it.
    tick(true, WEST);
    for (let i = 0; i < 5; i++) tick(true, EAST);
    expect(sim.castOf(1)).toBeNull();
    tick(false);
    tick(true);
    expect(sim.castOf(1)).not.toBeNull();
  });

  it('lands a fish in the pack when you click on the bite', () => {
    const { sim, events, click, waitFor } = atTheWater();
    click();
    waitFor('bite');
    click();
    const caught = events.find((event) => event.kind === 'caught');
    expect(caught).toBeDefined();
    if (caught?.kind !== 'caught') return;
    expect(caught.added).toBe(1);
    expect(POND_FISH.map((row) => row.item)).toContain(caught.item);
    expect(sim.inventoryOf(1)[caught.item]).toBe(1);
    expect(sim.castOf(1)).toBeNull();
  });

  it('loses it if you click too soon', () => {
    const { sim, events, click } = atTheWater();
    click();
    click();
    expect(events.map((event) => event.kind)).toEqual(['cast', 'tooSoon']);
    expect(sim.castOf(1)).toBeNull();
  });

  it('loses it if you never click', () => {
    const { events, click, waitFor } = atTheWater();
    click();
    waitFor('bite');
    waitFor('tooLate', BITE_WINDOW_INPUTS + 5);
    expect(events.some((event) => event.kind === 'caught')).toBe(false);
  });

  it('gives a browser that never says it saw the bite five seconds, and no longer', () => {
    // A stalled tab: inputs keep arriving, but none says the bite was shown.
    const { sim, events, click, waitFor } = atTheWater();
    click();
    waitFor('bite');
    let seq = 1000;
    let ticksAfterBite = 0;
    while (!events.some((event) => event.kind === 'tooLate') && ticksAfterBite < 200) {
      hold(sim, 1, seq++, EAST, false, false);
      events.push(...sim.drainFishingEvents());
      ticksAfterBite += 1;
    }
    // Well past the one-second window, because the window never started...
    expect(ticksAfterBite).toBeGreaterThan(BITE_WINDOW_INPUTS * 2);
    // ...and given up on at five seconds.
    expect(ticksAfterBite).toBeLessThanOrEqual(BITE_GIVE_UP_TICKS + 2);
    expect(events.some((event) => event.kind === 'caught')).toBe(false);
  });

  it('reels in when you walk away', () => {
    const { sim, events, click } = atTheWater();
    click();
    let seq = 100;
    for (let i = 0; i < TICK_HZ; i++) {
      sim.queueInput(1, createInput(seq++, 0, 1, WEST, 0));
      sim.step(tickClock());
      events.push(...sim.drainFishingEvents());
    }
    expect(events.some((event) => event.kind === 'walkedAway')).toBe(true);
    expect(sim.castOf(1)).toBeNull();
  });

  it('throws the fish back when the pack has no room for it', () => {
    const full = POND_FISH.map((row) => ({ item: row.item, count: ITEM_KINDS[row.item].maxCarry }));
    const { sim, events, click, waitFor } = atTheWater([{ item: 'rod', count: 1 }, ...full]);
    click();
    waitFor('bite');
    click();
    const caught = events.find((event) => event.kind === 'caught');
    if (caught?.kind !== 'caught') throw new Error('expected a catch');
    expect(caught.added).toBe(0);
    expect(sim.inventoryOf(1)[caught.item]).toBe(ITEM_KINDS[caught.item].maxCarry);
  });

  it('takes a breath before the next cast', () => {
    const { sim, click } = atTheWater();
    click();
    click(); // too soon: the line comes in
    expect(sim.castOf(1)).toBeNull();
    click();
    expect(sim.castOf(1)).toBeNull();
    for (let i = 0; i < CAST_COOLDOWN_TICKS; i++) hold(sim, 1, 500 + i, EAST, false);
    hold(sim, 1, 600, EAST, true);
    expect(sim.castOf(1)).not.toBeNull();
  });

  it('casts with the axe in the pack too, when there is no tree to chop', () => {
    const { sim, click } = atTheWater([
      { item: 'axe', count: 1 },
      { item: 'rod', count: 1 },
    ]);
    click();
    expect(sim.castOf(1)).not.toBeNull();
  });

  it('will not let you walk into the pond', () => {
    const sim = createWorld();
    sim.addPlayer(1);
    sim.placePlayer(1, onTheBank, EAST);
    let seq = 1;
    for (let i = 0; i < TICK_HZ * 2; i++) {
      sim.queueInput(1, createInput(seq++, 0, 1, EAST, 0));
      sim.step(tickClock());
    }
    const here = sim.readPlayer(1)?.position;
    if (here === undefined) throw new Error('missing player');
    expect(isOnWater(POND, here.x, here.z)).toBe(false);
  });

  it('is the same pond on the server and in the browser', () => {
    // Both build the clearing from the seed; neither is told where the water is.
    const a = buildTestClearing(DEFAULT_WORLD_SEED);
    const b = buildTestClearing(DEFAULT_WORLD_SEED);
    expect(a.water).toEqual(b.water);
    expect(a.colliders).toEqual(b.colliders);
  });
});
