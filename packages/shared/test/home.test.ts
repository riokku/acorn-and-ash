import { describe, expect, it } from 'vitest';

import { PLAYER_HEIGHT, PLAYER_RADIUS } from '../src/constants';
import { createCollisionWorld, resolveCapsule } from '../src/collision/capsule';
import {
  HOME_ENTRY,
  HOME_FURNITURE,
  HOME_ROOM,
  HOME_WAKE_SPOT,
  cabinCollider,
  cabinDoorstep,
  cabinDoorway,
  homeRoomColliders,
  isEnteringDoorway,
  isLeavingRoom,
} from '../src/world/home';
import { createFlatTerrain } from '../src/world/terrain';
import {
  decodeClientMessage,
  decodeServerMessage,
  encodeBuiltProps,
  encodeSetDoorLock,
  encodeSpace,
} from '../src/net/protocol';

/** Where a player standing here would be pushed out to, by these colliders. */
function pushedOut(
  x: number,
  z: number,
  colliders: ReturnType<typeof homeRoomColliders>,
): { x: number; z: number } {
  const world = createCollisionWorld(createFlatTerrain(0), colliders, 1000);
  const position = { x, y: 0, z };
  resolveCapsule(position, PLAYER_RADIUS, PLAYER_HEIGHT, world);
  return { x: position.x, z: position.z };
}

describe('a cabin from the outside', () => {
  for (const yaw of [0, 0.7, Math.PI / 2, -2.4, Math.PI]) {
    const home = { x: 12, z: -30, yaw };

    it(`has its doorway just outside the front wall, turned ${yaw.toFixed(2)}`, () => {
      const doorway = cabinDoorway(home);
      // Standing in the doorway is not inside the walls...
      const there = pushedOut(doorway.x, doorway.z, [cabinCollider(home)]);
      expect(there.x).toBeCloseTo(doorway.x, 3);
      expect(there.z).toBeCloseTo(doorway.z, 3);
      // ...but a step further in is, and you are held right there at the
      // door - well within reach of it.
      const inside = pushedOut(
        doorway.x + doorway.inwardX * 0.4,
        doorway.z + doorway.inwardZ * 0.4,
        [cabinCollider(home)],
      );
      expect(Math.hypot(inside.x - doorway.x, inside.z - doorway.z)).toBeLessThan(0.15);
    });

    it(`puts the doorstep in front of the door, facing away from it, turned ${yaw.toFixed(2)}`, () => {
      const doorstep = cabinDoorstep(home);
      const doorway = cabinDoorway(home);
      // Further out than the doorway, along the way out.
      const out =
        (doorstep.x - doorway.x) * -doorway.inwardX + (doorstep.z - doorway.z) * -doorway.inwardZ;
      expect(out).toBeGreaterThan(0.2);
      // Facing out: yaw 0 looks down -Z, so facing along (-sin, -cos).
      expect(-Math.sin(doorstep.yaw)).toBeCloseTo(-doorway.inwardX, 5);
      expect(-Math.cos(doorstep.yaw)).toBeCloseTo(-doorway.inwardZ, 5);
    });
  }

  it('counts walking at the door, or pressing interact there, as going in', () => {
    const home = { x: 0, z: 0, yaw: 0 };
    const doorway = cabinDoorway(home);
    expect(isEnteringDoorway(home, doorway.x, doorway.z, 0, -1, false)).toBe(true);
    expect(isEnteringDoorway(home, doorway.x, doorway.z, 0, 0, true)).toBe(true);
    // Standing still, or walking away, or walking past sideways, is not.
    expect(isEnteringDoorway(home, doorway.x, doorway.z, 0, 0, false)).toBe(false);
    expect(isEnteringDoorway(home, doorway.x, doorway.z, 0, 1, false)).toBe(false);
    expect(isEnteringDoorway(home, doorway.x, doorway.z, 1, 0, false)).toBe(false);
    // Nor is being nowhere near the door.
    expect(isEnteringDoorway(home, doorway.x + 3, doorway.z, 0, -1, false)).toBe(false);
  });
});

