import { env, runInDurableObject } from 'cloudflare:test';
import { expect, it } from 'vitest';
import { AXE_PICKUP_ID, BAG_PICKUP_ID, itemIndex } from '@acorn/shared';

it('lets a world saved before the change keep the tools its players are already holding', async () => {
  const stub = env.WORLD.get(env.WORLD.idFromName(`pickups-migrate-${Date.now()}`));
  const rows = await runInDurableObject(stub, (instance, state) => {
    const sql = state.storage.sql;
    // Put the world back as it was saved when the axe, bag and rod were found
    // once for the whole world.
    sql.exec('DROP TABLE player_pickups_taken');
    sql.exec(
      'CREATE TABLE pickups_taken (pickup_id INTEGER PRIMARY KEY, net_id INTEGER NOT NULL, taken_at INTEGER NOT NULL)',
    );
    // The axe and bag were found, by somebody; the rod never was.
    for (const id of [AXE_PICKUP_ID, BAG_PICKUP_ID])
      sql.exec('INSERT INTO pickups_taken VALUES (?, 1, 0)', id);
    const give = (key: string, item: 'axe' | 'bag' | 'rod'): void => {
      sql.exec(
        'INSERT INTO player_items (player_key, item_index, count) VALUES (?, ?, 1)',
        key,
        itemIndex(item),
      );
    };
    give('has-axe-and-bag', 'axe');
    give('has-axe-and-bag', 'bag');
    give('has-rod-only', 'rod');
    (instance as unknown as { createPlayerPickups(): void }).createPlayerPickups();
    return sql
      .exec<{ player_key: string; pickup_id: number }>(
        'SELECT player_key, pickup_id FROM player_pickups_taken ORDER BY player_key, pickup_id',
      )
      .toArray();
  });

  // Holding something that was found counts as having found it. Holding a rod
  // nobody ever found in the clearing says nothing about the clearing's rod.
  expect(rows).toEqual([
    { player_key: 'has-axe-and-bag', pickup_id: AXE_PICKUP_ID },
    { player_key: 'has-axe-and-bag', pickup_id: BAG_PICKUP_ID },
  ]);
});

it('does not run the migration again once the new table exists', async () => {
  const stub = env.WORLD.get(env.WORLD.idFromName(`pickups-again-${Date.now()}`));
  const count = await runInDurableObject(stub, (instance, state) => {
    const sql = state.storage.sql;
    sql.exec(
      'CREATE TABLE pickups_taken (pickup_id INTEGER PRIMARY KEY, net_id INTEGER NOT NULL, taken_at INTEGER NOT NULL)',
    );
    sql.exec('INSERT INTO pickups_taken VALUES (?, 1, 0)', AXE_PICKUP_ID);
    sql.exec(
      'INSERT INTO player_items (player_key, item_index, count) VALUES (?, ?, 1)',
      'carries-an-axe',
      itemIndex('axe'),
    );
    // A character who deleted themselves and started again has nothing marked.
    (instance as unknown as { createPlayerPickups(): void }).createPlayerPickups();
    return sql.exec('SELECT * FROM player_pickups_taken').toArray().length;
  });
  expect(count).toBe(0);
});
