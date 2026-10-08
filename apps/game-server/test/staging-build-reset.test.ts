import { env, runInDurableObject } from 'cloudflare:test';
import { expect, it } from 'vitest';
import { buildableKindIndex, itemIndex } from '@acorn/shared';
import type { WorldEnv } from '../src/env';
import { TestClient, waitFor } from './helpers';

const RESET_ID = 'original-test-builds-2026-10-07';

it('clears all main-world builds once, preserving characters and other world state', async () => {
  const stub = env.WORLD.get(env.WORLD.idFromName('home-clearing'));
  await runInDurableObject(stub, (instance, state) => {
    // Apply the same staging-only binding used by the constructor. The local
    // test environment leaves it unset so other tests keep their worlds.
    const runtime = instance as unknown as {
      env: WorldEnv;
      resetStagingBuildsOnce(): void;
    };
    const sql = state.storage.sql;
    sql.exec(
      'INSERT INTO players (player_key,x,y,z,facing_yaw,updated_at,name) VALUES (?,0,0,0,0,?,?)',
      'saved-owner',
      Date.now(),
      'Acorn',
    );
    sql.exec(
      'INSERT INTO player_items (player_key,item_index,count) VALUES (?,?,3)',
      'saved-owner',
      itemIndex('log'),
    );
    for (const [id, kind, owner] of [
      [7, 'cabin', 'saved-owner'],
      [8, 'fence', null],
      [9, 'campfire', 'old-test-owner'],
    ] as const) {
      sql.exec(
        'INSERT INTO built_props (id,kind_index,x,z,yaw,built_at_ms,owner_key) VALUES (?,?,0,0,0,?,?)',
        id,
        buildableKindIndex(kind),
        Date.now(),
        owner,
      );
    }
    sql.exec('INSERT INTO home_chests (home_id,slots) VALUES (7,?)', '[]');
    sql.exec('INSERT INTO home_gardens (home_id,plots) VALUES (7,?)', '[]');
    sql.exec(
      'INSERT INTO buried_caches (id,owner_key,x,z,buried_at_ms) VALUES (41,?,5,5,?)',
      'saved-owner',
      Date.now(),
    );
    sql.exec(
      'INSERT INTO world_meta (key,value) VALUES (?,?)',
      'home-decorations',
      JSON.stringify([{ id: 1, homeId: 7, kind: 'cedarBench', x: 0, z: 0, yaw: 0 }]),
    );

    expect(instance.status()).toMatchObject({ players: 0, savedCharacters: 1, builtStructures: 3 });
    runtime.resetStagingBuildsOnce();
    expect(instance.status().builtStructures).toBe(3);
    runtime.env = { ...runtime.env, WORLD_STAGING_BUILD_RESET: RESET_ID };
    runtime.resetStagingBuildsOnce();
    expect(instance.status()).toMatchObject({ players: 0, savedCharacters: 1, builtStructures: 0 });
    for (const table of ['home_chests', 'home_gardens'])
      expect(sql.exec(`SELECT * FROM ${table}`).toArray()).toEqual([]);
    expect(
      sql
        .exec<{ value: string }>('SELECT value FROM world_meta WHERE key = ?', 'home-decorations')
        .one().value,
    ).toBe('[]');
    expect(sql.exec('SELECT * FROM player_items').toArray()).toHaveLength(1);
    expect(sql.exec('SELECT * FROM buried_caches').toArray()).toHaveLength(1);

    sql.exec(
      'INSERT INTO built_props (id,kind_index,x,z,built_at_ms) VALUES (10,?,0,0,?)',
      buildableKindIndex('fence'),
      Date.now(),
    );
    runtime.resetStagingBuildsOnce();
    expect(instance.status().builtStructures).toBe(1);
  });

  const visitor = await TestClient.connect('home-clearing', 'reset-visitor');
  try {
    await waitFor('opening buildings', () => visitor.countOfMessages('builtProps') > 0);
    expect(visitor.openingBuiltProps().map((prop) => prop.id)).toEqual([10]);
    await runInDurableObject(stub, (instance) => {
      expect(instance.status()).toMatchObject({
        players: 1,
        savedCharacters: 1,
        builtStructures: 1,
      });
    });
  } finally {
    visitor.close();
  }
});

it('does not clear other worlds even with the staging reset binding', async () => {
  const stub = env.WORLD.get(env.WORLD.idFromName(`other-staging-${Date.now()}`));
  await runInDurableObject(stub, (instance, state) => {
    const runtime = instance as unknown as { env: WorldEnv; resetStagingBuildsOnce(): void };
    state.storage.sql.exec(
      'INSERT INTO built_props (id,kind_index,x,z,built_at_ms) VALUES (7,?,0,0,?)',
      buildableKindIndex('cabin'),
      Date.now(),
    );
    runtime.env = { ...runtime.env, WORLD_STAGING_BUILD_RESET: RESET_ID };
    runtime.resetStagingBuildsOnce();
    expect(instance.status().builtStructures).toBe(1);
  });
});