describe('the room inside', () => {
  const colliders = homeRoomColliders();

  it('lets you stand where you come in and where you wake up', () => {
    for (const spot of [HOME_ENTRY, HOME_WAKE_SPOT]) {
      const there = pushedOut(spot.x, spot.z, colliders);
      expect(there.x).toBeCloseTo(spot.x, 3);
      expect(there.z).toBeCloseTo(spot.z, 3);
    }
  });

  it('keeps everything inside the walls', () => {
    const { halfWidth, halfDepth } = HOME_ROOM;
    const { bed, hearth, table, chair, shelf } = HOME_FURNITURE;
    expect(Math.abs(bed.x) + bed.halfWidth).toBeLessThanOrEqual(halfWidth);
    expect(Math.abs(bed.z) + bed.halfLength).toBeLessThanOrEqual(halfDepth);
    expect(hearth.x + hearth.halfDepth).toBeLessThanOrEqual(halfWidth);
    expect(Math.abs(table.x) + table.halfWidth).toBeLessThanOrEqual(halfWidth);
    expect(Math.abs(chair.x) + chair.radius).toBeLessThanOrEqual(halfWidth);
    expect(shelf.x + shelf.halfDepth).toBeLessThanOrEqual(halfWidth);
  });

  it('holds you inside its walls, whichever way you push', () => {
    for (const [x, z] of [
      [5, 0],
      [-5, 0],
      [0, -5],
      [2, 4],
    ] as const) {
      const there = pushedOut(x * 0.8, z * 0.8, colliders);
      expect(Math.abs(there.x)).toBeLessThanOrEqual(
        HOME_ROOM.halfWidth + HOME_ROOM.wallThickness + 0.5,
      );
    }
  });

  it('counts walking at the door from inside as leaving, and only there', () => {
    const atDoor = { x: HOME_ROOM.doorX, z: HOME_ROOM.halfDepth - 0.4 };
    expect(isLeavingRoom(atDoor.x, atDoor.z, 0, 1, false)).toBe(true);
    expect(isLeavingRoom(atDoor.x, atDoor.z, 0, 0, true)).toBe(true);
    expect(isLeavingRoom(atDoor.x, atDoor.z, 0, -1, false)).toBe(false);
    // The middle of the room is not the door, however hard you walk.
    expect(isLeavingRoom(0, 0, 0, 1, false)).toBe(false);
    // Nor is a stretch of the front wall away from the door.
    expect(isLeavingRoom(2.5, atDoor.z, 0, 1, false)).toBe(false);
    // And coming in, you land clear of the way out.
    expect(isLeavingRoom(HOME_ENTRY.x, HOME_ENTRY.z, 0, 0, false)).toBe(false);
  });
});

describe('the door on the wire', () => {
  it('sends which space you are in, and where', () => {
    const decoded = decodeServerMessage(encodeSpace(412, -1.1, 2.35, 0.5));
    expect(decoded).toMatchObject({ type: 'space', space: 412 });
    if (decoded?.type !== 'space') return;
    expect(decoded.x).toBeCloseTo(-1.1, 2);
    expect(decoded.z).toBeCloseTo(2.35, 2);
    expect(decoded.yaw).toBeCloseTo(0.5, 3);
  });

  it('asks to lock or unlock your door', () => {
    expect(decodeClientMessage(encodeSetDoorLock(true))).toEqual({
      type: 'setDoorLock',
      locked: true,
    });
    expect(decodeClientMessage(encodeSetDoorLock(false))).toEqual({
      type: 'setDoorLock',
      locked: false,
    });
  });

  it('says whether a home is locked', () => {
    const decoded = decodeServerMessage(
      encodeBuiltProps([
        { id: 1, kind: 'cabin', x: 3, z: 4, yaw: 0, lit: false, locked: true },
        { id: 2, kind: 'cabin', x: 30, z: 4, yaw: 0, lit: false },
      ]),
    );
    if (decoded?.type !== 'builtProps') throw new Error('not a built-prop list');
    expect(decoded.props.map((prop) => prop.locked)).toEqual([true, false]);
  });
});
