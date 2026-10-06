import { describe, expect, it } from 'vitest';

import { SEASONS, type SeasonId, type SeasonMix } from '@acorn/shared';

import {
  BackdropWorld,
  FALL_COUNTS,
  PAINTING_HEIGHT,
  PAINTING_WIDTH,
  SPOTS,
  fallerX,
  glintBrightness,
  puffLook,
  rippleStrength,
  weatherFor,
  windowGlow,
} from '../src/backdrop/backdrop-world';
import { fallFor, type FallKind } from '../src/art/season-fall';

const WATER = Array.from({ length: 60 }, (_, i) => ({ x: 600 + i * 12, y: 700 + (i % 7) * 20 }));

function inSeason(season: SeasonId): SeasonMix {
  return { from: season, to: season, amount: 0 };
}

function worldIn(season: SeasonId, reducedMotion = false): BackdropWorld {
  return new BackdropWorld({ mix: inSeason(season), water: WATER, reducedMotion });
}

function running(world: BackdropWorld, seconds: number): void {
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.05) world.step(0.05);
}

function showing(world: BackdropWorld, kind: FallKind): number {
  return world.fallers.filter((faller) => faller.kind === kind && world.showing(faller)).length;
}

describe('what falls in each season', () => {
  const expected: Record<SeasonId, FallKind> = {
    spring: 'petals',
    summer: 'pollen',
    autumn: 'leaves',
    winter: 'snow',
  };

  for (const season of SEASONS) {
    it(`has ${expected[season]} in the air in ${season}, and nothing else`, () => {
      const world = worldIn(season);
      for (const kind of Object.keys(FALL_COUNTS) as FallKind[]) {
        if (kind === expected[season]) expect(showing(world, kind)).toBeGreaterThan(10);
        else expect(showing(world, kind)).toBe(0);
      }
    });
  }

  it('brings the next season’s kind in gradually as the season turns', () => {
    const early = new BackdropWorld({
      mix: { from: 'autumn', to: 'winter', amount: 0.2 },
      water: WATER,
      reducedMotion: false,
    });
    const late = new BackdropWorld({
      mix: { from: 'autumn', to: 'winter', amount: 0.8 },
      water: WATER,
      reducedMotion: false,
    });
    expect(showing(early, 'snow')).toBeLessThan(showing(late, 'snow'));
    expect(showing(early, 'leaves')).toBeGreaterThan(showing(late, 'leaves'));
  });

  it('agrees with how much of each there is in the game itself', () => {
    const mix: SeasonMix = { from: 'winter', to: 'spring', amount: 0.5 };
    const world = new BackdropWorld({ mix, water: WATER, reducedMotion: false });
    const amounts = fallFor(mix);
    expect(showing(world, 'snow')).toBe(Math.ceil(FALL_COUNTS.snow * amounts.snow));
    expect(showing(world, 'petals')).toBe(Math.ceil(FALL_COUNTS.petals * amounts.petals));
  });

  it('follows the season when told it has moved on', () => {
    const world = worldIn('autumn');
    expect(showing(world, 'snow')).toBe(0);
    world.setSeason(inSeason('winter'));
    expect(showing(world, 'snow')).toBeGreaterThan(10);
  });

  it('draws fewer when a slow computer asks for less', () => {
    const world = worldIn('winter');
    const full = showing(world, 'snow');
    world.detail = 0.35;
    expect(showing(world, 'snow')).toBeLessThan(full / 2);
  });
});

describe('everything that moves', () => {
  it('keeps falling things in the painting, wrapping round to the top as they land', () => {
    const world = worldIn('winter');
    running(world, 60);
    for (const faller of world.fallers.filter((f) => world.showing(f))) {
      expect(faller.y).toBeGreaterThanOrEqual(-21);
      expect(faller.y).toBeLessThanOrEqual(PAINTING_HEIGHT + 21);
      const x = fallerX(faller, world.time);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(PAINTING_WIDTH);
    }
  });

  it('lets snow fall and pollen rise', () => {
    const snow = worldIn('winter');
    const pollen = worldIn('summer');
    const flake = snow.fallers.find((f) => f.kind === 'snow' && snow.showing(f));
    const mote = pollen.fallers.find((f) => f.kind === 'pollen' && pollen.showing(f));
    expect(flake?.speed).toBeGreaterThan(0);
    expect(mote?.speed).toBeLessThan(0);
  });

  it('keeps the mist inside its bands, drifting rather than jumping', () => {
    const world = worldIn('autumn');
    const before = world.mist.map((patch) => patch.x);
    running(world, 30);
    world.mist.forEach((patch, index) => {
      const band = SPOTS.mist[patch.band];
      expect(patch.x).toBeGreaterThanOrEqual((band?.left ?? 0) - patch.width / 2 - 1);
      expect(patch.x).toBeLessThanOrEqual((band?.right ?? 0) + patch.width / 2 + 1);
      expect(Math.abs(patch.x - (before[index] ?? 0))).toBeLessThan(400);
    });
  });

  it('lets smoke out of the chimney, rise, and fade away without piling up', () => {
    const world = worldIn('autumn');
    expect(world.puffs).toHaveLength(0);
    running(world, 3);
    expect(world.puffs.length).toBeGreaterThan(0);
    for (const puff of world.puffs) expect(puff.x).toBe(SPOTS.chimney.x);
    running(world, 120);
    expect(world.puffs.length).toBeLessThan(40);
    const youngest = world.puffs.reduce((a, b) => (a.age < b.age ? a : b));
    const before = puffLook(youngest);
    youngest.age += 3;
    const later = puffLook(youngest);
    expect(later.y).toBeLessThan(before.y);
    expect(later.radius).toBeGreaterThan(before.radius);
  });

  it('smokes more in the cold than in summer', () => {
    const cold = worldIn('winter');
    const warm = worldIn('summer');
    running(cold, 6);
    running(warm, 6);
    expect(cold.puffs.length).toBeGreaterThan(warm.puffs.length);
  });

  it('never takes a long pause for a long step: a tab left in the background does not fling the leaves', () => {
    const world = worldIn('autumn');
    world.step(60);
    expect(world.time).toBeLessThanOrEqual(0.2);
  });
});

