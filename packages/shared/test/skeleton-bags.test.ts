import { expect, it } from 'vitest';
import { skeletonBagDrop } from '../src/sim/creature-loot';
import { RAIDER_KINDS, type RaiderKindId } from '../src/data/raiders';
import { packSlots, slotsUsed } from '../src/sim/inventory';
import { WorldSimulation } from '../src/sim/world-sim';

it('rolls bags independently and deterministically for every skeleton kind at roughly one in four', () => {
  for (const kind of Object.keys(RAIDER_KINDS) as RaiderKindId[]) {
    const rolls = Array.from({ length: 4000 }, (_, tick) => skeletonBagDrop(123, kind, 11, tick));
    expect(rolls).toEqual(
      Array.from({ length: 4000 }, (_, tick) => skeletonBagDrop(123, kind, 11, tick)),
    );
    const rate = rolls.filter(Boolean).length / rolls.length;
    expect(rate).toBeGreaterThan(0.22);
    expect(rate).toBeLessThan(0.28);
  }
});

it('wires bag rewards into skeleton loot and allows a full pack to collect the capacity upgrade', () => {
  const seed = Array.from({ length: 100 }, (_, i) => i).find(
    (seed) => skeletonBagDrop(seed, 'minion', 11, 0) === 'bag',
  )!;
  const sim = new WorldSimulation({
    seed,
    forestEncounters: false,
    hungerEmptyAfterSeconds: Infinity,
  });
  try {
    sim.addPlayer(1);
    const inventory = sim.inventoryOf(1);
    Object.assign(inventory, { axe: 1, rod: 1, shovel: 1, torch: 1, log: 20 });
    expect(slotsUsed(inventory)).toBe(packSlots(inventory));
    // The raid director's existing defeat test verifies this callback fires exactly once after falling.
    const host = (
      sim.raids as unknown as {
        host: {
          dropBonusLoot(
            id: number,
            kind: RaiderKindId,
            position: { x: number; y: number; z: number },
            yaw: number,
          ): void;
        };
      }
    ).host;
    host.dropBonusLoot(11, 'minion', { x: 8, y: sim.collision.terrain.heightAt(8, 8), z: 8 }, 0);
    const pile = sim.droppedPilesList().find((pile) => pile.item === 'bag')!;
    expect(pile?.count).toBe(1);
    const capacity = packSlots(inventory);
    sim.placePlayer(
      1,
      { x: pile.x, y: sim.collision.terrain.heightAt(pile.x, pile.z), z: pile.z },
      0,
    );
    sim.requestLoot(1, { kind: 'pile', id: pile.id });
    sim.step(50);
    expect(inventory.bag).toBe(1);
    expect(packSlots(inventory)).toBe(capacity + 4);
    expect(sim.droppedPilesList().some((p) => p.id === pile.id)).toBe(false);
    // A bag at the cap remains available for another player.
    inventory.bag = 5;
    const nextId = Array.from({ length: 100 }, (_, i) => i + 20).find(
      (id) => skeletonBagDrop(seed, 'minion', id, sim.tick) === 'bag',
    )!;
    host.dropBonusLoot(
      nextId,
      'minion',
      { x: 8, y: sim.collision.terrain.heightAt(8, 8), z: 8 },
      0,
    );
    const extra = sim.droppedPilesList().find((p) => p.item === 'bag')!;
    sim.placePlayer(
      1,
      { x: extra.x, y: sim.collision.terrain.heightAt(extra.x, extra.z), z: extra.z },
      0,
    );
    sim.requestLoot(1, { kind: 'pile', id: extra.id });
    sim.step(50);
    expect(inventory.bag).toBe(5);
    expect(packSlots(inventory)).toBe(24);
    expect(sim.droppedPilesList().find((p) => p.id === extra.id)?.count).toBe(1);
  } finally {
    sim.dispose();
  }
});
