import { afterEach, describe, expect, it } from 'vitest';
import {
  WorldSimulation,
  DEFAULT_WORLD_SEED,
  HOME_FACILITIES,
  homeRoomScale,
  homeFacilityInReach,
  homeHasFacility,
  homeRoomColliders,
  homeChestSpot,
  emptyGarden,
  useGarden,
  gardenFromSaved,
  GARDEN_GROW_TICKS,
  PlayerButton,
  createInput,
  encodeGardenRequest,
  encodeGardenState,
  decodeClientMessage,
  decodeServerMessage,
  startCast,
  ITEM_ORDER,
  recipeFor,
  countOf,
  LIGHT_COMBO,
  type HomeKind,
  type Inventory,
} from '../src/index';
const sims: WorldSimulation[] = [];
afterEach(() => {
  sims.splice(0).forEach((sim) => sim.dispose());
});
function atHome(
  kind: HomeKind = 'largeCabin',
  facility: 'cooking' | 'workbench' | 'garden' = 'garden',
) {
  const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED });
  sims.push(sim);
  sim.restoreBuiltProps([
    { id: 7, kind, x: 0, z: -5, yaw: 0, ownerKey: 'owner', lit: false, litUntilMs: null },
  ]);
  sim.addPlayer(1, undefined, 'owner');
  sim.addPlayer(2, undefined, 'visitor');
  const spot = HOME_FACILITIES[facility],
    scale = homeRoomScale(kind);
  for (const netId of [1, 2])
    sim.placePlayer(netId, { x: spot.x * scale - 0.75, y: 0, z: spot.z * scale }, 0, 7);
  return sim;
}
describe('useful housing facilities', () => {
  it('unlocks stations in order and preserves tent rest/storage collision', () => {
    expect(homeHasFacility('tent', 'cooking')).toBe(false);
    expect(homeHasFacility('teepee', 'cooking')).toBe(true);
    expect(homeHasFacility('teepee', 'workbench')).toBe(false);
    expect(homeHasFacility('cabin', 'workbench')).toBe(true);
    expect(homeHasFacility('cabin', 'garden')).toBe(false);
    expect(homeHasFacility('largeCabin', 'garden')).toBe(true);
    const chest = homeChestSpot('tent');
    expect(homeRoomColliders('tent').some((c) => c.x === chest.x && c.z === chest.z)).toBe(true);
    expect(homeFacilityInReach('tent', 'cooking', HOME_FACILITIES.cooking)).toBe(false);
  });
  it('saves held raw food for the teepee cooking station and cooks on E', () => {
    const sim = atHome('teepee', 'cooking');
    sim.inventoryOf(1).meat = 2;
    expect(sim.useItem(1, 'meat')).toBe(true);
    expect(sim.inventoryOf(1).meat).toBe(2);
    sim.queueInput(1, createInput(1, 0, 0, 0, PlayerButton.Interact));
    sim.step(1000);
    expect(sim.inventoryOf(1).roastedMeat).toBe(1);
    expect(sim.inventoryOf(1).meat).toBe(1);
    sim.queueInput(1, createInput(2, 0, 0, 0, PlayerButton.Interact));
    sim.step(1050);
    expect(sim.inventoryOf(1).roastedMeat).toBe(1);
  });
  it('refuses a workbench recipe remotely without spending and upgrades the equipped tool at the station', () => {
    const sim = atHome('cabin', 'workbench');
    Object.assign(sim.inventoryOf(1), { axe: 1, log: 6, bone: 4 });
    sim.useItem(1, 'axe');
    sim.placePlayer(1, { x: 1, y: 0, z: -1 }, 0, 7);
    expect(sim.craftItem(1, 'refinedAxe')).toBe(false);
    expect(sim.inventoryOf(1)).toMatchObject({ axe: 1, log: 6, bone: 4 });
    sim.placePlayer(1, { x: -2.15, y: 0, z: 1.1 }, 0, 7);
    expect(sim.craftItem(1, 'refinedAxe')).toBe(true);
    expect(sim.equippedItemOf(1)).toBe('refinedAxe');
    expect(sim.inventoryOf(1)).toEqual({ refinedAxe: 1 });
    expect(sim.drainEquipEvents()).toContain(1);
  });
  it('lets visitors use a workbench with their own supplies while the chest remains private', () => {
    const sim = atHome('cabin', 'workbench');
    Object.assign(sim.inventoryOf(2), { rod: 1, stick: 6, bone: 4 });
    expect(sim.craftItem(2, 'refinedRod')).toBe(true);
    expect(sim.requestChest(2, { action: 'open' }).reason).toBe('private');
    expect(sim.inventoryOf(1)).toEqual({});
  });
  it('requires cooking reach and learned knowledge for indoor special meals', () => {
    const sim = atHome('teepee', 'cooking');
    sim.inventoryOf(1).berry = 3;
    expect(sim.craftItem(1, 'berryTea')).toBe(false);
    const saved = sim.persistablePlayers()[0]!;
    sim.removePlayer(1);
    sim.addPlayer(1, { ...saved, discoveriesFound: 8, discoveriesClaimed: 8 }, 'owner');
    sim.placePlayer(1, { x: 1.3, y: 0, z: -0.81 }, 0, 7);
    expect(sim.craftItem(1, 'berryTea')).toBe(true);
    expect(sim.inventoryOf(1).berryTea).toBe(1);
  });
  it('keeps existing item indices and appends refined tools', () => {
    expect(ITEM_ORDER.slice(0, 3)).toEqual(['axe', 'log', 'rod']);
    expect(
      ITEM_ORDER.slice(ITEM_ORDER.indexOf('refinedAxe'), ITEM_ORDER.indexOf('refinedAxe') + 2),
    ).toEqual(['refinedAxe', 'refinedRod']);
    expect(recipeFor('refinedAxe')?.station).toBe('workbench');
  });
  it('makes a refined rod shorten the wait without shortening the catch window', () => {
    const basic = startCast(12, 9, 100, { x: 0, y: 0, z: 0 }, { x: 1, z: 1 });
    const refined = startCast(12, 9, 100, { x: 0, y: 0, z: 0 }, { x: 1, z: 1 }, 0.75);
    expect(refined.biteTick - 100).toBe(Math.round((basic.biteTick - 100) * 0.75));
    expect(refined.giveUpTick - refined.biteTick).toBe(basic.giveUpTick - basic.biteTick);
  });
  it('uses the refined axe in actual swing actions and removes two light-swing steps from a tree', () => {
    const sim = atHome('cabin', 'workbench');
    const tree = sim.clearing.props.find((prop) => prop.kind === 'pine')!;
    sim.inventoryOf(1).refinedAxe = 1;
    sim.useItem(1, 'refinedAxe');
    sim.placePlayer(1, { x: tree.x, y: 0, z: tree.z + 1.5 }, 0);
    const before = sim.swingsLeftOn(tree.id);
    if (before === null) throw new Error('The standing tree has no chop count');
    for (let index = 0; index <= LIGHT_COMBO[0].impact; index++) {
      sim.queueInput(1, createInput(index + 1, 0, 0, 0, index === 0 ? PlayerButton.Swing : 0));
      sim.step(1000 + index * 50);
    }
    expect(sim.swingsLeftOn(tree.id)).toBe(Math.max(0, before - 2));
  });
});
describe('a private garden without upkeep chores', () => {
  it('plants one item, grows in active world time and never expires a ready harvest', () => {
    const sim = atHome();
    sim.inventoryOf(1).berry = 1;
    expect(sim.requestGarden(1, { action: 'plant', plot: 0, crop: 'berry' }).reason).toBeNull();
    expect(countOf(sim.inventoryOf(1), 'berry')).toBe(0);
    expect(sim.savedGardens()[0]?.plots[0]?.growTicks).toBe(GARDEN_GROW_TICKS);
    sim.restoreGarden(
      7,
      sim
        .savedGardens()[0]!
        .plots.map((plot) => ({ ...plot, growTicks: plot.crop === null ? 0 : 2 })),
    );
    sim.removePlayer(1);
    for (let tick = 0; tick < 32; tick++) sim.step(1000 + tick * 50);
    expect(sim.savedGardens()[0]?.plots[0]).toEqual({ crop: 'berry', growTicks: 0 });
    sim.addPlayer(1, undefined, 'owner');
    sim.placePlayer(1, { x: 1.1, y: 0, z: 2.58 }, 0, 7);
    expect(sim.requestGarden(1, { action: 'harvest', plot: 0 }).reason).toBeNull();
    expect(sim.inventoryOf(1).berry).toBe(3);
  });
  it('protects planting and harvesting from visitors, outdoor and remote requests', () => {
    const sim = atHome();
    sim.inventoryOf(1).flower = 1;
    sim.inventoryOf(2).flower = 1;
    expect(sim.requestGarden(2, { action: 'plant', plot: 0, crop: 'flower' }).reason).toBe(
      'private',
    );
    expect(sim.inventoryOf(2).flower).toBe(1);
    sim.placePlayer(1, { x: -2, y: 0, z: -2 }, 0, 7);
    expect(sim.requestGarden(1, { action: 'plant', plot: 0, crop: 'flower' }).reason).toBe(
      'tooFar',
    );
    sim.placePlayer(1, { x: 1.1, y: 0, z: 2.58 }, 0);
    expect(sim.requestGarden(1, { action: 'plant', plot: 0, crop: 'flower' }).reason).toBe(
      'unavailable',
    );
    expect(sim.inventoryOf(1).flower).toBe(1);
  });
  it('leaves a growing crop and a full-pack harvest untouched', () => {
    const plots = emptyGarden(),
      pack: Inventory = { berry: 1 };
    expect(useGarden(plots, pack, { action: 'plant', plot: 0, crop: 'berry' })).toBeNull();
    expect(useGarden(plots, pack, { action: 'harvest', plot: 0 })).toBe('growing');
    plots[0]!.growTicks = 0;
    Object.assign(pack, { log: 60 });
    expect(useGarden(plots, pack, { action: 'harvest', plot: 0 })).toBe('packFull');
    expect(plots[0]!.crop).toBe('berry');
    delete pack.log;
    expect(useGarden(plots, pack, { action: 'harvest', plot: 0 })).toBeNull();
    expect(pack.berry).toBe(3);
  });
  it('restores remaining growth rather than advancing while the world sleeps', () => {
    const sim = atHome();
    sim.inventoryOf(1).mushroom = 1;
    sim.requestGarden(1, { action: 'plant', plot: 2, crop: 'mushroom' });
    sim.step(1000);
    const saved = sim.savedGardens()[0]!;
    const restored = atHome();
    restored.restoreGarden(saved.homeId, JSON.parse(JSON.stringify(saved.plots)));
    expect(restored.savedGardens()).toEqual([saved]);
    restored.step(100000000);
    expect(restored.gardenStateOf(1).plots[2]?.growTicks).toBe(GARDEN_GROW_TICKS - 2);
  });
  it('rejects invalid saves and duplicate planting without losing supplies', () => {
    expect(gardenFromSaved([{ crop: 'log', growTicks: 4 }, ...emptyGarden().slice(1)])).toBeNull();
    expect(gardenFromSaved([{ crop: null, growTicks: 4 }, ...emptyGarden().slice(1)])).toBeNull();
    const plots = emptyGarden(),
      pack: Inventory = { flower: 2 };
    useGarden(plots, pack, { action: 'plant', plot: 0, crop: 'flower' });
    expect(useGarden(plots, pack, { action: 'plant', plot: 0, crop: 'flower' })).toBe('occupied');
    expect(pack.flower).toBe(1);
  });
  it('round-trips strict garden messages and rejects forged indices and crop IDs', () => {
    for (const request of [
      { action: 'inspect' } as const,
      { action: 'plant', plot: 2, crop: 'berry' } as const,
      { action: 'harvest', plot: 1 } as const,
    ])
      expect(decodeClientMessage(encodeGardenRequest(request))).toEqual({
        type: 'garden',
        ...request,
      });
    const state = { homeId: 7, yours: true, plots: emptyGarden(), reason: null };
    state.plots[0] = { crop: 'mushroom', growTicks: GARDEN_GROW_TICKS };
    expect(decodeServerMessage(encodeGardenState(state))).toEqual({ type: 'garden', ...state });
    for (const bytes of [
      [0x0b, 1, 3, 1],
      [0x0b, 1, 0, 4],
      [0x0b, 2, 0, 1],
      [0x0b, 0, 1, 0],
    ])
      expect(decodeClientMessage(new Uint8Array(bytes).buffer)).toBeNull();
    const invalid = new Uint8Array(encodeGardenState(state));
    invalid[7] = 4;
    expect(decodeServerMessage(invalid.buffer)).toBeNull();
  });
});
