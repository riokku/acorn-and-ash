import { env, runInDurableObject } from 'cloudflare:test';
import { expect, it } from 'vitest';
import { MAX_MEAL_TICKS, itemIndex, type MealMessage, type WorldSimulation } from '@acorn/shared';
import { TestClient, sleep, waitFor } from './helpers';
const lastMeal = (client: TestClient) =>
  client.received.filter((message): message is MealMessage => message.type === 'meal').at(-1);
it('saves preparation with the eaten item, keeps it private and pauses the disconnected character', async () => {
  const worldId = `meal-${Date.now()}`,
    owner = await TestClient.connect(worldId, 'meal-owner');
  await waitFor('owner welcome', () =>
    owner.received.some((message) => message.type === 'welcome'),
  );
  const visitor = await TestClient.connect(worldId, 'meal-visitor');
  await waitFor('visitor welcome', () =>
    visitor.received.some((message) => message.type === 'welcome'),
  );
  const id = owner.welcome().netId,
    stub = env.WORLD.get(env.WORLD.idFromName(worldId));
  await runInDurableObject(stub, (instance) => {
    const sim = (instance as unknown as { simulation: WorldSimulation }).simulation;
    Object.assign(sim.inventoryOf(id), { trailRation: 1, berryTea: 1 });
  });
  owner.useItem('trailRation');
  await waitFor('ration benefit', () => lastMeal(owner)?.item === 'trailRation');
  expect(lastMeal(owner)?.ticksLeft).toBeGreaterThan(MAX_MEAL_TICKS - 40);
  await runInDurableObject(stub, (_instance, state) => {
    const meal = state.storage.sql
      .exec<{ item_index: number; ticks_left: number }>(
        'SELECT item_index,ticks_left FROM player_meals WHERE player_key=?',
        'meal-owner',
      )
      .one();
    expect(meal.item_index).toBe(itemIndex('trailRation'));
    expect(
      state.storage.sql
        .exec(
          'SELECT * FROM player_items WHERE player_key=? AND item_index=?',
          'meal-owner',
          itemIndex('trailRation'),
        )
        .toArray(),
    ).toHaveLength(0);
  });
  owner.useItem('berryTea');
  await waitFor('replacement', () => lastMeal(owner)?.item === 'berryTea');
  owner.close();
  await sleep(300);
  let paused = 0;
  await runInDurableObject(stub, (_instance, state) => {
    paused = state.storage.sql
      .exec<{ ticks_left: number }>(
        'SELECT ticks_left FROM player_meals WHERE player_key=?',
        'meal-owner',
      )
      .one().ticks_left;
  });
  await sleep(350);
  await runInDurableObject(stub, (_instance, state) =>
    expect(
      state.storage.sql
        .exec<{ ticks_left: number }>(
          'SELECT ticks_left FROM player_meals WHERE player_key=?',
          'meal-owner',
        )
        .one().ticks_left,
    ).toBe(paused),
  );
  expect(
    visitor.received
      .filter((message): message is MealMessage => message.type === 'meal')
      .every((message) => message.item === null),
  ).toBe(true);
  const returned = await TestClient.connect(worldId, 'meal-owner');
  await waitFor('restored meal', () => lastMeal(returned)?.item === 'berryTea');
  expect(lastMeal(returned)?.ticksLeft).toBeLessThanOrEqual(paused);
  expect(lastMeal(returned)?.ticksLeft).toBeGreaterThan(paused - 40);
  expect(returned.inventory().some((entry) => entry.item === 'berryTea')).toBe(false);
  returned.close();
  visitor.close();
  await sleep(250);
});
