import { env, runInDurableObject } from 'cloudflare:test';
import { expect, it } from 'vitest';
import type { WorldSimulation } from '@acorn/shared';
import { TestClient, waitFor } from './helpers';
it('sends recent wildlife history near the viewer, then clears it indoors', async () => {
  const name = `wildlife-tracks-${Date.now()}`;
  const player = await TestClient.connect(name, 'tracker');
  try {
    await waitFor('world loaded', () => player.snapshots().length > 0);
    const id = player.welcome().netId;
    const stub = env.WORLD.get(env.WORLD.idFromName(name));
    await runInDurableObject(stub, (instance) => {
      const sim = (instance as unknown as { simulation: WorldSimulation }).simulation;
      sim.placePlayer(id, { x: 0, y: 0, z: -32 }, 0);
      for (let i = 0; i < 160; i++) sim.step(Date.now());
      expect(sim.animalTracksOf(id).length).toBeGreaterThan(0);
    });
    await waitFor('nearby recent history', () =>
      player.received.some((m) => m.type === 'animalTracks' && m.tracks.length > 0),
    );
    const offset = player.received.length;
    await runInDurableObject(stub, (instance) => {
      const sim = (instance as unknown as { simulation: WorldSimulation }).simulation;
      sim.placePlayer(id, { x: 0, y: 0, z: 0 }, 0, 999);
    });
    await waitFor('indoor history cleared', () =>
      player.received.slice(offset).some((m) => m.type === 'animalTracks' && m.tracks.length === 0),
    );
  } finally {
    player.close();
  }
});
