import { env, runInDurableObject } from 'cloudflare:test';
import { expect, it } from 'vitest';
import { ABANDONED_OWNER, buildableKindIndex } from '@acorn/shared';
import { TestClient, waitFor } from './helpers';

it('clears old orphaned buildings on waking while preserving saved owners and deletion deadlines', async () => {
  const worldId = `orphaned-builds-${Date.now()}`;
  const stub = env.WORLD.get(env.WORLD.idFromName(worldId));
  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql;
    sql.exec(
      'INSERT INTO players (player_key,x,y,z,facing_yaw,updated_at,name) VALUES (?,0,0,0,0,?,?)',
      'saved-owner',
      Date.now(),
      'Acorn',
    );
    for (const [id, kind, owner, deadline] of [
      [7, 'cabin', 'old-test-owner', null],
      [8, 'fence', 'old-test-owner', null],
      [9, 'cabin', 'saved-owner', null],
      [10, 'campfire', null, null],
      [11, 'fence', ABANDONED_OWNER, Date.now() + 60_000],
    ] as const) {
      sql.exec(
        'INSERT INTO built_props (id,kind_index,x,z,yaw,built_at_ms,owner_key,expires_at_ms) VALUES (?,?,0,?,0,?,?,?)',
        id,
        buildableKindIndex(kind),
        -id * 10,
        Date.now(),
        owner,
        deadline,
      );
    }
    for (const homeId of [7, 9]) {
      sql.exec('INSERT INTO home_chests (home_id,slots) VALUES (?,?)', homeId, '[]');
      sql.exec('INSERT INTO home_gardens (home_id,plots) VALUES (?,?)', homeId, '[]');
    }
    sql.exec(
      'INSERT INTO world_meta (key,value) VALUES (?,?)',
      'home-decorations',
      JSON.stringify([
        { id: 1, homeId: 7, kind: 'cedarBench', x: 0, z: 0, yaw: 0 },
        { id: 2, homeId: 9, kind: 'cedarBench', x: 0, z: 0, yaw: 0 },
      ]),
    );
  });

  const visitor = await TestClient.connect(worldId, 'cleanup-visitor');
  try {
    await waitFor('opening buildings', () => visitor.countOfMessages('builtProps') > 0);
    expect(
      visitor
        .openingBuiltProps()
        .map((prop) => prop.id)
        .sort((a, b) => a - b),
    ).toEqual([9, 10, 11]);
    await runInDurableObject(stub, (_instance, state) => {
      const sql = state.storage.sql;
      expect(sql.exec('SELECT id FROM built_props ORDER BY id').toArray()).toEqual([
        { id: 9 },
        { id: 10 },
        { id: 11 },
      ]);
      expect(sql.exec('SELECT home_id FROM home_chests').toArray()).toEqual([{ home_id: 9 }]);
      expect(sql.exec('SELECT home_id FROM home_gardens').toArray()).toEqual([{ home_id: 9 }]);
      const decor = sql
        .exec<{ value: string }>('SELECT value FROM world_meta WHERE key = ?', 'home-decorations')
        .one();
      expect(JSON.parse(decor.value)).toEqual([
        { id: 2, homeId: 9, kind: 'cedarBench', x: 0, z: 0, yaw: 0 },
      ]);
    });
  } finally {
    visitor.close();
  }
});
