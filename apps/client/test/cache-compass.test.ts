import { describe, expect, it } from 'vitest';

import { compassTo, compassToOwnCache } from '../src/hud/cache-compass';

describe('a compass reading', () => {
  it('measures the flat distance between the two points', () => {
    const reading = compassTo({ x: 0, z: 0 }, { x: 3, z: 4 }, 0);
    expect(reading.distanceMeters).toBeCloseTo(5, 5);
  });

  it('points straight ahead (0 degrees) when the target is dead ahead', () => {
    // Yaw 0 faces -Z, the same convention the camera and every facing
    // direction in this game already use.
    const reading = compassTo({ x: 0, z: 0 }, { x: 0, z: -5 }, 0);
    expect(reading.bearingDegrees).toBeCloseTo(0, 5);
  });

  it('points behind (180 degrees) when the target is directly behind', () => {
    const reading = compassTo({ x: 0, z: 0 }, { x: 0, z: 5 }, 0);
    expect(Math.abs(reading.bearingDegrees)).toBeCloseTo(180, 5);
  });

  it('points right (+90 degrees) when the target is to the right of the camera', () => {
    const reading = compassTo({ x: 0, z: 0 }, { x: 5, z: 0 }, 0);
    expect(reading.bearingDegrees).toBeCloseTo(90, 5);
  });

  it('points left (-90 degrees) when the target is to the left of the camera', () => {
    const reading = compassTo({ x: 0, z: 0 }, { x: -5, z: 0 }, 0);
    expect(reading.bearingDegrees).toBeCloseTo(-90, 5);
  });

  it('turns with the camera, not just with the world', () => {
    // Facing -X now (yaw = +90 degrees): a target at world +X sits directly
    // behind the camera, whichever way it used to look.
    const reading = compassTo({ x: 0, z: 0 }, { x: 5, z: 0 }, Math.PI / 2);
    expect(Math.abs(reading.bearingDegrees)).toBeCloseTo(180, 5);
  });
});

describe('a compass toward your own buried cache', () => {
  it('is null when you have nothing buried anywhere', () => {
    expect(compassToOwnCache({ x: 0, z: 0 }, [], 1, 0)).toBeNull();
  });

  it('ignores caches that belong to somebody else', () => {
    const caches = [{ id: 1, ownerNetId: 2, x: 10, z: 10 }];
    expect(compassToOwnCache({ x: 0, z: 0 }, caches, 1, 0)).toBeNull();
  });

  it('points at the one cache you own', () => {
    const caches = [
      { id: 1, ownerNetId: 2, x: 1, z: 1 },
      { id: 2, ownerNetId: 1, x: 0, z: -8 },
    ];
    const reading = compassToOwnCache({ x: 0, z: 0 }, caches, 1, 0);
    expect(reading).not.toBeNull();
    expect(reading?.distanceMeters).toBeCloseTo(8, 5);
    expect(reading?.bearingDegrees).toBeCloseTo(0, 5);
  });

  it('picks the nearest of several caches you own', () => {
    const caches = [
      { id: 1, ownerNetId: 1, x: 0, z: -20 },
      { id: 2, ownerNetId: 1, x: 0, z: -6 },
    ];
    const reading = compassToOwnCache({ x: 0, z: 0 }, caches, 1, 0);
    expect(reading?.distanceMeters).toBeCloseTo(6, 5);
  });
});
