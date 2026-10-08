import { describe, expect, it } from 'vitest';

import {
  COLLISION_SKIN_WIDTH,
  createCollisionWorld,
  replaceCollider,
  resolveCapsule,
} from '../src/collision/capsule';
import { PLAYER_HEIGHT, PLAYER_RADIUS } from '../src/constants';
import { box, cylinder } from '../src/world/colliders';
import { createFlatTerrain } from '../src/world/terrain';

const terrain = createFlatTerrain(0);

describe('capsule collision', () => {
  it('leaves a player alone in the open', () => {
    const world = createCollisionWorld(terrain, [cylinder(10, 10, 1, 4)], 100);
    const position = { x: 0, y: 0, z: 0 };
    expect(resolveCapsule(position, PLAYER_RADIUS, PLAYER_HEIGHT, world)).toBe(false);
    expect(position).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('pushes a player out of a tree trunk', () => {
    const trunk = cylinder(0, 0, 0.5, 6);
    const world = createCollisionWorld(terrain, [trunk], 100);
    const position = { x: 0.2, y: 0, z: 0 };

    expect(resolveCapsule(position, PLAYER_RADIUS, PLAYER_HEIGHT, world)).toBe(true);
    const gap = Math.hypot(position.x - trunk.x, position.z - trunk.z);
    expect(gap).toBeCloseTo(PLAYER_RADIUS + trunk.radius, 5);
  });

  it('pushes straight out, not sideways, when brushing a trunk', () => {
    const world = createCollisionWorld(terrain, [cylinder(0, 0, 0.5, 6)], 100);
    const position = { x: 0.8, y: 0, z: 0 };
    resolveCapsule(position, PLAYER_RADIUS, PLAYER_HEIGHT, world);
    expect(position.z).toBeCloseTo(0, 6);
    expect(position.x).toBeGreaterThan(0.8);
  });

  it('is deterministic when a player is exactly at the centre of a trunk', () => {
    const world = createCollisionWorld(terrain, [cylinder(0, 0, 0.5, 6)], 100);
    const first = { x: 0, y: 0, z: 0 };
    const second = { x: 0, y: 0, z: 0 };
    resolveCapsule(first, PLAYER_RADIUS, PLAYER_HEIGHT, world);
    resolveCapsule(second, PLAYER_RADIUS, PLAYER_HEIGHT, world);
    expect(first).toEqual(second);
  });

  it('ignores something the player is standing over', () => {
    // A rock only 20 cm tall that the capsule's feet are already above.
    const world = createCollisionWorld(terrain, [cylinder(0, 0, 1, 0.2)], 100);
    const position = { x: 0, y: 1.5, z: 0 };
    expect(resolveCapsule(position, PLAYER_RADIUS, PLAYER_HEIGHT, world)).toBe(false);
  });

  it('pushes a player out of an unrotated box', () => {
    const rock = box(0, 0.5, 0, 1, 0.5, 2);
    const world = createCollisionWorld(terrain, [rock], 100);
    const position = { x: 0.5, y: 0, z: 0 };
    resolveCapsule(position, PLAYER_RADIUS, PLAYER_HEIGHT, world);
    expect(Math.abs(position.x)).toBeCloseTo(rock.halfX + PLAYER_RADIUS, 5);
  });

  it('pushes a player out of a rotated box', () => {
    const rotation = Math.PI / 4;
    const rock = box(0, 0.5, 0, 2, 0.5, 0.5, rotation);
    const world = createCollisionWorld(terrain, [rock], 100);
    const position = { x: 0.1, y: 0, z: 0.1 };
    resolveCapsule(position, PLAYER_RADIUS, PLAYER_HEIGHT, world);

    // Back into the box's own frame: the player must be clear of its short side.
    const sin = Math.sin(-rotation);
    const cos = Math.cos(-rotation);
    const localZ = position.x * sin + position.z * cos;
    expect(Math.abs(localZ)).toBeGreaterThanOrEqual(
      rock.halfZ + PLAYER_RADIUS - COLLISION_SKIN_WIDTH,
    );
  });

  it('resolves a corner between two trunks in one call', () => {
    const world = createCollisionWorld(
      terrain,
      [cylinder(-0.6, 0, 0.5, 6), cylinder(0.6, 0, 0.5, 6)],
      100,
    );
    const position = { x: 0, y: 0, z: 0.1 };
    resolveCapsule(position, PLAYER_RADIUS, PLAYER_HEIGHT, world);

    for (const trunk of world.colliders) {
      const gap = Math.hypot(position.x - trunk.x, position.z - trunk.z);
      expect(gap).toBeGreaterThanOrEqual(PLAYER_RADIUS + 0.5 - COLLISION_SKIN_WIDTH);
    }
  });

  it('holds the player inside the playable area', () => {
    const world = createCollisionWorld(terrain, [], 38);
    const position = { x: 120, y: 0, z: -95 };
    expect(resolveCapsule(position, PLAYER_RADIUS, PLAYER_HEIGHT, world)).toBe(true);
    expect(position.x).toBe(38);
    expect(position.z).toBe(-38);
  });
});

describe('the collision grid', () => {
  const trunks = Array.from({ length: 400 }, (_, i) =>
    cylinder(((i * 37) % 200) - 100, ((i * 53) % 200) - 100, 0.4 + (i % 5) * 0.1, 6),
  );

  it('pushes a player exactly as checking every collider would', () => {
    const plain = createCollisionWorld(terrain, trunks, 300);
    const gridded = createCollisionWorld(terrain, trunks, 300, null, true);
    for (let i = 0; i < 300; i++) {
      const start = { x: ((i * 7) % 200) - 100 + 0.3, y: 0, z: ((i * 11) % 200) - 100 - 0.2 };
      const a = { ...start };
      const b = { ...start };
      const touchedA = resolveCapsule(a, PLAYER_RADIUS, PLAYER_HEIGHT, plain);
      const touchedB = resolveCapsule(b, PLAYER_RADIUS, PLAYER_HEIGHT, gridded);
      expect(touchedB).toBe(touchedA);
      expect(b).toEqual(a);
    }
  });

  it('follows a tree being swapped for its stump, and still checks later additions', () => {
    const world = createCollisionWorld(terrain, [cylinder(0, 0, 1, 6)], 300, null, true);
    const inside = { x: 0.5, y: 0, z: 0 };
    expect(resolveCapsule(inside, PLAYER_RADIUS, PLAYER_HEIGHT, world)).toBe(true);

    replaceCollider(world, 0, cylinder(0, 0, 0.2, 0.4));
    const overStump = { x: 0.5, y: 1, z: 0 };
    expect(resolveCapsule(overStump, PLAYER_RADIUS, PLAYER_HEIGHT, world)).toBe(false);

    // A cabin built later is not in the grid, but it still stops a player.
    world.colliders.push(box(30, 1, 30, 2, 1, 2));
    const atCabin = { x: 30, y: 0, z: 30 };
    expect(resolveCapsule(atCabin, PLAYER_RADIUS, PLAYER_HEIGHT, world)).toBe(true);
  });
});
