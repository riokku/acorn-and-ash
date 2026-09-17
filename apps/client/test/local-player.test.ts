import { describe, expect, it } from 'vitest';

import {
  PLAYER_WALK_SPEED,
  SPAWN_POSITION,
  TICK_SECONDS,
  createCollisionWorld,
  createFlatTerrain,
  vec3,
  type SnapshotEntity,
} from '@acorn/shared';

import { LocalPlayer } from '../src/net/local-player';

const collision = createCollisionWorld(createFlatTerrain(0), []);

function createPlayer(): LocalPlayer {
  return new LocalPlayer(SPAWN_POSITION, collision);
}

function serverState(
  netId: number,
  x: number,
  z: number,
  vx = 0,
  vz = 0,
): SnapshotEntity {
  return { netId, x, y: 0, z, vx, vy: 0, vz, yaw: 0, flags: 0 };
}

describe('moving before the server answers', () => {
  it('moves straight away rather than waiting for a reply', () => {
    const player = createPlayer();
    player.advance(TICK_SECONDS, 0, 1, 0);
    expect(player.motion.position.z).toBeLessThan(SPAWN_POSITION.z);
  });

  it('produces exactly one input per tick', () => {
    const player = createPlayer();
    expect(player.advance(TICK_SECONDS * 3, 0, 1, 0)).toHaveLength(3);
    expect(player.advance(TICK_SECONDS / 2, 0, 1, 0)).toHaveLength(0);
  });

  it('numbers its inputs consecutively, so a bundle stays small', () => {
    const player = createPlayer();
    const inputs = player.advance(TICK_SECONDS * 4, 0, 1, 0);
    expect(inputs.map((input) => input.seq)).toEqual([1, 2, 3, 4]);
  });

  it('does not sprint to catch up after the tab was asleep', () => {
    const player = createPlayer();
    // Ten seconds of nothing should not become two hundred ticks of walking.
    const inputs = player.advance(10, 0, 1, 0);
    expect(inputs.length).toBeLessThanOrEqual(5);
  });

  it('keeps track of what the server has not acknowledged yet', () => {
    const player = createPlayer();
    player.advance(TICK_SECONDS * 5, 0, 1, 0);
    expect(player.stats.pendingInputs).toBe(5);
  });
});

describe('being corrected by the server', () => {
  it('does nothing visible when the server agrees', () => {
    const player = createPlayer();
    player.advance(TICK_SECONDS * 5, 0, 1, 0);
    const predicted = { ...player.motion.position };

    // The server saw all five inputs and reached the same answer.
    player.reconcile(
      serverState(1, predicted.x, predicted.z, player.motion.velocity.x, player.motion.velocity.z),
      5,
    );

    expect(player.motion.position.x).toBeCloseTo(predicted.x, 6);
    expect(player.motion.position.z).toBeCloseTo(predicted.z, 6);
    expect(player.stats.lastCorrection).toBeLessThan(0.02);
    expect(player.stats.pendingInputs).toBe(0);
  });

  it('replays the inputs the server has not seen yet', () => {
    const player = createPlayer();
    player.advance(TICK_SECONDS * 5, 0, 1, 0);
    const predicted = { ...player.motion.position };

    // The server has only simulated the first two of the five inputs. Replaying
    // the other three on top of its answer should land back where we were.
    const afterTwo = replayFromSpawn(2);
    player.reconcile(
      serverState(1, afterTwo.x, afterTwo.z, afterTwo.vx, afterTwo.vz),
      2,
    );

    expect(player.motion.position.z).toBeCloseTo(predicted.z, 5);
    expect(player.stats.pendingInputs).toBe(3);
  });

  it('puts the player where the server says when they are far apart', () => {
    const player = createPlayer();
    player.advance(TICK_SECONDS * 5, 0, 1, 0);

    // The server says they are somewhere else entirely: teleported, or a cheat
    // was rejected. The client has to accept it.
    player.reconcile(serverState(1, 20, -20), 5);
    expect(player.motion.position.x).toBeCloseTo(20, 5);
    expect(player.motion.position.z).toBeCloseTo(-20, 5);
    expect(player.stats.lastCorrection).toBeGreaterThan(2.5);
  });

  it('hides a small correction instead of snapping the camera', () => {
    const player = createPlayer();
    player.advance(TICK_SECONDS * 5, 0, 1, 0);
    const predicted = { ...player.motion.position };

    // Half a metre out: the simulation moves, but the drawn position should not
    // jump there all at once.
    player.reconcile(serverState(1, predicted.x + 0.5, predicted.z), 5);

    const drawnImmediately = player.renderPosition(vec3());
    expect(drawnImmediately.x).toBeCloseTo(predicted.x, 2);

    // And it settles onto the corrected position over the next moment.
    for (let i = 0; i < 40; i++) player.advance(TICK_SECONDS, 0, 0, 0);
    const drawnLater = player.renderPosition(vec3());
    expect(drawnLater.x).toBeCloseTo(player.motion.position.x, 2);
  });

  it('never walks faster than the server allows, however it is driven', () => {
    const player = createPlayer();
    const start = { ...player.motion.position };
    for (let i = 0; i < 100; i++) player.advance(TICK_SECONDS, 0, 1, 0);
    const travelled = Math.abs(player.motion.position.z - start.z);
    const seconds = 100 * TICK_SECONDS;
    expect(travelled).toBeLessThanOrEqual(PLAYER_WALK_SPEED * seconds + 0.01);
  });
});

/** What the server would have after simulating `count` of the same inputs. */
function replayFromSpawn(count: number): { x: number; z: number; vx: number; vz: number } {
  const player = createPlayer();
  player.advance(TICK_SECONDS * count, 0, 1, 0);
  return {
    x: player.motion.position.x,
    z: player.motion.position.z,
    vx: player.motion.velocity.x,
    vz: player.motion.velocity.z,
  };
}
