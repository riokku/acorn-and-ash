import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';

import { HOME_ROOM } from '@acorn/shared';

import { triangleCount } from '../src/art/shapes';
import { createHomeInterior } from '../src/scene/home-interior';

describe('the room inside a home', () => {
  const room = createHomeInterior();

  it('stays inside its walls', () => {
    const box = new THREE.Box3().setFromObject(room.group);
    const reach = HOME_ROOM.halfWidth + HOME_ROOM.wallThickness + 0.5;
    expect(box.max.x).toBeLessThan(reach);
    expect(box.min.x).toBeGreaterThan(-reach);
    expect(box.max.z).toBeLessThan(HOME_ROOM.halfDepth + HOME_ROOM.wallThickness + 0.5);
    expect(box.min.y).toBeGreaterThan(-0.2);
  });

  it('is modest enough to draw on an everyday laptop', () => {
    // A whole furnished room, with a lamp and a fire, in about as many
    // triangles as three trees.
    expect(triangleCount(room.group)).toBeLessThan(40_000);
  });

  it('cuts away the walls the camera is looking in through, and only those', () => {
    /** How many parts of the walls are showing right now, the tall parts cut away or not. */
    const visibleHighWalls = (): number => {
      let count = 0;
      room.group.traverse((child) => {
        if (child.visible && child.parent?.parent === room.group) count += 1;
      });
      return count;
    };
    // From out front, only the door wall comes down; from out to the right,
    // only the +X wall; from the front right corner, both.
    room.cutAway(0, 10);
    const fromFront = visibleHighWalls();
    room.cutAway(10, 0);
    const fromRight = visibleHighWalls();
    room.cutAway(7, 7);
    const fromCorner = visibleHighWalls();
    expect(fromRight).toBe(fromFront);
    expect(fromCorner).toBe(fromFront - 1);
  });

  it('brightens the fire and the lamp at night', () => {
    let lampAtNoon = 0;
    let lampAtMidnight = 0;
    room.update(0.016, 1);
    room.group.traverse((child) => {
      if (child instanceof THREE.PointLight && child.distance === 5) lampAtNoon = child.intensity;
    });
    room.update(0.016, 0);
    room.group.traverse((child) => {
      if (child instanceof THREE.PointLight && child.distance === 5)
        lampAtMidnight = child.intensity;
    });
    expect(lampAtMidnight).toBeGreaterThan(lampAtNoon);
  });
});
