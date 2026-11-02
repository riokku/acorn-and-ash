import { env, runInDurableObject } from 'cloudflare:test';
import { expect, it } from 'vitest';

import { TestClient, sleep, waitFor } from './helpers';

/**
 * The browser tests' shortcuts (decision 0278): standing next to a target
 * instead of walking there, and trees back in seconds. Only a server set up
 * for the browser tests honours either.
 */

type ShortcutWorld = {
  env: Record<string, unknown>;
  simulation: { regrowMinSeconds: number } | null;
  testQuickRegrow(url: URL): boolean;
};

async function join(worldId: string, key: string, quickRegrow = false): Promise<TestClient> {
  const client = await TestClient.connect(worldId, key, undefined, false, quickRegrow);
  await waitFor('a first snapshot', () =>
    client.received.some((message) => message.type === 'snapshot'),
  );
  return client;
}

function distanceFrom(client: TestClient, spot: { x: number; z: number }): number {
  const here = client.positionOf(client.welcome().netId);
  return here === undefined ? Infinity : Math.hypot(here.x - spot.x, here.z - spot.z);
}

it('puts a browser test player where it asked to stand', async () => {
  const client = await join(`place-${Date.now()}`, 'place-owner');
  const spot = { x: 6.5, z: -9.25, yaw: 1.2 };
  client.testPlace(spot);
  await waitFor('the player to be moved', () => distanceFrom(client, spot) < 0.1);
  client.close();
  await sleep(250);
});

it('ignores a placement where this server is not set up for the browser tests', async () => {
  const worldId = `place-real-${Date.now()}`;
  const client = await join(worldId, 'place-owner');
  const stub = env.WORLD.get(env.WORLD.idFromName(worldId));
  let testing: Record<string, unknown> = {};
  await runInDurableObject(stub, (instance) => {
    const world = instance as unknown as ShortcutWorld;
    testing = world.env;
    world.env = { ...testing, WORLD_ALLOW_TEST_SHORTCUTS: undefined };
  });

  const spot = { x: 6.5, z: -9.25, yaw: 1.2 };
  const before = client.positionOf(client.welcome().netId);
  client.testPlace(spot);
  await sleep(500);
  expect(client.positionOf(client.welcome().netId)).toEqual(before);
  expect(distanceFrom(client, spot)).toBeGreaterThan(1);

  await runInDurableObject(stub, (instance) => {
    (instance as unknown as ShortcutWorld).env = testing;
  });
  client.close();
  await sleep(250);
});

it('brings trees back in seconds when the first browser test in asks', async () => {
  const worldId = `quick-regrow-${Date.now()}`;
  const client = await join(worldId, 'regrow-owner', true);
  const stub = env.WORLD.get(env.WORLD.idFromName(worldId));
  await runInDurableObject(stub, (instance) => {
    // Four seconds, against the five these tests otherwise configure.
    expect((instance as unknown as ShortcutWorld).simulation?.regrowMinSeconds).toBe(4);
  });
  client.close();
  await sleep(250);
});

it('takes no notice of quick regrowth where this server is not set up for the browser tests', async () => {
  const worldId = `quick-regrow-real-${Date.now()}`;
  const client = await join(worldId, 'regrow-owner');
  const stub = env.WORLD.get(env.WORLD.idFromName(worldId));
  await runInDurableObject(stub, (instance) => {
    const world = instance as unknown as ShortcutWorld;
    const url = new URL('https://game.test/?quickRegrow');
    const testing = world.env;
    world.env = { ...testing, WORLD_ALLOW_TEST_SHORTCUTS: undefined };
    expect(world.testQuickRegrow(url)).toBe(false);
    world.env = { ...testing, WORLD_ALLOW_TEST_SHORTCUTS: '0' };
    expect(world.testQuickRegrow(url)).toBe(false);
    world.env = testing;
    expect(world.testQuickRegrow(url)).toBe(true);
    // Without being asked, the world keeps its configured five seconds.
    expect(world.simulation?.regrowMinSeconds).toBe(5);
  });
  client.close();
  await sleep(250);
});
