import { afterEach, describe, expect, it } from 'vitest';
import {
  WorldSimulation,
  DEFAULT_WORLD_SEED,
  createInput,
  BUILDABLE_KIND_ORDER,
  DECORATION_REQUEST_KINDS,
  HOMESTEAD_PROJECTS,
  nearestHomesteadPiece,
  encodeBuild,
  decodeClientMessage,
  emptyChest,
  GARDEN_GROW_TICKS,
  type BuildableKindId,
  type BuiltProp,
  type HomesteadProject,
} from '../src/index';
const worlds: WorldSimulation[] = [];
afterEach(() => {
  worlds.splice(0).forEach((world) => world.dispose());
});
function world() {
  const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED, forestEncounters: false });
  worlds.push(sim);
  sim.restoreBuiltProps([
    {
      id: 7,
      kind: 'tent',
      x: -2,
      z: -4.2,
      yaw: 0,
      lit: false,
      ownerKey: 'owner',
      litUntilMs: null,
    },
  ]);
  sim.addPlayer(1, undefined, 'owner');
  sim.placePlayer(1, { x: 0, y: 0, z: 2 }, 0);
  return sim;
}
function project(sim: WorldSimulation, kind: HomesteadProject, id = 8, x = 0, z = 0) {
  sim.restoreBuiltProps([
    ...sim.builtPropsList().map((p) => ({ ...p, ownerKey: 'owner', litUntilMs: null })),
    { id, kind, x, z, yaw: 0, lit: false, ownerKey: 'owner', litUntilMs: null },
  ]);
}
function build(sim: WorldSimulation, kind: BuildableKindId, seq = 1) {
  sim.requestBuild(1, { kind, x: 0, z: 0, yaw: 0 });
  sim.queueInput(1, createInput(seq, 0, 0, 0));
  sim.step(1000 + seq * 50);
  return sim.drainBuildReplies().at(-1)?.reason;
}
describe('a working homestead', () => {
  it('appends build and reclaim IDs and keeps old prefixes stable', () => {
    expect(BUILDABLE_KIND_ORDER.slice(0, 9)).toEqual([
      'campfire',
      'cabin',
      'flowerBed',
      'lantern',
      'fence',
      'gardenPath',
      'tent',
      'teepee',
      'largeCabin',
    ]);
    expect(BUILDABLE_KIND_ORDER.slice(21, 24)).toEqual([
      'lastBellTrophy',
      'sunreachPennant',
      'firstBellRelic',
    ]);
    expect(DECORATION_REQUEST_KINDS.slice(21, 24)).toEqual([
      'rowboat',
      'sunreachPennant',
      'firstBellRelic',
    ]);
    for (const { kind } of HOMESTEAD_PROJECTS) {
      expect(decodeClientMessage(encodeBuild({ kind, x: 1, z: 2, yaw: 0 }))).toEqual({
        type: 'build',
        kind,
        x: 1,
        z: 2,
        yaw: 0,
      });
    }
  });
  it('requires an owned home and spends materials only on a valid, unique project', () => {
    const sim = world();
    Object.assign(sim.inventoryOf(1), { log: 8, stick: 6 });
    expect(build(sim, 'trailWorkbench')).toBeNull();
    expect(sim.inventoryOf(1).log ?? 0).toBe(0);
    expect(sim.builtPropsList().filter((p) => p.kind === 'trailWorkbench')).toHaveLength(1);
    Object.assign(sim.inventoryOf(1), { log: 8, stick: 6 });
    // Clear the normal build cooldown before retrying.
    for (let i = 2; i < 30; i++) {
      sim.queueInput(1, createInput(i, 0, 0, 0));
      sim.step(1000 + i * 50);
    }
    expect(build(sim, 'trailWorkbench', 30)).toBe('alreadyOwned');
    expect(sim.inventoryOf(1).log).toBe(8);
    sim.addPlayer(2, undefined, 'visitor');
    sim.placePlayer(2, { x: 0, y: 0, z: 2 }, 0);
    Object.assign(sim.inventoryOf(2), { log: 6, stick: 4, rope: 2 });
    sim.requestBuild(2, { kind: 'trailPantry', x: 3, z: 1, yaw: 0 });
    sim.queueInput(2, createInput(1, 0, 0, 0));
    sim.step(3000);
    expect(sim.drainBuildReplies().at(-1)?.reason).toBe('area');
    expect(sim.inventoryOf(2).log).toBe(6);
  });
  it('refines tools by the outdoor bench without granting remote crafting', () => {
    const sim = world();
    project(sim, 'trailWorkbench');
    sim.placePlayer(1, { x: 0, y: 0, z: 1.5 }, 0);
    expect(sim.nearWorkbenchOf(1)).toBe(true);
    Object.assign(sim.inventoryOf(1), { axe: 1, log: 6, bone: 4 });
    expect(sim.craftItem(1, 'refinedAxe')).toBe(true);
    expect(sim.inventoryOf(1).refinedAxe).toBe(1);
    sim.placePlayer(1, { x: 0, y: 0, z: 4 }, 0);
    expect(sim.nearWorkbenchOf(1)).toBe(false);
  });
  it('keeps the pantry private, saves its actual slots, and refuses a loaded reclaim', () => {
    const sim = world();
    project(sim, 'trailPantry');
    sim.placePlayer(1, { x: 0, y: 0, z: 1.5 }, 0);
    Object.assign(sim.inventoryOf(1), { log: 4 });
    const saved = sim.requestChest(1, { action: 'deposit', item: 'log', amount: 4 });
    expect(saved.reason).toBeNull();
    expect(saved.moved).toBe(4);
    expect(saved.homeId).toBe(8);
    expect(sim.chestSlots(7)).toEqual(emptyChest());
    sim.addPlayer(2, undefined, 'visitor');
    sim.placePlayer(2, { x: 0, y: 0, z: 1.5 }, 0);
    expect(sim.requestChest(2, { action: 'open' }).reason).toBe('private');
    expect(sim.requestChest(2, { action: 'open' }).slots).toEqual(emptyChest());
    expect(
      sim.requestDecoration(1, {
        action: 'reclaimOutdoor',
        id: 8,
        kind: 'trailPantry',
        x: 0,
        z: 0,
        yaw: 0,
      }).reason,
    ).toBe('contents');
    const loaded = world();
    project(loaded, 'trailPantry');
    loaded.restoreChest(8, saved.slots);
    loaded.placePlayer(1, { x: 0, y: 0, z: 1.5 }, 0);
    expect(loaded.requestChest(1, { action: 'withdraw', slot: 0, amount: 4 }).moved).toBe(4);
    expect(loaded.inventoryOf(1).log).toBe(4);
    expect(loaded.requestChest(1, { action: 'withdraw', slot: 0, amount: 4 }).moved).toBe(0);
    expect(
      loaded.requestDecoration(1, {
        action: 'reclaimOutdoor',
        id: 8,
        kind: 'trailPantry',
        x: 0,
        z: 0,
        yaw: 0,
      }).reason,
    ).toBeNull();
    expect(loaded.builtPropsList().some((prop) => prop.id === 8)).toBe(false);
    expect(loaded.chestSlots(8)).toEqual(emptyChest());
    loaded.placePlayer(1, { x: 0, y: 0, z: 6 }, 0);
    expect(loaded.requestChest(1, { action: 'open' }).reason).toBe('unavailable');
  });
  it('plants outdoors, restores progress, harvests once and protects plants from reclaim', () => {
    const sim = world();
    project(sim, 'kitchenGarden');
    sim.placePlayer(1, { x: 0, y: 0, z: 1.5 }, 0);
    Object.assign(sim.inventoryOf(1), { berry: 1 });
    expect(sim.requestGarden(1, { action: 'plant', plot: 0, crop: 'berry' }).reason).toBeNull();
    expect(sim.savedGardens()[0]?.plots[0]).toEqual({
      crop: 'berry',
      growTicks: GARDEN_GROW_TICKS,
    });
    expect(
      sim.requestDecoration(1, {
        action: 'reclaimOutdoor',
        id: 8,
        kind: 'kitchenGarden',
        x: 0,
        z: 0,
        yaw: 0,
      }).reason,
    ).toBe('contents');
    const loaded = world();
    project(loaded, 'kitchenGarden');
    loaded.restoreGarden(8, [
      { crop: 'berry', growTicks: 0 },
      { crop: null, growTicks: 0 },
      { crop: null, growTicks: 0 },
    ]);
    loaded.placePlayer(1, { x: 0, y: 0, z: 1.5 }, 0);
    loaded.addPlayer(2, undefined, 'visitor');
    loaded.placePlayer(2, { x: 0, y: 0, z: 1.5 }, 0);
    expect(loaded.gardenStateOf(2).yours).toBe(false);
    expect(loaded.requestGarden(2, { action: 'harvest', plot: 0 }).reason).toBe('private');
    expect(loaded.requestGarden(1, { action: 'harvest', plot: 0 }).reason).toBeNull();
    expect(loaded.inventoryOf(1).berry).toBe(3);
    expect(loaded.requestGarden(1, { action: 'harvest', plot: 0 }).reason).toBe('empty');
    loaded.placePlayer(1, { x: 0, y: 0, z: 5 }, 0);
    expect(loaded.requestGarden(1, { action: 'plant', plot: 0, crop: 'berry' }).reason).toBe(
      'tooFar',
    );
  });
  it('chooses nearest pieces with stable ties, outside a player room only', () => {
    const pieces: BuiltProp[] = [
      { id: 9, kind: 'trailPantry', x: 1, z: 0, yaw: 0, lit: false },
      { id: 8, kind: 'trailPantry', x: -1, z: 0, yaw: 0, lit: false },
    ];
    expect(nearestHomesteadPiece(pieces, 'trailPantry', { x: 0, z: 0 })?.id).toBe(8);
    expect(nearestHomesteadPiece(pieces, 'trailPantry', { x: 10, z: 0 })).toBeNull();
  });
});
