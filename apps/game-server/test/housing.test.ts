import { env, runInDurableObject } from 'cloudflare:test';
import { expect, it } from 'vitest';
import {
  buildableKindIndex,
  itemIndex,
  homeSpot,
  HOME_WAKE_SPOT,
  type WorldSimulation,
} from '@acorn/shared';
import { TestClient, sleep, waitFor } from './helpers';

it('learns a blueprint atomically, upgrades the same saved home, and restores skills and its chest on return', async () => {
  const worldId = `housing-${Date.now()}`;
  const owner = await TestClient.connect(worldId, 'housing-owner');
  await waitFor('owner welcome', () =>
    owner.received.some((message) => message.type === 'welcome'),
  );
  const id = owner.welcome().netId,
    stub = env.WORLD.get(env.WORLD.idFromName(worldId));
  await runInDurableObject(stub, (instance, state) => {
    const sim = (instance as unknown as { simulation: WorldSimulation }).simulation;
    sim.restoreBuiltProps([
      {
        id: 7,
        kind: 'tent',
        x: 0,
        z: -4.2,
        yaw: 0,
        lit: false,
        locked: true,
        ownerKey: 'housing-owner',
        litUntilMs: null,
      },
    ]);
    sim.restoreChest(7, [
      { item: 'bone', count: 3 },
      { item: 'log', count: 8 },
      ...Array(8).fill(null),
    ]);
    sim.placePlayer(id, { x: 0, y: 0, z: 0 }, 0);
    Object.assign(sim.inventoryOf(id), { teepeeBlueprint: 1, log: 4, stick: 16 });
    state.storage.sql.exec(
      'INSERT INTO built_props (id,kind_index,x,z,yaw,built_at_ms,owner_key,locked) VALUES (?,?,?,?,?,?,?,?)',
      7,
      buildableKindIndex('tent'),
      0,
      -4.2,
      0,
      Date.now(),
      'housing-owner',
      1,
    );
    state.storage.sql.exec(
      'INSERT INTO home_chests (home_id,slots) VALUES (?,?)',
      7,
      JSON.stringify([
        { item: 'bone', count: 3 },
        { item: 'log', count: 8 },
        ...Array(8).fill(null),
      ]),
    );
  });
  owner.useItem('teepeeBlueprint');
  await waitFor('learned skill', () =>
    owner.received.some((message) => message.type === 'homeSkills' && message.skills === 1),
  );
  await runInDurableObject(stub, (_instance, state) => {
    expect(
      state.storage.sql
        .exec<{ skills: number }>(
          'SELECT skills FROM player_home_skills WHERE player_key=?',
          'housing-owner',
        )
        .one().skills,
    ).toBe(1);
    expect(
      state.storage.sql
        .exec(
          'SELECT * FROM player_items WHERE player_key=? AND item_index=?',
          'housing-owner',
          itemIndex('teepeeBlueprint'),
        )
        .toArray(),
    ).toHaveLength(0);
  });
  owner.build({ kind: 'teepee', x: 0, z: -4.2, yaw: 0 });
  await waitFor('upgrade acknowledgement', () =>
    owner.received.some(
      (message) => message.type === 'homeBuildFeedback' && message.reason === null,
    ),
  );
  expect(owner.builtProps().find((prop) => prop.id === 7)).toMatchObject({
    kind: 'teepee',
    locked: true,
    yours: true,
  });
  await runInDurableObject(stub, (_instance, state) => {
    expect(
      state.storage.sql
        .exec<{ kind_index: number }>('SELECT kind_index FROM built_props WHERE id=7')
        .one().kind_index,
    ).toBe(buildableKindIndex('teepee'));
    const savedChest = state.storage.sql
      .exec<{ slots: string }>('SELECT slots FROM home_chests WHERE home_id=7')
      .one();
    expect(JSON.parse(savedChest.slots).slice(0, 2)).toEqual([{ item: 'bone', count: 3 }, null]);
    expect(
      state.storage.sql
        .exec('SELECT * FROM player_items WHERE player_key=?', 'housing-owner')
        .toArray(),
    ).toHaveLength(0);
  });
  owner.close();
  await sleep(300);
  const returned = await TestClient.connect(worldId, 'housing-owner');
  await waitFor('restored knowledge', () =>
    returned.received.some((message) => message.type === 'homeSkills' && message.skills === 1),
  );
  const wake = homeSpot(HOME_WAKE_SPOT, 'teepee');
  await waitFor('inside upgraded home', () => returned.latestSpace()?.space === 7);
  expect(returned.latestSpace()?.x).toBeCloseTo(wake.x, 2);
  returned.chest({ action: 'open' });
  await waitFor('restored chest', () =>
    returned.received.some(
      (message) => message.type === 'chest' && message.slots[0]?.item === 'bone',
    ),
  );
  returned.close();
}, 30_000);
