import { describe, expect, it } from 'vitest';

import { PICKUP_REACH, SPAWN_POSITION } from '../src/constants';
import { pickupInReach } from '../src/sim/pickups';
import { AXE_PICKUP_ID, AXE_STUMP, buildTestClearing } from '../src/world/clearing';
import type { PlacedPickup } from '../src/world/clearing';

const nothingTaken = (): boolean => false;

const axe: PlacedPickup = { id: 1, item: 'axe', x: 4, z: 0, y: 0.5 };
const log: PlacedPickup = { id: 2, item: 'log', x: -4, z: 0, y: 0 };

describe('reaching for something', () => {
  it('finds nothing when there is nothing near', () => {
    expect(pickupInReach({ x: 0, y: 0, z: 0 }, [axe, log], nothingTaken)).toBeNull();
  });

  it('finds what you are standing next to', () => {
    const found = pickupInReach({ x: 4, y: 0, z: 0.5 }, [axe, log], nothingTaken);
    expect(found?.id).toBe(axe.id);
  });

  it('ignores height, so a hop does not put it out of reach', () => {
    const found = pickupInReach({ x: 4, y: 1.2, z: 0 }, [axe, log], nothingTaken);
    expect(found?.id).toBe(axe.id);
  });

  it('reaches exactly as far as it says and no further', () => {
    const atOrigin: PlacedPickup = { id: 9, item: 'log', x: 0, z: 0, y: 0 };
    const inside = { x: PICKUP_REACH - 0.01, y: 0, z: 0 };
    const outside = { x: PICKUP_REACH + 0.01, y: 0, z: 0 };
    expect(pickupInReach(inside, [atOrigin], nothingTaken)?.id).toBe(atOrigin.id);
    expect(pickupInReach(outside, [atOrigin], nothingTaken)).toBeNull();
  });

  it('takes the nearer of two', () => {
    const near: PlacedPickup = { id: 7, item: 'log', x: 0.4, z: 0, y: 0 };
    const far: PlacedPickup = { id: 8, item: 'log', x: 1.6, z: 0, y: 0 };
    expect(pickupInReach({ x: 0, y: 0, z: 0 }, [far, near], nothingTaken)?.id).toBe(near.id);
  });

  it('skips one that somebody else already took', () => {
    const taken = (id: number): boolean => id === axe.id;
    expect(pickupInReach({ x: 4, y: 0, z: 0 }, [axe], taken)).toBeNull();
  });
});

describe('the axe in the clearing', () => {
  it('is somewhere you have to walk to, not on top of the spawn point', () => {
    const clearing = buildTestClearing(1234);
    const pickup = clearing.pickups.find((entry) => entry.id === AXE_PICKUP_ID);
    expect(pickup?.item).toBe('axe');
    expect(pickup?.x).toBe(AXE_STUMP.x);
    expect(pickup?.z).toBe(AXE_STUMP.z);
    const fromSpawn = Math.hypot(AXE_STUMP.x - SPAWN_POSITION.x, AXE_STUMP.z - SPAWN_POSITION.z);
    expect(fromSpawn).toBeGreaterThan(10);
  });

  it('is standing in a stump you can see', () => {
    const clearing = buildTestClearing(1234);
    const stump = clearing.props.find((prop) => prop.kind === 'stump');
    expect(stump?.x).toBe(AXE_STUMP.x);
    expect(stump?.z).toBe(AXE_STUMP.z);
  });

  it('is in the same place for every seed, so it can always be found', () => {
    for (const seed of [1, 99, 0x4143_4f52]) {
      const pickup = buildTestClearing(seed).pickups[0];
      expect(pickup?.x).toBe(AXE_STUMP.x);
      expect(pickup?.z).toBe(AXE_STUMP.z);
    }
  });
});
