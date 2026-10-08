import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import {
  ABANDONED_OWNER,
  CLOSE_CHARACTER_DELETED,
  buildableKindIndex,
  itemIndex,
  type WorldSimulation,
} from '@acorn/shared';
import { TestClient, sleep, waitFor } from './helpers';

/** Short enough to watch in a test: see `WORLD_ABANDONED_SECONDS` in vitest.config.ts. */
const ABANDONED_FOR_MS = 3000;

const CABIN_ID = 7;

let worlds = 0;
const nextWorldId = (): string => `delete-character-${Date.now()}-${++worlds}`;

const stubFor = (worldId: string) => env.WORLD.get(env.WORLD.idFromName(worldId));

const deleteCharacter = (worldId: string, playerKey: string) =>
  stubFor(worldId).fetch(`https://game.test/worlds/${worldId}/character?player=${playerKey}`, {
    method: 'DELETE',
  });

const characterOf = async (worldId: string, playerKey: string): Promise<{ made: boolean }> => {
  const response = await SELF.fetch(
    `https://game.test/worlds/${worldId}/character?player=${playerKey}`,
  );
  return response.json();
};

/** Chris's cabin, in storage and, if the world is awake, in the simulation too. */
async function buildCabinFor(worldId: string, playerKey: string): Promise<void> {
  await runInDurableObject(stubFor(worldId), (instance, state) => {
    const sim = (instance as unknown as { simulation: WorldSimulation | null }).simulation;
    sim?.restoreBuiltProps([
      {
        id: CABIN_ID,
        kind: 'cabin',
        x: 0,
        z: -20,
        yaw: 0,
        lit: false,
        ownerKey: playerKey,
        litUntilMs: null,
      },
    ]);
    state.storage.sql.exec(
      'INSERT INTO built_props (id,kind_index,x,z,yaw,built_at_ms,owner_key) VALUES (?,?,?,?,?,?,?)',
      CABIN_ID,
      buildableKindIndex('cabin'),
      0,
      -20,
      0,
      Date.now(),
      playerKey,
    );
  });
}

const cabinRow = (worldId: string) =>
  runInDurableObject(
    stubFor(worldId),
    (_instance, state) =>
      state.storage.sql
        .exec<{
          owner_key: string | null;
          locked: number;
          expires_at_ms: number | null;
        }>('SELECT owner_key, locked, expires_at_ms FROM built_props WHERE id = ?', CABIN_ID)
        .toArray()[0],
  );

