import { describe, expect, it } from 'vitest';

import { createCollisionWorld } from '../src/collision/capsule';
import {
  PLAYABLE_HALF_EXTENT,
  PLAYER_RADIUS,
  PLAYER_WALK_SPEED,
  TICK_SECONDS,
} from '../src/constants';
import { createInput, createPlayerMotion, stepPlayer } from '../src/sim/player';
import { cylinder } from '../src/world/colliders';
import { createFlatTerrain } from '../src/world/terrain';

const flatWorld = createCollisionWorld(createFlatTerrain(0), [], PLAYABLE_HALF_EXTENT);

function walk(
  moveX: number,
  moveZ: number,
  yaw: number,
  ticks: number,
  world = flatWorld,
): ReturnType<typeof createPlayerMotion> {
  const motion = createPlayerMotion({ x: 0, y: 0, z: 0 });
  for (let i = 0; i < ticks; i++) {
    stepPlayer(motion, createInput(i + 1, moveX, moveZ, yaw), TICK_SECONDS, world);
  }
  return motion;
}

describe('walking', () => {
  it('walks away from the camera when W is held', () => {
    const motion = walk(0, 1, 0, 40);
    expect(motion.position.z).toBeLessThan(-2);
    expect(Math.abs(motion.position.x)).toBeLessThan(1e-6);
  });

  it('walks to the right when D is held', () => {
    const motion = walk(1, 0, 0, 40);
    expect(motion.position.x).toBeGreaterThan(2);
    expect(Math.abs(motion.position.z)).toBeLessThan(1e-6);
  });

  it('follows the camera when it is turned', () => {
    const motion = walk(0, 1, Math.PI / 2, 40);
    // Yaw of a quarter turn means "forward" now points down -X.
    expect(motion.position.x).toBeLessThan(-2);
    expect(Math.abs(motion.position.z)).toBeLessThan(1e-6);
  });

  it('does not let diagonal movement go faster than straight movement', () => {
    const straight = walk(0, 1, 0, 80);
    const diagonal = walk(1, 1, 0, 80);
    const straightDistance = Math.hypot(straight.position.x, straight.position.z);
    const diagonalDistance = Math.hypot(diagonal.position.x, diagonal.position.z);
    expect(diagonalDistance).toBeLessThanOrEqual(straightDistance + 1e-6);
  });

  it('tops out at the walking speed', () => {
    const motion = walk(0, 1, 0, 200);
    expect(Math.hypot(motion.velocity.x, motion.velocity.z)).toBeCloseTo(PLAYER_WALK_SPEED, 5);
  });

  it('comes to a stop when the keys are released', () => {
    const motion = walk(0, 1, 0, 40);
    for (let i = 0; i < 60; i++) {
      stepPlayer(motion, createInput(100 + i, 0, 0, 0), TICK_SECONDS, flatWorld);
    }
    expect(Math.hypot(motion.velocity.x, motion.velocity.z)).toBeCloseTo(0, 6);
  });

  it('stays on the ground', () => {
    const motion = walk(0, 1, 0, 60);
    expect(motion.position.y).toBe(0);
    expect(motion.grounded).toBe(true);
  });

  it('falls onto the ground when it starts in the air', () => {
    const motion = createPlayerMotion({ x: 0, y: 5, z: 0 });
    for (let i = 0; i < 60; i++) {
      stepPlayer(motion, createInput(i + 1), TICK_SECONDS, flatWorld);
    }
    expect(motion.position.y).toBe(0);
    expect(motion.grounded).toBe(true);
  });

  it('cannot walk through a tree', () => {
    const trunk = cylinder(0, -3, 0.5, 6);
    const world = createCollisionWorld(createFlatTerrain(0), [trunk], PLAYABLE_HALF_EXTENT);
    const motion = walk(0, 1, 0, 120, world);
    const gap = Math.hypot(motion.position.x - trunk.x, motion.position.z - trunk.z);
    expect(gap).toBeGreaterThanOrEqual(PLAYER_RADIUS + trunk.radius - 1e-6);
  });

  it('cannot walk out of the world', () => {
    const motion = walk(0, 1, 0, 600);
    expect(motion.position.z).toBeGreaterThanOrEqual(-PLAYABLE_HALF_EXTENT);
  });

  it('ignores an input that asks to move faster than one', () => {
    const honest = walk(0, 1, 0, 200);
    const cheating = createPlayerMotion({ x: 0, y: 0, z: 0 });
    for (let i = 0; i < 200; i++) {
      // createInput clamps, so a client cannot ask for ten times the speed.
      stepPlayer(cheating, createInput(i + 1, 0, 10), TICK_SECONDS, flatWorld);
    }
    expect(cheating.position.z).toBeCloseTo(honest.position.z, 6);
  });

  it('turns to face the way it is walking', () => {
    const motion = walk(0, 1, 0, 60);
    // Walking down -Z means facing yaw 0.
    expect(Math.abs(motion.facingYaw)).toBeLessThan(0.05);

    const rightwards = walk(1, 0, 0, 60);
    expect(Math.abs(Math.abs(rightwards.facingYaw) - Math.PI / 2)).toBeLessThan(0.05);
  });

  it('gives the same answer every time, so the client can predict it', () => {
    const inputs = Array.from({ length: 50 }, (_, i) =>
      createInput(i + 1, Math.sin(i * 0.3), Math.cos(i * 0.21), i * 0.05),
    );
    const world = createCollisionWorld(
      createFlatTerrain(0),
      [cylinder(1, -2, 0.6, 5), cylinder(-2, -4, 0.4, 5)],
      PLAYABLE_HALF_EXTENT,
    );

    const runOnce = (): { x: number; y: number; z: number; yaw: number } => {
      const motion = createPlayerMotion({ x: 0, y: 0, z: 0 });
      for (const input of inputs) stepPlayer(motion, input, TICK_SECONDS, world);
      return { ...motion.position, yaw: motion.facingYaw };
    };

    expect(runOnce()).toEqual(runOnce());
  });
});
