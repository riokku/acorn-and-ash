import { expect, it } from 'vitest';
import { LocalPlayer } from '../src/net/local-player';
import { createCollisionWorld, createFlatTerrain, TICK_SECONDS } from '@acorn/shared';
import { connectionNotice } from '../src/hud/Hud';
it('pauses at the predicted position with no stale replay, events or walking interpolation', () => {
  const player = new LocalPlayer(
    { x: 0, y: 0, z: 0 },
    createCollisionWorld(createFlatTerrain(0), []),
  );
  player.advance(TICK_SECONDS * 2.5, 1, 0, 0);
  const stopped = { ...player.motion.position };
  expect(player.stats.pendingInputs).toBeGreaterThan(0);
  player.pause();
  expect(player.stats.pendingInputs).toBe(0);
  expect(player.travelSpeed()).toBe(0);
  expect(player.renderPosition({ x: 0, y: 0, z: 0 })).toEqual(stopped);
  expect(player.drainEvents()).toEqual([]);
});
it('keeps disconnected and connecting feedback distinct from confirmed connection', () => {
  expect(connectionNotice('offline')).toContain('Reconnecting');
  expect(connectionNotice('connecting')).toContain('Connecting to the world');
  expect(connectionNotice('connected')).toBeNull();
});
