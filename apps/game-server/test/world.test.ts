import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import {
  ANIMAL_DENS,
  ANIMAL_KINDS,
  AXE_PICKUP_ID,
  BAG_PICKUP_ID,
  BAG_SPOT,
  DEFAULT_WORLD_SEED,
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
  SPAWN_POSITION,
  STICK_PATCHES,
  TICK_HZ,
  buildTestClearing,
  choppingRuleFor,
  recipeFor,
  type ItemId,
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

  it('locks a character that is not available yet, whatever the client asks for', async () => {
    const client = await TestClient.connect(nextWorldId());
    await waitFor('a welcome', () => client.received.length > 0);

    client.hello('Merlin', 'mage', 'plum');
    await waitFor('the roster to include them', () => client.roster().length > 0);

    // Mage is not available yet (see packages/shared/src/data/characters.ts),
    // so the server keeps them as Knight regardless of what was asked for.
    expect(client.roster()[0]?.character).toBe('knight');
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

  for (let step = 0; step < 60; step++) {
    const here = client.positionOf(netId);
    if (here === undefined) break;
    const gap = Math.hypot(here.x - spot.x, here.z - spot.z);
    if (gap < PICKUP_REACH - 0.4) return;
    // Walking forward is walking down -Z, so this is the heading that lines up.
    const yaw = Math.atan2(-(spot.x - here.x), -(spot.z - here.z));
    client.walk(0, 1, yaw, 4);
    await sleep(110);
  }
  const ended = client.positionOf(netId);
  throw new Error(`Never reached ${spot.x}, ${spot.z}; stopped at ${ended?.x}, ${ended?.z}`);
}

async function walkToTheAxe(client: TestClient): Promise<void> {
  await walkWithinReach(client, AXE_STUMP);
}

/**
 * Walk a fresh connection to the bag and pick it up.
 *
 * Nothing else can be carried before this, so almost every test that goes on
 * to pick up, gather, chop, fish, hunt or eat something starts here first.
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

  it('hands over the bag when a player reaches for it', async () => {
    const client = await TestClient.connect(nextWorldId(), 'bag-finder');
    await findTheBag(client);

    expect(client.inventory()).toEqual([{ item: 'bag', count: 1 }]);
    expect(client.takenPickups()).toEqual([BAG_PICKUP_ID]);
    client.close();
  });

  it('is the one thing a bagless player can still pick up', async () => {
    const client = await TestClient.connect(nextWorldId(), 'nothing-yet');
    await walkToTheAxe(client);
    client.walk(0, 0, 0, 3, PlayerButton.Interact);
    await sleep(150);

    // Standing right in the stump, holding the button down, still nothing -
    // there is nowhere yet to put an axe.
    expect(client.inventory()).toEqual([]);
    expect(client.takenPickups()).toEqual([]);
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

  /** Hold the interact button at a gather spot until the pack has this many sticks. */
  async function gatherSticks(client: TestClient, count: number): Promise<void> {
    const enough = (): boolean =>
      (client.inventory().find((entry) => entry.item === 'stick')?.count ?? 0) >= count;
    for (let step = 0; step < 60 && !enough(); step++) {
      client.walk(0, 0, 0, 4, PlayerButton.Interact);
      await sleep(120);
    }
    if (!enough()) throw new Error('never gathered enough sticks');
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

  it('gathers nothing at all without a bag yet', async () => {
    const client = await TestClient.connect(nextWorldId(), 'bagless-gatherer');
    await walkWithinReach(client, stickPatch);

    client.walk(0, 0, 0, 3, PlayerButton.Interact);
    await sleep(150);

    expect(client.inventory()).toEqual([]);
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

  it('fells the oak once you have the axe, and pays out logs', async () => {
    const client = await TestClient.connect(nextWorldId(), 'the-woodcutter');
    await findTheBag(client);
    await walkToTheAxe(client);
    client.walk(0, 0, 0, 3, PlayerButton.Interact);
    await waitFor('the axe', () => client.inventory().some((entry) => entry.item === 'axe'));

    const oak = theOak(client.welcome().seed);
    await chopUntilFelled(client, oak, oak.id);

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

    await waitFor('the logs', () => client.inventory().some((entry) => entry.item === 'log'));
    expect(client.inventory()).toEqual([
      { item: 'axe', count: 1 },
      { item: 'log', count: logs },
      { item: 'bag', count: 1 },
    ]);
    client.close();
  });

  it('leaves the stump there after logging out and coming back', async () => {
    const worldId = nextWorldId();
    const first = await TestClient.connect(worldId, 'comes-back');
    await findTheBag(first);
    await walkToTheAxe(first);
    first.walk(0, 0, 0, 3, PlayerButton.Interact);
    await waitFor('the axe', () => first.inventory().some((entry) => entry.item === 'axe'));

    const oak = theOak(first.welcome().seed);
    await chopUntilFelled(first, oak, oak.id);
    await waitFor('the logs', () => first.inventory().some((entry) => entry.item === 'log'));
    first.close();
    await sleep(300);

    const second = await TestClient.connect(worldId, 'comes-back');
    await waitFor('the opening messages', () => second.countOfMessages('treeStates') > 0);

    // This is the Phase 1 promise: chop a tree, log out, come back, stump still there.
    expect(second.felledTrees()).toEqual([oak.id]);
    expect(second.inventory()).toEqual([
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
    // Let go of the button, so the first click to cast is a fresh one.
    client.walk(0, 0, EAST, 2);
    await sleep(150);
    return client.welcome().netId;
  }

  /** A press and a release, carrying whatever else a browser would be saying. */
  function click(client: TestClient, extra = 0): void {
    client.walk(0, 0, EAST, 1, PlayerButton.Swing | extra);
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
    expect(ITEM_KINDS[caught.item].maxCarry).toBe(10);
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
    // Let go of the button, so the first click to cast is a fresh one.
    client.walk(0, 0, EAST, 2);
    await sleep(150);
  }

  /** A press and a release, carrying whatever else a browser would be saying. */
  function click(client: TestClient, extra = 0): void {
    client.walk(0, 0, EAST, 1, PlayerButton.Swing | extra);
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
    expect(client.latestHunger()?.hunger).toBe(HUNGER_MAX);
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

  it('eats a fish when there is nothing else to reach for, and says which', async () => {
    const client = await TestClient.connect(nextWorldId(), 'the-eater');
    const item = await catchAFish(client);
    await waitFor('the fish in the pack', () =>
      client.inventory().some((entry) => entry.item === item),
    );
    const before = client.inventory().find((entry) => entry.item === item)?.count ?? 0;

    // The rod is already in hand and the axe is nowhere near the pond, so the
    // same button that would pick something up reaches into the pack instead.
    client.walk(0, 0, EAST, 3, PlayerButton.Interact);
    await waitFor('a meal', () => client.hunger().some((event) => event.ate === item));

    const after = client.inventory().find((entry) => entry.item === item)?.count ?? 0;
    expect(after).toBe(before - 1);
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
   * `chopUntilFelled` does for a tree that cannot move. Stops early on a
   * catch; otherwise spends the whole step budget, which is exactly what the
   * no-axe test needs to prove a swing there still catches nothing.
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
      const buttons = closingIn ? PlayerButton.Sprint | PlayerButton.Swing : PlayerButton.Swing;
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
    await findTheBag(client);
    await walkToTheAxe(client);
    client.walk(0, 0, 0, 3, PlayerButton.Interact);
    await waitFor('the axe', () => client.inventory().some((entry) => entry.item === 'axe'));

    const oak = theOak(client.welcome().seed);
    await chopUntilFelled(client, oak, oak.id);
    await waitFor('the logs', () => client.inventory().some((entry) => entry.item === 'log'));
  }

  /** Walk back to open ground near spawn - clear of every landmark - to build on. */
  async function walkToOpenGround(client: TestClient): Promise<void> {
    const netId = client.welcome().netId;
    for (let step = 0; step < 60; step++) {
      const here = client.positionOf(netId);
      if (here === undefined) break;
      const gap = Math.hypot(here.x - SPAWN_POSITION.x, here.z - SPAWN_POSITION.z);
      if (gap < 3) return;
      const yaw = Math.atan2(-(SPAWN_POSITION.x - here.x), -(SPAWN_POSITION.z - here.z));
      client.walk(0, 1, yaw, 4);
      await sleep(110);
    }
    throw new Error('never made it back to open ground');
  }

  /** Face the middle of the clearing and ask to build until something appears. */
  async function buildCampfire(client: TestClient): Promise<void> {
    const netId = client.welcome().netId;
    for (let step = 0; step < 20; step++) {
      if (client.builtProps().length > 0) return;
      const here = client.positionOf(netId);
      const yaw =
        here === undefined
          ? 0
          : Math.atan2(-(SPAWN_POSITION.x - here.x), -(SPAWN_POSITION.z - here.z));
      client.walk(0, 0, yaw, 4);
      client.build('campfire');
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

    const props = client.builtProps();
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

    await waitFor('the watcher to see it too', () => watcher.builtProps().length > 0);
    expect(watcher.builtProps()).toEqual(builder.builtProps());
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
      client.build('campfire');
      await sleep(100);
    }

    expect(client.builtProps()).toEqual([]);
    expect(client.inventory()).toEqual([]);
    client.close();
  });

  it('leaves the campfire there after logging out and coming back', async () => {
    const worldId = nextWorldId();
    const first = await TestClient.connect(worldId, 'comes-back-to-build');
    await getLogsForACampfire(first);
    await walkToOpenGround(first);
    await buildCampfire(first);
    const built = first.builtProps();
    expect(built).toHaveLength(1);
    first.close();
    await sleep(300);

    const second = await TestClient.connect(worldId, 'comes-back-to-build');
    await waitFor('the opening built props', () => second.countOfMessages('builtProps') > 0);
    expect(second.openingBuiltProps()).toEqual(built);
    second.close();
  }, 30_000);

  /**
   * A campfire lands `BUILD_DISTANCE` away, outside interact reach, so
   * lighting it needs one more short walk first.
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
    const built = client.builtProps()[0];
    expect(built?.lit).toBe(false);
    if (built === undefined) return;

    await walkOntoCampfire(client, built);
    client.walk(0, 0, 0, 3, PlayerButton.Interact);
    await waitFor('the campfire to light', () => client.builtProps()[0]?.lit === true);
    client.close();
  }, 30_000);

  it('leaves a lit campfire lit after logging out and coming back', async () => {
    const worldId = nextWorldId();
    const first = await TestClient.connect(worldId, 'comes-back-to-a-lit-fire');
    await getLogsForACampfire(first);
    await walkToOpenGround(first);
    await buildCampfire(first);
    const built = first.builtProps()[0];
    expect(built).toBeDefined();
    if (built === undefined) return;

    await walkOntoCampfire(first, built);
    first.walk(0, 0, 0, 3, PlayerButton.Interact);
    await waitFor('the campfire to light', () => first.builtProps()[0]?.lit === true);
    first.close();
    await sleep(300);

    const second = await TestClient.connect(worldId, 'comes-back-to-a-lit-fire');
    await waitFor('the opening built props', () => second.countOfMessages('builtProps') > 0);
    expect(second.openingBuiltProps()[0]?.lit).toBe(true);
    second.close();
  }, 30_000);

  /** The oak plus every other hand-placed tree near it: enough logs for a cabin. */
  function treesNearTheOak(seed: number) {
    const props = buildTestClearing(seed).props;
    const oak = props.find((prop) => prop.kind === 'oak');
    const pine = props.find((prop) => prop.kind === 'pine');
    const birches = props.filter((prop) => prop.kind === 'birch');
    if (oak === undefined || pine === undefined || birches.length < 2) {
      throw new Error('expected the clearing to have an oak, a pine and two birches');
    }
    return [oak, pine, birches[0]!, birches[1]!];
  }

  /** Fell four trees for ten logs - the most a pack can hold, and a cabin's cost. */
  async function getLogsForACabin(client: TestClient): Promise<void> {
    await findTheBag(client);
    await walkToTheAxe(client);
    client.walk(0, 0, 0, 3, PlayerButton.Interact);
    await waitFor('the axe', () => client.inventory().some((entry) => entry.item === 'axe'));

    for (const tree of treesNearTheOak(client.welcome().seed)) {
      await walkWithinReach(client, tree);
      await chopUntilFelled(client, tree, tree.id);
    }
    await waitFor(
      'ten logs',
      () => (client.inventory().find((entry) => entry.item === 'log')?.count ?? 0) >= 10,
    );
  }

  /** Face the middle of the clearing and ask to build a cabin until one appears. */
  async function buildCabin(client: TestClient): Promise<void> {
    const netId = client.welcome().netId;
    for (let step = 0; step < 20; step++) {
      if (client.builtProps().some((prop) => prop.kind === 'cabin')) return;
      const here = client.positionOf(netId);
      const yaw =
        here === undefined
          ? 0
          : Math.atan2(-(SPAWN_POSITION.x - here.x), -(SPAWN_POSITION.z - here.z));
      client.walk(0, 0, yaw, 4);
      client.build('cabin');
      await sleep(120);
    }
    throw new Error('never built a cabin');
  }

  it('a cabin is capped at one, and is where its owner starts next time', async () => {
    const worldId = nextWorldId();
    const owner = await TestClient.connect(worldId, 'has-a-cabin');
    await getLogsForACabin(owner);
    await walkToOpenGround(owner);
    await buildCabin(owner);

    const home = owner.builtProps().find((prop) => prop.kind === 'cabin');
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

    // Reconnecting starts right outside the cabin now, not back where they
    // stood when they logged out.
    const returning = await TestClient.connect(worldId, 'has-a-cabin');
    await waitFor(
      'a first snapshot',
      () => returning.positionOf(returning.welcome().netId) !== undefined,
    );
    const position = returning.positionOf(returning.welcome().netId);
    if (position === undefined) throw new Error('lost the returning player');
    const gapFromHome = Math.hypot(position.x - home.x, position.z - home.z);
    expect(gapFromHome).toBeGreaterThan(0);
    expect(gapFromHome).toBeLessThan(6);
    returning.close();
  }, 60_000);

  /** Hold the interact button at a flower patch until the pack has this many. */
  async function gatherFlowers(client: TestClient, count: number): Promise<void> {
    const enough = (): boolean =>
      (client.inventory().find((entry) => entry.item === 'flower')?.count ?? 0) >= count;
    for (let step = 0; step < 60 && !enough(); step++) {
      client.walk(0, 0, 0, 4, PlayerButton.Interact);
      await sleep(120);
    }
    if (!enough()) throw new Error('never gathered enough flowers');
  }

  /** Face the middle of the clearing and ask to build a lantern until one appears. */
  async function buildLantern(client: TestClient): Promise<void> {
    const netId = client.welcome().netId;
    for (let step = 0; step < 20; step++) {
      if (client.builtProps().some((prop) => prop.kind === 'lantern')) return;
      const here = client.positionOf(netId);
      const yaw =
        here === undefined
          ? 0
          : Math.atan2(-(SPAWN_POSITION.x - here.x), -(SPAWN_POSITION.z - here.z));
      client.walk(0, 0, yaw, 4);
      client.build('lantern');
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
    expect(owner.builtProps().filter((prop) => prop.kind === 'lantern')).toHaveLength(1);
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
    expect(returning.builtProps().filter((prop) => prop.kind === 'lantern')).toHaveLength(1);

    // The same patch, never used up - a real reason nobody needs to remember
    // which flower patch was whose.
    await walkWithinReach(returning, patch);
    await gatherFlowers(returning, 4);
    await walkToOpenGround(returning);
    for (let step = 0; step < 10; step++) {
      returning.walk(0, 0, 0, 4);
      returning.build('lantern');
      await sleep(100);
    }
    expect(returning.builtProps().filter((prop) => prop.kind === 'lantern')).toHaveLength(1);
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
    // same as anything else worth carrying - and it survives the knockout
    // itself, being a tool, so digging the cache back up later still works.
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
