import { afterEach, describe, expect, it } from 'vitest';
import {
  WorldSimulation,
  DEFAULT_WORLD_SEED,
  BUILDABLE_KINDS,
  DECORATION_KINDS,
  DECORATION_REASONS,
  HOME_INTERIORS,
  HOME_TIERS,
  buildableKindIndex,
  checkDecorationSpot,
  decodeServerMessage,
  encodeDecorationState,
  furnitureRestingPlace,
  homeFloorWakeSpot,
  homeRoom,
  homeRoomColliders,
  homeWakeSpot,
  insideTheWalls,
  isIndoorOnlyKind,
  type DecorationRequest,
  type HomeDecoration,
  type HomeKind,
} from '../src/index';

const sims: WorldSimulation[] = [];
afterEach(() => sims.splice(0).forEach((sim) => sim.dispose()));

/** A home of this kind owned by `owner`, who stands inside it with supplies to build with. */
function home(kind: HomeKind = 'cabin') {
  const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED });
  sims.push(sim);
  sim.restoreBuiltProps([
    { id: 7, kind, x: 0, z: -5, yaw: 0, ownerKey: 'owner', lit: false, litUntilMs: null },
  ]);
  sim.addPlayer(1, undefined, 'owner');
  sim.placePlayer(1, { x: 0, y: 0, z: 1.2 }, 0, 7);
  Object.assign(sim.inventoryOf(1), { log: 40, stick: 40, rope: 10, flower: 10 });
  return sim;
}
const placing = (
  kind: DecorationRequest['kind'],
  x: number,
  z: number,
  yaw = 0,
): DecorationRequest => ({ action: 'place', kind, id: 0, x, z, yaw });

describe('the size of each home inside', () => {
  it('matches what Chris chose: tent 4x4, teepee 5.5x5.5, cabin 7x6, large cabin 10x8', () => {
    const size = (kind: HomeKind) => [
      HOME_INTERIORS[kind].halfWidth * 2,
      HOME_INTERIORS[kind].halfDepth * 2,
    ];
    expect(size('tent')).toEqual([4, 4]);
    expect(size('teepee')).toEqual([5.5, 5.5]);
    expect(size('cabin')).toEqual([7, 6]);
    expect(size('largeCabin')).toEqual([10, 8]);
  });
  it('never shrinks a room when a home is upgraded', () => {
    for (let index = 1; index < HOME_TIERS.length; index++) {
      const before = homeRoom(HOME_TIERS[index - 1]),
        after = homeRoom(HOME_TIERS[index]);
      expect(after.halfWidth).toBeGreaterThanOrEqual(before.halfWidth);
      expect(after.halfDepth).toBeGreaterThanOrEqual(before.halfDepth);
    }
  });
  it('gives tents and teepees an open fire, and both cabins a fireplace', () => {
    expect(HOME_INTERIORS.tent.fire).toBe('campfire');
    expect(HOME_INTERIORS.teepee.fire).toBe('campfire');
    expect(HOME_INTERIORS.cabin.fire).toBe('fireplace');
    expect(HOME_INTERIORS.largeCabin.fire).toBe('fireplace');
    // The tent's fire is the small one.
    expect(HOME_INTERIORS.tent.fireScale).toBeLessThan(HOME_INTERIORS.teepee.fireScale);
  });
});

describe('a new home', () => {
  for (const kind of HOME_TIERS)
    it(`starts a ${kind} empty but for its walls, door and fire`, () => {
      const sim = home(kind);
      expect(sim.decorationsList()).toEqual([]);
      expect(homeRoomColliders(kind)).toHaveLength(7);
    });

  it('wakes its owner on the floor by the fire until a bed is built, then by the bed', () => {
    expect(homeWakeSpot('tent', [])).toEqual({ spot: homeFloorWakeSpot('tent'), fromBed: false });
    const bed = { id: 1, homeId: 7, kind: 'bed', x: -1.3, z: -0.9, yaw: 0 } as const;
    expect(homeWakeSpot('tent', [bed])).toEqual({
      spot: furnitureRestingPlace(bed)!.stand,
      fromBed: true,
    });

    const sim = home('cabin');
    const floor = homeFloorWakeSpot('cabin');
    const before = sim.readPlayer(1);
    sim.removePlayer(1);
    sim.addPlayer(1, undefined, 'owner');
    expect(sim.readPlayer(1)?.position.x).toBeCloseTo(floor.x, 5);
    expect(before).toBeDefined();
    sim.restoreDecorations([{ ...bed, x: -2.75, z: -1.95 }]);
    sim.removePlayer(1);
    sim.addPlayer(1, undefined, 'owner');
    const stand = furnitureRestingPlace({ ...bed, x: -2.75, z: -1.95 })!.stand;
    expect(sim.readPlayer(1)?.position.x).toBeCloseTo(stand.x, 5);
    expect(sim.readPlayer(1)?.position.z).toBeCloseTo(stand.z, 5);
  });
});