describe('for someone who asked for less motion', () => {
  it('keeps everything still', () => {
    const world = worldIn('autumn', true);
    const before = JSON.stringify([world.mist, world.puffs, world.fallers]);
    running(world, 30);
    expect(world.time).toBe(0);
    expect(JSON.stringify([world.mist, world.puffs, world.fallers])).toBe(before);
  });

  it('has nothing falling', () => {
    for (const season of SEASONS) {
      const world = worldIn(season, true);
      for (const kind of Object.keys(FALL_COUNTS) as FallKind[]) {
        expect(showing(world, kind)).toBe(0);
      }
    }
  });
});

describe('the water', () => {
  it('puts glints and ripples only where there is water', () => {
    const world = worldIn('summer');
    expect(world.glints.length).toBeGreaterThan(0);
    for (const glint of world.glints) {
      expect(glint.x).toBeGreaterThan(590);
      expect(glint.y).toBeGreaterThan(690);
    }
    expect(world.ripples.length).toBeGreaterThan(0);
  });

  it('has none until it knows where the water is, then learns', () => {
    const world = new BackdropWorld({ mix: inSeason('summer'), reducedMotion: false });
    expect(world.glints).toHaveLength(0);
    world.setWater(WATER);
    expect(world.glints.length).toBeGreaterThan(0);
    world.setWater([]);
    expect(world.glints).toHaveLength(0);
  });

  it('twinkles briefly and is dark most of the time', () => {
    const world = worldIn('summer');
    const glint = world.glints[0];
    if (glint === undefined) throw new Error('no glint');
    let bright = 0;
    const steps = 400;
    for (let i = 0; i < steps; i++) {
      const level = glintBrightness(glint, (i / steps) * glint.period);
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(1);
      if (level > 0.3) bright += 1;
    }
    expect(bright).toBeGreaterThan(0);
    expect(bright / steps).toBeLessThan(0.3);
  });

  it('fades a ripple in and out', () => {
    const world = worldIn('summer');
    const ripple = world.ripples[0];
    if (ripple === undefined) throw new Error('no ripple');
    const start = rippleStrength(ripple, -ripple.phase);
    const middle = rippleStrength(ripple, -ripple.phase + ripple.period / 2);
    expect(start).toBeLessThan(0.01);
    expect(middle).toBeGreaterThan(0.99);
  });

  it('is nearly still in winter, when the lake is ice', () => {
    expect(weatherFor(inSeason('winter')).water).toBeLessThan(0.3);
    expect(weatherFor(inSeason('summer')).water).toBe(1);
  });
});

describe('the cabin window', () => {
  it('glows warmly and never goes dark or blows out', () => {
    for (const season of SEASONS) {
      const weather = weatherFor(inSeason(season));
      for (let time = 0; time < 30; time += 0.37) {
        const glow = windowGlow(time, weather);
        expect(glow).toBeGreaterThan(0.5);
        expect(glow).toBeLessThanOrEqual(1.4);
      }
    }
  });

  it('flickers a little instead of holding perfectly steady', () => {
    const weather = weatherFor(inSeason('autumn'));
    const levels = new Set<string>();
    for (let time = 0; time < 5; time += 0.25) levels.add(windowGlow(time, weather).toFixed(3));
    expect(levels.size).toBeGreaterThan(3);
  });
});

describe('the weather between seasons', () => {
  it('eases from one season’s weather to the next', () => {
    const autumn = weatherFor(inSeason('autumn'));
    const winter = weatherFor(inSeason('winter'));
    const middle = weatherFor({ from: 'autumn', to: 'winter', amount: 0.5 });
    expect(middle.smoke).toBeCloseTo((autumn.smoke + winter.smoke) / 2);
    expect(middle.water).toBeCloseTo((autumn.water + winter.water) / 2);
  });
});
