import { expect, it } from 'vitest';
import { BUILD_REPLY_REASONS } from '../src/sim/building';
import { encodeBuildReply, decodeServerMessage } from '../src/net/protocol';
import { DEFAULT_WORLD_SEED, WorldSimulation } from '../src/index';
const request = { kind: 'campfire' as const, x: 1.5, z: -3, yaw: 0 };
it.each([null, ...BUILD_REPLY_REASONS])('round-trips a private %s build result', (reason) => {
  expect(decodeServerMessage(encodeBuildReply({ request, reason }))).toEqual({
    type: 'buildReply',
    request,
    reason,
  });
});
it('rejects malformed replies', () => {
  const good = encodeBuildReply({ request, reason: null });
  expect(decodeServerMessage(good.slice(0, 8))).toBeNull();
  for (const offset of [1, 8]) {
    const bad = good.slice(0);
    new DataView(bad).setUint8(offset, 255);
    expect(decodeServerMessage(bad)).toBeNull();
  }
});
it('reports non-home refusal without spending materials, then confirms an accepted build', () => {
  const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED, hungerEmptyAfterSeconds: Infinity });
  sim.addPlayer(1, undefined, 'builder');
  sim.restoreBuiltProps([
    {
      id: 60000,
      kind: 'cabin',
      x: 0,
      z: 15,
      yaw: 0,
      ownerKey: 'builder',
      lit: false,
      litUntilMs: null,
    },
  ]);
  sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0);
  sim.requestBuild(1, request);
  sim.step(1000);
  expect(sim.drainBuildReplies()[0]?.reason).toBe('materials');
  Object.assign(sim.inventoryOf(1), { log: 20 });
  sim.requestBuild(1, request);
  sim.step(1000);
  expect(sim.drainBuildReplies()[0]?.reason).toBeNull();
  expect(sim.drainBuildEvents()).toHaveLength(1);
  sim.dispose();
});
it('reports an overwritten queued request instead of silently losing it', () => {
  const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED });
  sim.addPlayer(1);
  sim.requestBuild(1, request);
  sim.requestBuild(1, { ...request, x: 2 });
  expect(sim.drainBuildReplies()).toEqual([{ netId: 1, request, reason: 'busy' }]);
  sim.dispose();
});
