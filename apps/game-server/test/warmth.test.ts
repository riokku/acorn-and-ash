import { env, runInDurableObject } from 'cloudflare:test';
import { expect, it } from 'vitest';
import type { WarmthMessage, WarmthState, WorldSimulation } from '@acorn/shared';
import { TestClient, sleep, waitFor } from './helpers';
const lastWarmth = (client: TestClient) =>
  client.received.filter((message): message is WarmthMessage => message.type === 'warmth').at(-1);
it('keeps warmth private and restores exposure and fractional health from SQLite after a disconnected pause', async () => {
  const worldId = `warmth-${Date.now()}`;
  const owner = await TestClient.connect(worldId, 'winter-owner', 'winter');
  await waitFor('warmth on arrival', () => lastWarmth(owner) !== undefined);
  const visitor = await TestClient.connect(worldId, 'winter-visitor');
  await waitFor('visitor warmth', () => lastWarmth(visitor) !== undefined);
  const stub = env.WORLD.get(env.WORLD.idFromName(worldId));
  const id = owner.welcome().netId;
  await runInDurableObject(stub, (instance) => {
    const sim = (instance as unknown as { simulation: WorldSimulation }).simulation;
    const players = (
      sim as unknown as { players: Map<number, { warmth: WarmthState; health: number }> }
    ).players;
    players.get(id)!.warmth = { value: 12, coldTicks: 0 };
    players.get(id)!.health = 87.5;
  });
  await waitFor('private cold state', () => lastWarmth(owner)?.value === 12);
  expect(
    visitor.received
      .filter((message): message is WarmthMessage => message.type === 'warmth')
      .every((message) => message.value > 90),
  ).toBe(true);
  owner.close();
  await waitFor('owner close', () => owner.closedWith !== null);
  let saved = 0;
  await runInDurableObject(stub, (_instance, state) => {
    saved = state.storage.sql
      .exec<{ value: number }>('SELECT value FROM player_warmth WHERE player_key=?', 'winter-owner')
      .one().value;
    expect(saved).toBeGreaterThan(10);
    expect(saved).toBeLessThanOrEqual(12);
    expect(
      state.storage.sql
        .exec<{ health: number }>('SELECT health FROM players WHERE player_key=?', 'winter-owner')
        .one().health,
    ).toBe(87.5);
  });
  await sleep(300);
  await runInDurableObject(stub, (_instance, state) => {
    expect(
      state.storage.sql
        .exec<{ value: number }>(
          'SELECT value FROM player_warmth WHERE player_key=?',
          'winter-owner',
        )
        .one().value,
    ).toBe(saved);
  });
  const returned = await TestClient.connect(worldId, 'winter-owner');
  await waitFor('returned warmth', () => lastWarmth(returned) !== undefined);
  expect(lastWarmth(returned)!.value).toBeLessThanOrEqual(12);
  expect(lastWarmth(returned)!.value).toBeGreaterThan(9);
});
