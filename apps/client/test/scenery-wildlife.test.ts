import { describe, expect, it } from 'vitest';
import {
  buildTestClearing,
  DEFAULT_WORLD_SEED,
  isOnLake,
  isOnWater,
  LAKE,
  POND_LEVEL,
} from '@acorn/shared';
import { sceneryWildlifeSpots, type SceneryKind } from '../src/scene/scenery-wildlife';

const pond = buildTestClearing(DEFAULT_WORLD_SEED).water;
const spots = sceneryWildlifeSpots(DEFAULT_WORLD_SEED, pond);
const ofKind = (kind: SceneryKind) => spots.filter((spot) => spot.kind === kind);
const onAnyWater = (x: number, z: number) => isOnWater(pond, x, z) || isOnLake(LAKE, x, z);

describe('scenery wildlife spots', () => {
  it('are the same for everyone in a world, and differ between worlds', () => {
    expect(sceneryWildlifeSpots(DEFAULT_WORLD_SEED, pond)).toEqual(spots);
    expect(sceneryWildlifeSpots(DEFAULT_WORLD_SEED + 1, pond)).not.toEqual(spots);
  });

  it('has some of every kind', () => {
    for (const kind of ['duck', 'frog', 'crow', 'owl'] as const)
      expect(ofKind(kind).length).toBeGreaterThan(0);
  });

  it('puts the ducks on the water, a pair of them on the home pond', () => {
    for (const duck of ofKind('duck')) expect(onAnyWater(duck.x, duck.z)).toBe(true);
    expect(ofKind('duck').filter((duck) => duck.waterLevel === POND_LEVEL)).toHaveLength(2);
  });

  it('sits the frogs on the bank, close to the water but not in it', () => {
    for (const frog of ofKind('frog')) {
      expect(onAnyWater(frog.x, frog.z)).toBe(false);
      const nearEdge = [...pond, ...LAKE.basin].some(
        (circle) => Math.hypot(frog.x - circle.x, frog.z - circle.z) <= circle.radius + 2,
      );
      expect(nearEdge).toBe(true);
    }
  });

  it('keeps crows round the clearing and owls out in the deep woods', () => {
    for (const crow of ofKind('crow')) {
      expect(Math.hypot(crow.x, crow.z)).toBeGreaterThanOrEqual(34);
      expect(Math.hypot(crow.x, crow.z)).toBeLessThanOrEqual(90);
    }
    for (const owl of ofKind('owl')) expect(Math.hypot(owl.x, owl.z)).toBeGreaterThanOrEqual(140);
    for (const bird of [...ofKind('crow'), ...ofKind('owl')])
      expect(onAnyWater(bird.x, bird.z)).toBe(false);
  });
});
