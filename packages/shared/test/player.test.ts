import { describe, expect, it } from 'vitest';

import { createCollisionWorld } from '../src/collision/capsule';
import {
  GROUND_SNAP_DISTANCE,
  PLAYABLE_HALF_EXTENT,
  PLAYER_RADIUS,
  PLAYER_SPRINT_SPEED,
  PLAYER_WALK_SPEED,
  TICK_SECONDS,
} from '../src/constants';
import { PlayerButton, createInput, createPlayerMotion, stepPlayer } from '../src/sim/player';
import { cylinder } from '../src/world/colliders';
import { createFlatTerrain } from '../src/world/terrain';

const flatWorld = createCollisionWorld(createFlatTerrain(0), [], PLAYABLE_HALF_EXTENT);

function walk(
  moveX: number,
  moveZ: number,
  yaw: number,
  ticks: number,
  world = flatWorld,
  buttons = 0,
): ReturnType<typeof createPlayerMotion> {
  const motion = createPlayerMotion({ x: 0, y: 0, z: 0 });
  for (let i = 0; i < ticks; i++) {
    stepPlayer(motion, createInput(i + 1, moveX, moveZ, yaw, buttons), TICK_SECONDS, world);
  }
  return motion;
}

/** Hold a set of buttons for a number of ticks and report the highest point reached. */
function hop(
  motion: ReturnType<typeof createPlayerMotion>,
  buttons: number,
  ticks: number,
  moveZ = 0,
): { peak: number; airborneTicks: number } {
  let peak = motion.position.y;
  let airborneTicks = 0;
  for (let i = 0; i < ticks; i++) {
    stepPlayer(motion, createInput(i + 1, 0, moveZ, 0, buttons), TICK_SECONDS, flatWorld);
    peak = Math.max(peak, motion.position.y);
    if (!motion.grounded) airborneTicks += 1;
  }
  return { peak, airborneTicks };
}

const horizontalSpeed = (motion: ReturnType<typeof createPlayerMotion>): number =>
  Math.hypot(motion.velocity.x, motion.velocity.z);

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
    // Comfortably more than PLAYABLE_HALF_EXTENT / PLAYER_WALK_SPEED / TICK_SECONDS
    // ticks, so the walk actually reaches the wall rather than just not having
    // gone far enough yet.
    const motion = walk(0, 1, 0, 800);
    expect(motion.position.z).toBeCloseTo(-PLAYABLE_HALF_EXTENT, 6);
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

