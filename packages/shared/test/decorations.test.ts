import { afterEach, expect, it } from 'vitest';
import {
  WorldSimulation,
  DEFAULT_WORLD_SEED,
  checkDecorationSpot,
  encodeDecorationRequest,
  encodeDecorationState,
  decodeClientMessage,
  decodeServerMessage,
  HOME_WAKE_SPOT,
  HOME_ENTRY,
  HOME_FACILITIES,
  PLAYER_RADIUS,
  BUILDABLE_KINDS,
  createInput,
  type DecorationRequest,
  type HomeDecoration,
  type HomeKind,
} from '../src/index';
const sims: WorldSimulation[] = [];
afterEach(() => sims.splice(0).forEach((sim) => sim.dispose()));
function room(kind: HomeKind = 'cabin') {
  const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED });
  sims.push(sim);
  sim.restoreBuiltProps([
    { id: 7, kind, x: 0, z: -5, yaw: 0, ownerKey: 'owner', lit: false, litUntilMs: null },
  ]);
  sim.addPlayer(1, undefined, 'owner');
  sim.addPlayer(2, undefined, 'visitor');
  sim.placePlayer(1, { x: 0, y: 0, z: 2 }, 0, 7);
  sim.placePlayer(2, { x: 0, y: 0, z: 2 }, 0, 7);
  Object.assign(sim.inventoryOf(1), { log: 20, stick: 20, flower: 10 });
  return sim;
}
const place: DecorationRequest = {
  action: 'place',
  kind: 'cedarBench',
  id: 0,
  x: -0.5,
  z: -0.1,
  yaw: 0,
};
it('lets an owner freely place, rotate and move a piece without paying twice', () => {
  const sim = room();
  expect(sim.requestDecoration(1, place).reason).toBeNull();
  expect(sim.inventoryOf(1)).toMatchObject({ log: 16, stick: 18 });
  const piece = sim.decorationsList()[0]!;
  expect(
    sim.requestDecoration(1, { ...piece, action: 'move', x: 0, z: -1.1, yaw: Math.PI / 2 }).reason,
  ).toBeNull();
  expect(sim.inventoryOf(1)).toMatchObject({ log: 16, stick: 18 });
  expect(sim.decorationsList()[0]?.yaw).toBe(Math.PI / 2);
});
it('protects private rooms, outside requests and another home’s piece', () => {
  const sim = room();
  expect(sim.requestDecoration(2, place).reason).toBe('private');
  expect(sim.decorationsList()).toEqual([]);
  sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0);
  expect(sim.requestDecoration(1, place).reason).toBe('unavailable');
  sim.placePlayer(1, { x: 0, y: 0, z: 2 }, 0, 7);
  expect(sim.requestDecoration(1, { ...place, action: 'move', id: 99 }).reason).toBe('missing');
});
it('keeps doorways, waking spots, furniture, useful stations and players clear without spending', () => {
  const sim = room(),
    before = { ...sim.inventoryOf(1) };
  for (const spot of [
    HOME_WAKE_SPOT,
    HOME_ENTRY,
    HOME_FACILITIES.cooking,
    HOME_FACILITIES.workbench,
    { x: 0, z: 2 },
    { x: 3.5, z: 0 },
  ])
    expect(sim.requestDecoration(1, { ...place, ...spot }).reason).toBe('blocked');
  expect(sim.inventoryOf(1)).toEqual(before);
  expect(sim.decorationsList()).toEqual([]);
});
it('reclaims materials atomically and refuses a full backpack without removing the piece', () => {
  const sim = room();
  sim.requestDecoration(1, place);
  const piece = sim.decorationsList()[0]!;
  const pack = sim.inventoryOf(1);
  for (const key of Object.keys(pack)) delete pack[key as keyof typeof pack];
  Object.assign(pack, { log: 60 });
  expect(sim.requestDecoration(1, { ...piece, action: 'reclaim' }).reason).toBe('packFull');
  expect(sim.decorationsList()).toEqual([piece]);
  expect(pack).toEqual({ log: 60 });
  delete pack.log;
  expect(sim.requestDecoration(1, { ...piece, action: 'reclaim' }).reason).toBeNull();
  expect(pack).toEqual({ log: 4, stick: 2 });
  expect(sim.decorationsList()).toEqual([]);
});
it('retains positions after restore and applies furniture collision in the room', () => {
  const sim = room();
  sim.requestDecoration(1, place);
  const saved = sim.decorationsList();
  const returned = room();
  returned.restoreDecorations(saved);
  expect(returned.decorationsList()).toEqual(saved);
  returned.placePlayer(1, { x: place.x, y: 0, z: place.z }, 0, 7);
  returned.queueInput(1, createInput(1, 0, 0, 0, 0));
  returned.step(Date.now());
  const at = returned.snapshotFor(1).find((entity) => entity.netId === 1)!;
  expect(Math.hypot(at.x - place.x, at.z - place.z)).toBeGreaterThanOrEqual(
    BUILDABLE_KINDS.cedarBench.footprintRadius + PLAYER_RADIUS - 0.01,
  );
  expect(checkDecorationSpot('cabin', { ...saved[0]!, id: 2 }, saved, { x: 0, z: 2 })).toBe(
    'blocked',
  );
});
it('round-trips bounded decoration requests/state and rejects malformed, duplicate and forged data', () => {
  expect(decodeClientMessage(encodeDecorationRequest(place))).toEqual({
    type: 'decoration',
    ...place,
    z: Math.fround(place.z),
  });
  const piece: HomeDecoration = { id: 1, homeId: 7, kind: 'wovenRug', x: 0.5, z: 0, yaw: 1 };
  expect(decodeServerMessage(encodeDecorationState({ pieces: [piece], reason: null }))).toEqual({
    type: 'decoration',
    pieces: [piece],
    reason: null,
  });
  expect(
    decodeServerMessage(encodeDecorationState({ pieces: [piece, piece], reason: null })),
  ).toBeNull();
  const bad = encodeDecorationRequest({ ...place, x: NaN });
  expect(decodeClientMessage(bad)).toBeNull();
  expect(
    decodeClientMessage(encodeDecorationRequest({ ...place, action: 'move', id: 0 })),
  ).toBeNull();
  expect(
    decodeServerMessage(encodeDecorationState({ pieces: [piece], reason: null }).slice(0, -1)),
  ).toBeNull();
});
