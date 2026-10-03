import { afterEach, describe, expect, it } from 'vitest';
import {
  WorldSimulation,
  DEFAULT_WORLD_SEED,
  PlayerButton,
  createInput,
  ITEM_KINDS,
  canCraft,
  encodeDiscoveries,
  decodeServerMessage,
  encodeGatherPatches,
  discoveryKnown,
  type DiscoveryKind,
} from '../src/index';
const sims: WorldSimulation[] = [];
afterEach(() => {
  for (const sim of sims.splice(0)) sim.dispose();
});
function setup() {
  const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED });
  sims.push(sim);
  sim.addPlayer(1, undefined, 'one');
  sim.addPlayer(2, undefined, 'two');
  let sequence = 0,
    clock = 1000;
  const visit = (kind: DiscoveryKind, player = 1) => {
    const site = sim.discoverySites.find((s) => s.kind === kind)!;
    sim.placePlayer(player, { x: site.x, y: 0, z: site.z }, 0);
    sim.queueInput(player, createInput(++sequence, 0, 0, 0));
    sim.step((clock += 50));
    return site;
  };
  const inspect = (player = 1) => {
    sim.queueInput(player, createInput(++sequence, 0, 0, 0, PlayerButton.Interact));
    sim.step((clock += 50));
    sim.queueInput(player, createInput(++sequence, 0, 0, 0));
    sim.step((clock += 50));
  };
  return { sim, visit, inspect };
}
describe('personal discoveries and useful rewards', () => {
  it('marks a location when approached but waits for deliberate inspection to claim', () => {
    const { sim, visit, inspect } = setup();
    const site = visit('camp');
    expect(sim.discoveryStateOf(1)).toMatchObject({ found: 1, claimed: 0 });
    expect(sim.inventoryOf(1).berry ?? 0).toBe(0);
    expect(sim.discoveryStateOf(2).found).toBe(0);
    inspect();
    expect(discoveryKnown(sim.discoveryStateOf(1).claimed, site.id)).toBe(true);
    expect(sim.inventoryOf(1).berry).toBe(4);
  });
  it('rewards each character once and lets a friend inspect the same site', () => {
    const { sim, visit, inspect } = setup();
    visit('logging');
    inspect();
    inspect();
    expect(sim.inventoryOf(1).log).toBe(6);
    expect(sim.inventoryOf(1).stick).toBe(4);
    visit('logging', 2);
    inspect(2);
    expect(sim.inventoryOf(2).log).toBe(6);
    expect(sim.discoveryStateOf(2).claimed).toBe(2);
  });
  it('keeps the complete reward pending if a full pack cannot receive it', () => {
    const { sim, visit, inspect } = setup();
    visit('camp');
    sim.inventoryOf(1).log = ITEM_KINDS.log.stackSize * 6;
    const before = { ...sim.inventoryOf(1) };
    inspect();
    expect(sim.inventoryOf(1)).toEqual(before);
    expect(sim.discoveryStateOf(1).claimed).toBe(0);
    expect(sim.drainDiscoveryChanges().find((e) => e.netId === 1)?.state.notice).toBe('full');
    delete sim.inventoryOf(1).log;
    inspect();
    expect(sim.inventoryOf(1).berry).toBe(4);
  });
  it('does not pay partial multi-item rewards or consume their claim', () => {
    const { sim, visit, inspect } = setup();
    visit('logging');
    sim.inventoryOf(1).berry = ITEM_KINDS.berry.stackSize * 5;
    const before = { ...sim.inventoryOf(1) };
    inspect();
    expect(sim.inventoryOf(1)).toEqual(before);
    expect(sim.discoveryStateOf(1).claimed).toBe(0);
  });
  it('requires nearby skeleton guards to be cleared first', () => {
    const { sim, visit, inspect } = setup();
    const site = visit('logging');
    const raid = sim.startRaid(1, ['minion'])!;
    const id = sim.raids.raidersOf(raid)[0]!;
    sim.raids.placeRaider(id, { x: site.x + 1.4, y: 0, z: site.z }, 0);
    inspect();
    expect(sim.discoveryStateOf(1).claimed).toBe(0);
    expect(sim.drainDiscoveryChanges().find((e) => e.netId === 1)?.state.notice).toBe('guarded');
  });
  it('persists found/claimed locations and learned recipes across reconnect', () => {
    const { sim, visit, inspect } = setup();
    visit('grove');
    inspect();
    const saved = sim.persistablePlayers().find((p) => p.netId === 1)!;
    const back = setup().sim;
    back.addPlayer(9, saved, 'one');
    expect(back.discoveryStateOf(9)).toMatchObject({ found: 4, claimed: 4 });
    expect(canCraft({ roastedMeat: 1, mushroom: 3 }, 'forestStew', saved.discoveriesClaimed)).toBe(
      true,
    );
    expect(canCraft({ roastedMeat: 1, mushroom: 3 }, 'forestStew', 0)).toBe(false);
  });
  it('does not inspect remote sites or claim while indoors', () => {
    const { sim, inspect } = setup();
    inspect();
    expect(sim.discoveryStateOf(1).claimed).toBe(0);
    const site = sim.discoverySites.find((s) => s.kind === 'camp')!;
    sim.restoreBuiltProps([
      { id: 7, kind: 'tent', x: 0, z: 0, yaw: 0, lit: false, ownerKey: 'one', litUntilMs: null },
    ]);
    sim.placePlayer(1, { x: site.x, y: 0, z: site.z }, 0, 7);
    inspect();
    expect(sim.discoveryStateOf(1).claimed).toBe(0);
  });
  it('requires learned recipes and a lit nearby campfire for hot meals', () => {
    const { sim, visit, inspect } = setup();
    const site = visit('shrine');
    sim.inventoryOf(1).berry = 3;
    expect(sim.craftItem(1, 'berryTea')).toBe(false);
    inspect();
    expect(sim.craftItem(1, 'berryTea')).toBe(false);
    sim.restoreBuiltProps([
      {
        id: 7,
        kind: 'campfire',
        x: site.x,
        z: site.z + 1.5,
        yaw: 0,
        lit: true,
        ownerKey: 'one',
        litUntilMs: 100000,
      },
    ]);
    expect(sim.craftItem(1, 'berryTea')).toBe(true);
    expect(sim.inventoryOf(1).berryTea).toBe(1);
  });
  it('keeps shared forest foraging near its original glade after regrowth', () => {
    const { sim } = setup();
    const patch = sim.gatherPatchesList().find((p) => p.item === 'mushroom')!;
    sim.restorePatches([
      { id: patch.id, x: patch.x, z: patch.z, remaining: 0, generation: 0, emptiedAtMs: 0 },
    ]);
    sim.regrowPatches(100000000);
    const after = sim.gatherPatchesList().find((p) => p.id === patch.id)!;
    expect(after.remaining).toBeGreaterThan(0);
    expect(Math.hypot(after.x - patch.x, after.z - patch.z)).toBeLessThanOrEqual(8.1);
  });
  it('preserves forage IDs through the established one-byte patch protocol', () => {
    const { sim } = setup();
    const patches = sim.gatherPatchesList();
    const message = decodeServerMessage(encodeGatherPatches(patches));
    expect(message?.type).toBe('gatherPatches');
    if (message?.type !== 'gatherPatches') throw new Error('missing patch message');
    expect(message.patches.map((patch) => patch.id)).toEqual(patches.map((patch) => patch.id));
  });
  it('strictly decodes private discovery state and refuses invalid claim masks', () => {
    const state = { found: 15, claimed: 5, notice: 'guarded' as const };
    expect(decodeServerMessage(encodeDiscoveries(state))).toEqual({
      type: 'discoveries',
      ...state,
    });
    for (const bytes of [
      [0x33, 1, 2, 0],
      [0x33, 128, 0, 0],
      [0x33, 1, 0, 5],
      [0x33, 1, 0],
    ])
      expect(decodeServerMessage(new Uint8Array(bytes).buffer)).toBeNull();
  });
});
