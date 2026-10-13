import { describe, expect, it } from 'vitest';
import { CRAFT_REFUSALS, inventoryCraftRefusal } from '../src/sim/crafting';
import { encodeCraftRefused, decodeServerMessage } from '../src/net/protocol';
import { DEFAULT_WORLD_SEED } from '../src/index';
import { WorldSimulation } from '../src/sim/world-sim';

describe('craft refusals', () => {
  it('distinguishes missing materials, existing tools, unavailable recipes and a full pack without spending anything', () => {
    expect(inventoryCraftRefusal({ stick: 1 }, 'axe')).toBe('materials');
    expect(inventoryCraftRefusal({ stick: 3, axe: 1 }, 'axe')).toBe('alreadyOwned');
    expect(inventoryCraftRefusal({}, 'perch')).toBe('unavailable');
    expect(inventoryCraftRefusal({}, 'berryTea')).toBe('recipe');
    const full = { stick: 3, log: 10, perch: 10, trout: 10, meat: 10, flower: 10 };
    const before = { ...full };
    expect(inventoryCraftRefusal(full, 'torch')).toBe('packFull');
    expect(full).toEqual(before);
    expect(inventoryCraftRefusal({ stick: 2 }, 'torch')).toBeNull();
  });
  it('reports station requirements from the authoritative world', () => {
    const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED });
    sim.addPlayer(1);
    expect(sim.craftRefusalFor(99, 'axe')).toBe('unavailable');
    expect(sim.craftRefusalFor(1, 'refinedAxe')).toBe('workbench');
    expect(sim.craftRefusalFor(1, 'berryTea')).toBe('campfire');
    expect(sim.craftItem(1, 'refinedAxe')).toBe(false);
    expect(sim.drainCraftEvents()).toEqual([]);
    sim.dispose();
  });
  it.each(CRAFT_REFUSALS)('round-trips the private %s response with its item', (reason) => {
    expect(decodeServerMessage(encodeCraftRefused('rope', reason))).toEqual({
      type: 'craftRefused',
      item: 'rope',
      reason,
    });
  });
  it('rejects malformed lengths, unknown items and unknown reasons', () => {
    const good = encodeCraftRefused('rope', 'materials');
    expect(decodeServerMessage(good.slice(0, 2))).toBeNull();
    for (const [offset, value] of [
      [1, 255],
      [2, 0],
      [2, 255],
    ]) {
      const bad = good.slice(0);
      new DataView(bad).setUint8(offset!, value!);
      expect(decodeServerMessage(bad)).toBeNull();
    }
  });
});
