import { env, runInDurableObject } from 'cloudflare:test';
import { expect, it } from 'vitest';

import { TestClient, sleep, waitFor } from './helpers';

/** What a browser was last told about the lake, or null if it has not been told. */
function lakeIceSeenBy(client: TestClient): boolean | null {
  const told = client.received.filter((message) => message.type === 'lakeIce');
  const last = told[told.length - 1];
  return last?.type === 'lakeIce' ? last.frozen : null;
}

async function join(worldId: string, key: string, season?: string): Promise<TestClient> {
  const client = await TestClient.connect(worldId, key, season);
  await waitFor('welcome', () => client.received.some((message) => message.type === 'welcome'));
  return client;
}

it('tells a browser the lake is frozen when the first one in asks for winter', async () => {
  const worldId = `ice-winter-${Date.now()}`;
  const client = await join(worldId, 'ice-owner', 'winter');
  expect(lakeIceSeenBy(client)).toBe(true);
  client.close();
  await sleep(250);
});

it('tells a browser the lake is open when the first one in asks for summer', async () => {
  const worldId = `ice-summer-${Date.now()}`;
  const client = await join(worldId, 'ice-owner', 'summer');
  expect(lakeIceSeenBy(client)).toBe(false);
  client.close();
  await sleep(250);
});

it('keeps the season the first one in asked for when somebody else joins later', async () => {
  const worldId = `ice-later-${Date.now()}`;
  const first = await join(worldId, 'ice-first', 'summer');
  const second = await join(worldId, 'ice-second', 'winter');
  expect(lakeIceSeenBy(first)).toBe(false);
  expect(lakeIceSeenBy(second)).toBe(false);
  first.close();
  second.close();
  await sleep(250);
});

it('ignores a season that is not one of the four', async () => {
  const worldId = `ice-nonsense-${Date.now()}`;
  const client = await join(worldId, 'ice-owner', 'blizzard');
  const stub = env.WORLD.get(env.WORLD.idFromName(worldId));
  await runInDurableObject(stub, (instance) => {
    const world = instance as unknown as { testSeason(url: URL): string | null };
    expect(world.testSeason(new URL('https://game.test/?season=blizzard'))).toBeNull();
    expect(world.testSeason(new URL('https://game.test/?season=winter'))).toBe('winter');
  });
  client.close();
  await sleep(250);
});

it('takes no notice of a season where this server is not set up for testing', async () => {
  const worldId = `ice-real-${Date.now()}`;
  const client = await join(worldId, 'ice-owner');
  const stub = env.WORLD.get(env.WORLD.idFromName(worldId));
  await runInDurableObject(stub, (instance) => {
    const world = instance as unknown as {
      env: Record<string, unknown>;
      testSeason(url: URL): string | null;
    };
    const url = new URL('https://game.test/?season=winter');
    const testing = world.env;
    world.env = { ...testing, WORLD_ALLOW_TEST_SEASON: undefined };
    expect(world.testSeason(url)).toBeNull();
    world.env = { ...testing, WORLD_ALLOW_TEST_SEASON: '0' };
    expect(world.testSeason(url)).toBeNull();
    world.env = testing;
    expect(world.testSeason(url)).toBe('winter');
  });
  client.close();
  await sleep(250);
});
