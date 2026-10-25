import { expect, it } from 'vitest';
import { DEFAULT_WORLD_SEED } from '../src/constants';
import { PROP_KINDS } from '../src/data/props';
import {
  KINGS_ROAD,
  KING_MUSTER,
  KING_APPROACH,
  KING_APPROACH_LINEUPS,
  kingsRoadAt,
  kingsRoadBeat,
  blocksKingsRoad,
} from '../src/world/kings-road';
import { createWildernessTerrain } from '../src/world/terrain';
import { buildWilderness } from '../src/world/wilderness';
import { CROWNBREAKER_HOLD, HOLLOW_KING_SITE } from '../src/world/hollow-king';
import { buildEncounterSites, encounterColliders } from '../src/world/encounters';
import { buildTestClearing } from '../src/world/clearing';
import { LAKE } from '../src/world/lake';

it.each([1, 1234, DEFAULT_WORLD_SEED])(
  'keeps a gentle continuous route into the muster point in world %i',
  (seed) => {
    const terrain = createWildernessTerrain(seed);
    for (let i = 1; i < KINGS_ROAD.length; i++) {
      const a = KINGS_ROAD[i - 1]!,
        b = KINGS_ROAD[i]!;
      const span = Math.hypot(b.x - a.x, b.z - a.z);
      for (let t = 0; t < 1; t += 0.05) {
        const x = a.x + (b.x - a.x) * t,
          z = a.z + (b.z - a.z) * t;
        const step = 0.2;
        const dx = ((b.x - a.x) / span) * step,
          dz = ((b.z - a.z) / span) * step;
        expect(
          Math.abs(terrain.heightAt(x + dx, z + dz) - terrain.heightAt(x, z)) / step,
        ).toBeLessThan(0.4);
      }
    }
    expect(kingsRoadBeat(187, 161)?.title).toBe('The King’s Road');
    expect(kingsRoadBeat(208, 181)?.title).toBe('The Broken Watch');
    expect(kingsRoadBeat(KING_MUSTER.x, KING_MUSTER.z)?.title).toBe('The Last Muster');
    expect(
      Math.hypot(KING_MUSTER.x - CROWNBREAKER_HOLD.x, KING_MUSTER.z - CROWNBREAKER_HOLD.z),
    ).toBeGreaterThan(HOLLOW_KING_SITE.noticeRadius! + 5);
  },
);
it('clears the road without renumbering scenery and adds distinct bounded encounters', () => {
  const terrain = createWildernessTerrain(DEFAULT_WORLD_SEED),
    wilderness = buildWilderness(DEFAULT_WORLD_SEED, terrain),
    clearing = buildTestClearing(DEFAULT_WORLD_SEED, terrain);
  expect(
    wilderness.props.filter((p) =>
      blocksKingsRoad(p.x, p.z, PROP_KINDS[p.kind].colliderRadius * p.scale),
    ),
  ).toHaveLength(0);
  expect(kingsRoadAt(0, 0)).toBeNull();
  const sites = buildEncounterSites(
    DEFAULT_WORLD_SEED,
    terrain,
    [...clearing.colliders, ...wilderness.siteColliders],
    clearing.water,
    LAKE,
  );
  expect(sites.filter((s) => s.strongholdStage).map((s) => s.id)).toEqual([501, 502]);
  expect(KING_APPROACH_LINEUPS.scouts).toEqual(['rogue', 'minion']);
  expect(KING_APPROACH_LINEUPS.watch).toEqual(['sentinel', 'warrior', 'mage']);
  expect(new Set(sites.map((s) => s.id)).size).toBe(sites.length);
  expect(encounterColliders(KING_APPROACH, terrain).length).toBeGreaterThan(0);
});

it('wakes both approach lineups independently of normal encounter slots', async () => {
  const { WorldSimulation } = await import('../src/sim/world-sim');
  const sim = new WorldSimulation({
    seed: DEFAULT_WORLD_SEED,
    forestEncounters: true,
    raidIntervalSeconds: Infinity,
    hungerEmptyAfterSeconds: Infinity,
  });
  try {
    sim.addPlayer(1, undefined, 'visitor');
    sim.placePlayer(1, { x: 187, y: sim.collision.terrain.heightAt(187, 161), z: 161 }, 0);
    for (let i = 0; i < 30; i++) sim.step(i * 50);
    const kinds = sim.raidersList().map((r) => r.kind);
    for (const kind of ['rogue', 'minion', 'sentinel', 'warrior', 'mage'])
      expect(kinds).toContain(kind);
  } finally {
    sim.dispose();
  }
});
