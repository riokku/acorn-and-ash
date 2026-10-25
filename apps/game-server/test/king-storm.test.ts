import { env, runInDurableObject } from 'cloudflare:test';
import { expect, it } from 'vitest';
import {
  ActionKind,
  beginAction,
  CROWNBREAKER_HOLD,
  HOLLOW_KING_SITE,
  KING_WARDS,
  SOUL_STORM,
  type ActionState,
  type WorldSimulation,
} from '@acorn/shared';
import { TestClient, waitFor } from './helpers';

it('sends authoritative phase and viewer-specific shelter, then clears it outside the arena', async () => {
  const worldId = `storm-${Date.now()}`,
    player = await TestClient.connect(worldId, 'storm-owner');
  await waitFor('live world', () => player.snapshots().length > 0);
  const stub = env.WORLD.get(env.WORLD.idFromName(worldId)),
    id = player.welcome().netId;
  await runInDurableObject(stub, (instance) => {
    const sim = (instance as unknown as { simulation: WorldSimulation }).simulation,
      ward = KING_WARDS[0];
    sim.placePlayer(id, { ...ward, y: sim.collision.terrain.heightAt(ward.x, ward.z) }, Math.PI);
    sim.raids.startRaid(0, ['hollowKing'], false, HOLLOW_KING_SITE);
    for (let i = 0; i < 80; i++) sim.step(Date.now());
    const king = sim.raidersList().find((r) => r.kind === 'hollowKing')!;
    const at = sim.readPlayer(id)!.position;
    sim.raids.placeRaider(king.id, { ...at, z: at.z + 1.5 }, 0);
    sim.raids.blowLands(id, at, Math.PI, { kind: 'swing', step: 1 }, 0, 40000);
    const record = (
      sim.raids as unknown as { raiders: Map<number, { action: ActionState; mode: string }> }
    ).raiders.get(king.id)!;
    beginAction(record.action, ActionKind.Idle);
    record.mode = 'circle';
    sim.step(Date.now());
    expect(sim.kingStormOf(id)).toMatchObject({ phase: 'warning', sheltered: true });
  });
  await waitFor('sheltered warning', () =>
    player.received.some(
      (m) => m.type === 'kingStorm' && m.storm?.phase === 'warning' && m.storm.sheltered,
    ),
  );
  await runInDurableObject(stub, (instance) => {
    const sim = (instance as unknown as { simulation: WorldSimulation }).simulation;
    for (let i = 0; i < SOUL_STORM.warningTicks; i++) sim.step(Date.now());
    const at = CROWNBREAKER_HOLD;
    sim.placePlayer(id, { x: at.x, z: at.z, y: sim.collision.terrain.heightAt(at.x, at.z) }, 0);
  });
  await waitFor('exposed active storm', () =>
    player.received.some(
      (m) => m.type === 'kingStorm' && m.storm?.phase === 'storm' && !m.storm.sheltered,
    ),
  );
  const offset = player.received.length;
  await runInDurableObject(stub, (instance) => {
    const sim = (instance as unknown as { simulation: WorldSimulation }).simulation;
    sim.placePlayer(id, { x: 0, y: 0, z: 0 }, 0);
  });
  await waitFor('storm cleared beyond interest range', () =>
    player.received.slice(offset).some((m) => m.type === 'kingStorm' && m.storm === null),
  );
  player.close();
});
