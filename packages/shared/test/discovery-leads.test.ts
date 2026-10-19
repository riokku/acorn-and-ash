import { expect, it } from 'vitest';
import {
  WorldSimulation,
  DEFAULT_WORLD_SEED,
  buildDiscoveryLeads,
  discoveryLeadHint,
  DISCOVERIES,
  createFlatTerrain,
  cylinder,
  encounterColliders,
  type DiscoverySite,
} from '../src/index';
const sites: DiscoverySite[] = [{ ...DISCOVERIES[0]!, x: -95, z: -95 }];
it('creates bounded deterministic cairns with useful directional clues', () => {
  const leads = buildDiscoveryLeads(sites, createFlatTerrain(), [], []);
  expect(leads).toHaveLength(3);
  expect(buildDiscoveryLeads(sites, createFlatTerrain(), [], [])).toEqual(leads);
  for (const lead of leads) {
    expect(lead.hint).toContain('northwest');
    expect(lead.hint).toContain('recipe');
    expect(lead.x - 2.8).toBeCloseTo(lead.markerX);
    expect(lead.z + 2.7).toBeCloseTo(lead.markerZ);
    expect(encounterColliders([lead], createFlatTerrain())).toHaveLength(3);
  }
});
it('skips blocked, flooded and steep locations rather than placing floating landmarks', () => {
  expect(buildDiscoveryLeads(sites, createFlatTerrain(), [cylinder(-70, -70, 100, 2)], [])).toEqual(
    [],
  );
  expect(
    buildDiscoveryLeads(sites, createFlatTerrain(), [], [{ x: -70, z: -70, radius: 100 }]),
  ).toEqual([]);
  expect(buildDiscoveryLeads(sites, { kind: 'slope', heightAt: (x) => x * 3 }, [], [])).toEqual([]);
});
it('gives hints only nearby and stops nudging once the destination is discovered', () => {
  const leads = buildDiscoveryLeads(sites, createFlatTerrain(), [], []);
  const lead = leads[0]!;
  expect(discoveryLeadHint(leads, lead.markerX, lead.markerZ, 0)).toBe(lead.hint);
  expect(discoveryLeadHint(leads, 0, 0, 0)).toBeNull();
  expect(discoveryLeadHint(leads, lead.markerX, lead.markerZ, 1)).toBeNull();
});
it('grounds the existing cairn collision at its actual position on a slope', () => {
  const lead = buildDiscoveryLeads(sites, createFlatTerrain(), [], [])[0]!;
  const terrain = { kind: 'slope', heightAt: (x: number, z: number) => x * 0.1 + z * 0.1 };
  const collisions = encounterColliders([lead], terrain);
  const expected = terrain.heightAt(lead.markerX, lead.markerZ);
  expect(collisions[0]!.shape).toBe('cylinder');
  if (collisions[0]!.shape === 'cylinder') expect(collisions[0]!.baseY).toBeCloseTo(expected, 1);
});

it('places useful leads in the actual default forest without spawning extra encounters', () => {
  const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED });
  try {
    expect(sim.discoveryLeads.length).toBeGreaterThanOrEqual(4);
    expect(sim.discoveryLeads.length).toBeLessThanOrEqual(12);
    expect(new Set(sim.discoveryLeads.map((lead) => lead.discoveryId)).size).toBeGreaterThanOrEqual(
      3,
    );
    expect(sim.encounterSites.some((site) => site.id >= 2000)).toBe(false);
  } finally {
    sim.dispose();
  }
});
