import { env, runInDurableObject } from 'cloudflare:test';
import { expect, it } from 'vitest';
import {
  HOME_FACILITIES,
  homeRoomScale,
  buildableKindIndex,
  type GardenState,
  type WorldSimulation,
} from '@acorn/shared';
import { TestClient, sleep, waitFor } from './helpers';
const lastGarden = (client: TestClient) =>
  client.received
    .filter((message): message is GardenState & { type: 'garden' } => message.type === 'garden')
    .at(-1);
it('persists a private garden and its harvest across an empty world', async () => {
  const worldId = `garden-${Date.now()}`;
  const owner = await TestClient.connect(worldId, 'gardener');
  await waitFor('welcome', () => owner.received.some((message) => message.type === 'welcome'));
  const id = owner.welcome().netId,
    stub = env.WORLD.get(env.WORLD.idFromName(worldId));
  await runInDurableObject(stub, (instance, state) => {
    const sim = (instance as unknown as { simulation: WorldSimulation }).simulation;
    sim.restoreBuiltProps([
      {
        id: 7,
        kind: 'largeCabin',
        x: 0,
        z: -4.2,
        yaw: 0,
        lit: false,
        ownerKey: 'gardener',
        litUntilMs: null,
      },
    ]);
    const scale = homeRoomScale('largeCabin'),
      spot = HOME_FACILITIES.garden;
    sim.placePlayer(id, { x: spot.x * scale - 0.75, y: 0, z: spot.z * scale }, 0, 7);
    Object.assign(sim.inventoryOf(id), { berry: 1 });
    state.storage.sql.exec(
      'INSERT INTO built_props (id,kind_index,x,z,yaw,built_at_ms,owner_key) VALUES (?,?,?,?,?,?,?)',
      7,
      buildableKindIndex('largeCabin'),
      0,
      -4.2,
      0,
      Date.now(),
      'gardener',
    );
  });
  owner.garden({ action: 'plant', plot: 0, crop: 'berry' });
  await waitFor('planted', () => lastGarden(owner)?.plots[0]?.crop === 'berry');
  await runInDurableObject(stub, (_instance, state) => {
    const row = state.storage.sql
      .exec<{ plots: string }>('SELECT plots FROM home_gardens WHERE home_id=7')
      .one();
    expect(JSON.parse(row.plots)[0].growTicks).toBeGreaterThan(0);
    state.storage.sql.exec(
      'UPDATE home_gardens SET plots=? WHERE home_id=7',
      JSON.stringify([
        { crop: 'berry', growTicks: 0 },
        { crop: null, growTicks: 0 },
        { crop: null, growTicks: 0 },
      ]),
    );
  });
  owner.close();
  await sleep(350);
  // Empty-world saving is authoritative; set a ripe fixture after shutdown.
  await runInDurableObject(stub, (_instance, state) =>
    state.storage.sql.exec(
      'UPDATE home_gardens SET plots=? WHERE home_id=7',
      JSON.stringify([
        { crop: 'berry', growTicks: 0 },
        { crop: null, growTicks: 0 },
        { crop: null, growTicks: 0 },
      ]),
    ),
  );
  const returned = await TestClient.connect(worldId, 'gardener');
  await waitFor(
    'restored garden',
    () =>
      lastGarden(returned)?.plots[0]?.growTicks === 0 &&
      lastGarden(returned)?.plots[0]?.crop === 'berry',
  );
  const visitor = await TestClient.connect(worldId, 'garden-visitor');
  await waitFor('visitor welcome', () =>
    visitor.received.some((message) => message.type === 'welcome'),
  );
  await runInDurableObject(stub, (instance) => {
    const sim = (instance as unknown as { simulation: WorldSimulation }).simulation;
    const spot = HOME_FACILITIES.garden,
      scale = homeRoomScale('largeCabin');
    for (const netId of [returned.welcome().netId, visitor.welcome().netId])
      sim.placePlayer(netId, { x: spot.x * scale - 0.75, y: 0, z: spot.z * scale }, 0, 7);
  });
  visitor.garden({ action: 'harvest', plot: 0 });
  await waitFor('private refusal', () => lastGarden(visitor)?.reason === 'private');
  returned.garden({ action: 'harvest', plot: 0 });
  await waitFor('harvest', () =>
    returned.inventory().some((entry) => entry.item === 'berry' && entry.count === 3),
  );
  await runInDurableObject(stub, (_instance, state) =>
    expect(
      JSON.parse(
        state.storage.sql
          .exec<{ plots: string }>('SELECT plots FROM home_gardens WHERE home_id=7')
          .one().plots,
      )[0].crop,
    ).toBeNull(),
  );
  visitor.close();
  returned.close();
  await sleep(250);
});