async function rowsFor(worldId: string, playerKey: string): Promise<Record<string, number>> {
  return runInDurableObject(stubFor(worldId), (_instance, state) => {
    const counts: Record<string, number> = {};
    for (const table of [
      'players',
      'player_items',
      'player_meals',
      'player_home_skills',
      'player_sentinel',
      'player_blueprint_progress',
      'player_discoveries',
      'player_expeditions',
      'player_fishing_collection',
      'player_pickups_taken',
    ]) {
      counts[table] = state.storage.sql
        .exec<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table} WHERE player_key = ?`, playerKey)
        .one().n;
    }
    return counts;
  });
}

/** Somebody with a name, a pack and a first find, connected and settled in. */
async function joinWithACharacter(worldId: string, playerKey: string): Promise<TestClient> {
  const client = await TestClient.connect(worldId, playerKey);
  await waitFor('a welcome', () => client.received.some((message) => message.type === 'welcome'));
  client.hello('Acorn', 'knight', 'moss');
  await waitFor('their roster entry', () => client.roster().length > 0);
  const netId = client.welcome().netId;
  await runInDurableObject(stubFor(worldId), (instance, state) => {
    const sim = (instance as unknown as { simulation: WorldSimulation }).simulation;
    Object.assign(sim.inventoryOf(netId), { log: 5, stick: 2 });
    state.storage.sql.exec(
      'INSERT OR IGNORE INTO player_items (player_key, item_index, count) VALUES (?, ?, 9)',
      playerKey,
      itemIndex('flower'),
    );
    state.storage.sql.exec(
      'INSERT OR IGNORE INTO player_pickups_taken (player_key, pickup_id) VALUES (?, 1)',
      playerKey,
    );
  });
  return client;
}

describe('deleting a character', () => {
  it('forgets who they were, and hangs up on their tab so it does not come straight back', async () => {
    const worldId = nextWorldId();
    const key = 'deleter-forgets-all';
    const client = await joinWithACharacter(worldId, key);
    expect(await characterOf(worldId, key)).toMatchObject({ made: true, name: 'Acorn' });

    const response = await deleteCharacter(worldId, key);
    expect(await response.json()).toEqual({ ok: true, abandonedBuilds: 0 });

    await waitFor('the hang-up', () => client.closedWith !== null);
    expect(client.closedWith).toBe(CLOSE_CHARACTER_DELETED);
    expect(await characterOf(worldId, key)).toEqual({ made: false });
    expect(Object.values(await rowsFor(worldId, key)).every((count) => count === 0)).toBe(true);
  });

  it('does not save the character again when the hung-up socket finally closes', async () => {
    const worldId = nextWorldId();
    const key = 'deleter-stays-deleted';
    const client = await joinWithACharacter(worldId, key);

    await deleteCharacter(worldId, key);
    await waitFor('the hang-up', () => client.closedWith !== null);
    await sleep(300);

    expect(await characterOf(worldId, key)).toEqual({ made: false });
    expect(Object.values(await rowsFor(worldId, key)).every((count) => count === 0)).toBe(true);
  });

  it('lets them make a new character straight away, with a fresh pack and a name of their own', async () => {
    const worldId = nextWorldId();
    const key = 'deleter-starts-again';
    const first = await joinWithACharacter(worldId, key);
    await deleteCharacter(worldId, key);
    await waitFor('the hang-up', () => first.closedWith !== null);

    const second = await TestClient.connect(worldId, key);
    await waitFor('a welcome', () => second.received.some((message) => message.type === 'welcome'));
    second.hello('Ash', 'mage', 'plum');
    await waitFor('their roster entry', () => second.roster().length > 0);

    expect(second.roster()).toEqual([
      {
        netId: second.welcome().netId,
        name: 'Ash',
        character: 'mage',
        color: 'plum',
        skin: 'natural',
      },
    ]);
    // Nothing of the old pack, and the axe, bag and rod are all waiting again.
    expect(second.inventory()).toEqual([]);
    expect(second.takenPickups()).toEqual([]);
    second.close();
  });

  it('leaves everybody else in the world, and their characters, alone', async () => {
    const worldId = nextWorldId();
    const leaver = await joinWithACharacter(worldId, 'leaver-of-the-pair');
    const stayer = await joinWithACharacter(worldId, 'stayer-of-the-pair');

    await deleteCharacter(worldId, 'leaver-of-the-pair');
    await waitFor('the hang-up', () => leaver.closedWith !== null);

    expect(stayer.closedWith).toBeNull();
    const leaverId = leaver.welcome().netId;
    await waitFor('everybody to hear they left', () =>
      stayer.received.some((entry) => entry.type === 'playerLeft' && entry.netId === leaverId),
    );
    expect(await characterOf(worldId, 'stayer-of-the-pair')).toMatchObject({ made: true });
    expect((await rowsFor(worldId, 'stayer-of-the-pair')).players).toBe(1);
    stayer.close();
  });

  it('does nothing, harmlessly, for somebody with no character', async () => {
    const worldId = nextWorldId();
    const response = await deleteCharacter(worldId, 'never-made-one-here');
    expect(await response.json()).toEqual({ ok: true, abandonedBuilds: 0 });
    expect(response.status).toBe(200);
  });

  it('refuses a request with no valid player, and one from the public game-server routes', async () => {
    const worldId = nextWorldId();
    const noKey = await stubFor(worldId).fetch(`https://game.test/worlds/${worldId}/character`, {
      method: 'DELETE',
    });
    expect(noKey.status).toBe(400);

    const badKey = await deleteCharacter(worldId, 'x');
    expect(badKey.status).toBe(400);

    // Anybody can reach these, so they must never be a way to delete somebody else.
    const key = 'public-route-cannot-delete';
    const client = await joinWithACharacter(worldId, key);
    const viaPublicRoute = await SELF.fetch(
      `https://game.test/worlds/${worldId}/character?player=${key}`,
      { method: 'DELETE' },
    );
    expect(viaPublicRoute.status).toBe(404);
    expect(await characterOf(worldId, key)).toMatchObject({ made: true });
    client.close();
  });

  describe('what they built', () => {
    it('stays standing but locked, owned by nobody, then goes all at once', async () => {
      const worldId = nextWorldId();
      const key = 'deleter-with-a-cabin';
      const owner = await joinWithACharacter(worldId, key);
      const watcher = await joinWithACharacter(worldId, 'watcher-of-the-cabin');
      await buildCabinFor(worldId, key);
      await runInDurableObject(stubFor(worldId), (instance) => {
        // Said to everyone, as building it would have.
        (
          instance as unknown as { broadcastBuiltProps(sim: WorldSimulation): void }
        ).broadcastBuiltProps((instance as unknown as { simulation: WorldSimulation }).simulation);
      });
      await waitFor('the cabin to show as theirs', () =>
        owner.builtProps().some((prop) => prop.id === CABIN_ID && prop.yours),
      );

      await deleteCharacter(worldId, key);

      // Still there for everybody else, locked and nobody's.
      await waitFor('the cabin to show as locked', () =>
        watcher.builtProps().some((prop) => prop.id === CABIN_ID && prop.locked),
      );
      expect(watcher.builtProps().find((prop) => prop.id === CABIN_ID)?.yours).toBe(false);
      const stored = await cabinRow(worldId);
      expect(stored).toMatchObject({ owner_key: ABANDONED_OWNER, locked: 1 });
      expect(stored?.expires_at_ms).toBeGreaterThan(Date.now());
      expect(stored?.expires_at_ms).toBeLessThanOrEqual(Date.now() + ABANDONED_FOR_MS);

      // And when the time is up it is gone, from the world and from storage.
      await waitFor(
        'the cabin to disappear',
        () => !watcher.builtProps().some((prop) => prop.id === CABIN_ID),
        ABANDONED_FOR_MS + 4000,
      );
      expect(await cabinRow(worldId)).toBeUndefined();
      watcher.close();
    });

    it('is not handed back to a new character on the same account', async () => {
      const worldId = nextWorldId();
      const key = 'deleter-meets-their-cabin';
      const first = await joinWithACharacter(worldId, key);
      await buildCabinFor(worldId, key);
      await deleteCharacter(worldId, key);
      await waitFor('the hang-up', () => first.closedWith !== null);

      const second = await TestClient.connect(worldId, key);
      await waitFor('the opening built props', () => second.countOfMessages('builtProps') > 0);
      const cabin = second.openingBuiltProps().find((prop) => prop.id === CABIN_ID);
      expect(cabin).toMatchObject({ locked: true, yours: false });
      second.close();
    });

    it('goes in a world nobody was in, by the time somebody next comes', async () => {
      const worldId = nextWorldId();
      const key = 'deleter-in-an-empty-world';
      await buildCabinFor(worldId, key);

      const response = await deleteCharacter(worldId, key);
      expect(await response.json()).toEqual({ ok: true, abandonedBuilds: 1 });
      // Nobody is in the world, so nothing is left running - not even a timer.
      const asleep = await runInDurableObject(stubFor(worldId), (instance) => {
        const world = instance as unknown as {
          simulation: WorldSimulation | null;
          tickHandle: unknown;
        };
        return world.simulation === null && world.tickHandle === null;
      });
      expect(asleep).toBe(true);
      expect(await cabinRow(worldId)).toMatchObject({ owner_key: ABANDONED_OWNER, locked: 1 });

      await sleep(ABANDONED_FOR_MS + 500);
      // Still in storage - nothing was awake to take it away - but gone by the time
      // anybody sees the world.
      expect(await cabinRow(worldId)).toBeDefined();
      const visitor = await TestClient.connect(worldId, 'visitor-after-the-wait');
      await waitFor('the opening built props', () => visitor.countOfMessages('builtProps') > 0);
      expect(visitor.openingBuiltProps().some((prop) => prop.id === CABIN_ID)).toBe(false);
      expect(await cabinRow(worldId)).toBeUndefined();
      visitor.close();
    });

    it('also clears out the cabin’s chest', async () => {
      const worldId = nextWorldId();
      const key = 'deleter-with-a-chest';
      await buildCabinFor(worldId, key);
      await runInDurableObject(stubFor(worldId), (_instance, state) => {
        state.storage.sql.exec(
          'INSERT INTO home_chests (home_id, slots) VALUES (?, ?)',
          CABIN_ID,
          JSON.stringify([{ item: 'log', count: 4 }, ...Array.from({ length: 9 }, () => null)]),
        );
      });
      await deleteCharacter(worldId, key);
      await sleep(ABANDONED_FOR_MS + 500);

      const visitor = await TestClient.connect(worldId, 'visitor-after-the-chest');
      await waitFor('the opening built props', () => visitor.countOfMessages('builtProps') > 0);
      const chests = await runInDurableObject(stubFor(worldId), (_instance, state) =>
        state.storage.sql.exec('SELECT * FROM home_chests WHERE home_id = ?', CABIN_ID).toArray(),
      );
      expect(chests).toEqual([]);
      visitor.close();
    });
  });

  it('digs up what a knockout buried for them, at once', async () => {
    const worldId = nextWorldId();
    const key = 'deleter-with-a-cache';
    const client = await joinWithACharacter(worldId, key);
    const watcher = await joinWithACharacter(worldId, 'watcher-of-the-cache');
    await runInDurableObject(stubFor(worldId), (instance, state) => {
      const sim = (instance as unknown as { simulation: WorldSimulation }).simulation;
      sim.restoreBuriedCaches([
        { id: 41, ownerPlayerKey: key, x: 5, z: 5, items: [{ item: 'log', count: 3 }] },
        { id: 42, ownerPlayerKey: 'watcher-of-the-cache', x: 9, z: 9, items: [] },
      ]);
      const sql = state.storage.sql;
      for (const [id, owner] of [
        [41, key],
        [42, 'watcher-of-the-cache'],
      ] as const)
        sql.exec(
          'INSERT INTO buried_caches (id, owner_key, x, z, buried_at_ms) VALUES (?, ?, 5, 5, ?)',
          id,
          owner,
          Date.now(),
        );
      sql.exec(
        'INSERT INTO buried_cache_items (cache_id, item_index, count) VALUES (41, ?, 3)',
        itemIndex('log'),
      );
    });

    await deleteCharacter(worldId, key);
    await waitFor('the hang-up', () => client.closedWith !== null);

    await waitFor('the cache to leave the map', () =>
      watcher.buriedCaches().every((cache) => cache.x !== 5),
    );
    const left = await runInDurableObject(stubFor(worldId), (_instance, state) => ({
      caches: state.storage.sql
        .exec<{ id: number }>('SELECT id FROM buried_caches ORDER BY id')
        .toArray()
        .map((row) => row.id),
      items: state.storage.sql.exec('SELECT * FROM buried_cache_items').toArray().length,
    }));
    expect(left).toEqual({ caches: [42], items: 0 });
    watcher.close();
  });
});
