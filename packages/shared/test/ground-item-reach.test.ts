import { describe, expect, it } from 'vitest';
import { groundItemReachable } from '../src/sim/ground-item-reach';
import { pickupInReach } from '../src/sim/pickups';
import { gatherSpotInReach } from '../src/sim/gathering';
import { droppedPileInReach } from '../src/sim/dropping';
import { DugGrid, CUBE_DIG } from '../src/world/digging';

const flat = { terrain: { kind: 'test', heightAt: () => 0 } };
const feet = { x: 0, y: 0, z: 0 };
describe('terrain-aware ground-item reach', () => {
  it('keeps the full horizontal reach on flat ground and during an ordinary hop', () => {
    for (const y of [0, 1.2])
      expect(groundItemReachable(flat, { ...feet, y }, { x: 2, z: 0 })).toBe(true);
    expect(groundItemReachable(flat, feet, { x: 2.01, z: 0 })).toBe(false);
    expect(groundItemReachable(flat, feet, { x: 1, z: 0 }, 0.9)).toBe(true);
  });
  it('rejects an item on another floor despite overlapping horizontal coordinates', () => {
    expect(groundItemReachable(flat, { ...feet, y: -4 }, feet)).toBe(false);
    expect(groundItemReachable(flat, { ...feet, y: 4 }, feet)).toBe(false);
  });
  it('blocks reaching through a bank while allowing the same target from its clear side', () => {
    const world = {
      terrain: { kind: 'bank', heightAt: (x: number) => (x > 0.5 && x < 1 ? 2 : 0) },
    };
    expect(groundItemReachable(world, feet, { x: 1.5, z: 0 })).toBe(false);
    expect(groundItemReachable(world, { x: 2, y: 0, z: 0 }, { x: 1.5, z: 0 })).toBe(true);
  });
  it('allows reach through excavated air without accepting a solid ceiling', () => {
    const terrain = { kind: 'hole', heightAt: () => 1 };
    const dug = new DugGrid(terrain);
    const world = { terrain, dug };
    const actor = { x: 0.1, y: -1, z: 0.25 },
      target = { x: 1.5, z: 0.25 };
    expect(groundItemReachable(world, actor, target)).toBe(false);
    dug.apply({ ix: 0, iy: 0, iz: 0, dir: CUBE_DIG });
    dug.apply({ ix: 2, iy: 0, iz: 0, dir: CUBE_DIG });
    expect(groundItemReachable(world, actor, target)).toBe(true);
  });
  it('selects the nearest reachable target consistently for pickups, piles and patches', () => {
    const inaccessible = {
      id: 1,
      x: 0.5,
      z: 0,
      y: 0,
      item: 'stick' as const,
      count: 1,
      remaining: 1,
    };
    const accessible = { ...inaccessible, id: 2, x: 1.5 };
    const targets = [inaccessible, accessible];
    const canReach = (target: { id: number }) => target.id === 2;
    expect(pickupInReach(feet, targets, () => false, canReach)?.id).toBe(2);
    expect(droppedPileInReach(feet, targets, canReach)?.id).toBe(2);
    expect(gatherSpotInReach(feet, targets, canReach)?.id).toBe(2);
  });
});
