import { describe, expect, it } from 'vitest';
import { WorldSimulation } from '../src/sim/world-sim';
import { DEFAULT_WORLD_SEED } from '../src/constants';
import { PlayerButton, createInput } from '../src/sim/player';

describe('authoritative terrain reach', () => {
  it.each(['keyboard', 'mouse'] as const)(
    'keeps a pickup on its bank until reached from the clear side (%s)',
    (input) => {
      const sim = new WorldSimulation({
        seed: DEFAULT_WORLD_SEED,
        forestEncounters: false,
        hungerEmptyAfterSeconds: Infinity,
      });
      try {
        sim.addPlayer(1);
        const axe = sim.clearing.pickups.find((p) => p.item === 'axe')!;
        sim.collision.terrain.heightAt = (x) => (x > axe.x + 0.3 ? 0 : 4);
        sim.placePlayer(1, { x: axe.x + 1.2, y: 0, z: axe.z }, 0);
        const interact = (seq: number) => {
          if (input === 'mouse') sim.requestLoot(1, { kind: 'pickup', id: axe.id });
          else sim.queueInput(1, createInput(seq, 0, 0, 0, PlayerButton.Interact));
          sim.step(seq * 50);
        };
        expect(sim.reachablePickup(1)).toBeNull();
        interact(1);
        expect(sim.inventoryOf(1).axe ?? 0).toBe(0);
        expect(sim.drainPickupEvents()).toEqual([]);
        sim.placePlayer(1, { x: axe.x - 1.2, y: 4, z: axe.z }, 0);
        expect(sim.reachablePickup(1)?.id).toBe(axe.id);
        interact(2);
        expect(sim.inventoryOf(1).axe).toBe(1);
      } finally {
        sim.dispose();
      }
    },
  );
});
