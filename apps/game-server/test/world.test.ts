import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import {
  ANIMAL_DENS,
  CLOSE_PLAYING_ELSEWHERE,
  ANIMAL_KINDS,
  AXE_PICKUP_ID,
  BAG_PICKUP_ID,
  BAG_SPOT,
  DEFAULT_WORLD_SEED,
  Gesture,
  AXE_STUMP,
  CHOP_REACH,
  HEALTH_MAX,
  HUNGER_MAX,
  ITEM_KINDS,
  POND_FISH,
  ROD_PICKUP_ID,
  ROD_SPOT,
  PICKUP_REACH,
  PROP_KINDS,
  PlayerButton,
  SNAPSHOT_HZ,
  SnapshotFlag,
  FLOWER_PATCHES,
  GATHER_PATCH_MAX_COUNT,
  GATHER_PATCH_MIN_COUNT,
  SPAWN_POSITION,
  STICK_PATCHES,
  TICK_HZ,
  buildTestClearing,
  buildableKindIndex,
  choppingRuleFor,
  isExploredAt,
  HOME_WAKE_SPOT,
  HOME_ENTRY,
  recipeFor,
  type ItemId,
  type WorldSimulation,
} from '@acorn/shared';

import { sleep, TestClient, waitFor } from './helpers';

/** Each test gets its own world so they cannot tread on each other. */
let worldCounter = 0;
const nextWorldId = (): string => `world-${++worldCounter}-${Math.random().toString(36).slice(2)}`;

/** The hand-placed wildlife rides along in every snapshot now; this tells it apart from a player. */
const isAnimal = (entity: { flags: number }): boolean => (entity.flags & SnapshotFlag.Animal) !== 0;

