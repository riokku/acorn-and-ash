import { afterEach, expect, it } from 'vitest';
import {
  WorldSimulation,
  DEFAULT_WORLD_SEED,
  encodeDecorationRequest,
  decodeClientMessage,
  placedObjectRefund,
  BUILDABLE_KINDS,
  type BuildableKindId,
} from '../src/index';
const sims: WorldSimulation[] = [];
afterEach(() => sims.splice(0).forEach((sim) => sim.dispose()));
function setup(kind: BuildableKindId = 'lantern') {
  const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED, forestEncounters: false });
  sims.push(sim);
  sim.restoreBuiltProps([
    {
      id: 7,
      kind: 'cabin',
      x: -2,
      z: -4.2,
      yaw: 0,
      ownerKey: 'owner',
      lit: false,
      litUntilMs: null,
    },
    { id: 8, kind, x: 1, z: 0, yaw: 0, ownerKey: 'owner', lit: false, litUntilMs: null },
  ]);
  sim.addPlayer(1, undefined, 'owner');
  sim.addPlayer(2, undefined, 'visitor');
  sim.placePlayer(1, { x: 3, y: 0, z: 0 }, 0);
  const request = { id: 8, kind, action: 'reclaimOutdoor' as const, x: 1, z: 0, yaw: 0 };
  return { sim, request };
}
it('packs outdoor decorations into their full materials exactly once and frees collision', () => {
  const { sim, request } = setup();
  const before = sim.collision.colliders.length;
  expect(sim.requestDecoration(1, request).reason).toBeNull();
  expect(sim.builtPropsList().some((prop) => prop.id === 8)).toBe(false);
  expect(sim.collision.colliders.length).toBeLessThan(before);
  for (const cost of BUILDABLE_KINDS.lantern.costs)
    expect(sim.inventoryOf(1)[cost.item]).toBe(cost.amount);
  const pack = { ...sim.inventoryOf(1) };
  expect(sim.requestDecoration(1, request).reason).toBe('missing');
  expect(sim.inventoryOf(1)).toEqual(pack);
});
it('refuses non-owners, distant requests and full inventories without removing anything', () => {
  const { sim, request } = setup();
  expect(sim.requestDecoration(2, request).reason).toBe('private');
  sim.placePlayer(1, { x: 50, y: 0, z: 50 }, 0);
  expect(sim.requestDecoration(1, request).reason).toBe('tooFar');
  sim.placePlayer(1, { x: 3, y: 0, z: 0 }, 0);
  sim.inventoryOf(1).log = 60;
  expect(sim.requestDecoration(1, request).reason).toBe('packFull');
  expect(sim.inventoryOf(1)).toEqual({ log: 60 });
  expect(sim.builtPropsList().some((prop) => prop.id === 8)).toBe(true);
});
it('moves a decoration without charging again and preserves its identity', () => {
  const { sim, request } = setup();
  expect(
    sim.requestDecoration(1, { ...request, action: 'moveOutdoor', x: 1.2, z: 0.5 }).reason,
  ).toBeNull();
  expect(sim.builtPropsList().find((prop) => prop.id === 8)).toMatchObject({ x: 1.2, z: 0.5 });
  expect(sim.inventoryOf(1)).toEqual({});
  expect(
    sim.requestDecoration(1, { ...request, action: 'moveOutdoor', x: -2, z: -4.2 }).reason,
  ).toBe('blocked');
  expect(sim.builtPropsList().find((prop) => prop.id === 8)?.x).toBe(1.2);
});
it('dismantles structures for half materials and rejects moving them', () => {
  const { sim, request } = setup('fence');
  expect(sim.requestDecoration(1, { ...request, action: 'moveOutdoor' }).reason).toBe(
    'unsupported',
  );
  expect(sim.requestDecoration(1, request).reason).toBeNull();
  for (const cost of placedObjectRefund('fence'))
    expect(sim.inventoryOf(1)[cost.item]).toBe(cost.amount);
});
it('protects occupied homes, chest contents and decorations', () => {
  const { sim } = setup();
  sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0);
  const request = {
    id: 7,
    kind: 'cabin' as const,
    action: 'reclaimOutdoor' as const,
    x: -2,
    z: -4.2,
    yaw: 0,
  };
  sim.placePlayer(2, { x: 0, y: 0, z: 0 }, 0, 7);
  expect(sim.requestDecoration(1, request).reason).toBe('occupied');
  sim.placePlayer(2, { x: 10, y: 0, z: 0 }, 0);
  sim.restoreChest(7, [{ item: 'bone', count: 1 }, ...Array(9).fill(null)]);
  expect(sim.requestDecoration(1, request).reason).toBe('contents');
  sim.restoreChest(7, Array(10).fill(null));
  sim.restoreDecorations([{ id: 1, homeId: 7, kind: 'lantern', x: 0, z: 0, yaw: 0 }]);
  expect(sim.requestDecoration(1, request).reason).toBe('contents');
  sim.restoreDecorations([]);
  expect(sim.requestDecoration(1, request).reason).toBeNull();
  expect(sim.builtPropsList().some((prop) => prop.id === 7)).toBe(false);
});
it('keeps old indoor wire IDs and round-trips outdoor actions anywhere in the world', () => {
  const old = { id: 1, kind: 'lantern' as const, action: 'move' as const, x: 1, z: 2, yaw: 0 };
  expect(new Uint8Array(encodeDecorationRequest(old)).slice(0, 3)).toEqual(
    new Uint8Array([12, 1, 3]),
  );
  for (const kind of ['cabin', 'lantern', 'fence'] as const) {
    const request = { ...old, kind, action: 'reclaimOutdoor' as const, x: 300, z: -300 };
    expect(decodeClientMessage(encodeDecorationRequest(request))).toMatchObject(request);
  }
});
