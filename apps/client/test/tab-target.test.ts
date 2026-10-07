import { describe, expect, it } from 'vitest';
import { TabTargeting, TARGET_RANGE, type HostileTarget } from '../src/input/tab-target';

const player = { x: 0, y: 0, z: 0 };
const enemy = (id: number, x: number, z: number, y = 0): HostileTarget => ({
  id,
  x,
  y,
  z,
  name: 'Enemy',
});

describe('tab targeting', () => {
  it('prefers the forward cone over a closer enemy behind and balances distance with alignment', () => {
    const targeting = new TabTargeting();
    const targets = [enemy(1, 0, 1), enemy(2, 4, -5), enemy(3, 0, -5)];
    expect(targeting.cycle(player, 0, targets, 1)?.id).toBe(3);
    expect(targeting.cycle(player, 0, targets, 1)?.id).toBe(2);
    expect(targeting.cycle(player, 0, targets, 1)?.id).toBe(1);
    expect(targeting.cycle(player, 0, targets, 1)?.id).toBe(3);
  });

  it('uses the player heading, including across the angle seam', () => {
    const targeting = new TabTargeting();
    expect(targeting.cycle(player, Math.PI, [enemy(1, 0, -2), enemy(2, 0, 8)], 1)?.id).toBe(2);
    targeting.clear();
    expect(targeting.cycle(player, Math.PI / 2, [enemy(1, 2, 0), enemy(2, -8, 0)], 1)?.id).toBe(2);
  });

  it('cycles backward, wraps, and acquires the best target in either direction', () => {
    const targeting = new TabTargeting();
    const targets = [enemy(1, 0, -2), enemy(2, 0, -4), enemy(3, 0, -6)];
    expect(targeting.cycle(player, 0, targets, -1)?.id).toBe(1);
    expect(targeting.cycle(player, 0, targets, -1)?.id).toBe(3);
    expect(targeting.cycle(player, 0, targets, 1)?.id).toBe(1);
  });

  it('keeps cycling order while enemies move, the player turns, and new enemies arrive', () => {
    const targeting = new TabTargeting();
    targeting.cycle(player, 0, [enemy(1, 0, -2), enemy(2, 0, -4), enemy(3, 0, -6)], 1);
    const moved = [enemy(3, 0, -1), enemy(4, 0, -2), enemy(2, 0, 5), enemy(1, 0, -10)];
    expect(targeting.cycle(player, Math.PI, moved, 1)?.id).toBe(2);
    expect(targeting.cycle(player, Math.PI, moved, 1)?.id).toBe(3);
    expect(targeting.cycle(player, Math.PI, moved, 1)?.id).toBe(4);
    expect(targeting.cycle(player, Math.PI, moved, 1)?.id).toBe(1);
  });

  it('removes invalid candidates and clears a target that dies, despawns, or leaves range', () => {
    const targeting = new TabTargeting();
    const targets = [enemy(1, 0, -2), enemy(2, 0, -4), enemy(3, 0, -6)];
    targeting.cycle(player, 0, targets, 1);
    expect(targeting.cycle(player, 0, [targets[0]!, targets[2]!], 1)?.id).toBe(3);
    expect(targeting.update(player, [targets[0]!])).toBeNull();
    expect(targeting.id).toBeNull();
    targeting.cycle(player, 0, [enemy(1, 0, -TARGET_RANGE)], 1);
    expect(targeting.update(player, [enemy(1, 0, -TARGET_RANGE - 0.01)])).toBeNull();
    expect(targeting.id).toBeNull();
    expect(targeting.cycle(player, 0, [enemy(2, 0, 0, TARGET_RANGE + 1)], 1)).toBeNull();
  });

  it('handles no targets, a single target, equal scores, and an overlapping target', () => {
    const targeting = new TabTargeting();
    expect(targeting.cycle(player, 0, [], 1)).toBeNull();
    expect(targeting.cycle(player, 0, [enemy(1, 0, 0)], 1)?.id).toBe(1);
    expect(targeting.cycle(player, 0, [enemy(1, 0, 0)], -1)?.id).toBe(1);
    targeting.clear();
    expect(targeting.cycle(player, 0, [enemy(3, 0, -2), enemy(2, 0, -2)], 1)?.id).toBe(2);
  });
});