describe('jumping', () => {
  it('leaves the ground when the jump button is held', () => {
    const motion = createPlayerMotion({ x: 0, y: 0, z: 0 });
    stepPlayer(motion, createInput(1, 0, 0, 0, PlayerButton.Jump), TICK_SECONDS, flatWorld);
    expect(motion.grounded).toBe(false);
    expect(motion.position.y).toBeGreaterThan(0);
  });

  it('hops about a metre and comes back down', () => {
    const motion = createPlayerMotion({ x: 0, y: 0, z: 0 });
    const { peak, airborneTicks } = hop(motion, PlayerButton.Jump, 1);
    const rest = hop(motion, 0, 40);

    // High enough to clear a log, nowhere near high enough to reach a roof.
    expect(Math.max(peak, rest.peak)).toBeGreaterThan(1);
    expect(Math.max(peak, rest.peak)).toBeLessThan(1.5);
    // Back on the ground inside a second.
    expect(airborneTicks + rest.airborneTicks).toBeLessThan(1 / TICK_SECONDS);
    expect(motion.grounded).toBe(true);
    expect(motion.position.y).toBe(0);
    expect(motion.velocity.y).toBe(0);
  });

  it('cannot jump again in mid-air, however long the button is held', () => {
    const motion = createPlayerMotion({ x: 0, y: 0, z: 0 });
    // Holding jump hops again on landing, so the ceiling is one hop's height.
    const { peak } = hop(motion, PlayerButton.Jump, 200);
    expect(peak).toBeLessThan(1.5);
  });

  it('does not take a second jump from a player who is already falling', () => {
    const motion = createPlayerMotion({ x: 0, y: 5, z: 0 });
    // One tick of falling is what makes them airborne in the first place.
    stepPlayer(motion, createInput(1, 0, 0, 0), TICK_SECONDS, flatWorld);
    expect(motion.grounded).toBe(false);
    const fallingSpeed = motion.velocity.y;

    stepPlayer(motion, createInput(2, 0, 0, 0, PlayerButton.Jump), TICK_SECONDS, flatWorld);
    expect(motion.velocity.y).toBeLessThan(fallingSpeed);
  });

  it('keeps some steering in the air, but less than on the ground', () => {
    const grounded = createPlayerMotion({ x: 0, y: 0, z: 0 });
    for (let i = 0; i < 2; i++) {
      stepPlayer(grounded, createInput(i + 1, 0, 1, 0), TICK_SECONDS, flatWorld);
    }

    const airborne = createPlayerMotion({ x: 0, y: 0, z: 0 });
    stepPlayer(airborne, createInput(1, 0, 0, 0, PlayerButton.Jump), TICK_SECONDS, flatWorld);
    for (let i = 0; i < 2; i++) {
      stepPlayer(airborne, createInput(i + 2, 0, 1, 0), TICK_SECONDS, flatWorld);
    }

    expect(horizontalSpeed(airborne)).toBeGreaterThan(0);
    expect(horizontalSpeed(airborne)).toBeLessThan(horizontalSpeed(grounded));
  });

  it('pulls a walking player down over a small lip', () => {
    const motion = createPlayerMotion({ x: 0, y: GROUND_SNAP_DISTANCE / 2, z: 0 });
    stepPlayer(motion, createInput(1, 0, 1, 0), TICK_SECONDS, flatWorld);
    expect(motion.position.y).toBe(0);
    expect(motion.grounded).toBe(true);
  });

  it('does not cut a jump short at that same height', () => {
    // The ground snap is for walkers only. Someone at the top of a hop who is
    // this close to the ground has to fall the rest of the way properly.
    const motion = createPlayerMotion({ x: 0, y: GROUND_SNAP_DISTANCE - 0.05, z: 0 });
    motion.grounded = false;
    stepPlayer(motion, createInput(1, 0, 0, 0), TICK_SECONDS, flatWorld);
    expect(motion.grounded).toBe(false);
    expect(motion.position.y).toBeGreaterThan(0);
  });
});

describe('sprinting', () => {
  it('tops out at the sprinting speed', () => {
    const motion = walk(0, 1, 0, 200, flatWorld, PlayerButton.Sprint);
    expect(horizontalSpeed(motion)).toBeCloseTo(PLAYER_SPRINT_SPEED, 5);
  });

  it('covers more ground than walking in the same time', () => {
    const walked = walk(0, 1, 0, 100);
    const sprinted = walk(0, 1, 0, 100, flatWorld, PlayerButton.Sprint);
    expect(Math.abs(sprinted.position.z)).toBeGreaterThan(Math.abs(walked.position.z));
  });

  it('does nothing for a player who is not asking to move', () => {
    const motion = walk(0, 0, 0, 40, flatWorld, PlayerButton.Sprint);
    expect(horizontalSpeed(motion)).toBeCloseTo(0, 6);
    expect(motion.position.x).toBeCloseTo(0, 6);
    expect(motion.position.z).toBeCloseTo(0, 6);
  });

  it('slows back to a walk the moment the button is released', () => {
    const motion = walk(0, 1, 0, 100, flatWorld, PlayerButton.Sprint);
    for (let i = 0; i < 60; i++) {
      stepPlayer(motion, createInput(200 + i, 0, 1, 0), TICK_SECONDS, flatWorld);
    }
    expect(horizontalSpeed(motion)).toBeCloseTo(PLAYER_WALK_SPEED, 5);
  });

  it('cannot be combined with an oversized input to go faster still', () => {
    const honest = walk(0, 1, 0, 200, flatWorld, PlayerButton.Sprint);
    const cheating = createPlayerMotion({ x: 0, y: 0, z: 0 });
    for (let i = 0; i < 200; i++) {
      stepPlayer(
        cheating,
        createInput(i + 1, 0, 10, 0, PlayerButton.Sprint),
        TICK_SECONDS,
        flatWorld,
      );
    }
    expect(cheating.position.z).toBeCloseTo(honest.position.z, 6);
  });
});
