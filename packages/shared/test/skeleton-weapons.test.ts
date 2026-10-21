import { expect, it } from 'vitest';
import { SKELETON_WEAPON_DROPS } from '../src/data/creature-loot';
import { RAIDER_KIND_ORDER } from '../src/data/raiders';
import { skeletonWeaponDrop } from '../src/sim/creature-loot';
import { ITEM_ORDER, itemFromIndex, itemIndex } from '../src/data/items';
import { characterStats } from '../src/data/equipment-stats';
import { WorldSimulation } from '../src/sim/world-sim';

it('only drops each skeleton’s own weapon, deterministically at its 2–5% rate', () => {
  for (const kind of RAIDER_KIND_ORDER) {
    const expected = SKELETON_WEAPON_DROPS[kind];
    const rolls = Array.from({ length: 10000 }, (_, tick) =>
      skeletonWeaponDrop(123, kind, 17, tick),
    );
    expect(rolls).toEqual(
      Array.from({ length: 10000 }, (_, tick) => skeletonWeaponDrop(123, kind, 17, tick)),
    );
    expect(new Set(rolls.filter(Boolean))).toEqual(new Set([expected.item]));
    expect(Math.abs(rolls.filter(Boolean).length / rolls.length - expected.chance)).toBeLessThan(
      0.008,
    );
    expect(expected.chance).toBeGreaterThanOrEqual(0.02);
    expect(expected.chance).toBeLessThanOrEqual(0.05);
  }
});

it('appends weapon wire ids and equips each matching drop with its power bonus', () => {
  const items = [...new Set(Object.values(SKELETON_WEAPON_DROPS).map((drop) => drop.item))];
  expect(ITEM_ORDER.slice(-5)).toEqual(items);
  expect(itemIndex('lastBellTrophy')).toBe(51);
  const sim = new WorldSimulation({ seed: 123, forestEncounters: false });
  try {
    sim.addPlayer(1);
    for (const item of items) {
      expect(itemFromIndex(itemIndex(item))).toBe(item);
      sim.giveTestGear(1, [item]);
      expect(sim.wearGear(1, item, 'mainHand').ok).toBe(true);
      expect(sim.equippedItemOf(1)).toBe(item);
      expect(characterStats(sim.wornOf(1)).power).toBeGreaterThan(100);
    }
  } finally {
    sim.dispose();
  }
});

it('adds the weapon through the skeleton defeat callback and leaves it available for pickup', () => {
  const seed = Array.from({ length: 1000 }, (_, i) => i).find(
    (seed) => skeletonWeaponDrop(seed, 'mage', 17, 0) !== null,
  )!;
  const sim = new WorldSimulation({ seed, forestEncounters: false });
  try {
    sim.addPlayer(1);
    const host = (
      sim.raids as unknown as {
        host: {
          dropBonusLoot(
            id: number,
            kind: 'mage',
            position: { x: number; y: number; z: number },
            yaw: number,
          ): void;
        };
      }
    ).host;
    host.dropBonusLoot(17, 'mage', { x: 8, y: sim.collision.terrain.heightAt(8, 8), z: 8 }, 0);
    const pile = sim.droppedPilesList().find((p) => p.item === 'boneStaff')!;
    expect(pile?.count).toBe(1);
    sim.placePlayer(
      1,
      { x: pile.x, y: sim.collision.terrain.heightAt(pile.x, pile.z), z: pile.z },
      0,
    );
    sim.requestLoot(1, { kind: 'pile', id: pile.id });
    sim.step(50);
    expect(sim.inventoryOf(1).boneStaff).toBe(1);
    expect(sim.wearGear(1, 'boneStaff', 'mainHand').ok).toBe(true);
  } finally {
    sim.dispose();
  }
});