describe('building the furniture that used to come with every home', () => {
  it('builds a bed for six logs and two rope, flush against the back wall', () => {
    const sim = home('cabin');
    const z = -homeRoom('cabin').halfDepth + 0.98 + 0.03;
    expect(sim.requestDecoration(1, placing('bed', -2.75, z)).reason).toBeNull();
    expect(sim.inventoryOf(1)).toMatchObject({ log: 34, rope: 8 });
    expect(BUILDABLE_KINDS.bed.costs).toEqual([
      { item: 'log', amount: 6 },
      { item: 'rope', amount: 2 },
    ]);
  });
  it('keeps to one bed, one desk, one chest and one garden in a home', () => {
    const sim = home('largeCabin');
    expect(sim.requestDecoration(1, placing('bed', -4, -2.9)).reason).toBeNull();
    expect(sim.requestDecoration(1, placing('bed', -4, 1.5)).reason).toBe('onlyOne');
    expect(sim.requestDecoration(1, placing('storageChest', 1, -3.6)).reason).toBeNull();
    expect(sim.requestDecoration(1, placing('storageChest', -1, -3.6)).reason).toBe('onlyOne');
    expect(sim.decorationsList()).toHaveLength(2);
  });
  it('grows an indoor garden only in a large cabin', () => {
    expect(home('cabin').requestDecoration(1, placing('indoorGarden', 0, -2.4)).reason).toBe(
      'unsupported',
    );
    expect(
      home('largeCabin').requestDecoration(1, placing('indoorGarden', 0, -3.4)).reason,
    ).toBeNull();
  });
  it('keeps furniture off the fire, and room to get into bed', () => {
    const fireside: HomeDecoration = { id: 9, homeId: 7, kind: 'desk', x: 2, z: -0.9, yaw: 0 };
    expect(checkDecorationSpot('cabin', fireside, [], { x: 0, z: 2 })).toBe('blocked');
    // A bed whose getting-in side is against the wall.
    const walled: HomeDecoration = { id: 9, homeId: 7, kind: 'bed', x: 2.88, z: 1.5, yaw: 0 };
    expect(checkDecorationSpot('cabin', walled, [], { x: 0, z: 2 })).toBe('blocked');
    // Turned round, it gets in from the room side.
    expect(checkDecorationSpot('cabin', { ...walled, yaw: Math.PI }, [], { x: 0, z: 2 })).toBe(
      null,
    );
  });
  it('builds furniture inside only', () => {
    for (const kind of ['bed', 'desk', 'storageChest', 'indoorGarden'] as const)
      expect(isIndoorOnlyKind(kind)).toBe(true);
  });
  it('makes the desk the workbench', () => {
    const sim = home('teepee');
    expect(sim.nearWorkbenchOf(1)).toBe(false);
    expect(sim.requestDecoration(1, placing('desk', -1.9, -1.8)).reason).toBeNull();
    sim.placePlayer(1, { x: -1.9, y: 0, z: -0.9 }, 0, 7);
    expect(sim.nearWorkbenchOf(1)).toBe(true);
  });
});

describe('a chest you build', () => {
  it('keeps what was stored in the old built-in chest until a chest is built, then shows it', () => {
    const sim = home('cabin');
    sim.restoreChest(7, [{ item: 'bone', count: 3 }, ...Array(9).fill(null)]);
    expect(sim.requestChest(1, { action: 'open' }).reason).toBe('unavailable');
    expect(sim.requestDecoration(1, placing('storageChest', -1, -2.6)).reason).toBeNull();
    sim.placePlayer(1, { x: -1, y: 0, z: -1.6 }, 0, 7);
    const opened = sim.requestChest(1, { action: 'open' });
    expect(opened.reason).toBeNull();
    expect(opened.slots[0]).toEqual({ item: 'bone', count: 3 });
  });
  it('stays put while anything is stored in it', () => {
    const sim = home('cabin');
    sim.requestDecoration(1, placing('storageChest', -1, -2.6));
    sim.restoreChest(7, [{ item: 'bone', count: 3 }, ...Array(9).fill(null)]);
    const chest = sim.decorationsList()[0]!;
    expect(sim.requestDecoration(1, { ...chest, action: 'reclaim' }).reason).toBe('contents');
    expect(sim.decorationsList()).toHaveLength(1);
  });
});

describe('saved homes', () => {
  it('moves a piece in from the walls of a room that has shrunk, and leaves others be', () => {
    const lantern: HomeDecoration = { id: 1, homeId: 7, kind: 'lantern', x: 2.6, z: -1.9, yaw: 0 };
    const moved = insideTheWalls('tent', lantern);
    expect(moved.x).toBeCloseTo(2 - 0.15 - BUILDABLE_KINDS.lantern.footprintRadius, 5);
    expect(moved.z).toBeCloseTo(-(2 - 0.15 - BUILDABLE_KINDS.lantern.footprintRadius), 5);
    expect(insideTheWalls('cabin', lantern)).toEqual(lantern);
  });
});

describe('furniture on the wire', () => {
  it('keeps the older indices and adds the furniture after them', () => {
    expect(DECORATION_KINDS.indexOf('firstBellRelic')).toBe(14);
    expect(DECORATION_KINDS.indexOf('bed')).toBe(15);
    expect(DECORATION_KINDS.indexOf('indoorGarden')).toBe(18);
    expect(DECORATION_REASONS.indexOf('unsupported')).toBe(12);
    expect(DECORATION_REASONS.indexOf('onlyOne')).toBe(13);
    expect(buildableKindIndex('woodshed')).toBe(27);
    expect(buildableKindIndex('bed')).toBe(28);
    expect(buildableKindIndex('indoorGarden')).toBe(31);
  });
  it('round-trips a furnished room', () => {
    const pieces: HomeDecoration[] = [
      { id: 1, homeId: 7, kind: 'bed', x: -2.75, z: -1.95, yaw: 0 },
      { id: 2, homeId: 7, kind: 'storageChest', x: -1, z: -2.6, yaw: Math.PI },
    ];
    const decoded = decodeServerMessage(encodeDecorationState({ pieces, reason: 'onlyOne' }));
    expect(decoded).toMatchObject({ reason: 'onlyOne' });
    expect(
      (decoded as unknown as { pieces: HomeDecoration[] }).pieces.map((piece) => piece.kind),
    ).toEqual(['bed', 'storageChest']);
  });
});
