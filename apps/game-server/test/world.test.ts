import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import {
  AXE_PICKUP_ID,
  AXE_STUMP,
  PICKUP_REACH,
  PlayerButton,
  SNAPSHOT_HZ,
  TICK_HZ,
} from '@acorn/shared';

import { sleep, TestClient, waitFor } from './helpers';

/** Each test gets its own world so they cannot tread on each other. */
let worldCounter = 0;
const nextWorldId = (): string => `world-${++worldCounter}-${Math.random().toString(36).slice(2)}`;

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
    expect(snapshot.entities).toHaveLength(1);
    expect(snapshot.entities[0]?.netId).toBe(client.welcome().netId);
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
async function walkToTheAxe(client: TestClient): Promise<void> {
  await waitFor('a welcome', () => client.received.length > 0);
  const netId = client.welcome().netId;
  await waitFor('a first snapshot', () => client.positionOf(netId) !== undefined);

  for (let step = 0; step < 60; step++) {
    const here = client.positionOf(netId);
    if (here === undefined) break;
    const gap = Math.hypot(here.x - AXE_STUMP.x, here.z - AXE_STUMP.z);
    if (gap < PICKUP_REACH - 0.4) return;
    // Walking forward is walking down -Z, so this is the heading that lines up.
    const yaw = Math.atan2(-(AXE_STUMP.x - here.x), -(AXE_STUMP.z - here.z));
    client.walk(0, 1, yaw, 4);
    await sleep(110);
  }
  const ended = client.positionOf(netId);
  throw new Error(`Never reached the stump; stopped at ${ended?.x}, ${ended?.z}`);
}

describe('finding the axe', () => {
  it('tells a new player they have nothing and that nothing has been taken', async () => {
    const client = await TestClient.connect(nextWorldId(), 'fresh-player');
    await waitFor('the opening messages', () => client.countOfMessages('inventory') > 0);

    expect(client.inventory()).toEqual([]);
    expect(client.takenPickups()).toEqual([]);
    client.close();
  });

  it('hands over the axe when a player reaches for it', async () => {
    const client = await TestClient.connect(nextWorldId(), 'axe-finder');
    await walkToTheAxe(client);

    client.walk(0, 0, 0, 3, PlayerButton.Interact);
    await waitFor('the axe', () => client.inventory().length > 0);

    expect(client.inventory()).toEqual([{ item: 'axe', count: 1 }]);
    expect(client.takenPickups()).toEqual([AXE_PICKUP_ID]);
    client.close();
  });

  it('still has the axe after logging out and coming back', async () => {
    const worldId = nextWorldId();
    const first = await TestClient.connect(worldId, 'returning-player');
    await walkToTheAxe(first);
    first.walk(0, 0, 0, 3, PlayerButton.Interact);
    await waitFor('the axe', () => first.inventory().length > 0);
    first.close();
    await sleep(200);

    const second = await TestClient.connect(worldId, 'returning-player');
    await waitFor('the opening messages', () => second.countOfMessages('inventory') > 0);

    expect(second.inventory()).toEqual([{ item: 'axe', count: 1 }]);
    // And it is not sitting in the stump waiting to be found all over again.
    expect(second.takenPickups()).toEqual([AXE_PICKUP_ID]);
    second.close();
  });

  it('tells a second player the axe is already gone', async () => {
    const worldId = nextWorldId();
    const finder = await TestClient.connect(worldId, 'the-finder');
    await walkToTheAxe(finder);
    finder.walk(0, 0, 0, 3, PlayerButton.Interact);
    await waitFor('the axe', () => finder.inventory().length > 0);

    const latecomer = await TestClient.connect(worldId, 'the-latecomer');
    await waitFor('the opening messages', () => latecomer.countOfMessages('inventory') > 0);

    expect(latecomer.inventory()).toEqual([]);
    expect(latecomer.takenPickups()).toEqual([AXE_PICKUP_ID]);
    finder.close();
    latecomer.close();
  });

  it('does not hand out an axe to somebody standing in the middle of the clearing', async () => {
    const client = await TestClient.connect(nextWorldId(), 'nowhere-near');
    await waitFor('the opening messages', () => client.countOfMessages('inventory') > 0);

    for (let i = 0; i < 6; i++) {
      client.walk(0, 0, 0, 4, PlayerButton.Interact);
      await sleep(80);
    }

    expect(client.inventory()).toEqual([]);
    expect(client.takenPickups()).toEqual([]);
    client.close();
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
    expect(second.latestSnapshot().entities).toHaveLength(1);
    expect(second.latestSnapshot().entities[0]?.netId).toBe(second.welcome().netId);
    second.close();
  });

  it('remembers the tick count and what was taken across the gap', async () => {
    const worldId = nextWorldId();
    const first = await TestClient.connect(worldId, 'the-finder');
    await walkToTheAxe(first);
    first.walk(0, 0, 0, 3, PlayerButton.Interact);
    await waitFor('the axe', () => first.inventory().length > 0);
    const tickBefore = first.latestSnapshot().tick;
    first.close();
    await sleep(300);

    const second = await TestClient.connect(worldId, 'somebody-else');
    await waitFor('some snapshots', () => second.snapshots().length >= 2);

    expect(second.takenPickups()).toEqual([AXE_PICKUP_ID]);
    // The world picks up where it left off rather than starting over.
    expect(second.latestSnapshot().tick).toBeGreaterThanOrEqual(tickBefore);
    second.close();
  });
});