describe('the game server Worker', () => {
  it('answers a health check', async () => {
    const response = await SELF.fetch('https://game.test/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, service: 'game-server' });
  });

  it('turns away a plain request to a world', async () => {
    const response = await SELF.fetch(`https://game.test/worlds/${nextWorldId()}/ws`);
    expect(response.status).toBe(426);
  });
});

describe('joining a world', () => {
  it('welcomes a player and tells them the world seed', async () => {
    const client = await TestClient.connect(nextWorldId());
    await waitFor('a welcome', () => client.received.length > 0);

    const welcome = client.welcome();
    expect(welcome.netId).toBeGreaterThan(0);
    expect(welcome.tickHz).toBe(TICK_HZ);
    expect(welcome.snapshotHz).toBe(SNAPSHOT_HZ);
    expect(welcome.seed).toBeGreaterThan(0);
    client.close();
  });

  it('starts sending snapshots as soon as somebody is there', async () => {
    const client = await TestClient.connect(nextWorldId());
    await waitFor('some snapshots', () => client.snapshots().length >= 3);

    const snapshot = client.latestSnapshot();
    expect(snapshot.tick).toBeGreaterThan(0);
    const players = snapshot.entities.filter((entity) => !isAnimal(entity));
    expect(players).toHaveLength(1);
    expect(players[0]?.netId).toBe(client.welcome().netId);
    client.close();
  });

  it('gives two players different network ids', async () => {
    const worldId = nextWorldId();
    const first = await TestClient.connect(worldId);
    const second = await TestClient.connect(worldId);
    await waitFor('both welcomes', () => first.received.length > 0 && second.received.length > 0);

    expect(first.welcome().netId).not.toBe(second.welcome().netId);
    first.close();
    second.close();
  });
});

describe('two tabs in one world', () => {
  it('shows each player the other one moving', async () => {
    const worldId = nextWorldId();
    const walker = await TestClient.connect(worldId);
    const watcher = await TestClient.connect(worldId);
    await waitFor('both welcomes', () => walker.received.length > 0 && watcher.received.length > 0);

    const walkerId = walker.welcome().netId;
    await waitFor('a first snapshot', () => watcher.positionOf(walkerId) !== undefined);
    const before = watcher.positionOf(walkerId);
    expect(before).toBeDefined();

    // Hold W for about a second, the way a browser would.
    for (let i = 0; i < 5; i++) {
      walker.walk(0, 1, 0, 8);
      await sleep(150);
    }

    await waitFor(
      'the watcher to see the walker move',
      () => {
        const now = watcher.positionOf(walkerId);
        return now !== undefined && before !== undefined && Math.abs(now.z - before.z) > 1;
      },
      6000,
    );

    const after = watcher.positionOf(walkerId);
    if (after === undefined || before === undefined) throw new Error('lost the walker');
    // Walking away from the camera means walking down -Z.
    expect(after.z).toBeLessThan(before.z - 1);

    // And the walker sees themselves in the same place the watcher does.
    const walkerSeesSelf = walker.positionOf(walkerId);
    expect(walkerSeesSelf?.z).toBeCloseTo(after.z, 1);

    walker.close();
    watcher.close();
  });

  it('tells the other player when somebody leaves', async () => {
    const worldId = nextWorldId();
    const stayer = await TestClient.connect(worldId);
    const leaver = await TestClient.connect(worldId);
    await waitFor('both welcomes', () => stayer.received.length > 0 && leaver.received.length > 0);
    const leaverId = leaver.welcome().netId;

    leaver.close();

    await waitFor('a goodbye', () =>
      stayer.received.some((entry) => entry.type === 'playerLeft' && entry.netId === leaverId),
    );
    await waitFor(
      'the leaver to disappear from snapshots',
      () => stayer.positionOf(leaverId) === undefined,
    );
    stayer.close();
  });
});

describe('the server deciding', () => {
  it('acknowledges the inputs it has simulated', async () => {
    const client = await TestClient.connect(nextWorldId());
    await waitFor('a welcome', () => client.received.length > 0);

    client.walk(0, 1, 0, 6);
    await waitFor('an acknowledgement', () => client.latestSnapshot().ackSeq >= 6, 5000);
    expect(client.latestSnapshot().ackSeq).toBeGreaterThanOrEqual(6);
    client.close();
  });

  it('will not let a client walk through a tree', async () => {
    const client = await TestClient.connect(nextWorldId());
    await waitFor('a welcome', () => client.received.length > 0);
    const netId = client.welcome().netId;

    // Twelve seconds of walking flat out at the tree line.
    for (let i = 0; i < 24; i++) {
      client.walk(0, 1, 0, 16);
      await sleep(120);
    }

    const position = client.positionOf(netId);
    if (position === undefined) throw new Error('lost the player');
    // The clearing is 64 m across with a wall of trees around it.
    expect(Math.abs(position.z)).toBeLessThan(45);
    client.close();
  });

  it('rejects a malformed message instead of falling over', async () => {
    const client = await TestClient.connect(nextWorldId());
    await waitFor('a welcome', () => client.received.length > 0);

    client.sendRaw(new Uint8Array([0xff, 0x01, 0x02]).buffer);
    await waitFor('a rejection', () => client.received.some((entry) => entry.type === 'rejected'));

    // The connection carries on working afterwards.
    client.walk(0, 1, 0, 4);
    await waitFor('more snapshots', () => client.latestSnapshot().ackSeq >= 4, 5000);
    client.close();
  });

  it('answers a ping', async () => {
    const client = await TestClient.connect(nextWorldId());
    await waitFor('a welcome', () => client.received.length > 0);

    client.ping(123456);
    await waitFor('a pong', () => client.received.some((entry) => entry.type === 'pong'));
    const pong = client.received.find((entry) => entry.type === 'pong');
    expect(pong?.type === 'pong' && pong.clientTimeMs).toBe(123456);
    client.close();
  });
});

describe('remembering where a player was', () => {
  it('puts a returning player back where they left off', async () => {
    const worldId = nextWorldId();
    const playerKey = 'testplayerkey01';

    const first = await TestClient.connect(worldId, playerKey);
    await waitFor('a welcome', () => first.received.length > 0);
    const firstId = first.welcome().netId;

    for (let i = 0; i < 4; i++) {
      first.walk(1, 1, 0, 8);
      await sleep(150);
    }
    await waitFor(
      'to have moved',
      () => {
        const here = first.positionOf(firstId);
        return here !== undefined && Math.hypot(here.x, here.z - 6) > 2;
      },
      6000,
    );

    // A snapshot showing movement can still have more walking inputs queued.
    // Compare the position after braking, not one sampled mid-walk.
    await first.stoppedMoving();
    const before = first.positionOf(firstId);
    if (before === undefined) throw new Error('lost the player');
    first.close();
    await sleep(200);

    const second = await TestClient.connect(worldId, playerKey);
    await waitFor('a snapshot after coming back', () => second.snapshots().length > 0, 5000);
    const after = second.positionOf(second.welcome().netId);
    if (after === undefined) throw new Error('lost the player on return');

    expect(after.x).toBeCloseTo(before.x, 1);
    expect(after.z).toBeCloseTo(before.z, 1);
    second.close();
  });
});

describe('one of you per world', () => {
  /** Walk a little way from the spawn, and say where it got to. */
  async function wanderOff(client: TestClient): Promise<{ x: number; z: number }> {
    const netId = client.welcome().netId;
    for (let i = 0; i < 4; i++) {
      client.walk(1, 1, 0, 8);
      await sleep(150);
    }
    await waitFor(
      'to have moved',
      () => {
        const here = client.positionOf(netId);
        return here !== undefined && Math.hypot(here.x, here.z - 6) > 2;
      },
      6000,
    );
    await client.stoppedMoving();
    const here = client.positionOf(netId);
    if (here === undefined) throw new Error('lost the player');
    return here;
  }

  it('carries on in the same body when the same player joins again, leaving no copy behind', async () => {
    const worldId = nextWorldId();
    const playerKey = 'back-again-player';
    const first = await TestClient.connect(worldId, playerKey);
    await waitFor('a welcome', () => first.received.length > 0);
    const before = await wanderOff(first);

    // The first connection never says goodbye: as far as the server knows
    // it is still here, the way a dropped one looks until it times out.
    const again = await TestClient.connect(worldId, playerKey);
    await waitFor('a welcome back', () => again.received.some((entry) => entry.type === 'welcome'));
    expect(again.welcome().netId).toBe(first.welcome().netId);

    await waitFor('the first connection to be let go', () => first.closedWith !== null);
    expect(first.closedWith).toBe(CLOSE_PLAYING_ELSEWHERE);

    // Right where it stood - not back at the last save - and only the once.
    await waitFor('some snapshots', () => again.snapshots().length >= 3);
    const players = again.latestSnapshot().entities.filter((entity) => !isAnimal(entity));
    expect(players).toHaveLength(1);
    const here = again.positionOf(again.welcome().netId);
    expect(here?.x).toBeCloseTo(before.x, 1);
    expect(here?.z).toBeCloseTo(before.z, 1);
    again.close();
  });

  it('keeps the player when the old connection closes after the new one took over', async () => {
    const worldId = nextWorldId();
    const playerKey = 'two-tabs-player';
    const first = await TestClient.connect(worldId, playerKey);
    await waitFor('a welcome', () => first.received.length > 0);
    const again = await TestClient.connect(worldId, playerKey);
    await waitFor('a welcome back', () => again.received.some((entry) => entry.type === 'welcome'));
    await waitFor('the first connection to be let go', () => first.closedWith !== null);
    first.close();
    await sleep(300);

    const netId = again.welcome().netId;
    expect(again.received.some((entry) => entry.type === 'playerLeft')).toBe(false);
    const snapshotsBefore = again.snapshots().length;
    await waitFor('more snapshots', () => again.snapshots().length > snapshotsBefore + 2);
    expect(again.positionOf(netId)).toBeDefined();
    again.close();
  });

  it('listens to the new connection from its very first input', async () => {
    const worldId = nextWorldId();
    const playerKey = 'counts-from-one';
    const first = await TestClient.connect(worldId, playerKey);
    await waitFor('a welcome', () => first.received.length > 0);
    const before = await wanderOff(first);

    // A reloaded page counts its inputs from one again, well below what
    // the old connection had got up to.
    const again = await TestClient.connect(worldId, playerKey);
    await waitFor('a welcome back', () => again.received.some((entry) => entry.type === 'welcome'));
    const netId = again.welcome().netId;
    again.walk(-1, -1, 0, 8);
    await waitFor(
      'to walk back',
      () => {
        const here = again.positionOf(netId);
        return here !== undefined && Math.hypot(here.x - before.x, here.z - before.z) > 1;
      },
      6000,
    );
    again.close();
  });
});

describe('the map filling in as you explore', () => {
  it('sends a new player a blank map, then fills in around them', async () => {
    const client = await TestClient.connect(nextWorldId(), 'mapperkey0001');
    await waitFor('the opening map', () => client.countOfMessages('explored') > 0);
    expect(client.openingExplored().every((byte) => byte === 0)).toBe(true);

    await waitFor('the map to fill in around the spawn', () => {
      const cells = client.explored();
      return cells !== undefined && isExploredAt(cells, SPAWN_POSITION.x, SPAWN_POSITION.z);
    });
    client.close();
  });

  it('remembers what a returning player had seen', async () => {
    const worldId = nextWorldId();
    const playerKey = 'mapperkey0002';

    const first = await TestClient.connect(worldId, playerKey);
    await waitFor('the map to fill in', () => {
      const cells = first.explored();
      return cells !== undefined && isExploredAt(cells, SPAWN_POSITION.x, SPAWN_POSITION.z);
    });
    first.close();
    await sleep(200);

    const second = await TestClient.connect(worldId, playerKey);
    await waitFor('the opening map', () => second.countOfMessages('explored') > 0);
    expect(isExploredAt(second.openingExplored(), SPAWN_POSITION.x, SPAWN_POSITION.z)).toBe(true);
    second.close();
  });
});

describe('introducing yourself', () => {
  it('starts everybody off with an empty roster to introduce themselves into', async () => {
    const client = await TestClient.connect(nextWorldId());
    await waitFor('the opening roster', () => client.countOfMessages('roster') > 0);
    expect(client.openingRoster()).toEqual([]);
    client.close();
  });

  it('adds a player to their own roster once they say hello', async () => {
    const client = await TestClient.connect(nextWorldId());
    await waitFor('a welcome', () => client.received.length > 0);
    const netId = client.welcome().netId;

    client.hello('Acorn', 'knight', 'moss');
    await waitFor('the roster to include them', () => client.roster().length > 0);

    expect(client.roster()).toEqual([{ netId, name: 'Acorn', character: 'knight', color: 'moss' }]);
    client.close();
  });

  it('tells a second player who is already here, and hears back who they are too', async () => {
    const worldId = nextWorldId();
    const first = await TestClient.connect(worldId);
    await waitFor('a welcome', () => first.received.length > 0);
    first.hello('Acorn', 'knight', 'amber');
    await waitFor('their own roster entry', () => first.roster().length > 0);

    const second = await TestClient.connect(worldId);
    await waitFor('the opening roster', () => second.countOfMessages('roster') > 0);
    expect(second.openingRoster()).toEqual([
      { netId: first.welcome().netId, name: 'Acorn', character: 'knight', color: 'amber' },
    ]);

    second.hello('Ash', 'knight', 'teal');
    await waitFor('the first player to hear about the second', () => first.roster().length >= 2);
    expect(first.roster()).toEqual(
      expect.arrayContaining([
        { netId: first.welcome().netId, name: 'Acorn', character: 'knight', color: 'amber' },
        { netId: second.welcome().netId, name: 'Ash', character: 'knight', color: 'teal' },
      ]),
    );
    first.close();
    second.close();
  });

  it('honors any character the client asks for, now that all six are unlocked', async () => {
    const client = await TestClient.connect(nextWorldId());
    await waitFor('a welcome', () => client.received.length > 0);

    // Mage used to be the example of a locked character this same test held
    // players to Knight for (see decision 0044) - every character in
    // packages/shared/src/data/characters.ts is available today, so there is
    // no real id left to test the "not available yet" side of that gate
    // with. The gate itself (handleHello's `.available ? requested :
    // DEFAULT_CHARACTER` ternary) stays in the code, ready for whenever a
    // future seventh character ships locked the same way these five once
    // were.
    client.hello('Merlin', 'mage', 'plum');
    await waitFor('the roster to include them', () => client.roster().length > 0);
    expect(client.roster()[0]?.character).toBe('mage');
    client.close();
  });

  it('says nothing rather than accept a name that is too short', async () => {
    const client = await TestClient.connect(nextWorldId());
    await waitFor('a welcome', () => client.received.length > 0);

    client.hello('A', 'knight', 'amber');
    await sleep(200);

    expect(client.roster()).toEqual([]);
    client.close();
  });

  it('remembers a name and tint across logging out and coming back', async () => {
    const worldId = nextWorldId();
    const playerKey = 'remembers-who-they-are';

    const first = await TestClient.connect(worldId, playerKey);
    await waitFor('a welcome', () => first.received.length > 0);
    first.hello('Acorn', 'knight', 'clay');
    await waitFor('the roster to include them', () => first.roster().length > 0);
    first.close();
    await sleep(200);

    const second = await TestClient.connect(worldId, playerKey);
    await waitFor('the opening roster', () => second.countOfMessages('roster') > 0);
    expect(second.openingRoster()).toEqual([
      { netId: second.welcome().netId, name: 'Acorn', character: 'knight', color: 'clay' },
    ]);
    second.close();
  });
});

describe('the tick loop', () => {
  it('reports that it is running while somebody is connected', async () => {
    const worldId = nextWorldId();
    const client = await TestClient.connect(worldId);
    await waitFor('the world to start ticking', () => client.snapshots().length > 0);

    const response = await SELF.fetch(`https://game.test/worlds/${worldId}/status`);
    const status = (await response.json()) as {
      players: number;
      running: boolean;
      tick: number;
      slowTicks: number;
    };
    expect(status.players).toBe(1);
    expect(status.running).toBe(true);
    expect(status.tick).toBeGreaterThan(0);
    client.close();
  });

  it('keeps up with the clock', async () => {
    const client = await TestClient.connect(nextWorldId());
    await waitFor('a first snapshot', () => client.snapshots().length > 0);
    const startTick = client.latestSnapshot().tick;

    await sleep(1000);
    const endTick = client.latestSnapshot().tick;

    // A second should advance the world by about twenty ticks. Allow plenty of
    // slack for a busy test machine, but catch a loop that has stopped or halved.
    expect(endTick - startTick).toBeGreaterThan(TICK_HZ * 0.5);
    client.close();
  });

  it('stops ticking once the last player leaves', async () => {
    const worldId = nextWorldId();
    const client = await TestClient.connect(worldId);
    await waitFor('a welcome', () => client.received.length > 0);

    client.close();
    await sleep(400);

    const response = await SELF.fetch(`https://game.test/worlds/${worldId}/status`);
    const status = (await response.json()) as { players: number; running: boolean };
    expect(status.players).toBe(0);
    // Timers prevent hibernation, so the loop has to stop when the world empties.
    expect(status.running).toBe(false);
  });
});

/**
 * Walk a client over to the stump the axe is standing in.
 *
 * The heading is worked out again on every step, so bumping into a rock on the
 * way just means the player steers round it rather than losing the plot.
 */
/** Walk a client until it is within reach of something lying on the ground. */
async function walkWithinReach(
  client: TestClient,
  spot: { readonly x: number; readonly z: number },
): Promise<void> {
  await waitFor('a welcome', () => client.received.length > 0);
  const netId = client.welcome().netId;
  await waitFor('a first snapshot', () => client.positionOf(netId) !== undefined);

  let previous: { x: number; z: number } | undefined;
  for (let step = 0; step < 90; step++) {
    const here = client.positionOf(netId);
    if (here === undefined) break;
    const gap = Math.hypot(here.x - spot.x, here.z - spot.z);
    if (gap < PICKUP_REACH - 0.4) return;
    // Walking forward is walking down -Z, so this is the heading that lines up.
    const yaw = Math.atan2(-(spot.x - here.x), -(spot.z - here.z));
    // Pressed flat against something - the pond, say, now that a patch can
    // be anywhere - so step sideways around it before heading on.
    const stuck =
      previous !== undefined && Math.hypot(here.x - previous.x, here.z - previous.z) < 0.15;
    client.walk(stuck ? 1 : 0, stuck ? 0 : 1, yaw, stuck ? 8 : 4);
    previous = here;
    await sleep(stuck ? 220 : 110);
  }
  const ended = client.positionOf(netId);
  throw new Error(`Never reached ${spot.x}, ${spot.z}; stopped at ${ended?.x}, ${ended?.z}`);
}

/**
 * Hold the interact button at the nearest patch of this with any left, until
 * the pack has this many - moving on to the next whenever one is picked
 * clean, and waiting for one to grow back if every one of them is.
 */
async function gatherFromPatches(client: TestClient, item: ItemId, count: number): Promise<void> {
  const enough = (): boolean =>
    (client.inventory().find((entry) => entry.item === item)?.count ?? 0) >= count;
  await waitFor('the patches', () => client.countOfMessages('gatherPatches') > 0);
  for (let step = 0; step < 120 && !enough(); step++) {
    const here = client.positionOf(client.welcome().netId);
    const away = (spot: { x: number; z: number }): number =>
      here === undefined ? Infinity : Math.hypot(here.x - spot.x, here.z - spot.z);
    const patch = client
      .gatherPatches()
      .filter((candidate) => candidate.item === item && candidate.remaining > 0)
      .sort((a, b) => away(a) - away(b))[0];
    if (patch === undefined) {
      await sleep(300);
      continue;
    }
    if (away(patch) > PICKUP_REACH - 0.4) await walkWithinReach(client, patch);
    client.walk(0, 0, 0, 4, PlayerButton.Interact);
    await sleep(120);
  }
  if (!enough()) throw new Error(`never gathered ${count} of ${item}`);
}

async function walkToTheAxe(client: TestClient): Promise<void> {
  await walkWithinReach(client, AXE_STUMP);
}

/**
 * Walk a fresh connection to the bag and pick it up.
 *
 * Its four extra slots mean a test that goes on to pick up, gather, chop,
 * fish, hunt or eat something never has to think about the six a player
 * starts with running out, so almost every one starts here first.
 */
async function findTheBag(client: TestClient): Promise<void> {
  await walkWithinReach(client, BAG_SPOT);
  client.walk(0, 0, 0, 3, PlayerButton.Interact);
  await waitFor('the bag', () => client.inventory().some((entry) => entry.item === 'bag'));
}

describe('finding the bag', () => {
  it('tells a new player they have nothing and that nothing has been taken', async () => {
    const client = await TestClient.connect(nextWorldId(), 'fresh-player');
    await waitFor('the opening messages', () => client.countOfMessages('inventory') > 0);

    expect(client.inventory()).toEqual([]);
    expect(client.takenPickups()).toEqual([]);
    client.close();
  });

  it('shows everybody the player bending to pick it up', async () => {
    const worldId = nextWorldId();
    const finder = await TestClient.connect(worldId, 'bag-bender');
    const watcher = await TestClient.connect(worldId, 'bag-watcher');
    await findTheBag(finder);

    const expected = { netId: finder.welcome().netId, gesture: Gesture.PickUp, item: 'bag' };
    await waitFor('the gesture', () => watcher.gestures().length > 0);
    expect(watcher.gestures()).toEqual([expected]);
    expect(finder.gestures()).toEqual([expected]);
    finder.close();
    watcher.close();
  });

  it('hands over the bag when a player reaches for it', async () => {
    const client = await TestClient.connect(nextWorldId(), 'bag-finder');
    await findTheBag(client);

    expect(client.inventory()).toEqual([{ item: 'bag', count: 1 }]);
    expect(client.takenPickups()).toEqual([BAG_PICKUP_ID]);
    client.close();
  });

  it('is not needed to pick something up - six slots come before any bag', async () => {
    const client = await TestClient.connect(nextWorldId(), 'no-bag-yet');
    await walkToTheAxe(client);
    client.walk(0, 0, 0, 3, PlayerButton.Interact);
    await waitFor('the axe', () => client.inventory().some((entry) => entry.item === 'axe'));

    expect(client.inventory()).toEqual([{ item: 'axe', count: 1 }]);
    client.close();
  });
});

describe('finding the axe', () => {
  it('hands over the axe when a player reaches for it', async () => {
    const client = await TestClient.connect(nextWorldId(), 'axe-finder');
    await findTheBag(client);
    await walkToTheAxe(client);

    client.walk(0, 0, 0, 3, PlayerButton.Interact);
    await waitFor('the axe', () => client.inventory().some((entry) => entry.item === 'axe'));

    expect(client.inventory()).toEqual([
      { item: 'axe', count: 1 },
      { item: 'bag', count: 1 },
    ]);
    expect([...client.takenPickups()].sort((a, b) => a - b)).toEqual(
      [AXE_PICKUP_ID, BAG_PICKUP_ID].sort((a, b) => a - b),
    );
    client.close();
  });

  it('still has the axe after logging out and coming back', async () => {
    const worldId = nextWorldId();
    const first = await TestClient.connect(worldId, 'returning-player');
    await findTheBag(first);
    await walkToTheAxe(first);
    first.walk(0, 0, 0, 3, PlayerButton.Interact);
    await waitFor('the axe', () => first.inventory().some((entry) => entry.item === 'axe'));
    first.close();
    await sleep(200);

    const second = await TestClient.connect(worldId, 'returning-player');
    await waitFor('the opening messages', () => second.countOfMessages('inventory') > 0);

    expect(second.inventory()).toEqual([
      { item: 'axe', count: 1 },
      { item: 'bag', count: 1 },
    ]);
    // And it is not sitting in the stump waiting to be found all over again.
    expect([...second.takenPickups()].sort((a, b) => a - b)).toEqual(
      [AXE_PICKUP_ID, BAG_PICKUP_ID].sort((a, b) => a - b),
    );
    second.close();
  });

  it('tells a second player the axe is already gone', async () => {
    const worldId = nextWorldId();
    const finder = await TestClient.connect(worldId, 'the-finder');
    await findTheBag(finder);
    await walkToTheAxe(finder);
    finder.walk(0, 0, 0, 3, PlayerButton.Interact);
    await waitFor('the axe', () => finder.inventory().some((entry) => entry.item === 'axe'));

    const latecomer = await TestClient.connect(worldId, 'the-latecomer');
    await waitFor('the opening messages', () => latecomer.countOfMessages('inventory') > 0);

    expect(latecomer.inventory()).toEqual([]);
    expect(latecomer.takenPickups()).toContain(AXE_PICKUP_ID);
    finder.close();
    latecomer.close();
  });

  it('does not hand out an axe to somebody standing in the middle of the clearing', async () => {
    const client = await TestClient.connect(nextWorldId(), 'nowhere-near');
    await findTheBag(client);

    for (let i = 0; i < 6; i++) {
      client.walk(0, 0, 0, 4, PlayerButton.Interact);
      await sleep(80);
    }

    expect(client.inventory()).toEqual([{ item: 'bag', count: 1 }]);
    expect(client.takenPickups()).toEqual([BAG_PICKUP_ID]);
    client.close();
  });
});

describe('equipping what you are carrying', () => {
  it('starts a fresh player off with nothing equipped', async () => {
    const client = await TestClient.connect(nextWorldId());
    await waitFor('the opening equipped list', () => client.countOfMessages('equipped') > 0);
    const netId = client.welcome().netId;

    expect(client.openingEquipped()).toEqual([{ netId, item: null }]);
    client.close();
  });

  it('equips the axe once asked, and tells a nearby player about it', async () => {
    const worldId = nextWorldId();
    const first = await TestClient.connect(worldId, 'equip-first');
    await findTheBag(first);
    await walkToTheAxe(first);
    first.walk(0, 0, 0, 3, PlayerButton.Interact);
    await waitFor('the axe', () => first.inventory().some((entry) => entry.item === 'axe'));
    const netId = first.welcome().netId;

    const second = await TestClient.connect(worldId, 'equip-witness');
    await waitFor('a welcome', () => second.received.length > 0);

    first.useItem('axe');
    await waitFor(
      'the second player to see the axe equipped',
      () => second.equipped().find((entry) => entry.netId === netId)?.item === 'axe',
    );

    expect(first.equipped()).toEqual(expect.arrayContaining([{ netId, item: 'axe' }]));
    first.close();
    second.close();
  });

  it('refuses to equip an item that was never picked up', async () => {
    const client = await TestClient.connect(nextWorldId(), 'never-found-a-rod');
    await findTheBag(client);
    const netId = client.welcome().netId;

    client.useItem('rod');
    await sleep(150);

    expect(client.equipped().find((entry) => entry.netId === netId)?.item ?? null).toBeNull();
    client.close();
  });

  it('keeps the equipped choice across logging out and coming back', async () => {
    const worldId = nextWorldId();
    const playerKey = 'equip-and-return';
    const first = await TestClient.connect(worldId, playerKey);
    await findTheBag(first);
    await walkToTheAxe(first);
    first.walk(0, 0, 0, 3, PlayerButton.Interact);
    await waitFor('the axe', () => first.inventory().some((entry) => entry.item === 'axe'));
    first.useItem('axe');
    await waitFor('the axe to be equipped', () =>
      first.equipped().some((entry) => entry.item === 'axe'),
    );
    first.close();
    await sleep(200);

    const second = await TestClient.connect(worldId, playerKey);
    await waitFor('the opening equipped list', () => second.countOfMessages('equipped') > 0);
    const netId = second.welcome().netId;

    expect(second.openingEquipped()).toEqual(expect.arrayContaining([{ netId, item: 'axe' }]));
    second.close();
  });
});

describe('a world that empties and fills again', () => {
  it('does not leave a ghost behind when the last player leaves', async () => {
    const worldId = nextWorldId();
    const first = await TestClient.connect(worldId, 'the-first-visitor');
    await waitFor('a welcome', () => first.received.length > 0);
    await waitFor('a snapshot', () => first.snapshots().length > 0);
    first.close();
    // Long enough for the world to save itself and let go of its ECS world.
    await sleep(300);

    const second = await TestClient.connect(worldId, 'the-second-visitor');
    await waitFor('some snapshots', () => second.snapshots().length >= 3);

    // Exactly one player in the world: the one who is actually here.
    const players = second.latestSnapshot().entities.filter((entity) => !isAnimal(entity));
    expect(players).toHaveLength(1);
    expect(players[0]?.netId).toBe(second.welcome().netId);
    second.close();
  });

  it('remembers the tick count and what was taken across the gap', async () => {
    const worldId = nextWorldId();
    const first = await TestClient.connect(worldId, 'the-finder');
    await findTheBag(first);
    await walkToTheAxe(first);
    first.walk(0, 0, 0, 3, PlayerButton.Interact);
    await waitFor('the axe', () => first.inventory().some((entry) => entry.item === 'axe'));
    const tickBefore = first.latestSnapshot().tick;
    first.close();
    await sleep(300);

    const second = await TestClient.connect(worldId, 'somebody-else');
    await waitFor('some snapshots', () => second.snapshots().length >= 2);

    expect([...second.takenPickups()].sort((a, b) => a - b)).toEqual(
      [AXE_PICKUP_ID, BAG_PICKUP_ID].sort((a, b) => a - b),
    );
    // The world picks up where it left off rather than starting over.
    expect(second.latestSnapshot().tick).toBeGreaterThanOrEqual(tickBefore);
    second.close();
  });
});

describe('gathering and crafting', () => {
  const stickPatch = STICK_PATCHES[0];
  if (stickPatch === undefined) throw new Error('no stick patch to test against');

  async function gatherSticks(client: TestClient, count: number): Promise<void> {
    await gatherFromPatches(client, 'stick', count);
  }

  function sticksForAnAxe(): number {
    const recipe = recipeFor('axe');
    if (recipe === null) throw new Error('no recipe for an axe');
    return recipe.costs.find((cost) => cost.item === 'stick')?.amount ?? 0;
  }

  it('gathers a stick from a patch of fallen branches, no tool needed', async () => {
    const client = await TestClient.connect(nextWorldId(), 'stick-gatherer');
    await findTheBag(client);
    await walkWithinReach(client, stickPatch);

    client.walk(0, 0, 0, 3, PlayerButton.Interact);
    await waitFor('a stick', () => client.inventory().some((entry) => entry.item === 'stick'));

    expect(client.inventory()).toEqual([
      { item: 'stick', count: 1 },
      { item: 'bag', count: 1 },
    ]);
    client.close();
  });

  it('gathers with no bag at all, into one of the six slots everybody has', async () => {
    const client = await TestClient.connect(nextWorldId(), 'bagless-gatherer');
    await walkWithinReach(client, stickPatch);

    client.walk(0, 0, 0, 3, PlayerButton.Interact);
    await waitFor('a stick', () => client.inventory().some((entry) => entry.item === 'stick'));

    expect(client.inventory()).toEqual([{ item: 'stick', count: 1 }]);
    client.close();
  });

  it('makes an axe once there are enough sticks, without ever finding one', async () => {
    const client = await TestClient.connect(nextWorldId(), 'stick-crafter');
    await findTheBag(client);
    await walkWithinReach(client, stickPatch);
    await gatherSticks(client, sticksForAnAxe());

    client.craft('axe');
    await waitFor('the axe', () => client.inventory().some((entry) => entry.item === 'axe'));

    expect(client.inventory()).toEqual([
      { item: 'axe', count: 1 },
      { item: 'bag', count: 1 },
    ]);
    expect(client.crafted()).toEqual([{ netId: client.welcome().netId, item: 'axe' }]);
    client.close();
  });

  it('does nothing without enough materials, and spends nothing either', async () => {
    const client = await TestClient.connect(nextWorldId(), 'short-on-sticks');
    await findTheBag(client);
    await walkWithinReach(client, stickPatch);
    await gatherSticks(client, 1);

    client.craft('axe');
    await sleep(150);

    expect(client.inventory()).toEqual([
      { item: 'stick', count: 1 },
      { item: 'bag', count: 1 },
    ]);
    expect(client.crafted()).toEqual([]);
    client.close();
  });

  it('still has the crafted axe after logging out and coming back', async () => {
    const worldId = nextWorldId();
    const first = await TestClient.connect(worldId, 'returning-crafter');
    await findTheBag(first);
    await walkWithinReach(first, stickPatch);
    await gatherSticks(first, sticksForAnAxe());
    first.craft('axe');
    await waitFor('the axe', () => first.inventory().some((entry) => entry.item === 'axe'));
    first.close();
    await sleep(50);

    const second = await TestClient.connect(worldId, 'returning-crafter');
    await waitFor('the opening pack', () => second.countOfMessages('inventory') > 0);
    expect(second.inventory()).toEqual([
      { item: 'axe', count: 1 },
      { item: 'bag', count: 1 },
    ]);
    second.close();
  });
});

describe('patches running out', () => {
  const stickPatch = STICK_PATCHES[0];
  if (stickPatch === undefined) throw new Error('no stick patch to test against');

  it('tells a new player where every patch is and how many each holds', async () => {
    const worldId = nextWorldId();
    const client = await TestClient.connect(worldId, 'patch-looker');
    await waitFor('the patches', () => client.countOfMessages('gatherPatches') > 0);

    const patches = client.gatherPatches();
    await runInDurableObject(env.WORLD.get(env.WORLD.idFromName(worldId)), (instance) => {
      const expectedIds = (instance as unknown as { simulation: WorldSimulation }).simulation
          .gatherPatchesList()
          .map((patch) => patch.id),
        actualIds = patches.map((patch) => patch.id);
      expect(actualIds.sort()).toEqual(expectedIds.sort());
    });
    expect(patches.filter((patch) => patch.item === 'stick')).toHaveLength(STICK_PATCHES.length);
    expect(patches.filter((patch) => patch.item === 'flower')).toHaveLength(FLOWER_PATCHES.length);
    for (const patch of patches) {
      expect(patch.remaining).toBeGreaterThanOrEqual(GATHER_PATCH_MIN_COUNT);
      expect(patch.remaining).toBeLessThanOrEqual(GATHER_PATCH_MAX_COUNT);
    }
    client.close();
  });

  it('counts down for everybody as one player gathers, and stays picked clean', async () => {
    const worldId = nextWorldId();
    const gatherer = await TestClient.connect(worldId, 'patch-picker');
    const watcher = await TestClient.connect(worldId, 'patch-watcher');
    await waitFor('the patches', () => gatherer.countOfMessages('gatherPatches') > 0);
    const held = gatherer.gatherPatches().find((patch) => patch.id === 1)?.remaining ?? 0;

    // Every word the watcher has had about this patch, oldest first: it may
    // already have grown back somewhere else by the time anybody looks.
    const counts = (): number[] =>
      watcher.received.flatMap((message) =>
        message.type === 'gatherPatches'
          ? message.patches.filter((patch) => patch.id === 1).map((patch) => patch.remaining)
          : [],
      );

    await walkWithinReach(gatherer, stickPatch);
    for (let step = 0; step < 60 && !counts().includes(0); step++) {
      gatherer.walk(0, 0, 0, 4, PlayerButton.Interact);
      await sleep(120);
    }

    await waitFor('the watcher to hear it is picked clean', () => counts().includes(0));
    // One at a time, all the way down - the watcher saw every one go.
    const countdown = counts();
    expect(countdown.slice(0, countdown.indexOf(0) + 1)).toEqual(
      Array.from({ length: held + 1 }, (_, taken) => held - taken),
    );
    expect(gatherer.inventory()).toEqual([{ item: 'stick', count: held }]);
    const collections = watcher.received.flatMap((message) =>
      message.type === 'collected' ? message.events : [],
    );
    expect(collections).toHaveLength(held);
    expect(collections.map((event) => event.depleted)).toEqual(
      Array.from({ length: held }, (_, index) => index === held - 1),
    );
    expect(collections.every((event) => event.item === 'stick' && event.count === 1)).toBe(true);

    gatherer.close();
    watcher.close();
  });
});

describe('dropping and destroying', () => {
  it('sends inventory-full feedback only to the blocked collector and leaves the log available', async () => {
    const worldId = nextWorldId();
    const first = await TestClient.connect(worldId, 'full-pack');
    const watcher = await TestClient.connect(worldId, 'watcher');
    const netId = first.welcome().netId;
    const stub = env.WORLD.get(env.WORLD.idFromName(worldId));
    await runInDurableObject(stub, (instance) => {
      const sim = (instance as unknown as { simulation: WorldSimulation }).simulation;
      sim.removePlayer(netId);
      sim.addPlayer(netId, {
        netId,
        x: -10,
        y: 0,
        z: 4,
        facingYaw: 0,
        hunger: HUNGER_MAX,
        items: [{ item: 'log', count: 60 }],
      });
      sim.restoreDroppedPiles(
        [{ id: 1, item: 'log', count: 1, x: -10, z: 4, droppedAtMs: Date.now() }],
        Date.now(),
      );
    });
    first.walk(0, 0, 0, 4, PlayerButton.Interact);
    await waitFor('the capacity notice', () =>
      first.received.some((message) => message.type === 'pickupRefused'),
    );
    expect(first.received.filter((message) => message.type === 'pickupRefused')).toEqual([
      { type: 'pickupRefused', item: 'log', reason: 'full' },
    ]);
    expect(watcher.received.some((message) => message.type === 'pickupRefused')).toBe(false);
    first.walk(0, 0, 0, 12, PlayerButton.Interact);
    await first.caughtUp();
    expect(first.received.filter((message) => message.type === 'pickupRefused')).toHaveLength(1);
    first.discard('log', 10, true);
    await waitFor('room in the pack', () =>
      first.inventory().some((entry) => entry.item === 'log' && entry.count === 50),
    );
    first.walk(0, 0, 0, 1, PlayerButton.Interact);
    await waitFor('the saved log', () =>
      first.inventory().some((entry) => entry.item === 'log' && entry.count === 51),
    );
    first.close();
    watcher.close();
  });

  async function withSticks(client: TestClient): Promise<number> {
    await walkWithinReach(client, STICK_PATCHES[0] ?? { x: 0, z: 0 });
    client.walk(0, 0, 0, 3, PlayerButton.Interact);
    await waitFor('a stick', () => client.inventory().some((entry) => entry.item === 'stick'));
    // The interact button is still down for a tick or two after the stick
    // lands; dropping before it lets go would see the stick picked straight
    // back up.
    await client.caughtUp();
    return client.inventory().find((entry) => entry.item === 'stick')?.count ?? 0;
  }

  it('drops a stick for everybody to see, and lets somebody else pick it up', async () => {
    const worldId = nextWorldId();
    const dropper = await TestClient.connect(worldId, 'stick-dropper');
    const finder = await TestClient.connect(worldId, 'stick-finder');
    await withSticks(dropper);

    dropper.discard('stick', 1);
    await waitFor('the pile', () => finder.droppedPiles().length > 0);
    const [pile] = finder.droppedPiles();
    expect(pile).toMatchObject({ item: 'stick', count: 1 });
    expect(dropper.discarded()).toEqual([
      { netId: dropper.welcome().netId, item: 'stick', count: 1, destroyed: false },
    ]);
    await waitFor('the pack without it', () =>
      dropper.inventory().every((entry) => entry.item !== 'stick'),
    );

    if (pile === undefined) throw new Error('no pile');
    dropper.close();
    await walkWithinReach(finder, pile);
    finder.walk(0, 0, 0, 3, PlayerButton.Interact);
    await waitFor('the stick', () => finder.inventory().some((entry) => entry.item === 'stick'));
    await waitFor('the pile to be gone', () => finder.droppedPiles().length === 0);
    finder.close();
  });

  it('destroys without leaving anything behind', async () => {
    const client = await TestClient.connect(nextWorldId(), 'stick-destroyer');
    const held = await withSticks(client);

    client.discard('stick', held, true);
    await waitFor('the news', () => client.discarded().length > 0);
    expect(client.discarded()).toEqual([
      { netId: client.welcome().netId, item: 'stick', count: held, destroyed: true },
    ]);
    await waitFor('the pack without it', () => client.inventory().length === 0);
    expect(client.droppedPiles()).toEqual([]);
    client.close();
  });

  it('never lets go of the bag', async () => {
    const client = await TestClient.connect(nextWorldId(), 'bag-keeper');
    await findTheBag(client);

    client.discard('bag', 1);
    client.discard('bag', 1, true);
    await sleep(200);
    expect(client.inventory()).toEqual([{ item: 'bag', count: 1 }]);
    expect(client.discarded()).toEqual([]);
    client.close();
  });

  it('keeps a dropped pile lying there while the world sleeps', async () => {
    const worldId = nextWorldId();
    const first = await TestClient.connect(worldId, 'sleepy-dropper');
    await withSticks(first);
    first.discard('stick', 1);
    await waitFor('the pile', () => first.droppedPiles().length > 0);
    first.close();
    await sleep(100);

    const second = await TestClient.connect(worldId, 'sleepy-dropper');
    await waitFor('the opening piles', () => second.countOfMessages('droppedPiles') > 0);
    expect(second.droppedPiles()).toEqual([expect.objectContaining({ item: 'stick', count: 1 })]);
    second.close();
  });
});

/** Wait for a fallen trunk to break, then gather each loose log with E. */
async function collectFallenLogs(client: TestClient): Promise<void> {
  await waitFor('the fallen logs', () => client.droppedPiles().some((pile) => pile.item === 'log'));
  for (let attempt = 0; attempt < 20; attempt++) {
    const log = client.droppedPiles().find((pile) => pile.item === 'log');
    if (log === undefined) return;
    await walkWithinReach(client, log);
    client.walk(0, 0, 0, 1, PlayerButton.Interact);
    client.walk(0, 0, 0, 1);
    await client.caughtUp();
  }
  throw new Error('fallen logs were not collected');
}

describe('chopping a tree down', () => {
  /** The landmark oak, which happens to stand right beside the axe's stump. */
  function theOak(seed: number) {
    const tree = buildTestClearing(seed).props.find((prop) => prop.kind === 'oak');
    if (tree === undefined) throw new Error('no oak in the clearing');
    return tree;
  }

  /** Face a spot and hold the swing, until the tree is down or we give up. */
  async function chopUntilFelled(
    client: TestClient,
    target: { x: number; z: number },
    treeId: number,
  ): Promise<void> {
    const netId = client.welcome().netId;
    for (let step = 0; step < 60; step++) {
      if (client.felledTrees().includes(treeId)) return;
      const here = client.positionOf(netId);
      if (here === undefined) break;
      const yaw = Math.atan2(-(target.x - here.x), -(target.z - here.z));
      client.walk(0, 0, yaw, 4, PlayerButton.Swing);
      await sleep(120);
    }
    throw new Error('the tree never came down');
  }

  it('refuses to chop for somebody with no axe', async () => {
    const client = await TestClient.connect(nextWorldId(), 'no-axe-here');
    await walkToTheAxe(client);
    // Standing by the stump, the oak is well within reach, but bare hands.
    const oak = theOak(client.welcome().seed);
    for (let i = 0; i < 12; i++) {
      const here = client.positionOf(client.welcome().netId);
      const yaw = here === undefined ? 0 : Math.atan2(-(oak.x - here.x), -(oak.z - here.z));
      client.walk(0, 0, yaw, 4, PlayerButton.Swing);
      await sleep(100);
    }

    expect(client.treeHits()).toEqual([]);
    expect(client.felledTrees()).toEqual([]);
    client.close();
  });

  it('fells the oak, then leaves logs to gather with E', async () => {
    const client = await TestClient.connect(nextWorldId(), 'the-woodcutter');
    await findTheBag(client);
    await walkToTheAxe(client);
    client.walk(0, 0, 0, 3, PlayerButton.Interact);
    await waitFor('the axe', () => client.inventory().some((entry) => entry.item === 'axe'));
    client.useItem('axe');
    await waitFor('the axe to be equipped', () =>
      client.equipped().some((entry) => entry.item === 'axe'),
    );

    const oak = theOak(client.welcome().seed);
    await chopUntilFelled(client, oak, oak.id);

    expect(client.inventory().some((entry) => entry.item === 'log')).toBe(false);
    expect(client.treeStates().find((tree) => tree.treeId === oak.id)?.fall).toBeDefined();
    const swings = choppingRuleFor(PROP_KINDS.oak)?.swingsToFell ?? 0;
    const logs = choppingRuleFor(PROP_KINDS.oak)?.logs ?? 0;

    expect(client.felledTrees()).toEqual([oak.id]);
    // One message per swing, counting down to the one that felled it.
    const hits = client.treeHits().filter((hit) => hit.treeId === oak.id);
    expect(hits).toHaveLength(swings);
    expect(hits.map((hit) => hit.swingsLeft)).toEqual(
      Array.from({ length: swings }, (_, i) => swings - 1 - i),
    );
    // Whose swing it was, so only the chopper's own client plays its axe swinging back.
    expect(hits.every((hit) => hit.netId === client.welcome().netId)).toBe(true);

    await collectFallenLogs(client);
    // E can also gather a nearby shared stick patch while collecting logs.
    // Verify this tree's exact yield without assuming unrelated gathering is absent.
    expect(client.inventory().find((entry) => entry.item === 'log')?.count).toBe(logs);
    expect(client.inventory()).toEqual(
      expect.arrayContaining([
        { item: 'axe', count: 1 },
        { item: 'log', count: logs },
        { item: 'bag', count: 1 },
      ]),
    );
    client.close();
  });

  it('preserves the fall and its loose logs when everybody leaves mid-fall', async () => {
    const worldId = nextWorldId();
    const first = await TestClient.connect(worldId, 'comes-back');
    await findTheBag(first);
    await walkToTheAxe(first);
    first.walk(0, 0, 0, 3, PlayerButton.Interact);
    await waitFor('the axe', () => first.inventory().some((entry) => entry.item === 'axe'));
    first.useItem('axe');
    await waitFor('the axe to be equipped', () =>
      first.equipped().some((entry) => entry.item === 'axe'),
    );

    const oak = theOak(first.welcome().seed);
    await chopUntilFelled(first, oak, oak.id);
    const fall = first.treeStates().find((tree) => tree.treeId === oak.id)?.fall;
    expect(fall).toBeDefined();
    first.close();
    await sleep(300);

    const second = await TestClient.connect(worldId, 'comes-back');
    await waitFor('the opening messages', () => second.countOfMessages('treeStates') > 0);

    // This is the Phase 1 promise: chop a tree, log out, come back, stump still there.
    expect(second.felledTrees()).toEqual([oak.id]);
    expect(second.treeStates().find((tree) => tree.treeId === oak.id)?.fall).toEqual(fall);
    expect(second.inventory().some((entry) => entry.item === 'log')).toBe(false);
    await collectFallenLogs(second);
    expect(second.droppedPiles()).toEqual([]);
    // A nearby loose stick can be collected while walking among the fallen logs.
    expect(second.inventory().filter((entry) => entry.item !== 'stick')).toEqual([
      { item: 'axe', count: 1 },
      { item: 'log', count: choppingRuleFor(PROP_KINDS.oak)?.logs },
      { item: 'bag', count: 1 },
    ]);
    second.close();
  });

  it('shows a second player the tree coming down', async () => {
    const worldId = nextWorldId();
    const chopper = await TestClient.connect(worldId, 'the-chopper');
    const watcher = await TestClient.connect(worldId, 'the-watcher');
    await waitFor(
      'both welcomes',
      () => chopper.received.length > 0 && watcher.received.length > 0,
    );

    await findTheBag(chopper);
    await walkToTheAxe(chopper);
    chopper.walk(0, 0, 0, 3, PlayerButton.Interact);
    await waitFor('the axe', () => chopper.inventory().some((entry) => entry.item === 'axe'));
    chopper.useItem('axe');
    await waitFor('the axe to be equipped', () =>
      chopper.equipped().some((entry) => entry.item === 'axe'),
    );

    const oak = theOak(chopper.welcome().seed);
    await chopUntilFelled(chopper, oak, oak.id);

    await waitFor('the watcher to see it fall', () => watcher.felledTrees().includes(oak.id));
    expect(watcher.treeHits().length).toBeGreaterThan(0);
    // The watcher can tell it was the chopper's swing, not its own - what lets
    // its client leave its own axe at rest instead of swinging along.
    expect(watcher.treeHits().every((hit) => hit.netId === chopper.welcome().netId)).toBe(true);
    // Watching somebody chop does not fill your own pack.
    expect(watcher.inventory()).toEqual([]);
    chopper.close();
    watcher.close();
  });
});

describe('a world played before trees grew back', () => {
  it('adds what its tree table is missing instead of falling over', async () => {
    const worldId = nextWorldId();
    const stub = env.WORLD.get(env.WORLD.idFromName(worldId));

    const oak = buildTestClearing(DEFAULT_WORLD_SEED).props.find((prop) => prop.kind === 'oak');
    if (oak === undefined) throw new Error('no oak in the clearing');

    await runInDurableObject(stub, (instance, state) => {
      const sql = state.storage.sql;
      // The table as the previous release left it: a felled tree, with nothing
      // saying when it fell or how many have stood in that spot.
      sql.exec('DROP TABLE IF EXISTS trees');
      sql.exec(`CREATE TABLE trees (
        tree_id INTEGER PRIMARY KEY,
        swings_taken INTEGER NOT NULL,
        felled INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`);
      sql.exec('INSERT INTO trees VALUES (?, ?, ?, ?)', oak.id, 5, 1, Date.now());

      // What the next wake does, without waiting for this object to be evicted.
      (instance as unknown as { createSchema(): void }).createSchema();

      const columns = sql
        .exec<{ name: string }>('SELECT name FROM pragma_table_info(?)', 'trees')
        .toArray()
        .map((row) => row.name);
      expect(columns).toContain('felled_at_ms');
      expect(columns).toContain('generation');
      expect(columns).toContain('fall_yaw');

      // The old stump is treated as freshly cut rather than as felled in 1970,
      // so it waits its turn instead of coming back the instant anybody joins.
      const row = sql
        .exec<{
          felled_at_ms: number;
          generation: number;
        }>('SELECT felled_at_ms, generation FROM trees WHERE tree_id = ?', oak.id)
        .toArray()[0];
      expect(row?.generation).toBe(0);
      expect(row?.felled_at_ms ?? 0).toBeGreaterThan(0);
    });

    // And the world still opens, with the tree still down.
    const client = await TestClient.connect(worldId, 'came-back-after-the-update');
    await waitFor('the opening word on the trees', () => client.countOfMessages('treeStates') > 0);
    expect(client.felledTrees()).toEqual([oak.id]);
    client.close();
  });
});

describe('trees growing back', () => {
  function theOak(seed: number) {
    const tree = buildTestClearing(seed).props.find((prop) => prop.kind === 'oak');
    if (tree === undefined) throw new Error('no oak in the clearing');
    return tree;
  }

  async function chopUntilFelled(
    client: TestClient,
    target: { x: number; z: number },
    treeId: number,
  ): Promise<void> {
    const netId = client.welcome().netId;
    for (let step = 0; step < 60; step++) {
      if (client.felledTrees().includes(treeId)) return;
      const here = client.positionOf(netId);
      if (here === undefined) break;
      const yaw = Math.atan2(-(target.x - here.x), -(target.z - here.z));
      client.walk(0, 0, yaw, 4, PlayerButton.Swing);
      await sleep(120);
    }
    throw new Error('the tree never came down');
  }

  it('brings the tree back on its own, and says how many times it has', async () => {
    const client = await TestClient.connect(nextWorldId(), 'the-forester');
    await findTheBag(client);
    await walkToTheAxe(client);
    client.walk(0, 0, 0, 3, PlayerButton.Interact);
    await waitFor('the axe', () => client.inventory().some((entry) => entry.item === 'axe'));
    client.useItem('axe');
    await waitFor('the axe to be equipped', () =>
      client.equipped().some((entry) => entry.item === 'axe'),
    );

    const oak = theOak(client.welcome().seed);
    await chopUntilFelled(client, oak, oak.id);
    expect(client.felledTrees()).toEqual([oak.id]);

    // Stand well clear: a tree will not grow through somebody.
    for (let i = 0; i < 12; i++) {
      client.walk(0, 1, Math.PI, 4);
      await sleep(100);
    }

    // The test runtime brings them back in a second or two.
    await waitFor('the oak to come back', () => !client.felledTrees().includes(oak.id), 25_000);

    const grown = client.treeStates().find((tree) => tree.treeId === oak.id);
    expect(grown?.felled).toBe(false);
    expect(grown?.generation).toBe(1);
    client.close();
  });

  it('counts the wait through a world that was asleep', async () => {
    const worldId = nextWorldId();
    const first = await TestClient.connect(worldId, 'chops-then-leaves');
    await findTheBag(first);
    await walkToTheAxe(first);
    first.walk(0, 0, 0, 3, PlayerButton.Interact);
    await waitFor('the axe', () => first.inventory().some((entry) => entry.item === 'axe'));
    first.useItem('axe');
    await waitFor('the axe to be equipped', () =>
      first.equipped().some((entry) => entry.item === 'axe'),
    );

    const oak = theOak(first.welcome().seed);
    await chopUntilFelled(first, oak, oak.id);
    expect(first.felledTrees()).toEqual([oak.id]);

    // Everybody leaves. The world saves, lets go and stops ticking entirely.
    first.close();
    // Long enough that the oak comes due while nobody is here to see it.
    await sleep(7000);

    // Somebody comes back to a clearing that healed while nobody was here. The
    // very first word on the trees already has it standing: a world that was
    // asleep catches up before it says anything, rather than showing the stump
    // that was left and turning it into a tree a tick later.
    const second = await TestClient.connect(worldId, 'comes-back-later');
    await waitFor('the opening word on the trees', () => second.countOfMessages('treeStates') > 0);

    const opening = second.openingTreeStates().find((tree) => tree.treeId === oak.id);
    expect(opening?.felled).toBe(false);
    expect(opening?.generation).toBe(1);
    second.close();
  }, 45_000);
});

describe('fishing', () => {
  /** Looking along +X, which from the rod is straight out over the pond. */
  const EAST = -Math.PI / 2;

  /**
   * Pick up the rod and turn to the water.
   *
   * The rod lies close enough to the pond to cast from where you pick it up.
   * Walking on until the water stops you does not work: the bank is round, so
   * you slide along it instead of stopping.
   */
  async function readyToFish(client: TestClient): Promise<number> {
    await findTheBag(client);
    await walkWithinReach(client, ROD_SPOT);
    client.walk(0, 0, EAST, 3, PlayerButton.Interact);
    await waitFor('the rod', () => client.inventory().some((entry) => entry.item === 'rod'));
    client.useItem('rod');
    await waitFor('the rod to be equipped', () =>
      client.equipped().some((entry) => entry.item === 'rod'),
    );
    // Let go of the button, so the first click to cast is a fresh one.
    client.walk(0, 0, EAST, 2);
    await sleep(150);
    return client.welcome().netId;
  }

  /** A press and a release, carrying whatever else a browser would be saying. */
  function click(client: TestClient, extra = 0): void {
    client.walk(0, 0, EAST, 1, PlayerButton.Fish | extra);
    client.walk(0, 0, EAST, 1, extra);
  }

  it('leaves a rod by the pond for somebody to find', async () => {
    const client = await TestClient.connect(nextWorldId(), 'rod-finder');
    await findTheBag(client);
    await walkWithinReach(client, ROD_SPOT);
    client.walk(0, 0, 0, 3, PlayerButton.Interact);
    await waitFor('the rod', () => client.inventory().some((entry) => entry.item === 'rod'));
    expect(client.takenPickups()).toContain(ROD_PICKUP_ID);
    client.close();
  });

  it('lands a fish: cast, wait for the float to go under, click', async () => {
    const worldId = nextWorldId();
    const client = await TestClient.connect(worldId, 'the-angler');
    const netId = await readyToFish(client);

    click(client);
    await waitFor('the cast', () =>
      client.fishing().some((event) => event.kind === 'cast' && event.netId === netId),
    );

    // Somewhere between three and ten seconds.
    await waitFor(
      'a bite',
      () => client.fishing().some((event) => event.kind === 'bite' && event.netId === netId),
      12_000,
    );
    // A browser showing the bite says so on every input, the click included.
    click(client, PlayerButton.SawBite);

    await waitFor('the catch', () => client.fishing().some((event) => event.kind === 'caught'));
    const caught = client.fishing().find((event) => event.kind === 'caught');
    if (caught?.kind !== 'caught') throw new Error('expected a catch');
    expect(caught.netId).toBe(netId);
    expect(caught.added).toBe(1);
    expect(POND_FISH.map((row) => row.item)).toContain(caught.item);
    await waitFor('the fish in the pack', () =>
      client.inventory().some((entry) => entry.item === caught.item),
    );

    // And it is still in the pack after logging out and coming back.
    client.close();
    await sleep(300);
    const again = await TestClient.connect(worldId, 'the-angler');
    await waitFor('the pack', () => again.countOfMessages('inventory') > 0);
    expect(again.inventory()).toContainEqual({ item: caught.item, count: 1 });
    expect(ITEM_KINDS[caught.item].stackSize).toBe(10);
    again.close();
  }, 45_000);

  it('lets the fish go when you click before it bites', async () => {
    const client = await TestClient.connect(nextWorldId(), 'impatient');
    const netId = await readyToFish(client);

    click(client);
    await waitFor('the cast', () => client.fishing().some((event) => event.kind === 'cast'));
    click(client);

    await waitFor('the line to come in', () =>
      client.fishing().some((event) => event.kind === 'tooSoon' && event.netId === netId),
    );
    expect(client.inventory().some((entry) => entry.item !== 'rod' && entry.item !== 'bag')).toBe(
      false,
    );
    client.close();
  }, 45_000);

  it('shows everybody else the float', async () => {
    const worldId = nextWorldId();
    const angler = await TestClient.connect(worldId, 'fishing-in-company');
    const onlooker = await TestClient.connect(worldId, 'watching-the-float');
    const netId = await readyToFish(angler);

    click(angler);
    await waitFor('the onlooker to see the cast', () =>
      onlooker.fishing().some((event) => event.kind === 'cast' && event.netId === netId),
    );
    angler.close();
    onlooker.close();
  }, 45_000);
});

describe('hunger', () => {
  /** Looking along +X, which from the rod is straight out over the pond. */
  const EAST = -Math.PI / 2;

  async function readyToFish(client: TestClient): Promise<void> {
    await findTheBag(client);
    await walkWithinReach(client, ROD_SPOT);
    client.walk(0, 0, EAST, 3, PlayerButton.Interact);
    await waitFor('the rod', () => client.inventory().some((entry) => entry.item === 'rod'));
    client.useItem('rod');
    await waitFor('the rod to be equipped', () =>
      client.equipped().some((entry) => entry.item === 'rod'),
    );
    // Let go of the button, so the first click to cast is a fresh one.
    client.walk(0, 0, EAST, 2);
    await sleep(150);
  }

  /** A press and a release, carrying whatever else a browser would be saying. */
  function click(client: TestClient, extra = 0): void {
    client.walk(0, 0, EAST, 1, PlayerButton.Fish | extra);
    client.walk(0, 0, EAST, 1, extra);
  }

  /** Cast, wait for a bite and land it, the same way the fishing tests do. */
  async function catchAFish(client: TestClient): Promise<ItemId> {
    await readyToFish(client);
    click(client);
    await waitFor('a bite', () => client.fishing().some((event) => event.kind === 'bite'), 12_000);
    click(client, PlayerButton.SawBite);

    await waitFor('the catch', () => client.fishing().some((event) => event.kind === 'caught'));
    const caught = client.fishing().find((event) => event.kind === 'caught');
    if (caught?.kind !== 'caught') throw new Error('expected a catch');
    return caught.item;
  }

  it('tells a new player they start full', async () => {
    const client = await TestClient.connect(nextWorldId());
    await waitFor('a hunger reading', () => client.hunger().length > 0);
    expect(client.hunger()[0]?.hunger).toBe(HUNGER_MAX);
    client.close();
  });

  it('drains on its own while the world ticks', async () => {
    // Three seconds to empty in this test run; see vitest.config.ts.
    const client = await TestClient.connect(nextWorldId());
    await waitFor('a hunger reading', () => client.hunger().length > 0);

    await waitFor(
      'hunger to have dropped',
      () => (client.latestHunger()?.hunger ?? HUNGER_MAX) < HUNGER_MAX,
      4_000,
    );
    client.close();
  }, 15_000);

  it('does not eat a fish through the interact fallback until it is the active item', async () => {
    const client = await TestClient.connect(nextWorldId(), 'the-eater');
    const item = await catchAFish(client);
    await waitFor('the fish in the pack', () =>
      client.inventory().some((entry) => entry.item === item),
    );
    const before = client.inventory().find((entry) => entry.item === item)?.count ?? 0;

    // The rod is still the active item from casting - carrying the fish is
    // not enough on its own, the same rule a swing needs the axe active and
    // a cast needs the rod active for. Nothing else claims the button here
    // (no pickup, gather spot, cache or campfire), so this proves the
    // fallback really does nothing rather than merely not being reached.
    client.walk(0, 0, EAST, 3, PlayerButton.Interact);
    await sleep(300);

    expect(client.hunger().some((event) => event.ate === item)).toBe(false);
    expect(client.inventory().find((entry) => entry.item === item)?.count ?? 0).toBe(before);
    client.close();
  }, 45_000);

  it('eats a specific item on demand from the hotbar, not just the interact fallback', async () => {
    const client = await TestClient.connect(nextWorldId(), 'the-hotbar-eater');
    const item = await catchAFish(client);
    await waitFor('the fish in the pack', () =>
      client.inventory().some((entry) => entry.item === item),
    );
    const before = client.inventory().find((entry) => entry.item === item)?.count ?? 0;

    client.useItem(item);
    await waitFor('a meal', () => client.hunger().some((event) => event.ate === item));

    const after = client.inventory().find((entry) => entry.item === item)?.count ?? 0;
    expect(after).toBe(before - 1);
    client.close();
  }, 45_000);

  it('does nothing asking to eat an item the pack has none of', async () => {
    const client = await TestClient.connect(nextWorldId(), 'nothing-to-eat');
    await waitFor('a hunger reading', () => client.hunger().length > 0);

    client.useItem('perch');
    await sleep(150);

    expect(client.hunger().some((event) => event.ate === 'perch')).toBe(false);
    client.close();
  });

  it('keeps hunger across logging out and coming back', async () => {
    // Waits for the meter to bottom out rather than comparing a reading taken
    // mid-drain: with hunger still moving, the moment between capturing "what
    // it was" and the connection actually closing is enough real time for the
    // fast test rate to move it again, and the comparison would be flaky.
    // Zero is a stable floor to compare against instead.
    const worldId = nextWorldId();
    const first = await TestClient.connect(worldId, 'the-hungry-one');
    await waitFor('hunger to bottom out', () => first.latestHunger()?.hunger === 0, 5_000);
    first.close();
    await sleep(300);

    const second = await TestClient.connect(worldId, 'the-hungry-one');
    await waitFor('a hunger reading after coming back', () => second.hunger().length > 0);
    expect(second.latestHunger()?.hunger).toBe(0);
    second.close();
  }, 15_000);
});

describe('wildlife', () => {
  it('rides along in the snapshot every player already gets', async () => {
    const client = await TestClient.connect(nextWorldId());
    await waitFor('a snapshot with wildlife in it', () =>
      client.latestSnapshot().entities.some(isAnimal),
    );
    client.close();
  });

  it('moves on its own while the world ticks, not only in the shared package tests', async () => {
    const client = await TestClient.connect(nextWorldId());
    await waitFor('a snapshot with wildlife in it', () =>
      client.latestSnapshot().entities.some(isAnimal),
    );
    const first = client.latestSnapshot().entities.find(isAnimal);
    if (first === undefined) throw new Error('expected an animal in the snapshot');
    const { netId: animalId, x: startX, z: startZ } = first;

    await waitFor(
      'that animal to have wandered off its den',
      () => {
        const now = client
          .latestSnapshot()
          .entities.find((entity) => entity.netId === animalId && isAnimal(entity));
        return now !== undefined && Math.hypot(now.x - startX, now.z - startZ) > 0.15;
      },
      6_000,
    );
    client.close();
  }, 15_000);
});

describe('catching wildlife', () => {
  /**
   * Connect, optionally fetch the axe, then wait for wildlife to show up in
   * the snapshot and report which animal to go after.
   */
  async function readyHunter(
    playerKey: string,
    withAxe: boolean,
  ): Promise<{ client: TestClient; animalId: number }> {
    const client = await TestClient.connect(nextWorldId(), playerKey);
    if (withAxe) {
      await findTheBag(client);
      await walkToTheAxe(client);
      client.walk(0, 0, 0, 3, PlayerButton.Interact);
      await waitFor('the axe', () => client.inventory().some((entry) => entry.item === 'axe'));
      client.useItem('axe');
      await waitFor('the axe to be equipped', () =>
        client.equipped().some((entry) => entry.item === 'axe'),
      );
    }
    await waitFor('a snapshot with wildlife in it', () =>
      client.latestSnapshot().entities.some(isAnimal),
    );
    const animal = client.latestSnapshot().entities.find(isAnimal);
    if (animal === undefined) throw new Error('expected an animal in the snapshot');
    return { client, animalId: animal.netId };
  }

  /**
   * Sprint toward wherever the animal currently is - it wanders, so a fixed
   * spot would not do - and once close enough, hold still and swing, the way
   * `chopUntilFelled` does for a tree that cannot move. Only swings once in
   * reach: a swing plants your feet (see decision 0056), so swinging on the
   * run would never close the gap. Stops early on a catch; otherwise spends
   * the whole step budget, which is exactly what the no-axe test needs to
   * prove a swing there still catches nothing.
   */
  async function huntAnimal(client: TestClient, animalId: number, steps: number): Promise<void> {
    const netId = client.welcome().netId;
    for (let step = 0; step < steps; step++) {
      if (client.caught().some((event) => event.netId === animalId)) return;
      const animal = client
        .latestSnapshot()
        .entities.find((entity) => entity.netId === animalId && isAnimal(entity));
      if (animal === undefined) return;
      const here = client.positionOf(netId);
      if (here === undefined) return;
      const yaw = Math.atan2(-(animal.x - here.x), -(animal.z - here.z));
      const closingIn = Math.hypot(animal.x - here.x, animal.z - here.z) > CHOP_REACH - 0.5;
      const buttons = closingIn ? PlayerButton.Sprint : PlayerButton.Swing;
      client.walk(0, closingIn ? 1 : 0, yaw, 4, buttons);
      await sleep(110);
    }
  }

  it('catches a rabbit with the axe, and it pays out meat', async () => {
    const { client, animalId } = await readyHunter('the-hunter', true);
    await huntAnimal(client, animalId, 300);

    expect(client.caught()).toEqual([
      { netId: client.welcome().netId, item: ANIMAL_KINDS.rabbit.catchItem, added: 1 },
    ]);
    expect(client.inventory()).toEqual(
      expect.arrayContaining([{ item: ANIMAL_KINDS.rabbit.catchItem, count: 1 }]),
    );
    client.close();
  }, 40_000);

  it('makes the animal vanish from the next snapshot the moment it is caught', async () => {
    const { client, animalId } = await readyHunter('the-other-hunter', true);
    await huntAnimal(client, animalId, 300);

    expect(client.caught().length).toBeGreaterThan(0);
    expect(client.latestSnapshot().entities.some((entity) => entity.netId === animalId)).toBe(
      false,
    );
    client.close();
  }, 40_000);

  it('refuses to catch anything for somebody with no axe', async () => {
    const { client, animalId } = await readyHunter('no-axe-hunter', false);
    await huntAnimal(client, animalId, 300);

    expect(client.caught()).toEqual([]);
    client.close();
  }, 40_000);
});

describe('building', () => {
  /** These material/lighting tests begin with an existing owner's home. */
  async function existingBuildArea(client: TestClient): Promise<void> {
    if (client.playerKey === undefined) throw new Error('building fixture needs an owner');
    const stub = env.WORLD.get(env.WORLD.idFromName(client.worldId));
    const inside = await runInDurableObject(stub, (instance, state) => {
      const sim = (instance as unknown as { simulation: WorldSimulation }).simulation;
      if (!sim.builtPropsList().some((prop) => prop.id === 60000)) {
        sim.restoreBuiltProps([
          {
            id: 60000,
            kind: 'cabin',
            x: 0,
            z: 15,
            yaw: 0,
            lit: false,
            ownerKey: client.playerKey!,
            litUntilMs: null,
          },
        ]);
        state.storage.sql.exec(
          'INSERT INTO built_props (id,kind_index,x,z,yaw,built_at_ms,owner_key) VALUES (?,?,?,?,?,?,?)',
          60000,
          buildableKindIndex('cabin'),
          0,
          15,
          0,
          Date.now(),
          client.playerKey!,
        );
      }
      return sim.spaceOf(client.welcome().netId) !== 0;
    });
    if (inside) await walkWithinReach(client, { x: 0, z: HOME_ENTRY.z + 5 });
    client.walk(0, 0, 0, 1);
    await waitFor('outdoors at the established home', () => client.latestSpace()?.space === 0);
  }

  /** The landmark oak, which happens to stand right beside the axe's stump. */
  function theOak(seed: number) {
    const tree = buildTestClearing(seed).props.find((prop) => prop.kind === 'oak');
    if (tree === undefined) throw new Error('no oak in the clearing');
    return tree;
  }

  /** Face a spot and hold the swing, until the tree is down or we give up. */
  async function chopUntilFelled(
    client: TestClient,
    target: { x: number; z: number },
    treeId: number,
  ): Promise<void> {
    const netId = client.welcome().netId;
    for (let step = 0; step < 60; step++) {
      if (client.felledTrees().includes(treeId)) return;
      const here = client.positionOf(netId);
      if (here === undefined) break;
      const yaw = Math.atan2(-(target.x - here.x), -(target.z - here.z));
      client.walk(0, 0, yaw, 4, PlayerButton.Swing);
      await sleep(120);
    }
    throw new Error('the tree never came down');
  }

  /** Fell the landmark oak: exactly enough logs for one campfire, no more. */
  async function getLogsForACampfire(client: TestClient): Promise<void> {
    await existingBuildArea(client);
    await findTheBag(client);
    await walkToTheAxe(client);
    client.walk(0, 0, 0, 3, PlayerButton.Interact);
    await waitFor('the axe', () => client.inventory().some((entry) => entry.item === 'axe'));
    client.useItem('axe');
    await waitFor('the axe to be equipped', () =>
      client.equipped().some((entry) => entry.item === 'axe'),
    );

    const oak = theOak(client.welcome().seed);
    await chopUntilFelled(client, oak, oak.id);
    await collectFallenLogs(client);
  }

  /** Walk back to open ground near spawn - clear of every landmark - to build on. */
  async function walkToOpenGround(client: TestClient): Promise<void> {
    // The same walk as reaching for anything, so it steps around the pond
    // from wherever a patch happened to be.
    await walkWithinReach(client, SPAWN_POSITION);
  }

  /** Face the middle of the clearing and ask to build until something appears. */
  async function buildCampfire(client: TestClient): Promise<void> {
    const netId = client.welcome().netId;
    for (let step = 0; step < 20; step++) {
      if (client.builtProps().filter((prop) => prop.id !== 60000).length > 0) return;
      const here = client.positionOf(netId);
      const yaw =
        here === undefined
          ? 0
          : Math.atan2(-(SPAWN_POSITION.x - here.x), -(SPAWN_POSITION.z - here.z));
      client.walk(0, 0, yaw, 4);
      client.buildInFront('campfire', yaw);
      await sleep(120);
    }
    throw new Error('never built anything');
  }

  it('places a campfire once you have the logs for one, and spends them', async () => {
    const client = await TestClient.connect(nextWorldId(), 'the-builder');
    await getLogsForACampfire(client);
    // The oak pays out exactly what a campfire costs, so this is the plainest
    // possible check that a build is not free.
    expect(client.inventory()).toEqual([
      { item: 'axe', count: 1 },
      { item: 'log', count: 4 },
      { item: 'bag', count: 1 },
    ]);

    await walkToOpenGround(client);
    await buildCampfire(client);

    const props = client.builtProps().filter((prop) => prop.id !== 60000);
    expect(props).toHaveLength(1);
    expect(props[0]?.kind).toBe('campfire');
    expect(client.inventory()).toEqual([
      { item: 'axe', count: 1 },
      { item: 'bag', count: 1 },
    ]);
    client.close();
  }, 30_000);

  it('shows a second player the campfire appear', async () => {
    const worldId = nextWorldId();
    const builder = await TestClient.connect(worldId, 'the-other-builder');
    const watcher = await TestClient.connect(worldId, 'the-watcher');
    await waitFor(
      'both welcomes',
      () => builder.received.length > 0 && watcher.received.length > 0,
    );

    await getLogsForACampfire(builder);
    await walkToOpenGround(builder);
    await buildCampfire(builder);

    await waitFor(
      'the watcher to see it too',
      () => watcher.builtProps().filter((prop) => prop.id !== 60000).length > 0,
    );
    expect(
      watcher
        .builtProps()
        .filter((prop) => prop.id !== 60000)
        .map((prop) => ({ ...prop, yours: false })),
    ).toEqual(
      builder
        .builtProps()
        .filter((prop) => prop.id !== 60000)
        .map((prop) => ({ ...prop, yours: false })),
    );
    builder.close();
    watcher.close();
  }, 30_000);

  it('refuses without enough logs, and spends nothing', async () => {
    const client = await TestClient.connect(nextWorldId(), 'no-logs-here');
    await waitFor(
      'a first snapshot',
      () => client.positionOf(client.welcome().netId) !== undefined,
    );
    await walkToOpenGround(client);

    const netId = client.welcome().netId;
    for (let i = 0; i < 10; i++) {
      const here = client.positionOf(netId);
      const yaw =
        here === undefined
          ? 0
          : Math.atan2(-(SPAWN_POSITION.x - here.x), -(SPAWN_POSITION.z - here.z));
      client.walk(0, 0, yaw, 4);
      client.buildInFront('campfire', yaw);
      await sleep(100);
    }

    expect(client.builtProps().filter((prop) => prop.id !== 60000)).toEqual([]);
    expect(client.inventory()).toEqual([]);
    client.close();
  });

  it('leaves the campfire there after logging out and coming back', async () => {
    const worldId = nextWorldId();
    const first = await TestClient.connect(worldId, 'comes-back-to-build');
    await getLogsForACampfire(first);
    await walkToOpenGround(first);
    await buildCampfire(first);
    const built = first.builtProps().filter((prop) => prop.id !== 60000);
    expect(built).toHaveLength(1);
    first.close();
    await sleep(300);

    const second = await TestClient.connect(worldId, 'comes-back-to-build');
    await waitFor('the opening built props', () => second.countOfMessages('builtProps') > 0);
    expect(second.openingBuiltProps().filter((prop) => prop.id !== 60000)).toEqual(built);
    second.close();
  }, 30_000);

  /**
   * A campfire lands a couple of steps away (see `buildInFront`), outside
   * interact reach, so lighting it needs one more short walk first.
   */
  async function walkOntoCampfire(
    client: TestClient,
    campfire: { x: number; z: number },
  ): Promise<void> {
    const netId = client.welcome().netId;
    for (let step = 0; step < 20; step++) {
      const here = client.positionOf(netId);
      if (here === undefined) return;
      if (Math.hypot(here.x - campfire.x, here.z - campfire.z) < PICKUP_REACH - 0.5) return;
      const yaw = Math.atan2(-(campfire.x - here.x), -(campfire.z - here.z));
      client.walk(0, 1, yaw, 4);
      await sleep(110);
    }
    throw new Error('never reached the campfire');
  }

  it('lights a campfire once you are close enough to it', async () => {
    const client = await TestClient.connect(nextWorldId(), 'the-lighter');
    await getLogsForACampfire(client);
    await walkToOpenGround(client);
    await buildCampfire(client);
    const built = client.builtProps().filter((prop) => prop.id !== 60000)[0];
    expect(built?.lit).toBe(false);
    if (built === undefined) return;

    await walkOntoCampfire(client, built);
    client.walk(0, 0, 0, 3, PlayerButton.Interact);
    await waitFor(
      'the campfire to light',
      () => client.builtProps().filter((prop) => prop.id !== 60000)[0]?.lit === true,
    );
    client.close();
  }, 30_000);

  it('leaves a lit campfire lit after logging out and coming back', async () => {
    const worldId = nextWorldId();
    const first = await TestClient.connect(worldId, 'comes-back-to-a-lit-fire');
    await getLogsForACampfire(first);
    await walkToOpenGround(first);
    await buildCampfire(first);
    const built = first.builtProps().filter((prop) => prop.id !== 60000)[0];
    expect(built).toBeDefined();
    if (built === undefined) return;

    await walkOntoCampfire(first, built);
    first.walk(0, 0, 0, 3, PlayerButton.Interact);
    await waitFor(
      'the campfire to light',
      () => first.builtProps().filter((prop) => prop.id !== 60000)[0]?.lit === true,
    );
    first.close();
    await sleep(300);

    const second = await TestClient.connect(worldId, 'comes-back-to-a-lit-fire');
    await waitFor('the opening built props', () => second.countOfMessages('builtProps') > 0);
    expect(second.openingBuiltProps().find((prop) => prop.kind === 'campfire')?.lit).toBe(true);
    second.close();
  }, 30_000);

  /** Face the middle of the clearing and ask to build a cabin until one appears. */
  async function buildTent(client: TestClient): Promise<void> {
    const netId = client.welcome().netId;
    for (let step = 0; step < 20; step++) {
      if (
        client
          .builtProps()
          .filter((prop) => prop.id !== 60000)
          .some((prop) => prop.kind === 'tent')
      )
        return;
      const here = client.positionOf(netId);
      const yaw =
        here === undefined
          ? 0
          : Math.atan2(-(SPAWN_POSITION.x - here.x), -(SPAWN_POSITION.z - here.z));
      client.walk(0, 0, yaw, 4);
      client.buildInFront('tent', yaw);
      await sleep(120);
    }
    throw new Error('never built a cabin');
  }

  it('a starter tent is capped at one, and is where its owner starts next time', async () => {
    const worldId = nextWorldId();
    const owner = await TestClient.connect(worldId, 'has-a-cabin');
    await waitFor('owner first snapshot', () => owner.snapshots().length > 0);
    await gatherFromPatches(owner, 'stick', 6);
    await walkToOpenGround(owner);
    await buildTent(owner);

    const home = owner
      .builtProps()
      .filter((prop) => prop.id !== 60000)
      .find((prop) => prop.kind === 'tent');
    expect(home).toBeDefined();
    if (home === undefined) throw new Error('no cabin was built');

    // A second player never sees somebody else's home count against them.
    const stranger = await TestClient.connect(worldId, 'no-cabin-here');
    await waitFor(
      'the stranger to have a position',
      () => stranger.positionOf(stranger.welcome().netId) !== undefined,
    );
    stranger.close();

    owner.close();
    await sleep(300);

    // Reconnecting wakes them up inside their own home now, by the bed,
    // not back where they stood when they logged out - see decision 0055.
    const returning = await TestClient.connect(worldId, 'has-a-cabin');
    await waitFor('word of where they are', () => returning.latestSpace() !== undefined);
    expect(returning.latestSpace()?.space).toBe(home.id);
    expect(returning.latestSpace()?.x).toBeCloseTo(HOME_WAKE_SPOT.x * 0.8, 1);
    expect(returning.latestSpace()?.z).toBeCloseTo(HOME_WAKE_SPOT.z * 0.8, 1);

    // Their own door locks and unlocks, and everybody hears about it.
    returning.setDoorLock(true);
    await waitFor(
      'the door to be locked',
      () =>
        returning
          .builtProps()
          .filter((prop) => prop.id !== 60000)
          .find((prop) => prop.id === home.id)?.locked === true,
    );
    returning.setDoorLock(false);
    await waitFor(
      'the door to be open again',
      () =>
        returning
          .builtProps()
          .filter((prop) => prop.id !== 60000)
          .find((prop) => prop.id === home.id)?.locked === false,
    );
    returning.close();
  }, 60_000);

  it('tells a player with no home that they are outdoors', async () => {
    const client = await TestClient.connect(nextWorldId(), 'homeless-for-now');
    await waitFor('word of where they are', () => client.latestSpace() !== undefined);
    expect(client.latestSpace()?.space).toBe(0);
    client.close();
  });

  async function gatherFlowers(client: TestClient, count: number): Promise<void> {
    await existingBuildArea(client);
    await gatherFromPatches(client, 'flower', count);
  }

  /** Face the middle of the clearing and ask to build a lantern until one appears. */
  async function buildLantern(client: TestClient): Promise<void> {
    const netId = client.welcome().netId;
    for (let step = 0; step < 20; step++) {
      if (
        client
          .builtProps()
          .filter((prop) => prop.id !== 60000)
          .some((prop) => prop.kind === 'lantern')
      )
        return;
      const here = client.positionOf(netId);
      const yaw =
        here === undefined
          ? 0
          : Math.atan2(-(SPAWN_POSITION.x - here.x), -(SPAWN_POSITION.z - here.z));
      client.walk(0, 0, yaw, 4);
      client.buildInFront('lantern', yaw);
      await sleep(120);
    }
    throw new Error('never built a lantern');
  }

  it('a lantern (a decoration, not a home) is still capped through a real reconnect', async () => {
    const worldId = nextWorldId();
    const owner = await TestClient.connect(worldId, 'has-a-lantern');
    const patch = FLOWER_PATCHES[0];
    if (patch === undefined) throw new Error('no flower patch to test against');

    await findTheBag(owner);
    await walkWithinReach(owner, patch);
    await gatherFlowers(owner, 4);
    await walkToOpenGround(owner);
    await buildLantern(owner);
    expect(
      owner
        .builtProps()
        .filter((prop) => prop.id !== 60000)
        .filter((prop) => prop.kind === 'lantern'),
    ).toHaveLength(1);
    owner.close();
    await sleep(300);

    // A fresh connection, same player: the owner_key this lantern was saved
    // with has to round-trip through real storage for the cap to still know
    // it is theirs, not just the in-memory session that built it.
    const returning = await TestClient.connect(worldId, 'has-a-lantern');
    await waitFor(
      'a first snapshot',
      () => returning.positionOf(returning.welcome().netId) !== undefined,
    );
    expect(
      returning
        .builtProps()
        .filter((prop) => prop.id !== 60000)
        .filter((prop) => prop.kind === 'lantern'),
    ).toHaveLength(1);

    // Whichever flower patches have any left - or have grown back since -
    // with nothing about which ones were whose to remember.
    await gatherFlowers(returning, 4);
    await walkToOpenGround(returning);
    for (let step = 0; step < 10; step++) {
      returning.walk(0, 0, 0, 4);
      returning.buildInFront('lantern', 0);
      await sleep(100);
    }
    expect(
      returning
        .builtProps()
        .filter((prop) => prop.id !== 60000)
        .filter((prop) => prop.kind === 'lantern'),
    ).toHaveLength(1);
    returning.close();
  }, 60_000);
});

describe('threats', () => {
  it("a threat's damage survives a real reconnect, through actual storage", async () => {
    const raccoonDen = ANIMAL_DENS.find((entry) => entry.id === 1005);
    if (raccoonDen === undefined) {
      throw new Error('the masked raccoon den is gone from the data table');
    }

    const worldId = nextWorldId();
    const first = await TestClient.connect(worldId, 'gets-hurt');
    // Stand there undefended, so only the raccoon's own attack is in play.
    await walkWithinReach(first, raccoonDen);

    await waitFor(
      'health to drop from a real attack',
      () => (first.latestHealth()?.health ?? HEALTH_MAX) < HEALTH_MAX,
      20_000,
    );
    first.close();
    await sleep(300);

    // What the reconnect is told the instant it opens, straight from
    // storage - not the in-memory session that actually took the hit.
    const second = await TestClient.connect(worldId, 'gets-hurt');
    await waitFor(
      'a first snapshot',
      () => second.positionOf(second.welcome().netId) !== undefined,
    );
    expect(second.openingHealth()?.health).toBeLessThan(HEALTH_MAX);
    second.close();
  }, 30_000);

  it('buries something on a real knockout, and lets it be dug back up through real storage', async () => {
    const raccoonDen = ANIMAL_DENS.find((entry) => entry.id === 1005);
    if (raccoonDen === undefined) {
      throw new Error('the masked raccoon den is gone from the data table');
    }

    const stickPatch = STICK_PATCHES[0];
    if (stickPatch === undefined) throw new Error('no stick patch to test against');

    const worldId = nextWorldId();
    const first = await TestClient.connect(worldId, 'gets-buried');
    // Something worth losing - an empty pack has nothing a knockout can
    // bury, and burying half of one stick would still be none. A bag first,
    // the same as most tests here - and it survives the knockout itself,
    // being kept like a tool, so its slots are still there to dig into.
    await findTheBag(first);
    await walkWithinReach(first, stickPatch);
    const hasTwoSticks = (): boolean =>
      (first.inventory().find((entry) => entry.item === 'stick')?.count ?? 0) >= 2;
    for (let step = 0; step < 60 && !hasTwoSticks(); step++) {
      first.walk(0, 0, 0, 4, PlayerButton.Interact);
      await sleep(120);
    }
    if (!hasTwoSticks()) throw new Error('never gathered enough sticks');

    await walkWithinReach(first, raccoonDen);

    // Four hits at twenty-five damage each empties a hundred health - a
    // real fight, not a shortcut, the same as the reconnect test above.
    await waitFor(
      'a real knockout',
      () => first.health().some((event) => event.knockedOut),
      30_000,
    );
    await waitFor('the cache to appear', () => first.buriedCaches().length > 0, 5_000);
    const cache = first.buriedCaches()[0];
    expect(cache).toBeDefined();
    if (cache === undefined) return;
    expect(cache.ownerNetId).toBe(first.welcome().netId);

    first.close();
    await sleep(300);

    // The mound survives a reconnect - it comes straight from storage, not
    // the in-memory session that actually buried it.
    const second = await TestClient.connect(worldId, 'gets-buried');
    await waitFor('the opening buried caches', () => second.countOfMessages('buriedCaches') > 0);
    const reopened = second.openingBuriedCaches();
    expect(reopened).toEqual([{ ...cache, ownerNetId: second.welcome().netId }]);

    // Walk back to where it is and dig it up.
    await walkWithinReach(second, cache);
    second.walk(0, 0, 0, 3, PlayerButton.Interact);
    await waitFor('the dig-up to register', () =>
      second.cacheNews().some((event) => event.kind === 'dugUp'),
    );
    await waitFor('the mound to disappear', () => second.buriedCaches().length === 0);

    second.close();
    await sleep(300);

    // Gone from storage too, not only this session's memory.
    const third = await TestClient.connect(worldId, 'gets-buried');
    await waitFor('the opening buried caches', () => third.countOfMessages('buriedCaches') > 0);
    expect(third.openingBuriedCaches()).toEqual([]);
    third.close();
  }, 60_000);
});
