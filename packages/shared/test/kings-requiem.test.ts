import { expect, it } from 'vitest';
import {
  WorldSimulation,
  createFlatTerrain,
  itemIndex,
  itemFromIndex,
  characterStats,
  catalogItem,
  encodeGear,
  decodeClientMessage,
  inventoryEntries,
} from '../src/index';

it('keeps old wire IDs and exposes an editable epic main-hand weapon with stronger power', () => {
  expect(itemIndex('kingsRequiem')).toBe(60);
  expect(itemFromIndex(60)).toBe('kingsRequiem');
  expect(itemIndex('watchGreatsword')).toBe(56);
  expect(itemIndex('kingCrown')).toBe(58);
  expect(catalogItem('kingsRequiem')).toMatchObject({ rarity: 'epic', bonuses: { power: 85 } });
  expect(
    catalogItem('kingsRequiem', {
      kingsRequiem: { bonuses: { power: 95 }, displayName: 'First Bell' },
    }),
  ).toMatchObject({ displayName: 'First Bell', bonuses: { power: 95 } });
  expect(characterStats({ mainHand: 'kingsRequiem' }).power).toBe(185);
  expect(
    decodeClientMessage(encodeGear({ action: 'wear', slot: 'mainHand', item: 'kingsRequiem' })),
  ).toMatchObject({ type: 'gear', item: 'kingsRequiem' });
});
it('guarantees one personal sword per recent contributor, permits pickup and equip, and excludes spectators', () => {
  const sim = new WorldSimulation({
    seed: 1234,
    terrain: createFlatTerrain(),
    forestEncounters: false,
    hungerEmptyAfterSeconds: Infinity,
    raidIntervalSeconds: 86400,
  });
  try {
    for (let id = 1; id <= 3; id++) {
      sim.addPlayer(id, undefined, `hero-${id}`);
      sim.placePlayer(id, { x: 0, y: 0, z: 0 }, 0);
    }
    const raid = sim.startRaid(1, ['hollowKing'])!;
    const id = sim.raids.raidersOf(raid)[0]!;
    for (let t = 0; t < 40; t++) sim.step(1000 + t * 50);
    sim.raids.placeRaider(id, { x: 0, y: 0, z: -1.4 }, Math.PI);
    sim.raids.blowLands(2, { x: 0, y: 0, z: 0 }, 0, { kind: 'swing', step: 1 }, 0);
    sim.raids.blowLands(1, { x: 0, y: 0, z: 0 }, 0, { kind: 'strike' }, 0, 200_000);
    const sword = sim.droppedPilesList(1).find((p) => p.item === 'kingsRequiem')!;
    expect(sword?.count).toBe(1);
    expect(sim.droppedPilesList(2).filter((p) => p.item === 'kingsRequiem')).toHaveLength(1);
    expect(sim.droppedPilesList(3).some((p) => p.item === 'kingsRequiem')).toBe(false);
    sim.requestLoot(3, { kind: 'pile', id: sword.id });
    sim.step(4000);
    expect(sim.inventoryOf(3).kingsRequiem).toBeUndefined();
    sim.requestLoot(1, { kind: 'pile', id: sword.id });
    sim.step(4050);
    expect(sim.inventoryOf(1).kingsRequiem).toBe(1);
    // Like other weapons, it must use the gear gate rather than bypassing combat restrictions.
    expect(sim.useItem(1, 'kingsRequiem')).toBe(false);
    // Let the defeated king finish crumbling before changing gear.
    for (let t = 0; t < 40; t++) sim.step(4100 + t * 50);
    expect(sim.wearGear(1, 'kingsRequiem', 'mainHand').ok).toBe(true);
    expect(sim.equippedItemOf(1)).toBe('kingsRequiem');
    expect(inventoryEntries(sim.inventoryOf(1)).some((e) => e.item === 'kingsRequiem')).toBe(false);
    expect(sim.wornOf(1).mainHand).toBe('kingsRequiem');
    // The usual optional public weapon roll cannot duplicate the guaranteed personal reward.
    expect(sim.raidersList().some((r) => r.id === id)).toBe(false);
    expect(sim.droppedPilesList(3).some((p) => p.item === 'kingsRequiem')).toBe(false);
  } finally {
    sim.dispose();
  }
});
