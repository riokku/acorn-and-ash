import { env, runInDurableObject } from 'cloudflare:test';
import { expect, it } from 'vitest';
import { weatherPlan, WEATHER_CYCLE_MS, type WorldSimulation } from '@acorn/shared';
import { TestClient, sleep, waitFor } from './helpers';
it('commits a storm reward cursor with its shared piles and cannot replay it', async () => {
  const worldId = `weather-${Date.now()}`,
    client = await TestClient.connect(worldId, 'weather-owner');
  await waitFor('welcome', () => client.received.some((message) => message.type === 'welcome'));
  const stub = env.WORLD.get(env.WORLD.idFromName(worldId));
  await runInDurableObject(stub, (instance, state) => {
    const world = instance as unknown as {
      simulation: WorldSimulation;
      announcePiles(sim: WorldSimulation, now: number): void;
    };
    const sim = world.simulation;
    let cycle = Math.floor(Date.now() / WEATHER_CYCLE_MS) + 10;
    while (!weatherPlan(sim.seed, cycle - 1).storm) cycle++;
    sim.restoreWeatherCycle(cycle - 1);
    world.announcePiles(sim, cycle * WEATHER_CYCLE_MS + 1000);
    expect(
      state.storage.sql
        .exec<{ value: string }>("SELECT value FROM world_meta WHERE key='weather-cycle'")
        .one().value,
    ).toBe(String(cycle));
    const saved = state.storage.sql.exec('SELECT * FROM dropped_piles').toArray();
    expect(saved.length).toBeGreaterThan(0);
    expect(saved.length).toBeLessThanOrEqual(6);
    world.announcePiles(sim, cycle * WEATHER_CYCLE_MS + 1100);
    expect(state.storage.sql.exec('SELECT * FROM dropped_piles').toArray()).toEqual(saved);
  });
  client.close();
  await sleep(250);
});
